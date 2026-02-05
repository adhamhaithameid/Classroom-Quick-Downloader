// filepath: cloudflare-worker/src/index.ts
import { renderDashboard, renderLoginPage } from "./dashboard";
import type { Env as WorkerEnv, StatsResponse } from "./types";

// ---------------------------------------------------------------------------
// Session Token Utilities (HMAC-SHA256 based)
// ---------------------------------------------------------------------------

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
const COOKIE_NAME = "cqd_session";

interface SessionPayload {
  ip: string;
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

async function createSessionToken(secret: string, ip: string): Promise<string> {
  const payload: SessionPayload = {
    ip,
    exp: Date.now() + SESSION_DURATION_MS,
    iat: Date.now(),
  };
  
  const payloadB64 = btoa(JSON.stringify(payload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadB64)
  );
  
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${payloadB64}.${sigB64}`;
}

async function verifySessionToken(token: string, secret: string, clientIp: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return false;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const signature = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(payloadB64)
    );
    
    if (!isValid) return false;
    
    const payload: SessionPayload = JSON.parse(atob(payloadB64));
    
    // Check expiration
    if (Date.now() > payload.exp) return false;
    
    // Optional: Check IP binding (disabled for now to allow mobile switching)
    // if (payload.ip !== clientIp) return false;
    
    return true;
  } catch {
    return false;
  }
}
function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf("=");
    if (eqIndex === -1) continue;
    const name = cookie.substring(0, eqIndex);
    const value = cookie.substring(eqIndex + 1);
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

function createSessionCookieHeader(token: string): string {
  // HttpOnly, SameSite=Lax for security (no Secure flag to allow localhost HTTP)
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`;
}

function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// IP Allowlist Check (optional - returns true if no allowlist configured)
// ---------------------------------------------------------------------------

async function isIpAllowed(stub: DurableObjectStub, ip: string): Promise<boolean> {
  try {
    const res = await stub.fetch(new Request("http://internal/auth/check-ip-allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip }),
    }));
    const data = await res.json() as { allowed: boolean };
    return data.allowed !== false; // Allow by default if no response
  } catch {
    return true; // Allow on error to prevent lockout
  }
}

// ---------------------------------------------------------------------------
// Core Helpers
// ---------------------------------------------------------------------------

function getDownloadsStub(env: WorkerEnv): DurableObjectStub {
  const id = env.DOWNLOADS_DO.idFromName("downloads");
  return env.DOWNLOADS_DO.get(id);
}

// --- CORS helpers -----------------------------------------------------------

function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin") || "*";

  // If you want to lock it down later, replace "*" with a whitelist check.
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Secret",
  );
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function withCors(request: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const ch = corsHeaders(request);
  ch.forEach((v, k) => headers.set(k, v));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ---------------------------------------------------------------------------
// Dashboard Login (POST / validates password, sets session cookie)
// ---------------------------------------------------------------------------

async function handleRoot(request: Request, env: WorkerEnv): Promise<Response> {
  const method = request.method.toUpperCase();
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const stub = getDownloadsStub(env);

  // GET: Show login page OR redirect to dashboard if valid session
  if (method === "GET") {
    const sessionToken = getSessionCookie(request);
    if (sessionToken && await verifySessionToken(sessionToken, env.DO_SHARED_SECRET, clientIp)) {
      // Valid session - redirect to dashboard
      return Response.redirect(new URL("/dashboard", request.url).toString(), 302);
    }
    return new Response(renderLoginPage(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // POST: Handle login
  if (method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("multipart/form-data")
    ) {
      return new Response("Unsupported content type", { status: 400 });
    }

    // IP Allowlist check
    const ipAllowed = await isIpAllowed(stub, clientIp);
    if (!ipAllowed) {
      return new Response(
        renderLoginPage("Access denied: your IP is not in the allowlist."),
        { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    // Rate limit check
    const rateLimitReq = new Request(new URL("/auth/login-attempt", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-IP": clientIp },
      body: JSON.stringify({ ip: clientIp, success: false }),
    });

    const form = await request.formData();
    const password = (form.get("password") || "").toString();

    if (!env.DO_SHARED_SECRET) {
      return new Response(
        renderLoginPage("Server misconfigured: DO_SHARED_SECRET missing."),
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    // Validate password
    if (password !== env.DO_SHARED_SECRET) {
      const rateLimitRes = await stub.fetch(rateLimitReq);
      const rateLimitData = await rateLimitRes.json() as {
        allowed: boolean;
        attemptsRemaining?: number;
        blockedForSeconds?: number;
      };

      if (!rateLimitData.allowed) {
        const mins = Math.ceil((rateLimitData.blockedForSeconds || 900) / 60);
        return new Response(
          renderLoginPage(`Too many failed attempts. Please try again in ${mins} minutes.`),
          { status: 429, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }

      const remaining = rateLimitData.attemptsRemaining ?? 4;
      return new Response(
        renderLoginPage(`Invalid password. ${remaining} attempts remaining.`),
        { status: 401, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    // Successful login - clear rate limit and create session
    const successReq = new Request(new URL("/auth/login-attempt", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-IP": clientIp },
      body: JSON.stringify({ ip: clientIp, success: true }),
    });
    await stub.fetch(successReq);

    // Create session token and set cookie
    const sessionToken = await createSessionToken(env.DO_SHARED_SECRET, clientIp);

    // Redirect to dashboard with session cookie
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/dashboard",
        "Set-Cookie": createSessionCookieHeader(sessionToken),
      },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}

// ---------------------------------------------------------------------------
// Dashboard View (requires valid session)
// ---------------------------------------------------------------------------

async function handleDashboard(request: Request, env: WorkerEnv): Promise<Response> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const sessionToken = getSessionCookie(request);

  if (!sessionToken || !await verifySessionToken(sessionToken, env.DO_SHARED_SECRET, clientIp)) {
    // Invalid or missing session - redirect to login
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": clearSessionCookieHeader(),
      },
    });
  }

  const stub = getDownloadsStub(env);
  const url = new URL(request.url);
  url.pathname = "/stats";

  const statsRes = await stub.fetch(url.toString(), { method: "GET" });
  if (!statsRes.ok) {
    const text = await statsRes.text().catch(() => "");
    return new Response(
      `Failed to load stats from Durable Object.\n\n${statsRes.status} ${statsRes.statusText}\n${text}`,
      { status: 500 }
    );
  }

  const stats = (await statsRes.json()) as StatsResponse;
  const html = renderDashboard(stats);

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Logout Handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Danger Password Verification (separate from login password)
// ---------------------------------------------------------------------------

async function handleVerifyDangerPassword(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { password } = await request.json() as { password: string };
    
    if (!password || password !== env.DANGER_PASSWORD) {
      return withCors(request, new Response(
        JSON.stringify({ ok: false, error: "Invalid danger password" }),
        { status: 401, headers: { "content-type": "application/json" } }
      ));
    }

    return withCors(request, new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
  } catch {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "Invalid request body" }),
      { status: 400, headers: { "content-type": "application/json" } }
    ));
  }
}

// ---------------------------------------------------------------------------
// Protected Stats Endpoint (requires session or X-Admin-Secret)
// ---------------------------------------------------------------------------

async function handleProtectedStats(request: Request, env: WorkerEnv): Promise<Response> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const adminSecret = request.headers.get("X-Admin-Secret");
  const sessionToken = getSessionCookie(request);

  // Check X-Admin-Secret header first (for API access)
  const hasValidSecret = adminSecret === env.DO_SHARED_SECRET;
  
  // Check session token (for browser/dashboard access)
  const hasValidSession = sessionToken && 
    await verifySessionToken(sessionToken, env.DO_SHARED_SECRET, clientIp);

  if (!hasValidSecret && !hasValidSession) {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "unauthorized", message: "Valid session or X-Admin-Secret required" }),
      { status: 401, headers: { "content-type": "application/json" } }
    ));
  }

  return proxyToDO(request, env);
}



// ---------------------------------------------------------------------------
// Protected Admin Endpoint (requires session, injects X-Admin-Secret for DO)
// Used by dashboard to call admin endpoints without exposing the secret
// ---------------------------------------------------------------------------

async function handleProtectedAdminEndpoint(request: Request, env: WorkerEnv): Promise<Response> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const adminSecret = request.headers.get("X-Admin-Secret");
  const sessionToken = getSessionCookie(request);

  // Check X-Admin-Secret header first (for direct API access)
  const hasValidSecret = adminSecret === env.DO_SHARED_SECRET;
  
  // Check session token (for browser/dashboard access)
  const hasValidSession = sessionToken && 
    await verifySessionToken(sessionToken, env.DO_SHARED_SECRET, clientIp);

  if (!hasValidSecret && !hasValidSession) {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "unauthorized", message: "Valid session or X-Admin-Secret required" }),
      { status: 401, headers: { "content-type": "application/json" } }
    ));
  }

  // If session-based auth but no secret header, inject the secret for DO
  const stub = getDownloadsStub(env);
  const country = (request.cf as unknown as { country?: string })?.country;
  const headers = new Headers(request.headers);
  
  // CRITICAL: Inject the real admin secret for DO authorization
  if (!hasValidSecret) {
    headers.set("X-Admin-Secret", env.DO_SHARED_SECRET);
  }
  
  if (country) {
    headers.set("X-Geo-Country", country);
  }

  const newReq = new Request(request.url, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  });

  const res = await stub.fetch(newReq);
  return withCors(request, res);
}

// ---------------------------------------------------------------------------
// Proxy to Durable Object
// ---------------------------------------------------------------------------

async function proxyToDO(request: Request, env: WorkerEnv): Promise<Response> {
  const stub = getDownloadsStub(env);
  
  // Extract country from Cloudflare's incoming request properties
  const country = (request.cf as unknown as { country?: string })?.country;
  
  // Create a new request based on the original, but with the added header
  const headers = new Headers(request.headers);
  if (country) {
    headers.set("X-Geo-Country", country);
  }

  // Pass Client IP to DO for rate limiting
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) {
    headers.set("X-Client-IP", clientIp);
  }

  // We need to create a new Request object to modify headers locally before fetching the Stub
  const newReq = new Request(request.url, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  });

  const res = await stub.fetch(newReq);
  return withCors(request, res);
}

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Preflight for all routes
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // Login page
    if (pathname === "/") {
      return handleRoot(request, env);
    }

    // Dashboard (requires session)
    if (pathname === "/dashboard") {
      return handleDashboard(request, env);
    }

    // Logout
    if (pathname === "/logout") {
      return handleLogout(request);
    }

    // Danger password verification
    if (pathname === "/auth/verify-danger") {
      return handleVerifyDangerPassword(request, env);
    }

    // Protected stats endpoint (requires session or X-Admin-Secret)
    if (pathname === "/stats" && request.method === "GET") {
      return handleProtectedStats(request, env);
    }

    // Public endpoints (no auth required)
    if (
      (pathname === "/config" && request.method === "GET") ||
      (pathname === "/health" && request.method === "GET") ||
      (pathname === "/changelog" && request.method === "GET") ||
      (pathname === "/track" && request.method === "POST")
    ) {
      return proxyToDO(request, env);
    }

    // Admin endpoints (require session OR X-Admin-Secret - session injects secret for DO)
    if (
      (pathname === "/admin/changelog" && request.method === "POST") ||
      (pathname === "/debug/flush" && request.method === "POST") ||
      (pathname === "/debug/reset" && request.method === "POST") ||
      pathname === "/admin/force-flush" ||
      pathname === "/admin/cut-power" ||
      pathname === "/admin/restore-power" ||
      pathname === "/admin/full-sync" ||
      pathname === "/admin/update-config" ||
      pathname === "/admin/ip-allowlist"
    ) {
      return handleProtectedAdminEndpoint(request, env);
    }

    // Auth endpoints (internal use)
    if (pathname.startsWith("/auth/")) {
      return proxyToDO(request, env);
    }

    return new Response("Not found (worker)", { status: 404 });
  },
};

export { DownloadsDurable } from "./downloads_do";