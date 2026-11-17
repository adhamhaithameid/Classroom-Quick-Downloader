/**
 * Licensing provider abstraction (bead 0h4d.2.2).
 *
 * The vendor is swappable config: the service talks to `LicenseProvider`
 * only, so moving off Lemon Squeezy (e.g. to Paddle) is a provider
 * implementation + a config flip, not a client update. Cloudflare-only:
 * no external backend sits in this path.
 *
 * Raw license keys flow through provider calls as function arguments only.
 * They must never be logged, stored raw, or echoed in responses — the
 * service hashes them (SHA-256) before any persistence.
 */

// Explicit type import (mirrors event-archive.ts): keeps this module usable
// outside the workers-types global environment (extension test programs).
import type { Env as WorkerEnv } from "../types";
import { timingSafeStringEqual } from "../timing";

/** Authoritative license status as the provider reports it. */
export type ProviderLicenseStatus =
  | "active"
  | "expired"
  | "revoked"
  | "refunded"
  | "unknown";

export interface ProviderValidateResult {
  /** True when the provider call succeeded and the key is currently valid. */
  ok: boolean;
  /** Stable error code. Must never embed raw key material. */
  error?: string;
  status?: ProviderLicenseStatus;
  plan?: string;
  /** Provider-side license identifier (e.g. Lemon Squeezy license_key id). */
  providerResourceId?: string;
  /** Epoch ms when the license expires; null = perpetual. */
  expiresAt?: number | null;
  activationLimit?: number | null;
  activationUsage?: number | null;
}

export interface ProviderIssueResult {
  ok: boolean;
  error?: string;
  providerResourceId?: string;
  expiresAt?: number | null;
}

export interface ProviderRevokeResult {
  ok: boolean;
  error?: string;
}

/** Normalized webhook event after signature verification. */
export interface ProviderWebhookEvent {
  /** Provider event name, e.g. "order_created" | "order_refunded". */
  eventName: string;
  /** Stable event id used for idempotent handling (dedupe). */
  eventId: string;
  orderId?: string;
  /**
   * Raw license key when the provider payload carries one. The service
   * hashes it immediately; it must never be logged or persisted raw.
   */
  licenseKey?: string;
  providerResourceId?: string;
  status?: ProviderLicenseStatus;
  plan?: string;
  expiresAt?: number | null;
}

export interface LicenseProvider {
  readonly name: string;
  /**
   * Provision a license on the provider side. Providers that mint keys at
   * checkout (Lemon Squeezy) return a controlled refusal; issuance for them
   * happens on their checkout + webhook path.
   */
  issue(input: { plan: string; providerResourceId?: string }): Promise<ProviderIssueResult>;
  /** Validate a raw key against the provider (authoritative state refresh). */
  validate(licenseKey: string): Promise<ProviderValidateResult>;
  /** Flip a license to revoked on the provider side (best effort). */
  revoke(providerResourceId: string): Promise<ProviderRevokeResult>;
  /**
   * Verify a webhook request and normalize its payload. Returns null when
   * the signature is missing/invalid (caller must reject with 401).
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<ProviderWebhookEvent | null>;
}

// ---------------------------------------------------------------------------
// Lemon Squeezy implementation
// ---------------------------------------------------------------------------

const LS_DEFAULT_API_BASE = "https://api.lemonsqueezy.com/v1";

/** LS license-key object statuses mapped onto the provider status union. */
function mapLsStatus(raw: unknown): ProviderLicenseStatus {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  if (value === "active" || value === "inactive") return "active";
  if (value === "expired") return "expired";
  if (value === "cancelled") return "revoked";
  if (value === "refunded") return "refunded";
  return "unknown";
}

function mapLsExpiresAt(raw: unknown): number | null {
  if (typeof raw !== "string" || !raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Lemon Squeezy license API provider. Validate/activate authenticate with
 * the license key itself; the admin API key is not required for the
 * license endpoints and is intentionally not read here (no secret sprawl).
 */
export function createLemonSqueezyProvider(env: WorkerEnv): LicenseProvider {
  const apiBase = (env.LS_LICENSE_API_BASE || LS_DEFAULT_API_BASE).replace(/\/+$/, "");

  async function postLicenseApi(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; json: Record<string, unknown> | null }> {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      return { status: res.status, json };
    } catch {
      return { status: 0, json: null };
    }
  }

  function lsLicenseKeyObject(json: Record<string, unknown> | null): Record<string, unknown> | null {
    const meta = json?.meta;
    const obj = json?.license_key ?? (meta && typeof meta === "object" ? (meta as Record<string, unknown>).license_key : undefined);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  }

  return {
    name: "lemonsqueezy",

    async issue() {
      // LS mints keys on its own checkout; we never create keys remotely.
      // Manual issuance registers state in D1 via the admin route instead.
      return { ok: false, error: "provider_managed_issuance" };
    },

    async validate(licenseKey) {
      const { status, json } = await postLicenseApi("/licenses/validate", {
        license_key: licenseKey,
      });
      if (status === 0) {
        return { ok: false, error: "provider_unreachable" };
      }
      if (status === 404) {
        return { ok: false, error: "license_not_found", status: "unknown" };
      }
      if (!json) {
        return { ok: false, error: "provider_bad_response" };
      }
      const licenseObj = lsLicenseKeyObject(json);
      const valid = json.valid === true && status === 200;
      return {
        ok: valid,
        error: valid ? undefined : "license_invalid",
        status: mapLsStatus(licenseObj?.status),
        plan: typeof licenseObj?.plan === "string" ? licenseObj.plan : undefined,
        providerResourceId:
          typeof licenseObj?.id === "number" || typeof licenseObj?.id === "string"
            ? String(licenseObj.id)
            : undefined,
        expiresAt: mapLsExpiresAt(licenseObj?.expires_at),
        activationLimit:
          typeof licenseObj?.activation_limit === "number" ? licenseObj.activation_limit : null,
        activationUsage:
          typeof licenseObj?.activation_usage === "number" ? licenseObj.activation_usage : null,
      };
    },

    async revoke() {
      // LS ties whole-license revocation to refunds from their dashboard;
      // the resulting webhook drives the local state transition. Nothing to
      // call remotely here — report success so the local revoke still lands.
      return { ok: true };
    },

    async verifyWebhook(rawBody, headers) {
      const secret = env.LICENSE_WEBHOOK_SECRET;
      if (!secret) return null;
      const signature = (headers.get("X-Signature") || "").trim();
      if (!signature) return null;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const expected = [...new Uint8Array(mac)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Timing-safe over hex strings; LS signs the raw request body.
      if (!timingSafeStringEqual(signature.toLowerCase(), expected)) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return null;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const body = parsed as Record<string, unknown>;
      const meta = (body.meta && typeof body.meta === "object" ? body.meta : {}) as Record<string, unknown>;
      const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
      const attrs = (data.attributes && typeof data.attributes === "object" ? data.attributes : {}) as Record<string, unknown>;
      const eventName = typeof meta.event_name === "string" ? meta.event_name : "";

      // LS webhook payloads have no dedicated event id; the stable dedupe
      // key is event name + data.id (order/subscription/license resource).
      const resourceId = typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : "";
      const rawLicenseKey =
        typeof attrs.license_key === "string" && attrs.license_key
          ? attrs.license_key
          : typeof (attrs.first_order_item as Record<string, unknown> | undefined)?.license_key === "string"
            ? String((attrs.first_order_item as Record<string, unknown>).license_key)
            : undefined;
      const planName =
        typeof attrs.product_name === "string" && attrs.product_name
          ? attrs.product_name
          : typeof attrs.variant_name === "string"
            ? attrs.variant_name
            : undefined;
      const renewsAt = mapLsExpiresAt(attrs.renews_at);
      const endsAt = mapLsExpiresAt(attrs.ends_at);

      return {
        eventName,
        eventId: `${eventName}:${resourceId}`,
        orderId: resourceId || undefined,
        licenseKey: rawLicenseKey,
        providerResourceId: resourceId || undefined,
        status: mapLsStatus(attrs.status),
        plan: planName,
        expiresAt: endsAt ?? renewsAt,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

/**
 * Test hook registry: lets tests drive the exact service code path with a
 * fake provider selected through the same LICENSE_PROVIDER var (mirrors
 * the __tokenTestInternals precedent). Production never populates this.
 */
const testProviders = new Map<string, LicenseProvider>();

export function registerLicenseProviderForTests(name: string, provider: LicenseProvider): void {
  testProviders.set(name.trim().toLowerCase(), provider);
}

export function clearLicenseProvidersForTests(): void {
  testProviders.clear();
}

/**
 * Resolve the configured provider. Missing config falls back to Lemon
 * Squeezy (the closed decision in bead 0h4d.4). Unknown provider names
 * return null — the service fails closed with a config error instead of
 * silently talking to the wrong vendor. Additional vendors register in
 * this factory (or via the test registry in tests).
 */
export function getLicenseProvider(env: WorkerEnv): LicenseProvider | null {
  const selected = (env.LICENSE_PROVIDER || "lemonsqueezy").trim().toLowerCase();
  const fromRegistry = testProviders.get(selected);
  if (fromRegistry) return fromRegistry;
  if (selected === "lemonsqueezy") {
    return createLemonSqueezyProvider(env);
  }
  return null;
}
