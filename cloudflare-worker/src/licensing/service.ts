/**
 * Licensing service (bead 0h4d.2.2) — D1-backed license state, signed
 * entitlements, and the grace-window math shared by validate/activate.
 *
 * Hard rules enforced here:
 * - Raw license keys are hashed (SHA-256) before persistence; they never
 *   appear in stored rows, responses, error codes, or logs.
 * - Responses carry an opaque `license_ref`, never the raw key.
 * - All secrets come from env; nothing is hardcoded.
 */

import type { Env as WorkerEnv } from "../types";
import {
  getLicenseProvider,
  type LicenseProvider,
  type ProviderLicenseStatus,
  type ProviderWebhookEvent,
  type ProviderValidateResult,
} from "./provider";

// ---------------------------------------------------------------------------
// Config constants
// ---------------------------------------------------------------------------

/** Cached grace window after expiry (provider decision 0h4d.4: 30 days). */
export const LICENSE_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Activation cap per license (opaque install IDs). The research doc sets LS
 * instance limits "generously, e.g. 5 devices"; this constant mirrors that
 * budget locally so the cap holds even when the provider is unreachable.
 */
export const MAX_ACTIVATIONS_PER_LICENSE = 5;

/** Default plan recorded when a provider payload carries none. */
export const DEFAULT_LICENSE_PLAN = "pro";

/** License keys are opaque provider tokens: [A-Za-z0-9] then allowed chars. */
const LICENSE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

/** Install IDs are opaque extension-generated tokens. */
const INSTALL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

// ---------------------------------------------------------------------------
// D1 access (structural — mirrors index.ts's D1PreparedStatementLike)
// ---------------------------------------------------------------------------

export interface LicensingD1PreparedStatement {
  bind(...args: unknown[]): LicensingD1PreparedStatement;
  run(): Promise<{ success?: boolean; meta?: { changes?: number }; error?: string }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ success?: boolean; results?: T[]; error?: string }>;
}

export interface LicensingD1 {
  prepare(query: string): LicensingD1PreparedStatement;
  batch(statements: unknown[]): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Schema (event-archive pattern: idempotent runtime ensure)
// ---------------------------------------------------------------------------

const LICENSES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_resource_id TEXT,
  provider_subscription_id TEXT,
  plan TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
)`;

const ACTIVATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS activations (
  license_id TEXT NOT NULL,
  install_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (license_id, install_id)
)`;

const LICENSE_EVENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS license_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT,
  type TEXT NOT NULL,
  payload_digest TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
)`;

let licensingSchemaReady = false;

/** Test hook: reset the one-shot schema cache between isolated fake DBs. */
export function resetLicensingSchemaCacheForTests(): void {
  licensingSchemaReady = false;
}

export interface SchemaEnsureResult {
  ok: boolean;
  error?: string;
}

/**
 * Create the licensing tables if needed. Best-effort idempotent; mirrors
 * ensureArchiveSchema in event-archive.ts (batched CREATE TABLE IF NOT
 * EXISTS, cached one-shot per isolate).
 */
export async function ensureLicensingSchema(db: LicensingD1): Promise<SchemaEnsureResult> {
  if (licensingSchemaReady) return { ok: true };
  try {
    await db.batch([
      db.prepare(LICENSES_TABLE_SQL),
      db.prepare(ACTIVATIONS_TABLE_SQL),
      db.prepare(LICENSE_EVENTS_TABLE_SQL),
    ]);
    licensingSchemaReady = true;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: trimError("licensing_schema_failed", error) };
  }
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function textToBytes(value: string): Uint8Array<ArrayBuffer> {
  // Cast keeps the BufferSource overloads happy: TextEncoder allocates a
  // plain ArrayBuffer, but its declared type widens to ArrayBufferLike.
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** SHA-256 of a string, hex-encoded. Used for key hashes and dedupe digests. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textToBytes(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash the normalized raw key. This — never the raw key — is the only key
 * material that reaches D1 or any persisted surface.
 */
export async function hashLicenseKey(licenseKey: string): Promise<string | null> {
  const normalized = licenseKey.trim();
  if (!LICENSE_KEY_PATTERN.test(normalized)) return null;
  return sha256Hex(normalized);
}

export function isValidInstallId(installId: string): boolean {
  return INSTALL_ID_PATTERN.test(installId.trim());
}

// ---------------------------------------------------------------------------
// Entitlement signing (HMAC-SHA256 over base64url payload, session-token format)
// ---------------------------------------------------------------------------

/**
 * Signed entitlement payload. Field order is load-bearing: the base64url
 * token signs exactly this serialization, and consumers must verify the
 * token rather than trusting any decoded copy.
 */
export interface EntitlementPayload {
  license_ref: string;
  plan: string;
  /** Epoch ms; null = perpetual license. */
  expiresAt: number | null;
  /** Epoch ms = expiresAt + grace window; null when expiresAt is null. */
  graceUntil: number | null;
  /** Epoch ms when this entitlement token was minted. */
  issuedAt: number;
}

export interface SignedEntitlement {
  /** "<base64url payload>.<base64url HMAC-SHA256(payloadB64)>" */
  entitlement: string;
  payload: EntitlementPayload;
}

export async function signEntitlement(
  signingKey: string,
  payload: EntitlementPayload,
): Promise<SignedEntitlement> {
  const payloadB64 = base64UrlEncode(textToBytes(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, textToBytes(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(mac));
  return { entitlement: `${payloadB64}.${sigB64}`, payload };
}

/** Verify a signed entitlement token; returns null on any failure. */
export async function verifyEntitlement(
  signingKey: string,
  token: string,
): Promise<EntitlementPayload | null> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      textToBytes(signingKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, textToBytes(payloadB64));
    if (!valid) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const payload = parsed as Record<string, unknown>;
    if (typeof payload.license_ref !== "string" || typeof payload.plan !== "string") return null;
    if (payload.expiresAt !== null && typeof payload.expiresAt !== "number") return null;
    if (payload.graceUntil !== null && typeof payload.graceUntil !== "number") return null;
    if (typeof payload.issuedAt !== "number") return null;
    return {
      license_ref: payload.license_ref,
      plan: payload.plan,
      expiresAt: payload.expiresAt as number | null,
      graceUntil: payload.graceUntil as number | null,
      issuedAt: payload.issuedAt as number,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Grace-window math
// ---------------------------------------------------------------------------

export type EffectiveLicenseStatus = "active" | "grace" | "expired" | "invalid";

/**
 * Decide the effective status at `now`:
 * - revoked/refunded rows are invalid immediately;
 * - perpetual licenses (expiresAt null) are active;
 * - within expiry: active;
 * - past expiry but inside the 30-day grace window: grace (still valid);
 * - past grace: expired (fails until an online revalidation renews it).
 */
export function computeEffectiveStatus(
  status: string,
  expiresAt: number | null,
  now: number,
): EffectiveLicenseStatus {
  if (status === "revoked" || status === "refunded") return "invalid";
  if (expiresAt === null || !Number.isFinite(expiresAt)) return "active";
  if (now < expiresAt) return "active";
  if (now < expiresAt + LICENSE_GRACE_PERIOD_MS) return "grace";
  return "expired";
}

// ---------------------------------------------------------------------------
// License records
// ---------------------------------------------------------------------------

export interface LicenseRecord {
  id: string;
  key_hash: string;
  status: "active" | "revoked" | "refunded";
  provider: string;
  /**
   * Provider-side identifier in the "license/order" namespace: the
   * license-key id for validate-self-registered rows, the order id for
   * webhook-registered rows. Refund lookups target this column.
   */
  provider_resource_id: string | null;
  /**
   * Provider-side subscription id (separate namespace from order ids).
   * Subscription events look up and backfill this column.
   */
  provider_subscription_id: string | null;
  plan: string;
  issued_at: number;
  expires_at: number | null;
  revoked_at: number | null;
}

type LicenseRow = {
  id: string;
  key_hash: string;
  status: string;
  provider: string;
  provider_resource_id: string | null;
  provider_subscription_id: string | null;
  plan: string;
  issued_at: number;
  expires_at: number | null;
  revoked_at: number | null;
};

function toRecord(row: Record<string, unknown>): LicenseRecord | null {
  if (typeof row.id !== "string" || typeof row.key_hash !== "string") return null;
  const status = row.status === "revoked" || row.status === "refunded" ? row.status : "active";
  return {
    id: row.id,
    key_hash: row.key_hash,
    status,
    provider: typeof row.provider === "string" ? row.provider : "unknown",
    provider_resource_id: typeof row.provider_resource_id === "string" ? row.provider_resource_id : null,
    provider_subscription_id:
      typeof row.provider_subscription_id === "string" ? row.provider_subscription_id : null,
    plan: typeof row.plan === "string" ? row.plan : DEFAULT_LICENSE_PLAN,
    issued_at: typeof row.issued_at === "number" ? row.issued_at : Date.now(),
    expires_at: typeof row.expires_at === "number" ? row.expires_at : null,
    revoked_at: typeof row.revoked_at === "number" ? row.revoked_at : null,
  };
}

const LICENSE_COLUMNS =
  "id, key_hash, status, provider, provider_resource_id, provider_subscription_id, plan, issued_at, expires_at, revoked_at";

async function findLicenseByKeyHash(db: LicensingD1, keyHash: string): Promise<LicenseRecord | null> {
  const result = await db
    .prepare(`SELECT ${LICENSE_COLUMNS} FROM licenses WHERE key_hash = ?1`)
    .bind(keyHash)
    .all<Record<string, unknown>>();
  const row = result?.results?.[0];
  return row ? toRecord(row) : null;
}

async function findLicenseById(db: LicensingD1, licenseId: string): Promise<LicenseRecord | null> {
  const result = await db
    .prepare(`SELECT ${LICENSE_COLUMNS} FROM licenses WHERE id = ?1`)
    .bind(licenseId)
    .all<Record<string, unknown>>();
  const row = result?.results?.[0];
  return row ? toRecord(row) : null;
}

/** Order-id namespace lookup (refund events against webhook-registered rows). */
async function findLicenseByProviderResource(
  db: LicensingD1,
  provider: string,
  providerResourceId: string,
): Promise<LicenseRecord | null> {
  const result = await db
    .prepare(
      `SELECT ${LICENSE_COLUMNS} FROM licenses
       WHERE provider_resource_id = ?1 AND provider = ?2`,
    )
    .bind(providerResourceId, provider)
    .all<Record<string, unknown>>();
  const row = result?.results?.[0];
  return row ? toRecord(row) : null;
}

/** Subscription-id namespace lookup (subscription events). */
async function findLicenseByProviderSubscription(
  db: LicensingD1,
  provider: string,
  providerSubscriptionId: string,
): Promise<LicenseRecord | null> {
  const result = await db
    .prepare(
      `SELECT ${LICENSE_COLUMNS} FROM licenses
       WHERE provider_subscription_id = ?1 AND provider = ?2`,
    )
    .bind(providerSubscriptionId, provider)
    .all<Record<string, unknown>>();
  const row = result?.results?.[0];
  return row ? toRecord(row) : null;
}

interface NewLicenseInput {
  keyHash: string;
  provider: string;
  providerResourceId: string | null;
  providerSubscriptionId: string | null;
  plan: string;
  expiresAt: number | null;
  now: number;
}

async function insertLicense(db: LicensingD1, input: NewLicenseInput): Promise<LicenseRecord | null> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO licenses
         (id, key_hash, status, provider, provider_resource_id, provider_subscription_id,
          plan, issued_at, expires_at, revoked_at, created_at)
       VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?7)
       ON CONFLICT (key_hash) DO NOTHING`,
    )
    .bind(
      id,
      input.keyHash,
      input.provider,
      input.providerResourceId,
      input.providerSubscriptionId,
      input.plan,
      input.now,
      input.expiresAt,
    )
    .run();
  return findLicenseByKeyHash(db, input.keyHash);
}

async function updateLicenseStatus(
  db: LicensingD1,
  licenseId: string,
  status: "active" | "revoked" | "refunded",
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE licenses SET status = ?1, revoked_at = ?2 WHERE id = ?3`)
    .bind(status, status === "active" ? null : now, licenseId)
    .run();
}

async function updateLicenseExpiry(
  db: LicensingD1,
  licenseId: string,
  expiresAt: number | null,
): Promise<void> {
  await db
    .prepare(`UPDATE licenses SET expires_at = ?1 WHERE id = ?2`)
    .bind(expiresAt, licenseId)
    .run();
}

/**
 * Bind a subscription id to a license row (subscription-event namespace).
 * Later subscription events without a license key reach the row through it.
 */
async function bindLicenseSubscription(
  db: LicensingD1,
  licenseId: string,
  subscriptionId: string,
): Promise<void> {
  await db
    .prepare(`UPDATE licenses SET provider_subscription_id = ?1 WHERE id = ?2`)
    .bind(subscriptionId, licenseId)
    .run();
}

/**
 * Audit trail write. Event-archive write pattern: best-effort insert with
 * ON CONFLICT (payload_digest) DO NOTHING so replays dedupe and a failed
 * audit never fails the main flow. Returns false when the digest already
 * exists (webhook replay).
 */
async function recordLicenseEvent(
  db: LicensingD1,
  input: { licenseId: string | null; type: string; payloadDigest: string; now: number },
): Promise<boolean> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO license_events (license_id, type, payload_digest, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (payload_digest) DO NOTHING`,
      )
      .bind(input.licenseId, input.type, input.payloadDigest, input.now)
      .run();
    const changes = result?.meta?.changes;
    return typeof changes === "number" ? changes > 0 : true;
  } catch {
    return true; // Audit failure must not fail the request or requeue replays.
  }
}

async function auditEvent(db: LicensingD1, type: string, licenseId: string | null, now: number): Promise<void> {
  const digest = await sha256Hex(`audit:${type}:${licenseId ?? "-"}:${crypto.randomUUID()}`);
  await recordLicenseEvent(db, { licenseId, type, payloadDigest: digest, now });
}

/**
 * Read-only dedupe probe: has this webhook payload digest already been
 * processed? A read cannot poison a failed delivery's retry the way an
 * upfront INSERT could.
 */
async function hasLicenseEvent(db: LicensingD1, payloadDigest: string): Promise<boolean> {
  try {
    const result = await db
      .prepare(`SELECT id FROM license_events WHERE payload_digest = ?1`)
      .bind(payloadDigest)
      .all<Record<string, unknown>>();
    return (result?.results?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Service operations
// ---------------------------------------------------------------------------

export interface ServiceOutcome {
  ok: boolean;
  code: string;
  status?: EffectiveLicenseStatus;
  entitlement?: string;
  /** Admin-facing record (no key_hash). Present on success paths. */
  record?: Omit<LicenseRecord, "key_hash">;
}

function stripKeyHash(record: LicenseRecord): Omit<LicenseRecord, "key_hash"> {
  const { key_hash: _keyHash, ...rest } = record;
  return rest;
}

export interface ValidateInput {
  licenseKey: string;
  installId?: string;
}

/**
 * Shared resolve step for validate/activate: hash lookup first, provider
 * fallback registration when the row is unknown, best-effort provider
 * status refresh when it is known. Never returns raw key material.
 * `remoteStatus` carries the provider's last reported status so callers can
 * fail closed on states the local row cannot represent (e.g. "inactive").
 */
/**
 * Per-isolate TTL cache over the known-row provider refresh (wt5f.4: the
 * 10/min/IP limiter bounds per-client fan-out, not global fan-out across
 * clients). Only successful answers cache; network failures retry on the
 * next request. Revocation safety: webhook-driven revocations mutate the D1
 * row immediately, and the refresh branch only runs for rows still active —
 * so a cached answer can only delay (by <= TTL) a provider-side change that
 * never arrived as a webhook. Entries are dropped on any revoke/refund
 * mutation and when the map grows past its bound.
 */
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_CACHE_MAX_ENTRIES = 500;
const providerRefreshCache = new Map<
  string,
  { until: number; remote: ProviderValidateResult }
>();

function cachedProviderRefresh(
  providerName: string,
  keyHash: string,
  now: number,
): ProviderValidateResult | null {
  const hit = providerRefreshCache.get(`${providerName}:${keyHash}`);
  if (!hit) return null;
  if (hit.until <= now) {
    providerRefreshCache.delete(`${providerName}:${keyHash}`);
    return null;
  }
  return hit.remote;
}

function storeProviderRefresh(
  providerName: string,
  keyHash: string,
  remote: ProviderValidateResult,
  now: number,
): void {
  if (providerRefreshCache.size >= PROVIDER_CACHE_MAX_ENTRIES) {
    providerRefreshCache.clear();
  }
  providerRefreshCache.set(`${providerName}:${keyHash}`, {
    until: now + PROVIDER_CACHE_TTL_MS,
    remote,
  });
}

function dropProviderCacheForStatusChange(): void {
  // A webhook just flipped a row to revoked/refunded: the cached "active"
  // answers for OTHER keys are still per-key, so dropping everything is
  // unnecessary — but revocations are rare and correctness beats cleverness.
  providerRefreshCache.clear();
}

async function resolveLicense(
  db: LicensingD1,
  provider: LicenseProvider | null,
  licenseKey: string,
  now: number,
): Promise<{ record: LicenseRecord | null; remoteStatus?: ProviderLicenseStatus }> {
  const keyHash = await hashLicenseKey(licenseKey);
  if (!keyHash) return { record: null };
  let record = await findLicenseByKeyHash(db, keyHash);

  if (!record && provider) {
    // Unknown row: give the provider a chance to bind this key on first
    // use (covers webhooks that carried no license key payload).
    const remote = await provider.validate(licenseKey);
    if (remote.ok && remote.providerResourceId) {
      record = await insertLicense(db, {
        keyHash,
        provider: provider.name,
        providerResourceId: remote.providerResourceId,
        providerSubscriptionId: null,
        plan: remote.plan || DEFAULT_LICENSE_PLAN,
        expiresAt: remote.expiresAt ?? null,
        now,
      });
    }
    return { record, remoteStatus: remote.status };
  }

  if (record && record.status === "active" && provider) {
    // Known row: best-effort authoritative refresh. Unreachable provider
    // keeps local state (grace math still applies from expiresAt).
    const cached = cachedProviderRefresh(provider.name, keyHash, now);
    const remote = cached ?? (await provider.validate(licenseKey));
    if (!cached && remote.ok) storeProviderRefresh(provider.name, keyHash, remote, now);
    if (remote.ok) {
      if (remote.expiresAt !== undefined && remote.expiresAt !== record.expires_at) {
        await updateLicenseExpiry(db, record.id, remote.expiresAt ?? null);
        record = { ...record, expires_at: remote.expiresAt ?? null };
      }
    } else if (remote.status === "revoked" || remote.status === "refunded") {
      await updateLicenseStatus(db, record.id, remote.status, now);
      record = { ...record, status: remote.status, revoked_at: now };
    }
    // "inactive" is NOT persisted: the provider may reactivate the key on a
    // fresh activation. The caller fails this request without an
    // entitlement; the row stays active so a later "active" refresh heals.
    return { record, remoteStatus: remote.status };
  }

  return { record };
}

function buildEntitlementPayload(record: LicenseRecord, now: number): EntitlementPayload {
  return {
    license_ref: record.id,
    plan: record.plan,
    expiresAt: record.expires_at,
    graceUntil: record.expires_at === null ? null : record.expires_at + LICENSE_GRACE_PERIOD_MS,
    issuedAt: now,
  };
}

async function signedOutcome(
  env: WorkerEnv,
  db: LicensingD1,
  record: LicenseRecord,
  status: EffectiveLicenseStatus,
  now: number,
): Promise<ServiceOutcome> {
  const signingKey = env.ENTITLEMENT_SIGNING_KEY;
  if (!signingKey) {
    return { ok: false, code: "signing_key_unconfigured" };
  }
  const signed = await signEntitlement(signingKey, buildEntitlementPayload(record, now));
  return {
    ok: true,
    code: "license_valid",
    status,
    entitlement: signed.entitlement,
    record: stripKeyHash(record),
  };
}

export async function validateLicense(
  env: WorkerEnv,
  db: LicensingD1,
  input: ValidateInput,
): Promise<ServiceOutcome> {
  const now = Date.now();
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable" };

  const keyHash = await hashLicenseKey(input.licenseKey);
  if (!keyHash) return { ok: false, code: "license_key_format_invalid" };

  const provider = getLicenseProvider(env);
  const { record, remoteStatus } = await resolveLicense(db, provider, input.licenseKey, now);
  if (!record) return { ok: false, code: "license_invalid" };

  // Provider says deactivated: fail with NO signed entitlement. Without
  // this, a deactivated key with a local active row would validate forever.
  if (remoteStatus === "inactive") {
    await auditEvent(db, "validate:inactive", record.id, now);
    return { ok: false, code: "license_inactive", status: "invalid" };
  }

  const status = computeEffectiveStatus(record.status, record.expires_at, now);
  await auditEvent(db, `validate:${status}`, record.id, now);
  if (status === "active" || status === "grace") {
    return signedOutcome(env, db, record, status, now);
  }
  return {
    ok: false,
    code: status === "expired" ? "license_expired" : "license_invalid",
    status,
  };
}

export interface ActivateInput extends ValidateInput {
  installId: string;
}

export async function activateLicense(
  env: WorkerEnv,
  db: LicensingD1,
  input: ActivateInput,
): Promise<ServiceOutcome> {
  const now = Date.now();
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable" };

  const keyHash = await hashLicenseKey(input.licenseKey);
  if (!keyHash) return { ok: false, code: "license_key_format_invalid" };
  const installId = input.installId.trim();
  if (!isValidInstallId(installId)) return { ok: false, code: "install_id_format_invalid" };

  const provider = getLicenseProvider(env);
  const { record, remoteStatus } = await resolveLicense(db, provider, input.licenseKey, now);
  if (!record) return { ok: false, code: "license_invalid" };

  // Provider says deactivated: no new activations either (same reasoning
  // as the validate branch above).
  if (remoteStatus === "inactive") {
    await auditEvent(db, "activate:inactive", record.id, now);
    return { ok: false, code: "license_inactive", status: "invalid" };
  }

  const status = computeEffectiveStatus(record.status, record.expires_at, now);
  if (status === "expired" || status === "invalid") {
    await auditEvent(db, `activate:${status}`, record.id, now);
    return {
      ok: false,
      code: status === "expired" ? "license_expired" : "license_invalid",
      status,
    };
  }

  // Atomic cap enforcement: the count check lives inside the INSERT's
  // SELECT, so two concurrent activations cannot both squeeze under the
  // cap between a separate SELECT and INSERT (count-then-insert race).
  // changes = 1: fresh activation. changes = 0: either the cap was full or
  // the (license_id, install_id) pair already exists — distinguish below.
  const insertResult = await db
    .prepare(
      `INSERT INTO activations (license_id, install_id, created_at, last_seen_at)
       SELECT ?1, ?2, ?3, ?3
       WHERE (SELECT COUNT(*) FROM activations WHERE license_id = ?1) < ?4
       ON CONFLICT (license_id, install_id) DO NOTHING`,
    )
    .bind(record.id, installId, now, MAX_ACTIVATIONS_PER_LICENSE)
    .run();
  const inserted = typeof insertResult?.meta?.changes === "number"
    ? insertResult.meta.changes > 0
    : true;

  if (!inserted) {
    const existing = await db
      .prepare(`SELECT install_id FROM activations WHERE license_id = ?1 AND install_id = ?2`)
      .bind(record.id, installId)
      .all<Record<string, unknown>>();
    if ((existing?.results?.length ?? 0) === 0) {
      await auditEvent(db, "activate:cap_reached", record.id, now);
      return { ok: false, code: "activation_limit_reached", status };
    }
    await db
      .prepare(`UPDATE activations SET last_seen_at = ?1 WHERE license_id = ?2 AND install_id = ?3`)
      .bind(now, record.id, installId)
      .run();
    await auditEvent(db, "activate:refresh", record.id, now);
  } else {
    await auditEvent(db, "activate:new", record.id, now);
  }

  return signedOutcome(env, db, record, status, now);
}

export interface IssueInput {
  licenseKey: string;
  plan: string;
  provider?: string;
  providerResourceId?: string;
  expiresAt?: number | null;
}

/**
 * Admin issuance. The caller supplies the raw license key once (generated
 * out of band or by the provider checkout); only its hash is stored and the
 * response carries the opaque license_ref — never the raw key.
 */
export async function issueLicense(
  env: WorkerEnv,
  db: LicensingD1,
  input: IssueInput,
): Promise<ServiceOutcome> {
  const now = Date.now();
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable" };

  const keyHash = await hashLicenseKey(input.licenseKey);
  if (!keyHash) return { ok: false, code: "license_key_format_invalid" };

  const providerName = (input.provider || env.LICENSE_PROVIDER || "lemonsqueezy").trim().toLowerCase();
  const plan = input.plan.trim().toLowerCase();
  if (!plan || !/^[a-z0-9_-]{1,32}$/.test(plan)) return { ok: false, code: "plan_invalid" };

  const expiresAt = typeof input.expiresAt === "number" && Number.isFinite(input.expiresAt)
    ? Math.floor(input.expiresAt)
    : null;

  const providerImpl = getLicenseProvider(env);
  if (providerImpl) {
    // Provider-managed issuance (Lemon Squeezy) refuses to mint keys; a
    // controlled refusal keeps manual issuance D1-only.
    await providerImpl.issue({ plan, providerResourceId: input.providerResourceId }).catch(() => {});
  }

  const existing = await findLicenseByKeyHash(db, keyHash);
  if (existing) return { ok: true, code: "license_exists", record: stripKeyHash(existing) };

  const record = await insertLicense(db, {
    keyHash,
    provider: providerName,
    providerResourceId: input.providerResourceId?.trim() || null,
    providerSubscriptionId: null,
    plan,
    expiresAt,
    now,
  });
  if (!record) return { ok: false, code: "storage_unavailable" };

  await auditEvent(db, "issue", record.id, now);
  return { ok: true, code: "license_issued", record: stripKeyHash(record) };
}

export interface RevokeInput {
  licenseRef: string;
}

export async function revokeLicense(
  env: WorkerEnv,
  db: LicensingD1,
  input: RevokeInput,
): Promise<ServiceOutcome> {
  const now = Date.now();
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable" };

  const licenseRef = input.licenseRef.trim();
  if (!licenseRef) return { ok: false, code: "license_ref_required" };
  const record = await findLicenseById(db, licenseRef);
  if (!record) return { ok: false, code: "license_not_found" };

  const provider = getLicenseProvider(env);
  if (provider && record.provider_resource_id) {
    await provider.revoke(record.provider_resource_id).catch(() => {});
  }

  await updateLicenseStatus(db, record.id, "revoked", now);
  await auditEvent(db, "revoke", record.id, now);
  dropProviderCacheForStatusChange();
  return {
    ok: true,
    code: "license_revoked",
    record: stripKeyHash({ ...record, status: "revoked", revoked_at: now }),
  };
}

export interface ListLicensesInput {
  status?: string;
  limit?: number;
}

/** Admin listing. key_hash is never selected, let alone returned. */
export async function listLicenses(
  _env: WorkerEnv,
  db: LicensingD1,
  input: ListLicensesInput,
): Promise<ServiceOutcome & { licenses?: Omit<LicenseRecord, "key_hash">[] }> {
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable" };

  const limit = Math.min(Math.max(Math.floor(input.limit ?? 100), 1), 500);
  const statusFilter = input.status?.trim().toLowerCase();
  const query = statusFilter
    ? `SELECT id, status, provider, provider_resource_id, provider_subscription_id, plan, issued_at, expires_at, revoked_at
       FROM licenses WHERE status = ?1 ORDER BY issued_at DESC LIMIT ?2`
    : `SELECT id, status, provider, provider_resource_id, provider_subscription_id, plan, issued_at, expires_at, revoked_at
       FROM licenses ORDER BY issued_at DESC LIMIT ?1`;

  const statement = db.prepare(query);
  const bound = statusFilter ? statement.bind(statusFilter, limit) : statement.bind(limit);
  const result = await bound.all<Record<string, unknown>>();
  if (result && result.success === false) {
    return { ok: false, code: "storage_unavailable" };
  }
  const licenses: Omit<LicenseRecord, "key_hash">[] = [];
  for (const row of result?.results ?? []) {
    const record = toRecord(row);
    if (record) licenses.push(stripKeyHash(record));
  }
  return { ok: true, code: "license_list", licenses };
}

// ---------------------------------------------------------------------------
// Webhook processing
// ---------------------------------------------------------------------------

export interface WebhookOutcome {
  ok: boolean;
  code: string;
  httpStatus: number;
}

export async function processLicenseWebhook(
  env: WorkerEnv,
  db: LicensingD1,
  provider: LicenseProvider,
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const now = Date.now();
  const schema = await ensureLicensingSchema(db);
  if (!schema.ok) return { ok: false, code: "storage_unavailable", httpStatus: 500 };

  const event = await provider.verifyWebhook(rawBody, headers);
  if (!event || !event.eventName) {
    return { ok: false, code: "webhook_signature_invalid", httpStatus: 401 };
  }

  // Idempotency digest: hash of the FULL raw payload, not name:id. LS sends
  // no per-occurrence event id, so name:id would collide across distinct
  // occurrences (e.g. two subscription_updated rounds for one subscription)
  // and silently drop events. Content hashing keeps genuine replays
  // (identical bytes) deduped while distinct payloads never collide.
  const digest = await sha256Hex(`${provider.name}:${rawBody}`);
  if (await hasLicenseEvent(db, digest)) {
    return { ok: true, code: "webhook_duplicate", httpStatus: 200 };
  }

  try {
    const { code, licenseId } = await applyWebhookEvent(db, provider, event, now);
    // Dedupe write happens AFTER successful processing: a delivery that
    // throws must not poison the provider's retry with a duplicate verdict
    // (that would lose the event permanently). Processing itself is
    // idempotent (ON CONFLICT DO NOTHING inserts, idempotent updates), so
    // a rare re-run after a dedupe-write failure is safe.
    await recordLicenseEvent(db, {
      licenseId,
      type: `webhook:${event.eventName}`,
      payloadDigest: digest,
      now,
    });
    return { ok: true, code, httpStatus: 200 };
  } catch {
    return { ok: false, code: "webhook_processing_failed", httpStatus: 500 };
  }
}

/**
 * Apply one verified webhook event to D1. Pure state transition; returns
 * the outcome code. Throws on storage failures (caller maps to 500 and
 * leaves the dedupe digest unwritten).
 */
async function applyWebhookEvent(
  db: LicensingD1,
  provider: LicenseProvider,
  event: ProviderWebhookEvent,
  now: number,
): Promise<{ code: string; licenseId: string | null }> {
  const keyHash = event.licenseKey ? await hashLicenseKey(event.licenseKey) : null;

  if (event.eventName === "order_created" || event.eventName === "order_processed") {
    if (keyHash) {
      const existing = await findLicenseByKeyHash(db, keyHash);
      if (!existing) {
        await insertLicense(db, {
          keyHash,
          provider: provider.name,
          // Webhook-registered rows bind the ORDER id here; the
          // subscription namespace is a separate column.
          providerResourceId: event.orderId ?? null,
          providerSubscriptionId: null,
          plan: event.plan || DEFAULT_LICENSE_PLAN,
          expiresAt: event.expiresAt ?? null,
          now,
        });
      }
    }
    return { code: "webhook_handled", licenseId: null };
  }

  // State-transition events target an existing license by key hash first,
  // then by the identifier namespace the event type actually carries:
  // refunds name an ORDER id (provider_resource_id), subscription events
  // name a SUBSCRIPTION id (provider_subscription_id).
  let record: LicenseRecord | null = null;
  if (keyHash) {
    record = await findLicenseByKeyHash(db, keyHash);
  }
  if (!record && event.providerResourceId && event.resourceKind === "order") {
    record = await findLicenseByProviderResource(db, provider.name, event.providerResourceId);
  }
  if (!record && event.providerResourceId && event.resourceKind === "subscription") {
    record = await findLicenseByProviderSubscription(db, provider.name, event.providerResourceId);
  }

  if (!record) {
    // Unknown license: the event is acknowledged so the provider stops
    // retrying; issuance self-binds later via first validate.
    return { code: "webhook_unmatched", licenseId: null };
  }

  // Bind the subscription namespace whenever this event names one, so
  // later subscription events without a license key still reach the row.
  if (event.resourceKind === "subscription" && event.providerResourceId) {
    if (record.provider_subscription_id !== event.providerResourceId) {
      await bindLicenseSubscription(db, record.id, event.providerResourceId);
      record = { ...record, provider_subscription_id: event.providerResourceId };
    }
  }

  if (event.eventName === "order_refunded") {
    await updateLicenseStatus(db, record.id, "refunded", now);
    dropProviderCacheForStatusChange();
    return { code: "webhook_handled", licenseId: record.id };
  }
  // Resurrect guard (wt5f.2): refunded/revoked are terminal statuses set by
  // a refund webhook or an admin revoke. A later subscription renewal event
  // must not silently reactivate them — a fresh PURCHASE issues a new key
  // and a deliberate un-revoke goes through admin re-issue.
  if (record.status === "refunded" || record.status === "revoked") {
    return { code: "webhook_handled", licenseId: record.id };
  }
  if (event.eventName === "subscription_created" || event.eventName === "subscription_updated") {
    if (event.expiresAt !== undefined) {
      await updateLicenseExpiry(db, record.id, event.expiresAt);
    }
    if (record.status !== "active") {
      await updateLicenseStatus(db, record.id, "active", now);
    }
    return { code: "webhook_handled", licenseId: record.id };
  }
  if (event.eventName === "subscription_resumed") {
    await updateLicenseStatus(db, record.id, "active", now);
    return { code: "webhook_handled", licenseId: record.id };
  }
  if (event.eventName === "subscription_expired" || event.eventName === "subscription_cancelled") {
    // No stored "expired" status: keep the row active and let the grace
    // math invalidate it from expiresAt (webhook may carry ends_at).
    await updateLicenseExpiry(db, record.id, event.expiresAt ?? now);
    return { code: "webhook_handled", licenseId: record.id };
  }

  return { code: "webhook_ignored", licenseId: record.id };
}

function trimError(prefix: string, error: unknown): string {
  const detail = String(error).slice(0, 200);
  return `${prefix}: ${detail}`;
}
