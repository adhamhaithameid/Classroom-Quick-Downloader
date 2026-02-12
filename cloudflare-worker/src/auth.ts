import type { Env } from "./types";

// ---------------------------------------------------------------------------
// Session Token Utilities (HMAC-SHA256 based)
// ---------------------------------------------------------------------------

export const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const COOKIE_NAME = "cqd_session";

export interface SessionPayload {
  ip: string;
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

export function getDashboardSecret(env: Env): string | null {
  return env.DASHBOARD_PASSWORD || env.DO_SHARED_SECRET || null;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}

export async function createSessionToken(secret: string, ip: string): Promise<string> {
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

export async function verifySessionToken(token: string, secret: string, _clientIp: string): Promise<boolean> {
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

export function getSessionCookie(request: Request): string | null {
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

/**
 * Checks if hostname represents a local development environment.
 * SECURITY: Only loopback addresses disable Secure cookie flag.
 * Private IPs (10.*, 192.168.*, etc.) may serve HTTPS and need Secure flag.
 */
export function isLocalEnvironment(hostname: string): boolean {
  if (!hostname) return false;

  // Standard localhost aliases
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  // IPv6 loopback
  if (hostname === '::1' || hostname === '[::1]') return true;

  // Null/any address (dev servers bound to 0.0.0.0)
  if (hostname === '0.0.0.0') return true;

  // IPv4 loopback range (127.0.0.0/8)
  if (hostname.startsWith('127.')) return true;

  // NOTE: Private ranges (10.*, 172.16-31.*, 192.168.*) are NOT included
  // They may serve HTTPS and should retain Secure cookie flag

  return false;
}

export function createSessionCookieHeader(token: string, url?: URL, env?: Env): string {
  // SECURITY: Only disable Secure flag for loopback OR explicit override
  // For production (Cloudflare Workers serve HTTPS), use Secure; SameSite=Strict
  const isLoopback = url && isLocalEnvironment(url.hostname);
  const allowInsecure = env?.ALLOW_INSECURE_COOKIES === 'true';
  const isLocalDev = isLoopback || allowInsecure;

  if (isLocalDev) {
    // Development: SameSite=Lax without Secure for HTTP compatibility
    return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`;
  }
  // Production: Full security with Secure flag
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=3600`;
}

export function clearSessionCookieHeader(url?: URL, env?: Env): string {
  const isLoopback = url && isLocalEnvironment(url.hostname);
  const allowInsecure = env?.ALLOW_INSECURE_COOKIES === 'true';
  const isLocalDev = isLoopback || allowInsecure;

  if (isLocalDev) {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  }
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// IP Allowlist Check (Fail-Safe with Graceful Degradation)
// Returns: { allowed: boolean, error?: string } for proper 503 handling
// ---------------------------------------------------------------------------

export type IpAllowResult = { allowed: boolean; error?: string; serviceDown?: boolean };

export async function isIpAllowed(stub: DurableObjectStub, ip: string, env: Env): Promise<IpAllowResult> {
  try {
    const res = await stub.fetch(new Request("http://internal/auth/check-ip-allowlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": env.DO_SHARED_SECRET,
      },
      body: JSON.stringify({ ip }),
    }));
    const data = await res.json() as { allowed: boolean; enabled?: boolean };

    // If allowlist is not enabled, allow all IPs
    if (data.enabled === false) {
      return { allowed: true };
    }

    return { allowed: data.allowed !== false };
  } catch (err) {
    // Graceful Degradation: Signal service unavailable instead of hard lockout
    // This prevents admins from being locked out during transient DO failures
    console.error("[isIpAllowed] DO check failed:", err);
    return {
      allowed: false,
      serviceDown: true,
      error: "IP allowlist service temporarily unavailable. Please try again shortly."
    };
  }
}

// ---------------------------------------------------------------------------
// Unified Authentication
// ---------------------------------------------------------------------------

export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<{ authorized: boolean; method: 'secret' | 'session' | null }> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const adminSecret = request.headers.get("X-Admin-Secret");
  const sessionToken = getSessionCookie(request);
  const dashboardSecret = getDashboardSecret(env);

  // Check X-Admin-Secret header first (for API access)
  const hasValidSecret = !!adminSecret && timingSafeStringEqual(adminSecret, env.DO_SHARED_SECRET);
  if (hasValidSecret) {
    return { authorized: true, method: 'secret' };
  }

  // Check session token (for browser/dashboard access)
  const hasValidSession = !!dashboardSecret && sessionToken &&
    await verifySessionToken(sessionToken, dashboardSecret, clientIp);

  if (hasValidSession) {
    return { authorized: true, method: 'session' };
  }

  return { authorized: false, method: null };
}
