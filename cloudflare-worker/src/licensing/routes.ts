/**
 * Licensing HTTP routes (bead 0h4d.2.2).
 *
 * Route patterns mirror the existing worker handlers: JSON bodies, the
 * plain { ok, error } envelope, withCors for browser-facing paths, and the
 * shared admin auth context (session OR X-Admin-Secret). Public
 * validate/activate are license-key-authenticated and rate-limited through
 * the DO's shared per-IP limiter. The webhook receiver returns plain
 * responses (server-to-server; not a CORS surface).
 *
 * Raw license keys may appear ONLY as request bodies. They never appear in
 * responses, error codes, or logs.
 */

import type { Env as WorkerEnv } from "../types";
import {
  activateLicense,
  issueLicense,
  listLicenses,
  processLicenseWebhook,
  revokeLicense,
  validateLicense,
  type LicenseRecord,
  type LicensingD1,
  type ServiceOutcome,
} from "./service";
import { getLicenseProvider } from "./provider";

// ---------------------------------------------------------------------------
// Route classification (used by index.ts wiring + CORS sets)
// ---------------------------------------------------------------------------

export const LICENSE_VALIDATE_PATH = "/license/validate";
export const LICENSE_ACTIVATE_PATH = "/license/activate";
export const LICENSE_WEBHOOK_PATH = "/license/webhook";

export function isLicensePublicRoute(pathname: string): boolean {
  return pathname === LICENSE_VALIDATE_PATH || pathname === LICENSE_ACTIVATE_PATH;
}

export function isLicenseWebhookRoute(pathname: string): boolean {
  return pathname === LICENSE_WEBHOOK_PATH;
}

export function isLicenseAdminRoute(pathname: string): boolean {
  return (
    pathname === "/admin/licenses/issue" ||
    pathname === "/admin/licenses/revoke" ||
    pathname === "/admin/licenses/list"
  );
}

// ---------------------------------------------------------------------------
// Shared helpers injected from index.ts (single source of truth, no cycles)
// ---------------------------------------------------------------------------

export interface LicenseRouteDeps {
  withCors: (request: Request, res: Response, env: WorkerEnv) => Response;
  resolveAuthContext: (
    request: Request,
    env: WorkerEnv,
  ) => Promise<{ hasValidSecret: boolean; hasValidSession: boolean; hasDangerStepUp: boolean }>;
  unauthorized: (request: Request, env: WorkerEnv) => Response;
  csrfAllowed: (request: Request, env: WorkerEnv) => { ok: boolean; code?: string; message?: string };
  getDownloadsStub: (env: WorkerEnv) => DurableObjectStub;
}

function licenseErrorResponse(
  deps: LicenseRouteDeps,
  request: Request,
  env: WorkerEnv,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  const body = { ok: false, error, ...(extra ?? {}) };
  return deps.withCors(
    request,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    env,
  );
}

/** Map service codes onto HTTP statuses for public endpoints. */
function publicErrorStatus(code: string): number {
  switch (code) {
    case "license_key_format_invalid":
    case "install_id_format_invalid":
    case "invalid_json":
      return 400;
    case "license_invalid":
    case "license_expired":
    case "license_inactive":
      return 403;
    case "activation_limit_reached":
      return 409;
    case "rate_limited":
      return 429;
    case "rate_limit_unavailable":
    case "storage_unavailable":
    case "signing_key_unconfigured":
    case "license_provider_unconfigured":
      return 503;
    default:
      return 500;
  }
}

function serviceOutcomeResponse(
  deps: LicenseRouteDeps,
  request: Request,
  env: WorkerEnv,
  outcome: ServiceOutcome,
): Response {
  if (outcome.ok) {
    return deps.withCors(
      request,
      new Response(
        JSON.stringify({
          ok: true,
          status: outcome.status,
          entitlement: outcome.entitlement,
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
      ),
      env,
    );
  }
  const status = publicErrorStatus(outcome.code);
  const extra = outcome.status ? { licenseStatus: outcome.status } : undefined;
  return licenseErrorResponse(deps, request, env, status, outcome.code, extra);
}

// ---------------------------------------------------------------------------
// DO-backed rate limiting (reuses the shared per-IP per-minute limiter)
// ---------------------------------------------------------------------------

type RateCheckResult =
  | { state: "allowed" }
  | { state: "limited"; retryAfterSec?: number }
  | { state: "unavailable" };

async function checkLicenseRateLimit(
  deps: LicenseRouteDeps,
  env: WorkerEnv,
  kind: "validate" | "activate",
  clientIp: string,
): Promise<RateCheckResult> {
  const secret = env.DO_SHARED_SECRET;
  if (!secret) return { state: "unavailable" };
  try {
    const res = await deps.getDownloadsStub(env).fetch(
      new Request("https://do/license/rate-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": secret,
        },
        body: JSON.stringify({ kind, ip: clientIp }),
      }),
    );
    if (!res.ok) return { state: "unavailable" };
    const data = (await res.json()) as { allowed?: unknown; retryAfterSec?: unknown };
    if (typeof data.allowed !== "boolean") return { state: "unavailable" };
    if (!data.allowed) {
      return {
        state: "limited",
        retryAfterSec: typeof data.retryAfterSec === "number" ? data.retryAfterSec : undefined,
      };
    }
    return { state: "allowed" };
  } catch {
    return { state: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// D1 binding access
// ---------------------------------------------------------------------------

function getLicensingDb(env: WorkerEnv): LicensingD1 | null {
  if (!env.SITE_CACHE_DB || typeof env.SITE_CACHE_DB.prepare !== "function") return null;
  return env.SITE_CACHE_DB as unknown as LicensingD1;
}

// ---------------------------------------------------------------------------
// Public endpoints (license-key authenticated)
// ---------------------------------------------------------------------------

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function makePublicLicenseHandler(
  deps: LicenseRouteDeps,
  kind: "validate" | "activate",
): (request: Request, env: WorkerEnv) => Promise<Response> {
  return async (request: Request, env: WorkerEnv): Promise<Response> => {
    if (request.method !== "POST") {
      return licenseErrorResponse(deps, request, env, 405, "method_not_allowed");
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

    const rate = await checkLicenseRateLimit(deps, env, kind, clientIp);
    if (rate.state === "unavailable") {
      return licenseErrorResponse(deps, request, env, 503, "rate_limit_unavailable", {
        retryAfterSec: 30,
      });
    }
    if (rate.state === "limited") {
      return licenseErrorResponse(deps, request, env, 429, "rate_limited", {
        retryAfterSec: rate.retryAfterSec ?? 60,
      });
    }

    const body = await readJsonBody(request);
    const licenseKey = typeof body?.licenseKey === "string" ? body.licenseKey : "";
    if (!body || !licenseKey) {
      return licenseErrorResponse(deps, request, env, 400, "license_key_required");
    }

    const db = getLicensingDb(env);
    if (!db) {
      return licenseErrorResponse(deps, request, env, 503, "storage_unavailable");
    }

    if (kind === "validate") {
      const installId = typeof body.installId === "string" ? body.installId : undefined;
      let outcome: ServiceOutcome;
      try {
        outcome = await validateLicense(env, db, { licenseKey, installId });
      } catch {
        return licenseErrorResponse(deps, request, env, 500, "license_service_failed");
      }
      return serviceOutcomeResponse(deps, request, env, outcome);
    }

    const installId = typeof body.installId === "string" ? body.installId : "";
    if (!installId) {
      return licenseErrorResponse(deps, request, env, 400, "install_id_required");
    }
    let activated: ServiceOutcome;
    try {
      activated = await activateLicense(env, db, { licenseKey, installId });
    } catch {
      return licenseErrorResponse(deps, request, env, 500, "license_service_failed");
    }
    return serviceOutcomeResponse(deps, request, env, activated);
  };
}

// ---------------------------------------------------------------------------
// Webhook receiver (provider server-to-server, HMAC-verified)
// ---------------------------------------------------------------------------

function makeLicenseWebhookHandler(
  deps: LicenseRouteDeps,
): (request: Request, env: WorkerEnv) => Promise<Response> {
  return async (request: Request, env: WorkerEnv): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "method_not_allowed" }),
        { status: 405, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    const provider = getLicenseProvider(env);
    if (!provider) {
      return new Response(
        JSON.stringify({ ok: false, error: "license_provider_unconfigured" }),
        { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    const db = getLicensingDb(env);
    if (!db) {
      return new Response(
        JSON.stringify({ ok: false, error: "storage_unavailable" }),
        { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }

    // Raw body only: the signature covers the exact bytes on the wire.
    const rawBody = await request.text();
    const outcome = await processLicenseWebhook(env, db, provider, rawBody, request.headers);
    return new Response(
      JSON.stringify({ ok: outcome.ok, code: outcome.code }),
      {
        status: outcome.httpStatus,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  };
}

// ---------------------------------------------------------------------------
// Admin endpoints (session OR X-Admin-Secret, mirroring admin console routes)
// ---------------------------------------------------------------------------

function adminOutcomeResponse(
  deps: LicenseRouteDeps,
  request: Request,
  env: WorkerEnv,
  outcome: ServiceOutcome & { licenses?: Omit<LicenseRecord, "key_hash">[] },
): Response {
  if (!outcome.ok) {
    const status =
      outcome.code === "license_not_found" || outcome.code === "license_ref_required"
        ? 404
        : outcome.code === "plan_invalid" || outcome.code === "license_key_format_invalid"
          ? 400
          : 503;
    return licenseErrorResponse(deps, request, env, status, outcome.code);
  }
  return deps.withCors(
    request,
    new Response(
      JSON.stringify({
        ok: true,
        code: outcome.code,
        ...(outcome.record ? { license: outcome.record } : {}),
        ...(outcome.licenses ? { licenses: outcome.licenses } : {}),
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
    ),
    env,
  );
}

function makeLicenseAdminHandler(
  deps: LicenseRouteDeps,
): (request: Request, env: WorkerEnv) => Promise<Response> {
  return async (request: Request, env: WorkerEnv): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    const auth = await deps.resolveAuthContext(request, env);
    if (!auth.hasValidSecret && !auth.hasValidSession) {
      return deps.unauthorized(request, env);
    }

    // Mutations via session cookie need the admin CSRF/origin checks; the
    // literal X-Admin-Secret path (scripts, CI) bypasses browser CSRF.
    if (!auth.hasValidSecret && request.method !== "GET") {
      const csrf = deps.csrfAllowed(request, env);
      if (!csrf.ok) {
        return licenseErrorResponse(deps, request, env, 403, "csrf_validation_failed", {
          code: csrf.code,
        });
      }
    }

    const db = getLicensingDb(env);
    if (!db) {
      return licenseErrorResponse(deps, request, env, 503, "storage_unavailable");
    }

    if (pathname === "/admin/licenses/issue" && request.method === "POST") {
      const body = await readJsonBody(request);
      const licenseKey = typeof body?.licenseKey === "string" ? body.licenseKey : "";
      const plan = typeof body?.plan === "string" ? body.plan : "";
      if (!body || !licenseKey || !plan) {
        return licenseErrorResponse(deps, request, env, 400, "license_issue_input_invalid");
      }
      let outcome: ServiceOutcome;
      try {
        outcome = await issueLicense(env, db, {
          licenseKey,
          plan,
          provider: typeof body.provider === "string" ? body.provider : undefined,
          providerResourceId:
            typeof body.providerResourceId === "string" ? body.providerResourceId : undefined,
          expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : null,
        });
      } catch {
        return licenseErrorResponse(deps, request, env, 500, "license_service_failed");
      }
      return adminOutcomeResponse(deps, request, env, outcome);
    }

    if (pathname === "/admin/licenses/revoke" && request.method === "POST") {
      const body = await readJsonBody(request);
      const licenseRef = typeof body?.licenseRef === "string" ? body.licenseRef : "";
      if (!body || !licenseRef) {
        return licenseErrorResponse(deps, request, env, 400, "license_ref_required");
      }
      let outcome: ServiceOutcome;
      try {
        outcome = await revokeLicense(env, db, { licenseRef });
      } catch {
        return licenseErrorResponse(deps, request, env, 500, "license_service_failed");
      }
      return adminOutcomeResponse(deps, request, env, outcome);
    }

    if (pathname === "/admin/licenses/list" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw ? Number(limitRaw) : undefined;
      let outcome: ServiceOutcome & { licenses?: Omit<LicenseRecord, "key_hash">[] };
      try {
        outcome = await listLicenses(env, db, {
          status,
          limit: typeof limit === "number" && Number.isFinite(limit) ? limit : undefined,
        });
      } catch {
        return licenseErrorResponse(deps, request, env, 500, "license_service_failed");
      }
      return adminOutcomeResponse(deps, request, env, outcome);
    }

    return licenseErrorResponse(deps, request, env, 405, "method_not_allowed");
  };
}

// ---------------------------------------------------------------------------
// Factory used by index.ts
// ---------------------------------------------------------------------------

export function createLicenseRoutes(deps: LicenseRouteDeps) {
  return {
    handleValidate: makePublicLicenseHandler(deps, "validate"),
    handleActivate: makePublicLicenseHandler(deps, "activate"),
    handleWebhook: makeLicenseWebhookHandler(deps),
    handleAdmin: makeLicenseAdminHandler(deps),
  };
}
