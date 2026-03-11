// filepath: cloudflare-worker/src/index.ts
import { renderDashboard, renderLoginPage, renderWebsiteConsole } from "./dashboard";
import { renderReleaseNotesPage, sanitizeReleaseEntries } from "./release-notes";
import { resolveOracleEndpoint } from "./oracle-endpoint";
import { timingSafeStringEqual } from "./timing";
import type { Env as WorkerEnv, StatsResponse } from "./types";

type WorkerLogLevel = "info" | "warn" | "error";

function logEvent(level: WorkerLogLevel, message: string, fields?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      level,
      message,
      ts: new Date().toISOString(),
      ...(fields ?? {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// Session Token Utilities (HMAC-SHA256 based)
// ---------------------------------------------------------------------------

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour
const COOKIE_NAME = "cqd_session";
const DANGER_COOKIE_NAME = "cqd_danger_stepup";
const DANGER_SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface SessionPayload {
  ip: string;
  fp?: string;
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

type SessionBindingMode = "off" | "optional" | "strict";
type SessionBindingMismatchInfo = {
  expectedPrefix: string;
  actualPrefix: string;
};
type VerifySessionTokenOptions = {
  onOptionalBindingMismatch?: (info: SessionBindingMismatchInfo) => void | Promise<void>;
};

function getDashboardSecret(env: WorkerEnv): string | null {
  // Security hardening: require a dedicated dashboard secret.
  // Do not silently fall back to DO_SHARED_SECRET.
  return env.DASHBOARD_PASSWORD || null;
}

export async function createSessionToken(secret: string, ip: string): Promise<string> {
  return createSessionTokenWithBinding(secret, ip, "", "off");
}

function normalizeSessionBindingMode(raw?: string): SessionBindingMode {
  const mode = (raw || "").trim().toLowerCase();
  if (mode === "strict") return "strict";
  if (mode === "optional") return "optional";
  return "off";
}

function sessionBindingModeFromEnv(env: WorkerEnv): SessionBindingMode {
  return normalizeSessionBindingMode(env.SESSION_BINDING_MODE);
}

function normalizeIPv4Prefix(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

function normalizeIPv6Prefix(ip: string): string | null {
  let cleaned = ip.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!cleaned.includes(":")) return null;
  if (cleaned.includes("%")) return null;

  let ipv4Tail: [number, number] | null = null;
  if (cleaned.includes(".")) {
    const lastColon = cleaned.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const tail = cleaned.slice(lastColon + 1);
    ipv4Tail = parseIPv4TailToHextets(tail);
    if (!ipv4Tail) return null;
    cleaned = cleaned.slice(0, lastColon);
  }

  const segments = parseIPv6Segments(cleaned, ipv4Tail);
  if (!segments) return null;

  const prefix = segments
    .slice(0, 4)
    .map((segment) => segment.toString(16))
    .join(":");
  return `${prefix}::/64`;
}

function parseIPv4TailToHextets(raw: string): [number, number] | null {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
}

function parseIPv6Segments(raw: string, ipv4Tail: [number, number] | null): number[] | null {
  const pieces = raw.split("::");
  if (pieces.length > 2) return null;

  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const token of part.split(":")) {
      if (!token || !/^[0-9a-f]{1,4}$/.test(token)) return null;
      out.push(parseInt(token, 16));
    }
    return out;
  };

  const left = parsePart(pieces[0]);
  if (!left) return null;
  const right = pieces.length === 2 ? parsePart(pieces[1]) : [];
  if (!right) return null;

  const tailLen = ipv4Tail ? 2 : 0;
  let segments: number[];
  if (pieces.length === 2) {
    const zeros = 8 - (left.length + right.length + tailLen);
    if (zeros < 0) return null;
    segments = [...left, ...Array(zeros).fill(0), ...right];
  } else {
    const expectedLen = ipv4Tail ? 6 : 8;
    if (left.length !== expectedLen) return null;
    segments = [...left];
  }

  if (ipv4Tail) {
    segments.push(ipv4Tail[0], ipv4Tail[1]);
  }
  if (segments.length !== 8) return null;
  return segments;
}

function coarseIPPrefix(ip: string): string {
  const v4 = normalizeIPv4Prefix(ip.trim());
  if (v4) return v4;
  const v6 = normalizeIPv6Prefix(ip.trim());
  if (v6) return v6;
  return "unknown";
}

async function userAgentFingerprintHash(userAgent: string): Promise<string> {
  const value = userAgent.trim();
  if (!value) return "ua:none";
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `ua:${hash.slice(0, 24)}`;
}

async function buildSessionFingerprint(clientIp: string, userAgent: string): Promise<string> {
  const prefix = coarseIPPrefix(clientIp);
  const uaHash = await userAgentFingerprintHash(userAgent);
  return `${prefix}|${uaHash}`;
}

function fingerprintPrefix(value: string): string {
  const [prefix] = value.split("|", 1);
  return prefix || "unknown";
}

async function createSessionTokenWithBinding(
  secret: string,
  ip: string,
  userAgent: string,
  bindingMode: SessionBindingMode,
  ttlMs = SESSION_DURATION_MS,
): Promise<string> {
  const payload: SessionPayload = {
    ip,
    exp: Date.now() + Math.max(1_000, ttlMs),
    iat: Date.now(),
  };
  if (bindingMode !== "off") {
    payload.fp = await buildSessionFingerprint(ip, userAgent);
  }
  
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

async function createDangerStepUpToken(
  secret: string,
  ip: string,
  userAgent: string,
  bindingMode: SessionBindingMode,
): Promise<string> {
  return createSessionTokenWithBinding(secret, ip, userAgent, bindingMode, DANGER_SESSION_DURATION_MS);
}

export async function verifySessionToken(
  token: string,
  secret: string,
  clientIp: string,
  clientUserAgent = "",
  bindingMode: SessionBindingMode = "off",
  options: VerifySessionTokenOptions = {},
): Promise<boolean> {
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

    if (bindingMode === "off") {
      return true;
    }

    if (!payload.fp) {
      return bindingMode !== "strict";
    }

    const expectedFingerprint = await buildSessionFingerprint(clientIp, clientUserAgent);
    if (timingSafeStringEqual(payload.fp, expectedFingerprint)) {
      return true;
    }
    if (bindingMode === "strict") {
      return false;
    }
    const mismatch = {
      expectedPrefix: fingerprintPrefix(payload.fp),
      actualPrefix: fingerprintPrefix(expectedFingerprint),
    };
    logEvent("warn", "session_binding_mismatch_optional_accept", mismatch);
    if (options.onOptionalBindingMismatch) {
      await options.onOptionalBindingMismatch(mismatch);
    }
    return true;
  } catch {
    return false;
  }
}
function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf("=");
    if (eqIndex === -1) continue;
    const key = cookie.substring(0, eqIndex);
    const value = cookie.substring(eqIndex + 1);
    if (key === name) return value;
  }
  return null;
}

function getSessionCookie(request: Request): string | null {
  return getCookieValue(request, COOKIE_NAME);
}

function getDangerStepUpCookie(request: Request): string | null {
  return getCookieValue(request, DANGER_COOKIE_NAME);
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

export function createSessionCookieHeader(token: string, url?: URL, env?: WorkerEnv): string {
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

function createDangerStepUpCookieHeader(token: string, url?: URL, env?: WorkerEnv): string {
  const isLoopback = url && isLocalEnvironment(url.hostname);
  const allowInsecure = env?.ALLOW_INSECURE_COOKIES === "true";
  const isLocalDev = isLoopback || allowInsecure;
  if (isLocalDev) {
    return `${DANGER_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=900`;
  }
  return `${DANGER_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=900`;
}

export function clearSessionCookieHeader(url?: URL, env?: WorkerEnv): string {
  const isLoopback = url && isLocalEnvironment(url.hostname);
  const allowInsecure = env?.ALLOW_INSECURE_COOKIES === 'true';
  const isLocalDev = isLoopback || allowInsecure;
  
  if (isLocalDev) {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  }
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0`;
}

function clearDangerStepUpCookieHeader(url?: URL, env?: WorkerEnv): string {
  const isLoopback = url && isLocalEnvironment(url.hostname);
  const allowInsecure = env?.ALLOW_INSECURE_COOKIES === "true";
  const isLocalDev = isLoopback || allowInsecure;
  if (isLocalDev) {
    return `${DANGER_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  }
  return `${DANGER_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0`;
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

const HTML_SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
} as const;

function withHtmlSecurityHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("content-type", headers.get("content-type") || "text/html; charset=utf-8");
  for (const [key, value] of Object.entries(HTML_SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Core Helpers
// ---------------------------------------------------------------------------

function getDownloadsStub(env: WorkerEnv): DurableObjectStub {
  const id = env.DOWNLOADS_DO.idFromName("downloads");
  return env.DOWNLOADS_DO.get(id);
}

// --- CORS helpers -----------------------------------------------------------

const WEBSITE_EVENTS_SCHEMA_VERSION = "1" as const;
const SITE_SNAPSHOT_KV_KEY = "site:v1:snapshot";
const SITE_CACHE_TTL_SECONDS = 3 * 60 * 60;
const SITE_CACHE_REVALIDATE_AFTER_MS = 3 * 60 * 60 * 1000;
const ORACLE_PULL_HOURS_UTC = new Set([0, 3, 6, 9, 12, 15, 18, 21]);
const ORACLE_EXPORT_HOURS_UTC = new Set([1, 4, 7, 10, 13, 16, 19, 22]);
const ORACLE_PUBLIC_WEBSITE_PATHS = new Set<string>([
  "/api/public/website/snapshot",
  "/api/public/website/overview",
  "/api/public/website/map",
  "/api/public/website/status",
  "/api/public/website/changelog",
  "/api/public/website/uninstall",
  // NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  // "/api/public/website/newsletter/subscribe",
  // NEWSLETTER_CTA_DISABLED_ROLLBACK_END
]);

function isOraclePublicWebsiteRoute(pathname: string): boolean {
  return ORACLE_PUBLIC_WEBSITE_PATHS.has(pathname);
}

function isLegacyChangelogAdminRoute(pathname: string): boolean {
  return (
    pathname === "/admin/changelog" ||
    pathname === "/admin/changelog/parse" ||
    pathname === "/admin/changelog/history" ||
    pathname === "/admin/changelog/rules" ||
    pathname === "/admin/changelog/draft" ||
    pathname === "/admin/changelog/publish" ||
    pathname === "/admin/changelog/mode" ||
    pathname === "/admin/changelog/sync-now"
  );
}

function websiteEventsErrorBody(code: string, message: string, retryable: boolean): Record<string, unknown> {
  return {
    ok: false,
    schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
    error: {
      code,
      message,
      retryable,
    },
  };
}

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  if (!raw) return new Set<string>();
  const cacheKey = raw.trim();
  if (!cacheKey) return new Set<string>();

  const allowed = new Set<string>();
  for (const item of cacheKey.split(",")) {
    const candidate = item.trim();
    if (!candidate) continue;
    try {
      const origin = new URL(candidate).origin;
      if (origin !== "null") {
        allowed.add(origin);
      }
    } catch {
      // Ignore malformed values to fail safely.
    }
  }
  return allowed;
}

function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set<string>();
  const cacheKey = raw.trim().toLowerCase();
  if (!cacheKey) return new Set<string>();
  const emails = new Set<string>();
  for (const item of cacheKey.split(",")) {
    const value = item.trim().toLowerCase();
    if (!value) continue;
    emails.add(value);
  }
  return emails;
}

function isPublicCorsRoute(pathname: string): boolean {
  return (
    pathname === "/config" ||
    pathname === "/health" ||
    pathname === "/pipeline-health" ||
    pathname === "/changelog" ||
    pathname === "/track" ||
    pathname === "/api/site/v1/snapshot" ||
    pathname === "/api/site/v1/privacy" ||
    isOraclePublicWebsiteRoute(pathname)
  );
}

function isAdminCorsRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/") || pathname.startsWith("/debug/");
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/dashboard/website" ||
    pathname === "/logout" ||
    pathname === "/stats" ||
    pathname === "/auth/verify-danger" ||
    isAdminCorsRoute(pathname)
  );
}

function isProtectedCorsRoute(pathname: string): boolean {
  return (
    pathname === "/stats" ||
    pathname === "/auth/verify-danger" ||
    pathname === "/api/public/website/events" ||
    pathname === "/api/site/v1/events" ||
    isAdminCorsRoute(pathname)
  );
}

function isKnownCorsRoute(pathname: string): boolean {
  return isPublicCorsRoute(pathname) || isProtectedCorsRoute(pathname);
}

function isOriginRequiredForPath(pathname: string): boolean {
  return pathname === "/api/public/website/events" || pathname === "/api/site/v1/events";
}

function normalizeRequestOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function normalizeHeaderOrigin(rawOrigin: string | null): string | null {
  if (!rawOrigin) return null;
  try {
    const origin = new URL(rawOrigin).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function normalizeRefererOrigin(rawReferer: string | null): string | null {
  if (!rawReferer) return null;
  try {
    const refererOrigin = new URL(rawReferer).origin;
    return refererOrigin === "null" ? null : refererOrigin;
  } catch {
    return null;
  }
}

function isCloudflareAccessRequired(env: WorkerEnv): boolean {
  if ((env.CLOUDFLARE_ACCESS_REQUIRED || "").trim().toLowerCase() === "true") {
    return true;
  }
  return parseAllowedEmails(env.CLOUDFLARE_ACCESS_EMAIL_ALLOWLIST).size > 0;
}

function hasCloudflareAccessIdentity(request: Request): boolean {
  const email = (request.headers.get("CF-Access-Authenticated-User-Email") || "").trim();
  const jwt = (request.headers.get("CF-Access-Jwt-Assertion") || "").trim();
  return email !== "" || jwt !== "";
}

function isCloudflareAccessIdentityAllowed(request: Request, env: WorkerEnv): boolean {
  if (!isCloudflareAccessRequired(env)) return true;
  if (!hasCloudflareAccessIdentity(request)) return false;
  const allowedEmails = parseAllowedEmails(env.CLOUDFLARE_ACCESS_EMAIL_ALLOWLIST);
  if (allowedEmails.size === 0) {
    return true;
  }
  const email = (request.headers.get("CF-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!email) return false;
  return allowedEmails.has(email);
}

function cloudflareAccessDeniedResponse(request: Request, env: WorkerEnv, pathname: string): Response {
  if (pathname === "/" || pathname === "/dashboard" || pathname === "/dashboard/website" || pathname === "/logout") {
    return new Response("Access denied: Cloudflare Access identity required.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return withCors(
    request,
    new Response(
      JSON.stringify({
        ok: false,
        error: "access_identity_required",
      }),
      { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
    ),
    env,
  );
}

async function recordOptionalSessionBindingMismatch(
  stub: DurableObjectStub,
  requestUrl: string,
  adminSecret: string,
  mismatch: SessionBindingMismatchInfo,
): Promise<void> {
  const auditReq = new Request(new URL("/auth/session-binding-mismatch", requestUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": adminSecret,
    },
    body: JSON.stringify(mismatch),
  });
  const res = await stub.fetch(auditReq);
  if (!res.ok) {
    throw new Error(`session-binding-mismatch endpoint returned ${res.status}`);
  }
}

function makeSessionVerificationOptions(
  env: WorkerEnv,
  request: Request,
  stub: DurableObjectStub,
  bindingMode: SessionBindingMode,
): VerifySessionTokenOptions {
  if (bindingMode !== "optional" || !env.DO_SHARED_SECRET) {
    return {};
  }
  return {
    onOptionalBindingMismatch: async (mismatch) => {
      try {
        await recordOptionalSessionBindingMismatch(stub, request.url, env.DO_SHARED_SECRET, mismatch);
      } catch (error) {
        logEvent("warn", "session_binding_mismatch_audit_failed", {
          error: String(error),
          expectedPrefix: mismatch.expectedPrefix,
          actualPrefix: mismatch.actualPrefix,
        });
      }
    },
  };
}

function isCorsOriginAllowedForPath(request: Request, env: WorkerEnv, pathname: string): boolean {
  const headerOrigin = normalizeHeaderOrigin(request.headers.get("Origin"));
  if (!headerOrigin) return !isOriginRequiredForPath(pathname);
  const requestOrigin = normalizeRequestOrigin(request);
  if (requestOrigin && headerOrigin === requestOrigin) {
    return true;
  }
  if (isAdminCorsRoute(pathname)) {
    const adminAllowlist = parseAllowedOrigins(env.ADMIN_CORS_ALLOWED_ORIGINS);
    return adminAllowlist.has(headerOrigin);
  }
  if (pathname === "/stats" || pathname === "/auth/verify-danger") {
    const protectedAllowlist = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
    return protectedAllowlist.has(headerOrigin);
  }
  if (pathname === "/api/public/website/events" || pathname === "/api/site/v1/events") {
    const websiteIngestAllowlist = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
    return websiteIngestAllowlist.has(headerOrigin);
  }
  return false;
}

function corsAllowedHeadersForPath(pathname: string): string {
  if (
    isOraclePublicWebsiteRoute(pathname) ||
    pathname === "/api/public/website/events" ||
    pathname === "/api/site/v1/events" ||
    pathname === "/api/site/v1/snapshot" ||
    pathname === "/api/site/v1/privacy"
  ) {
    return "Content-Type, X-Requested-With";
  }
  if (isPublicCorsRoute(pathname)) {
    return "Content-Type";
  }
  if (pathname === "/stats" || pathname === "/auth/verify-danger" || isAdminCorsRoute(pathname)) {
    return "Content-Type, X-Admin-Secret, X-Requested-With";
  }
  return "Content-Type";
}

function corsHeaders(request: Request, env: WorkerEnv): Headers {
  const pathname = new URL(request.url).pathname;
  const headerOrigin = normalizeHeaderOrigin(request.headers.get("Origin"));
  const h = new Headers();

  if (isPublicCorsRoute(pathname)) {
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    h.set("Access-Control-Allow-Headers", corsAllowedHeadersForPath(pathname));
    h.set("Access-Control-Max-Age", "86400");
    return h;
  }

  if (!isKnownCorsRoute(pathname)) {
    return h;
  }

  if (headerOrigin && isCorsOriginAllowedForPath(request, env, pathname)) {
    h.set("Access-Control-Allow-Origin", headerOrigin);
    h.set("Vary", "Origin");
  }

  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", corsAllowedHeadersForPath(pathname));
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function withCors(request: Request, res: Response, env: WorkerEnv): Response {
  const headers = new Headers(res.headers);
  const ch = corsHeaders(request, env);
  ch.forEach((v, k) => headers.set(k, v));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function handleOptions(request: Request, env: WorkerEnv): Response {
  const pathname = new URL(request.url).pathname;
  if (!isKnownCorsRoute(pathname)) {
    return new Response("CORS not enabled for route", { status: 403 });
  }
  if (isProtectedCorsRoute(pathname) && !isCorsOriginAllowedForPath(request, env, pathname)) {
    return new Response("CORS origin not allowed", { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

type LoginAllowlistCheck = {
  ok: boolean;
  allowed: boolean;
  enabled: boolean;
  stepUpBypassEnabled: boolean;
};

type DangerStepUpResult = {
  ok: boolean;
  status: number;
  error?: string;
  blockedForSeconds?: number;
};

async function checkLoginAllowlist(
  stub: DurableObjectStub,
  requestUrl: string,
  doSecret: string,
  clientIp: string,
): Promise<LoginAllowlistCheck> {
  const checkReq = new Request(new URL("/auth/check-ip-allowlist", requestUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": doSecret,
    },
    body: JSON.stringify({ ip: clientIp }),
  });
  const checkRes = await stub.fetch(checkReq);
  if (!checkRes.ok) {
    throw new Error(`ip-allowlist endpoint returned ${checkRes.status}`);
  }
  const checkData = await checkRes.json() as {
    allowed?: unknown;
    enabled?: unknown;
    stepUpBypassEnabled?: unknown;
  };
  if (typeof checkData.allowed !== "boolean") {
    throw new Error("ip-allowlist payload missing allowed boolean");
  }
  return {
    ok: true,
    allowed: checkData.allowed,
    enabled: checkData.enabled === true,
    stepUpBypassEnabled: checkData.stepUpBypassEnabled === true,
  };
}

async function verifyDangerStepUpPassword(
  stub: DurableObjectStub,
  env: WorkerEnv,
  clientIp: string,
  password: string,
): Promise<DangerStepUpResult> {
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
    return {
      ok: false,
      status: 503,
      error: "Rate limit service unavailable. Try again later.",
    };
  }

  let rateLimitData: { allowed?: unknown; blockedForSeconds?: unknown };
  try {
    rateLimitData = await rateLimitRes.json() as { allowed?: unknown; blockedForSeconds?: unknown };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Rate limit service unavailable. Try again later.",
    };
  }
  if (rateLimitData.allowed !== true) {
    return {
      ok: false,
      status: 429,
      error: "Too many failed step-up attempts. Try again later.",
      blockedForSeconds:
        typeof rateLimitData.blockedForSeconds === "number" ? rateLimitData.blockedForSeconds : undefined,
    };
  }

  if (!password || !env.DANGER_PASSWORD || !timingSafeStringEqual(password, env.DANGER_PASSWORD)) {
    await stub.fetch(new Request("https://do/auth/login-attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": env.DO_SHARED_SECRET,
      },
      body: JSON.stringify({ ip: `danger:${clientIp}`, success: false }),
    }));
    return { ok: false, status: 401, error: "Invalid danger password" };
  }

  await stub.fetch(new Request("https://do/auth/login-attempt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": env.DO_SHARED_SECRET,
    },
    body: JSON.stringify({ ip: `danger:${clientIp}`, success: true }),
  }));
  return { ok: true, status: 200 };
}

// ---------------------------------------------------------------------------
// Dashboard Login (POST / validates password, sets session cookie)
// ---------------------------------------------------------------------------

async function handleRoot(request: Request, env: WorkerEnv): Promise<Response> {
  const method = request.method.toUpperCase();
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";
  const sessionBindingMode = sessionBindingModeFromEnv(env);
  const stub = getDownloadsStub(env);
  const dashboardSecret = getDashboardSecret(env);
  const sessionVerifyOptions = makeSessionVerificationOptions(env, request, stub, sessionBindingMode);

  // GET: Show login page OR redirect to dashboard if valid session
  if (method === "GET") {
    const sessionToken = getSessionCookie(request);
    if (
      sessionToken &&
      dashboardSecret &&
      await verifySessionToken(sessionToken, dashboardSecret, clientIp, userAgent, sessionBindingMode, sessionVerifyOptions)
    ) {
      // Valid session - redirect to dashboard
      return Response.redirect(new URL("/dashboard", request.url).toString(), 302);
    }
    return new Response(renderLoginPage(), {
      status: 200,
      headers: withHtmlSecurityHeaders(),
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
        { status: 500, headers: withHtmlSecurityHeaders() },
      );
    }
    if (!env.DO_SHARED_SECRET) {
      return new Response(
        renderLoginPage("Server misconfigured: DO_SHARED_SECRET missing."),
        { status: 500, headers: withHtmlSecurityHeaders() },
      );
    }

    const form = await request.formData();
    const password = (form.get("password") || "").toString();

    let allowlistDecision: LoginAllowlistCheck;
    try {
      allowlistDecision = await checkLoginAllowlist(stub, request.url, env.DO_SHARED_SECRET, clientIp);
    } catch {
      return new Response(
        renderLoginPage("Access policy service temporarily unavailable. Please try again shortly."),
        {
          status: 503,
          headers: withHtmlSecurityHeaders({
            "Retry-After": "30",
            "X-Dependency-Error": "durable-object-unavailable",
          }),
        },
      );
    }

    if (!allowlistDecision.allowed) {
      if (!allowlistDecision.stepUpBypassEnabled) {
        return new Response(
          renderLoginPage("This device is not allowlisted. Ask an admin to add your IP before trying again."),
          { status: 403, headers: withHtmlSecurityHeaders() },
        );
      }
      if (!env.DANGER_PASSWORD) {
        return new Response(
          renderLoginPage("Server misconfigured: DANGER_PASSWORD missing."),
          { status: 500, headers: withHtmlSecurityHeaders() },
        );
      }
      const stepUpResult = await verifyDangerStepUpPassword(stub, env, clientIp, password);
      if (!stepUpResult.ok) {
        if (stepUpResult.status === 429) {
          const mins = Math.ceil((stepUpResult.blockedForSeconds || 900) / 60);
          return new Response(
            renderLoginPage(`Too many failed step-up attempts. Please try again in ${mins} minutes.`),
            { status: 429, headers: withHtmlSecurityHeaders() },
          );
        }
        if (stepUpResult.status === 503) {
          return new Response(
            renderLoginPage("Step-up verification service is temporarily unavailable. Please try again."),
            {
              status: 503,
              headers: withHtmlSecurityHeaders({
                "Retry-After": "30",
                "X-Dependency-Error": "durable-object-unavailable",
              }),
            },
          );
        }
        return new Response(
          renderLoginPage("This device is not allowlisted. Enter the admin danger password to continue."),
          { status: 401, headers: withHtmlSecurityHeaders() },
        );
      }
    } else if (!timingSafeStringEqual(password, dashboardSecret)) {
      // Rate limit: record failed attempt
      const rateLimitReq = new Request(new URL("/auth/login-attempt", request.url).toString(), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Admin-Secret": env.DO_SHARED_SECRET,
        },
        body: JSON.stringify({ ip: clientIp, success: false }),
      });
      let rateLimitData: {
        allowed: boolean;
        attemptsRemaining?: number;
        blockedForSeconds?: number;
      };
      try {
        const rateLimitRes = await stub.fetch(rateLimitReq);
        if (!rateLimitRes.ok) {
          throw new Error(`login-attempt endpoint returned ${rateLimitRes.status}`);
        }
        rateLimitData = await rateLimitRes.json() as {
          allowed: boolean;
          attemptsRemaining?: number;
          blockedForSeconds?: number;
        };
        if (typeof rateLimitData.allowed !== "boolean") {
          throw new Error("login-attempt payload missing allowed boolean");
        }
      } catch {
        return new Response(
          renderLoginPage("Login service temporarily unavailable. Please try again shortly."),
          {
            status: 503,
            headers: withHtmlSecurityHeaders({
              "Retry-After": "30",
              "X-Dependency-Error": "durable-object-unavailable",
            }),
          },
        );
      }

      if (!rateLimitData.allowed) {
        const mins = Math.ceil((rateLimitData.blockedForSeconds || 900) / 60);
        return new Response(
          renderLoginPage(`Too many failed attempts. Please try again in ${mins} minutes.`),
          { status: 429, headers: withHtmlSecurityHeaders() }
        );
      }

      const remaining = rateLimitData.attemptsRemaining ?? 4;
      return new Response(
        renderLoginPage(`Invalid password. ${remaining} attempts remaining.`),
        { status: 401, headers: withHtmlSecurityHeaders() }
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
    try {
      const successRes = await stub.fetch(successReq);
      if (!successRes.ok) {
        console.warn("[handleRoot] failed to clear login attempts after successful login", successRes.status);
      }
    } catch (err) {
      console.warn("[handleRoot] failed to clear login attempts after successful login", err);
    }

    // Create session token and set cookie
    const sessionToken = await createSessionTokenWithBinding(dashboardSecret, clientIp, userAgent, sessionBindingMode);

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
  const userAgent = request.headers.get("User-Agent") || "";
  const sessionBindingMode = sessionBindingModeFromEnv(env);
  const sessionToken = getSessionCookie(request);
  const dashboardSecret = getDashboardSecret(env);
  const stub = getDownloadsStub(env);
  const sessionVerifyOptions = makeSessionVerificationOptions(env, request, stub, sessionBindingMode);

  if (
    !dashboardSecret ||
    !sessionToken ||
    !await verifySessionToken(sessionToken, dashboardSecret, clientIp, userAgent, sessionBindingMode, sessionVerifyOptions)
  ) {
    // Invalid or missing session - redirect to login
    const logoutUrl = new URL(request.url);
    return redirectWithCookies("/", [
      clearSessionCookieHeader(logoutUrl, env),
      clearDangerStepUpCookieHeader(logoutUrl, env),
    ]);
  }
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
    headers: withHtmlSecurityHeaders(),
  });
}

async function handleWebsiteConsoleDashboard(request: Request, env: WorkerEnv): Promise<Response> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";
  const sessionBindingMode = sessionBindingModeFromEnv(env);
  const sessionToken = getSessionCookie(request);
  const dashboardSecret = getDashboardSecret(env);
  const stub = getDownloadsStub(env);
  const sessionVerifyOptions = makeSessionVerificationOptions(env, request, stub, sessionBindingMode);

  if (
    !dashboardSecret ||
    !sessionToken ||
    !await verifySessionToken(sessionToken, dashboardSecret, clientIp, userAgent, sessionBindingMode, sessionVerifyOptions)
  ) {
    const logoutUrl = new URL(request.url);
    return redirectWithCookies("/", [
      clearSessionCookieHeader(logoutUrl, env),
      clearDangerStepUpCookieHeader(logoutUrl, env),
    ]);
  }

  return new Response(renderWebsiteConsole(), {
    status: 200,
    headers: withHtmlSecurityHeaders(),
  });
}

// ---------------------------------------------------------------------------
// Logout Handler
// ---------------------------------------------------------------------------

function handleLogout(request: Request, env: WorkerEnv): Response {
  const logoutUrl = new URL(request.url);
  return redirectWithCookies("/", [
    clearSessionCookieHeader(logoutUrl, env),
    clearDangerStepUpCookieHeader(logoutUrl, env),
  ]);
}

// ---------------------------------------------------------------------------
// Danger Password Verification (separate from login password)
// ---------------------------------------------------------------------------

async function handleVerifyDangerPassword(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Require authenticated context (session or X-Admin-Secret)
  const auth = await resolveAuthContext(request, env);
  if (!auth.hasValidSecret && !auth.hasValidSession) {
    return unauthorizedResponse(request, env);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";
  const dashboardSecret = getDashboardSecret(env);
  const sessionBindingMode = sessionBindingModeFromEnv(env);

  const stub = getDownloadsStub(env);

  try {
    const { password } = await request.json() as { password: string };
    const result = await verifyDangerStepUpPassword(stub, env, clientIp, password || "");
    if (!result.ok) {
      if (result.status === 429) {
        return withCors(request, new Response(
          JSON.stringify({
            ok: false,
            error: "Too many failed attempts. Try again later.",
            blockedForSeconds: result.blockedForSeconds,
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ), env);
      }
      return withCors(request, new Response(
        JSON.stringify({ ok: false, error: result.error || "Invalid danger password" }),
        { status: result.status, headers: { "content-type": "application/json" } },
      ), env);
    }

    const responseHeaders = new Headers({ "content-type": "application/json" });
    if (dashboardSecret) {
      const token = await createDangerStepUpToken(
        dashboardSecret,
        clientIp,
        userAgent,
        sessionBindingMode,
      );
      responseHeaders.set(
        "Set-Cookie",
        createDangerStepUpCookieHeader(token, new URL(request.url), env),
      );
    }

    return withCors(request, new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: responseHeaders }
    ), env);
  } catch {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "Invalid request body" }),
      { status: 400, headers: { "content-type": "application/json" } }
    ), env);
  }
}


// ---------------------------------------------------------------------------
// Shared Auth Context (session OR X-Admin-Secret)
// ---------------------------------------------------------------------------

type AuthContext = { hasValidSecret: boolean; hasValidSession: boolean; hasDangerStepUp: boolean };

async function resolveAuthContext(request: Request, env: WorkerEnv): Promise<AuthContext> {
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";
  const adminSecret = request.headers.get("X-Admin-Secret");
  const sessionToken = getSessionCookie(request);
  const dangerToken = getDangerStepUpCookie(request);
  const dashboardSecret = getDashboardSecret(env);
  const bindingMode = sessionBindingModeFromEnv(env);
  const stub = getDownloadsStub(env);
  const sessionVerifyOptions = makeSessionVerificationOptions(env, request, stub, bindingMode);
  const hasValidSecret = !!adminSecret && timingSafeStringEqual(adminSecret, env.DO_SHARED_SECRET);
  const hasValidSession =
    !!dashboardSecret &&
    !!sessionToken &&
    await verifySessionToken(sessionToken, dashboardSecret, clientIp, userAgent, bindingMode, sessionVerifyOptions);
  const hasDangerStepUp =
    hasValidSecret ||
    (
      !!dashboardSecret &&
      !!dangerToken &&
      await verifySessionToken(dangerToken, dashboardSecret, clientIp, userAgent, bindingMode, sessionVerifyOptions)
    );

  return {
    hasValidSecret,
    hasValidSession,
    hasDangerStepUp,
  };
}

function unauthorizedResponse(request: Request, env: WorkerEnv): Response {
  return withCors(request, new Response(
    JSON.stringify({ ok: false, error: "unauthorized", message: "Valid session or X-Admin-Secret required" }),
    { status: 401, headers: { "content-type": "application/json" } }
  ), env);
}

function isMutatingMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD" && upper !== "OPTIONS";
}

function isAdminMutationCsrfAllowed(request: Request, env: WorkerEnv): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  const pathname = new URL(request.url).pathname;
  if (!isAdminCorsRoute(pathname) || !isMutatingMethod(request.method)) {
    return { ok: true };
  }

  const requestedWith = (request.headers.get("X-Requested-With") || "").trim();
  if (requestedWith !== "XMLHttpRequest") {
    return {
      ok: false,
      code: "csrf_missing_x_requested_with",
      message: "Mutating admin requests require X-Requested-With: XMLHttpRequest.",
    };
  }

  const origin = normalizeHeaderOrigin(request.headers.get("Origin"));
  if (origin) {
    if (isCorsOriginAllowedForPath(request, env, pathname)) {
      return { ok: true };
    }
    return {
      ok: false,
      code: "invalid_origin",
      message: "Origin is not allowed for mutating admin requests.",
    };
  }

  const refererOrigin = normalizeRefererOrigin(request.headers.get("Referer"));
  if (!refererOrigin) {
    return {
      ok: false,
      code: "origin_required",
      message: "Origin or Referer is required for mutating admin requests.",
    };
  }

  const requestOrigin = normalizeRequestOrigin(request);
  if (requestOrigin && refererOrigin === requestOrigin) {
    return { ok: true };
  }

  const adminAllowlist = parseAllowedOrigins(env.ADMIN_CORS_ALLOWED_ORIGINS);
  if (adminAllowlist.has(refererOrigin)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "invalid_origin",
    message: "Referer origin is not allowed for mutating admin requests.",
  };
}

// ---------------------------------------------------------------------------
// Protected Stats Endpoint (requires session or X-Admin-Secret)
// ---------------------------------------------------------------------------

async function handleProtectedStats(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await resolveAuthContext(request, env);
  if (!auth.hasValidSecret && !auth.hasValidSession) {
    return unauthorizedResponse(request, env);
  }

  return proxyToDO(request, env);
}

type ConsoleErrorShape = {
  ok: false;
  code: string;
  message: string;
  generatedAtUtc: number;
  details?: Record<string, unknown>;
};

type D1PreparedStatementLike = {
  bind(...args: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ success?: boolean; results?: T[]; error?: string }>;
};

function buildConsoleError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ConsoleErrorShape {
  return {
    ok: false,
    code,
    message,
    generatedAtUtc: Date.now(),
    ...(details ? { details } : {}),
  };
}

function consoleErrorResponse(
  request: Request,
  env: WorkerEnv,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  return withCors(
    request,
    new Response(
      JSON.stringify(buildConsoleError(code, message, details)),
      { status, headers: { "content-type": "application/json; charset=utf-8" } },
    ),
    env,
  );
}

const WEBSITE_CONSOLE_ADMIN_PATHS = new Set<string>([
  "/admin/website/console/summary",
  "/admin/website/console/kv",
  "/admin/website/console/d1/tables",
  "/admin/website/console/d1/query",
  "/admin/website/console/telemetry",
  "/admin/website/console/snapshot/raw",
]);

const WEBSITE_CONSOLE_RAW_PATHS = new Set<string>([
  "/admin/website/console/kv",
  "/admin/website/console/d1/tables",
  "/admin/website/console/d1/query",
  "/admin/website/console/snapshot/raw",
]);

const MAX_D1_QUERY_ROWS = 500;
const D1_BLOCKED_KEYWORDS = /\b(insert|update|delete|alter|drop|attach|detach|pragma|vacuum|replace|create|truncate|reindex)\b/i;

function isWebsiteConsoleAdminPath(pathname: string): boolean {
  return WEBSITE_CONSOLE_ADMIN_PATHS.has(pathname);
}

function requiresWebsiteConsoleStepUp(pathname: string): boolean {
  return WEBSITE_CONSOLE_RAW_PATHS.has(pathname);
}

async function fetchDoWebsiteStatus(env: WorkerEnv): Promise<Record<string, unknown>> {
  const stub = getDownloadsStub(env);
  const res = await stub.fetch(new Request("https://do/admin/website/status", {
    method: "GET",
    headers: {
      "X-Admin-Secret": env.DO_SHARED_SECRET,
    },
  }));

  if (!res.ok) {
    throw new Error(`do_status_http_${res.status}`);
  }
  const payload = await res.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("do_status_invalid_payload");
  }
  return payload as Record<string, unknown>;
}

async function executeD1All(
  env: WorkerEnv,
  query: string,
): Promise<Record<string, unknown>[]> {
  if (!env.SITE_CACHE_DB || typeof env.SITE_CACHE_DB.prepare !== "function") {
    throw new Error("d1_not_configured");
  }
  const prepared = env.SITE_CACHE_DB.prepare(query) as D1PreparedStatementLike;
  const result = await prepared.all<Record<string, unknown>>();
  if (result && result.success === false) {
    throw new Error(result.error || "d1_query_failed");
  }
  return Array.isArray(result?.results) ? result.results : [];
}

function extractTableNames(rows: Record<string, unknown>[]): string[] {
  const names: string[] = [];
  for (const row of rows) {
    const raw = row.name;
    if (typeof raw !== "string") continue;
    const table = raw.trim();
    if (!table || table.startsWith("sqlite_")) continue;
    names.push(table);
  }
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

function extractReferencedTables(query: string): string[] {
  const refs = new Set<string>();
  const regex = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(query)) !== null) {
    refs.add(match[1]);
  }
  return [...refs];
}

async function guardConsoleD1Query(
  env: WorkerEnv,
  queryRaw: string,
  maxRowsRaw: unknown,
): Promise<{ ok: true; query: string; maxRows: number } | { ok: false; code: string; message: string }> {
  const query = queryRaw.trim();
  if (!query) {
    return { ok: false, code: "query_required", message: "SQL query is required." };
  }
  if (query.includes(";")) {
    return { ok: false, code: "query_multiple_statements", message: "Only a single read-only statement is allowed." };
  }
  if (!/^(select|with)\b/i.test(query)) {
    return { ok: false, code: "query_read_only_required", message: "Only SELECT/WITH read-only queries are allowed." };
  }
  if (D1_BLOCKED_KEYWORDS.test(query)) {
    return { ok: false, code: "query_keyword_blocked", message: "Mutating SQL keywords are blocked." };
  }
  if (/\bjoin\b/i.test(query)) {
    return { ok: false, code: "query_join_blocked", message: "Cross-table JOIN queries are blocked in console mode." };
  }
  if (/\bselect\s+\*/i.test(query) && !/\bfrom\s+sqlite_master\b/i.test(query)) {
    return { ok: false, code: "query_wildcard_blocked", message: "SELECT * is blocked. Select explicit columns instead." };
  }

  const tableRows = await executeD1All(
    env,
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC",
  );
  const allowedTables = new Set(extractTableNames(tableRows).map((name) => name.toLowerCase()));
  const refs = extractReferencedTables(query.toLowerCase());
  for (const table of refs) {
    if (!allowedTables.has(table)) {
      return {
        ok: false,
        code: "query_table_not_allowed",
        message: `Table '${table}' is not available in SITE_CACHE_DB.`,
      };
    }
  }

  let maxRows = Number(maxRowsRaw);
  if (!Number.isFinite(maxRows) || maxRows <= 0) maxRows = 200;
  maxRows = Math.min(Math.floor(maxRows), MAX_D1_QUERY_ROWS);
  if (!/\blimit\s+\d+\b/i.test(query)) {
    return { ok: true, query: `${query} LIMIT ${maxRows}`, maxRows };
  }
  return { ok: true, query, maxRows };
}

async function handleWebsiteConsoleAdminEndpoint(
  request: Request,
  env: WorkerEnv,
  auth: AuthContext,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!isWebsiteConsoleAdminPath(pathname)) {
    return null;
  }

  const expectedMethod =
    pathname === "/admin/website/console/d1/query" ? "POST" : "GET";
  if (request.method !== expectedMethod) {
    return consoleErrorResponse(
      request,
      env,
      405,
      "method_not_allowed",
      `Only ${expectedMethod} is allowed for this endpoint.`,
      { path: pathname },
    );
  }

  if (requiresWebsiteConsoleStepUp(pathname) && !auth.hasValidSecret && !auth.hasDangerStepUp) {
    return consoleErrorResponse(
      request,
      env,
      403,
      "step_up_required",
      "Danger step-up is required for raw website console data.",
      { path: pathname },
    );
  }

  try {
    if (pathname === "/admin/website/console/summary") {
      const doStatus = await fetchDoWebsiteStatus(env);
      const cachedRaw = await readSiteSnapshotCache(env);
      let cachedSnapshot: Record<string, unknown> | null = null;
      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && typeof parsed === "object") {
            cachedSnapshot = parsed as Record<string, unknown>;
          }
        } catch {
          cachedSnapshot = null;
        }
      }

      const payload = {
        ok: true,
        code: "ok",
        message: "website_console_summary",
        generatedAtUtc: Date.now(),
        runtime: {
          kvConfigured: !!env.SITE_SNAPSHOT_KV,
          d1Configured: !!env.SITE_CACHE_DB,
          oracleReachable: true,
        },
        snapshot: {
          snapshotId: typeof cachedSnapshot?.snapshotId === "string" ? cachedSnapshot.snapshotId : null,
          generatedAtUtc: typeof cachedSnapshot?.generatedAtUtc === "number" ? cachedSnapshot.generatedAtUtc : null,
          totals: (cachedSnapshot?.totals && typeof cachedSnapshot.totals === "object")
            ? cachedSnapshot.totals
            : { downloads: 0, countries: 0 },
          cacheState: cachedRaw ? "hit" : "miss",
        },
        telemetry: (doStatus.telemetry && typeof doStatus.telemetry === "object") ? doStatus.telemetry : {},
        doWebsite: (doStatus.website && typeof doStatus.website === "object") ? doStatus.website : {},
      };
      return withCors(
        request,
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
        env,
      );
    }

    if (pathname === "/admin/website/console/telemetry") {
      const doStatus = await fetchDoWebsiteStatus(env);
      const payload = {
        ok: true,
        code: "ok",
        message: "website_console_telemetry",
        generatedAtUtc: Date.now(),
        telemetry: (doStatus.telemetry && typeof doStatus.telemetry === "object") ? doStatus.telemetry : {},
        publicSnapshot: (doStatus.publicSnapshot && typeof doStatus.publicSnapshot === "object")
          ? doStatus.publicSnapshot
          : {},
      };
      return withCors(
        request,
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
        env,
      );
    }

    if (pathname === "/admin/website/console/kv") {
      const key = new URL(request.url).searchParams.get("key") || SITE_SNAPSHOT_KV_KEY;
      if (!env.SITE_SNAPSHOT_KV) {
        return consoleErrorResponse(request, env, 503, "kv_not_configured", "SITE_SNAPSHOT_KV binding is not configured.");
      }
      const value = await env.SITE_SNAPSHOT_KV.get(key);
      let parsed: unknown = null;
      if (value) {
        try {
          parsed = JSON.parse(value);
        } catch {
          parsed = null;
        }
      }
      const payload = {
        ok: true,
        code: "ok",
        message: "website_console_kv",
        generatedAtUtc: Date.now(),
        key,
        sizeBytes: value ? value.length : 0,
        exists: value !== null,
        valueRaw: value,
        valueJson: parsed,
      };
      return withCors(
        request,
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
        env,
      );
    }

    if (pathname === "/admin/website/console/d1/tables") {
      const rows = await executeD1All(
        env,
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC",
      );
      const tables = extractTableNames(rows);
      return withCors(
        request,
        new Response(
          JSON.stringify({
            ok: true,
            code: "ok",
            message: "website_console_d1_tables",
            generatedAtUtc: Date.now(),
            tables,
          }),
          { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }

    if (pathname === "/admin/website/console/d1/query") {
      if (request.method !== "POST") {
        return consoleErrorResponse(
          request,
          env,
          405,
          "method_not_allowed",
          "Only POST is allowed for D1 query endpoint.",
        );
      }

      const body = await request.json().catch(() => null) as {
        query?: unknown;
        maxRows?: unknown;
      } | null;
      const query = typeof body?.query === "string" ? body.query : "";
      const guard = await guardConsoleD1Query(env, query, body?.maxRows);
      if (!guard.ok) {
        return consoleErrorResponse(request, env, 400, guard.code, guard.message);
      }
      const rows = await executeD1All(env, guard.query);
      return withCors(
        request,
        new Response(
          JSON.stringify({
            ok: true,
            code: "ok",
            message: "website_console_d1_query",
            generatedAtUtc: Date.now(),
            maxRows: guard.maxRows,
            rowCount: rows.length,
            rows,
            query: guard.query,
          }),
          { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }

    if (pathname === "/admin/website/console/snapshot/raw") {
      const doStatus = await fetchDoWebsiteStatus(env);
      const kvRaw = await readSiteSnapshotCache(env);
      let kvParsed: Record<string, unknown> | null = null;
      if (kvRaw) {
        try {
          const parsed = JSON.parse(kvRaw);
          if (parsed && typeof parsed === "object") kvParsed = parsed as Record<string, unknown>;
        } catch {
          kvParsed = null;
        }
      }
      return withCors(
        request,
        new Response(
          JSON.stringify({
            ok: true,
            code: "ok",
            message: "website_console_snapshot_raw",
            generatedAtUtc: Date.now(),
            kvSnapshotRaw: kvRaw,
            kvSnapshotJson: kvParsed,
            doPublicSnapshot: (doStatus.publicSnapshot && typeof doStatus.publicSnapshot === "object")
              ? doStatus.publicSnapshot
              : null,
          }),
          { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "website_console_failed";
    return consoleErrorResponse(
      request,
      env,
      500,
      "website_console_error",
      "Failed to load website console data.",
      { cause: message },
    );
  }
}



// ---------------------------------------------------------------------------
// Protected Admin Endpoint (requires session, injects X-Admin-Secret for DO)
// Used by dashboard to call admin endpoints without exposing the secret
// ---------------------------------------------------------------------------

async function handleProtectedAdminEndpoint(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await resolveAuthContext(request, env);
  if (!auth.hasValidSecret && !auth.hasValidSession) {
    return unauthorizedResponse(request, env);
  }

  // Session-authenticated mutating admin routes must pass CSRF/origin checks.
  if (!auth.hasValidSecret) {
    const csrf = isAdminMutationCsrfAllowed(request, env);
    if (!csrf.ok) {
      return withCors(
        request,
        new Response(
          JSON.stringify({
            ok: false,
            error: "csrf_validation_failed",
            code: csrf.code || "csrf_invalid",
            message: csrf.message || "Mutating admin request failed CSRF validation.",
          }),
          { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }
  }

  const websiteConsoleResponse = await handleWebsiteConsoleAdminEndpoint(request, env, auth);
  if (websiteConsoleResponse) {
    return websiteConsoleResponse;
  }

  // If session-based auth but no secret header, inject the secret for DO
  const stub = getDownloadsStub(env);
  const country = (request.cf as unknown as { country?: string })?.country;
  const headers = new Headers(request.headers);
  
  // CRITICAL: Inject the real admin secret for DO authorization
  if (!auth.hasValidSecret) {
    headers.set("X-Admin-Secret", env.DO_SHARED_SECRET);
  }
  
  if (country) {
    headers.set("CF-IPCountry", country);
    headers.set("X-Geo-Country", country);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const requestInit: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: headers,
    redirect: request.redirect,
  };
  if (hasBody) {
    requestInit.body = request.body;
    // Node fetch in tests requires duplex for streamed request bodies.
    requestInit.duplex = "half";
  }
  const newReq = new Request(request.url, requestInit);

  try {
    const res = await stub.fetch(newReq);
    return withCors(request, res, env);
  } catch {
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "upstream_unavailable" }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }
    ), env);
  }
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
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const requestInit: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: headers,
    redirect: request.redirect,
  };
  if (hasBody) {
    requestInit.body = request.body;
    requestInit.duplex = "half";
  }
  const newReq = new Request(request.url, requestInit);

  try {
    const res = await stub.fetch(newReq);
    return withCors(request, res, env);
  } catch {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/public/website/events") {
      return withCors(
        request,
        new Response(
          JSON.stringify(
            websiteEventsErrorBody(
              "upstream_unavailable",
              "Telemetry gateway is temporarily unavailable.",
              true,
            ),
          ),
          { status: 502, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }
    return withCors(request, new Response(
      JSON.stringify({ ok: false, error: "upstream_unavailable" }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }
    ), env);
  }
}

async function handleReleaseNotes(request: Request, env: WorkerEnv): Promise<Response> {
  const stub = getDownloadsStub(env);
  let entries: unknown[] = [];

  try {
    const upstream = await stub.fetch(new Request("https://do/changelog", { method: "GET" }));
    if (upstream.ok) {
      const payload = await upstream.json() as { entries?: unknown[] };
      if (Array.isArray(payload.entries)) {
        entries = payload.entries;
      }
    }
  } catch (error) {
    console.warn("[release-notes] Failed to load changelog entries:", error);
  }

  const safeEntries = sanitizeReleaseEntries(entries);
  const html = renderReleaseNotesPage(safeEntries, new URL(request.url).origin);

  return new Response(html, {
    status: 200,
    headers: withHtmlSecurityHeaders({
      "cache-control": "public, max-age=300",
      "referrer-policy": "no-referrer",
    }),
  });
}

async function handleOraclePublicWebsiteProxy(request: Request, env: WorkerEnv): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  let allowedMethods = new Set(["GET"]);
  if (pathname === "/api/public/website/uninstall") {
    allowedMethods = new Set(["GET", "POST"]);
  }
  // NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  // else if (pathname === "/api/public/website/newsletter/subscribe") {
  //   allowedMethods = new Set(["POST"]);
  // }
  // NEWSLETTER_CTA_DISABLED_ROLLBACK_END

  if (!allowedMethods.has(request.method)) {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }

  const resolvedOracleEndpoint = resolveOracleEndpoint(env.ORACLE_ENDPOINT, {
    allowInsecureHttp: env.ALLOW_INSECURE_ORACLE_ENDPOINT === "true",
  });
  if (!resolvedOracleEndpoint.ok) {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: resolvedOracleEndpoint.error }), {
        status: 503,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }

  const targetUrl = `${resolvedOracleEndpoint.baseUrl}${pathname}`;
  const upstreamHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) upstreamHeaders.set("content-type", contentType);
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith) upstreamHeaders.set("x-requested-with", requestedWith);
  const origin = request.headers.get("origin");
  if (origin) upstreamHeaders.set("origin", origin);
  const forwardedFor = request.headers.get("cf-connecting-ip");
  if (forwardedFor) upstreamHeaders.set("x-forwarded-for", forwardedFor);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const requestBody = hasBody ? await request.text() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: requestBody,
      redirect: "follow",
    });
    const body = await upstream.text();
    const responseHeaders = new Headers({
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    });
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);
    return withCors(
      request,
      new Response(body, {
        status: upstream.status,
        headers: responseHeaders,
      }),
      env,
    );
  } catch {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "upstream_unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }
}

async function readSiteSnapshotCache(env: WorkerEnv): Promise<string | null> {
  try {
    if (!env.SITE_SNAPSHOT_KV) return null;
    return await env.SITE_SNAPSHOT_KV.get(SITE_SNAPSHOT_KV_KEY);
  } catch {
    return null;
  }
}

async function writeSiteSnapshotCache(env: WorkerEnv, payloadText: string): Promise<void> {
  try {
    if (!env.SITE_SNAPSHOT_KV) return;
    await env.SITE_SNAPSHOT_KV.put(SITE_SNAPSHOT_KV_KEY, payloadText, {
      expirationTtl: SITE_CACHE_TTL_SECONDS,
    });
  } catch {
    // Best-effort cache write only.
  }
}

function readSiteSnapshotTimestamp(snapshot: Record<string, unknown>): number {
  const cacheWrittenAtUtc = Number(snapshot.cacheWrittenAtUtc);
  if (Number.isFinite(cacheWrittenAtUtc) && cacheWrittenAtUtc > 0) return cacheWrittenAtUtc;

  const generatedAtUtc = Number(snapshot.generatedAtUtc ?? snapshot.generatedAt);
  if (Number.isFinite(generatedAtUtc) && generatedAtUtc > 0) return generatedAtUtc;

  return 0;
}

function isCachedSiteSnapshotStale(cachedRaw: string): boolean {
  try {
    const parsed = JSON.parse(cachedRaw);
    if (!parsed || typeof parsed !== "object") return true;

    const snapshotTs = readSiteSnapshotTimestamp(parsed as Record<string, unknown>);
    if (snapshotTs <= 0) return true;

    return Date.now() - snapshotTs >= SITE_CACHE_REVALIDATE_AFTER_MS;
  } catch {
    return true;
  }
}

function buildSiteSnapshotEnvelope(input: Record<string, unknown>): Record<string, unknown> {
  const now = Date.now();
  const generatedAtUtc = Number(input.generatedAtUtc ?? input.generatedAt) || now;
  const snapshotId = typeof input.snapshotId === "string" && input.snapshotId.trim().length > 0
    ? input.snapshotId
    : `edge-${generatedAtUtc}`;
  return {
    ...input,
    snapshotId,
    generatedAtUtc,
    cacheWrittenAtUtc: now,
    sessionPinned: true,
  };
}

async function fetchOracleSnapshotPayload(env: WorkerEnv): Promise<Record<string, unknown>> {
  const resolvedOracleEndpoint = resolveOracleEndpoint(env.ORACLE_ENDPOINT, {
    allowInsecureHttp: env.ALLOW_INSECURE_ORACLE_ENDPOINT === "true",
  });
  if (!resolvedOracleEndpoint.ok) {
    throw new Error(resolvedOracleEndpoint.message);
  }

  const upstream = await fetch(`${resolvedOracleEndpoint.baseUrl}/api/public/website/snapshot`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    redirect: "follow",
  });
  if (!upstream.ok) {
    throw new Error(`oracle_http_${upstream.status}`);
  }
  const payload = await upstream.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("oracle_invalid_snapshot");
  }
  return payload as Record<string, unknown>;
}

async function handleSiteV1Snapshot(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "GET") {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }

  const cachedRaw = await readSiteSnapshotCache(env);
  if (cachedRaw) {
    if (!isCachedSiteSnapshotStale(cachedRaw)) {
      return withCors(
        request,
        new Response(cachedRaw, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=120, s-maxage=300",
            "x-site-cache": "hit",
          },
        }),
        env,
      );
    }

    try {
      const refreshedSnapshot = await fetchOracleSnapshotPayload(env);
      const refreshedPayloadText = JSON.stringify(buildSiteSnapshotEnvelope(refreshedSnapshot));
      await writeSiteSnapshotCache(env, refreshedPayloadText);
      return withCors(
        request,
        new Response(refreshedPayloadText, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=120, s-maxage=300",
            "x-site-cache": "revalidated",
          },
        }),
        env,
      );
    } catch {
      return withCors(
        request,
        new Response(cachedRaw, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=120, s-maxage=300",
            "x-site-cache": "stale",
          },
        }),
        env,
      );
    }
  }

  try {
    const snapshot = await fetchOracleSnapshotPayload(env);
    const enveloped = buildSiteSnapshotEnvelope(snapshot);
    const payloadText = JSON.stringify(enveloped);
    await writeSiteSnapshotCache(env, payloadText);
    return withCors(
      request,
      new Response(payloadText, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=120, s-maxage=300",
          "x-site-cache": "miss",
        },
      }),
      env,
    );
  } catch {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "upstream_unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }
}

async function handleSiteV1Privacy(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "GET") {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }

  try {
    const snapshot = await fetchOracleSnapshotPayload(env);
    const privacy = (snapshot.privacy && typeof snapshot.privacy === "object")
      ? snapshot.privacy
      : {
          headline: "Privacy-first by design",
          summary: "Classroom Quick Downloader keeps telemetry minimal and avoids raw IP storage in public payloads.",
        };
    const payload = {
      ok: true,
      schemaVersion: "1",
      generatedAtUtc: Date.now(),
      sessionPinned: true,
      privacy,
    };
    return withCors(
      request,
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=120, s-maxage=300",
        },
      }),
      env,
    );
  } catch {
    return withCors(
      request,
      new Response(JSON.stringify({ ok: false, error: "upstream_unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
      env,
    );
  }
}

async function handleSiteV1Events(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return withCors(
      request,
      new Response(
        JSON.stringify(
          websiteEventsErrorBody(
            "method_not_allowed",
            "Only POST is allowed for this endpoint.",
            false,
          ),
        ),
        { status: 405, headers: { "content-type": "application/json; charset=utf-8" } },
      ),
      env,
    );
  }

  const body = await request.text();
  const proxied = new Request(new URL("/api/public/website/events", request.url).toString(), {
    method: "POST",
    headers: new Headers(request.headers),
    body,
  });
  return proxyToDO(proxied, env);
}

function currentHourUtc(ts = Date.now()): number {
  return new Date(ts).getUTCHours();
}

async function refreshSiteSnapshotCacheFromOracle(env: WorkerEnv): Promise<void> {
  try {
    const snapshot = await fetchOracleSnapshotPayload(env);
    const payloadText = JSON.stringify(buildSiteSnapshotEnvelope(snapshot));
    await writeSiteSnapshotCache(env, payloadText);
  } catch {
    // Best effort. Failures are surfaced through existing health endpoints.
  }
}

async function flushWebsiteTelemetryViaDo(env: WorkerEnv): Promise<void> {
  try {
    if (!env.DO_SHARED_SECRET) return;
    const stub = getDownloadsStub(env);
    await stub.fetch(
      new Request("https://do/admin/website/flush-now", {
        method: "POST",
        headers: {
          "x-admin-secret": env.DO_SHARED_SECRET,
          "content-type": "application/json; charset=utf-8",
        },
      }),
    );
  } catch {
    // Best effort. DO keeps retry semantics internally.
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Preflight for all routes
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    const enforceProtectedCors =
      !(
        (pathname === "/api/public/website/events" && request.method !== "POST") ||
        (pathname === "/api/site/v1/events" && request.method !== "POST")
      );
    if (
      isProtectedCorsRoute(pathname) &&
      enforceProtectedCors &&
      !isCorsOriginAllowedForPath(request, env, pathname)
    ) {
      if (pathname === "/api/public/website/events" || pathname === "/api/site/v1/events") {
        const hasOrigin = normalizeHeaderOrigin(request.headers.get("Origin")) !== null;
        const errorCode = hasOrigin ? "cors_origin_not_allowed" : "origin_required";
        const errorMessage = hasOrigin
          ? "Origin is not allowed for this endpoint."
          : "Origin header is required for this endpoint.";
        return withCors(
          request,
          new Response(
            JSON.stringify(
              websiteEventsErrorBody(
                errorCode,
                errorMessage,
                false,
              ),
            ),
            { status: 403, headers: { "content-type": "application/json" } },
          ),
          env,
        );
      }
      return withCors(
        request,
        new Response(
          JSON.stringify({ ok: false, error: "cors_origin_not_allowed" }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
        env,
      );
    }

    // Optional Cloudflare Access enforcement for dashboard/admin routes.
    if (isDashboardRoute(pathname) && !isCloudflareAccessIdentityAllowed(request, env)) {
      return cloudflareAccessDeniedResponse(request, env, pathname);
    }

    // Login page
    if (pathname === "/") {
      return handleRoot(request, env);
    }

    // Public changelog website
    if (pathname === "/release-notes" && request.method === "GET") {
      return handleReleaseNotes(request, env);
    }

    if (pathname === "/api/public/website/events") {
      if (request.method !== "POST") {
        return withCors(
          request,
          new Response(
            JSON.stringify(
              websiteEventsErrorBody(
                "method_not_allowed",
                "Only POST is allowed for this endpoint.",
                false,
              ),
            ),
            {
            status: 405,
            headers: { "content-type": "application/json; charset=utf-8" },
            },
          ),
          env,
        );
      }
      return proxyToDO(request, env);
    }

    if (pathname === "/api/site/v1/snapshot") {
      return handleSiteV1Snapshot(request, env);
    }
    if (pathname === "/api/public/website/snapshot") {
      return handleSiteV1Snapshot(request, env);
    }

    if (pathname === "/api/site/v1/privacy") {
      return handleSiteV1Privacy(request, env);
    }

    if (pathname === "/api/site/v1/events") {
      return handleSiteV1Events(request, env);
    }

    if (isOraclePublicWebsiteRoute(pathname)) {
      return handleOraclePublicWebsiteProxy(request, env);
    }

    // Dashboard (requires session)
    if (pathname === "/dashboard") {
      return handleDashboard(request, env);
    }
    if (pathname === "/dashboard/website") {
      return handleWebsiteConsoleDashboard(request, env);
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

    // LEGACY_CHANGELOG_DISABLED_START
    // Changelog customization is now manual and source-controlled.
    // Keep legacy Cloudflare admin routes disabled but present for rollback visibility.
    if (isLegacyChangelogAdminRoute(pathname)) {
      return withCors(
        request,
        new Response(
          JSON.stringify({
            ok: false,
            error: "legacy_changelog_disabled",
            message: "Cloudflare changelog customization endpoints are disabled. Use manual/changelog sources.",
          }),
          { status: 410, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
        env,
      );
    }
    // LEGACY_CHANGELOG_DISABLED_END

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
      (pathname === "/admin/changelog" && (request.method === "POST" || request.method === "GET")) ||
      (pathname === "/admin/changelog/parse" && request.method === "POST") ||
      (pathname === "/admin/changelog/history" && request.method === "GET") ||
      (pathname === "/admin/changelog/rules" && request.method === "POST") ||
      (pathname === "/admin/changelog/draft" && request.method === "POST") ||
      (pathname === "/admin/changelog/publish" && request.method === "POST") ||
      (pathname === "/admin/changelog/mode" && request.method === "POST") ||
      (pathname === "/admin/changelog/sync-now" && request.method === "POST") ||
      (pathname === "/debug/flush" && request.method === "POST") ||
      (pathname === "/debug/reset" && request.method === "POST") ||
      pathname === "/admin/force-flush" ||
      pathname === "/admin/cut-power" ||
      pathname === "/admin/restore-power" ||
      pathname === "/admin/full-sync" ||
      pathname === "/admin/update-config" ||
      pathname === "/admin/ip-allowlist" ||
      pathname === "/admin/website/status" ||
      pathname === "/admin/website/flush-now" ||
      pathname === "/admin/website/replay-dlq" ||
      pathname === "/admin/website/override" ||
      pathname === "/admin/website/refresh-toggle" ||
      pathname === "/admin/website/console/summary" ||
      pathname === "/admin/website/console/kv" ||
      pathname === "/admin/website/console/d1/tables" ||
      pathname === "/admin/website/console/d1/query" ||
      pathname === "/admin/website/console/telemetry" ||
      pathname === "/admin/website/console/snapshot/raw"
    ) {
      return handleProtectedAdminEndpoint(request, env);
    }

    return new Response("Not found (worker)", { status: 404 });
  },
  async scheduled(controller: ScheduledController, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    const now = controller.scheduledTime || Date.now();
    const hour = currentHourUtc(now);

    if (ORACLE_PULL_HOURS_UTC.has(hour)) {
      await refreshSiteSnapshotCacheFromOracle(env);
    }

    if (ORACLE_EXPORT_HOURS_UTC.has(hour)) {
      await flushWebsiteTelemetryViaDo(env);
    }
  },
};

export { DownloadsDurable } from "./downloads_do";
