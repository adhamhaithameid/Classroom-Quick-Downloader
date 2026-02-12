// filepath: cloudflare-worker/src/index.ts
import { renderDashboard, renderLoginPage } from "./dashboard";
import type { Env as WorkerEnv, StatsResponse } from "./types";
import {
  SESSION_DURATION_MS,
  COOKIE_NAME,
  SessionPayload,
  getDashboardSecret,
  timingSafeStringEqual,
  createSessionToken,
  verifySessionToken,
  getSessionCookie,
  isLocalEnvironment,
  createSessionCookieHeader,
  clearSessionCookieHeader,
  isIpAllowed,
  authenticateRequest
} from "./auth";

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
  const dashboardSecret = getDashboardSecret(env);

  // GET: Show login page OR redirect to dashboard if valid session
  if (method === "GET") {
    const sessionToken = getSessionCookie(request);
    if (sessionToken && dashboardSecret && await verifySessionToken(sessionToken, dashboardSecret, clientIp)) {
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

    if (!dashboardSecret) {
      return new Response(
        renderLoginPage("Server misconfigured: DASHBOARD_PASSWORD missing."),
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    if (!env.DO_SHARED_SECRET) {
      return new Response(
        renderLoginPage("Server misconfigured: DO_SHARED_SECRET missing."),
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    // IP Allowlist check (Fail-Safe with Graceful Degradation)
    const ipCheckResult = await isIpAllowed(stub, clientIp, env);
    
    // Handle service degradation: return 503 instead of hard lockout
    if (ipCheckResult.serviceDown) {
      return new Response(
        renderLoginPage(ipCheckResult.error || "Service temporarily unavailable. Please try again."),
        { 
          status: 503, 
          headers: { 
            "content-type": "text/html; charset=utf-8",
            "Retry-After": "30",
            "X-Dependency-Error": "durable-object-unavailable"
          } 
        }
      );
    }
    
    // Handle explicit deny (allowlist enabled and IP not in list)
    if (!ipCheckResult.allowed) {
      return new Response(
        renderLoginPage("Access denied: your IP is not in the allowlist."),
        { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    // Rate limit check
    const rateLimitReq = new Request(new URL("/auth/login-attempt", request.url).toString(), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Secret": env.DO_SHARED_SECRET,
      },
      body: JSON.stringify({ ip: clientIp, success: false }),
    });

    const form = await request.formData();
    const password = (form.get("password") || "").toString();

    // Validate password
    if (password !== dashboardSecret) {
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
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Secret": env.DO_SHARED_SECRET,
      },
      body: JSON.stringify({ ip: clientIp, success: true }),
    });
    await stub.fetch(successReq);

    // Create session token and set cookie
    const sessionToken = await createSessionToken(dashboardSecret, clientIp);

    // Redirect to dashboard with session cookie
    const loginUrl = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/dashboard",
        "Set-Cookie": createSessionCookieHeader(sessionToken, loginUrl, env),
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
  const dashboardSecret = getDashboardSecret(env);

  if (!dashboardSecret || !sessionToken || !await verifySessionToken(sessionToken, dashboardSecret, clientIp)) {
    // Invalid or missing session - redirect to login
    const logoutUrl = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": clearSessionCookieHeader(logoutUrl, env),
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

function handleLogout(request: Request, env: WorkerEnv): Response {
  const logoutUrl = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": clearSessionCookieHeader(logoutUrl, env),
    },
  });
}

// ---------------------------------------------------------------------------
// Danger Password Verification (separate from login password)
// ---------------------------------------------------------------------------

async function handleVerifyDangerPassword(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

  // Rate limit check via DO (reuses login attempt tracking with "danger:" prefix)
  const stub = getDownloadsStub(env);
  
  // First check if this IP is rate limited for danger password attempts
  const rateLimitReq = new Request("https://do/auth/login-attempt", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Admin-Secret": env.DO_SHARED_SECRET,
    },
    body: JSON.stringify({ ip: `danger:${clientIp}`, success: false, checkOnly: true }),
  });
  const rateLimitRes = await stub.fetch(rateLimitReq);
  if (!rateLimitRes.ok) {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "Rate limit service unavailable. Try again later." }),
      { status: 503, headers: { "content-type": "application/json" } }
    ));
  }
  let rateLimitData: { ok: boolean; allowed: boolean; blockedForSeconds?: number };
  try {
    rateLimitData = await rateLimitRes.json();
  } catch {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "Rate limit service unavailable. Try again later." }),
      { status: 503, headers: { "content-type": "application/json" } }
    ));
  }
  
  if (!rateLimitData.allowed) {
    return withCors(request, new Response(
      JSON.stringify({ 
        ok: false, 
        error: "Too many failed attempts. Try again later.",
        blockedForSeconds: rateLimitData.blockedForSeconds 
      }),
      { status: 429, headers: { "content-type": "application/json" } }
    ));
  }

  try {
    const { password } = await request.json() as { password: string };
    
    if (!password || password !== env.DANGER_PASSWORD) {
      // Record failed attempt
      await stub.fetch(new Request("https://do/auth/login-attempt", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Admin-Secret": env.DO_SHARED_SECRET,
        },
        body: JSON.stringify({ ip: `danger:${clientIp}`, success: false }),
      }));
      
      return withCors(request, new Response(
        JSON.stringify({ ok: false, error: "Invalid danger password" }),
        { status: 401, headers: { "content-type": "application/json" } }
      ));
    }

    // Clear attempts on success
    await stub.fetch(new Request("https://do/auth/login-attempt", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Admin-Secret": env.DO_SHARED_SECRET,
      },
      body: JSON.stringify({ ip: `danger:${clientIp}`, success: true }),
    }));

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
  const { authorized } = await authenticateRequest(request, env);

  if (!authorized) {
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
  const { authorized, method } = await authenticateRequest(request, env);

  if (!authorized) {
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
  if (method === 'session') {
    headers.set("X-Admin-Secret", env.DO_SHARED_SECRET);
  }
  
  if (country) {
    headers.set("CF-IPCountry", country);
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
    headers.set("CF-IPCountry", country);
    headers.set("X-Geo-Country", country);
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
      return handleLogout(request, env);
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
      (pathname === "/pipeline-health" && request.method === "GET") ||
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

    return new Response("Not found (worker)", { status: 404 });
  },
};

export { DownloadsDurable } from "./downloads_do";
