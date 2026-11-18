/**
 * ============================================================================
 * ENTITLEMENT CONFIG — shared constants for the client-side entitlement module
 * (bead 0h4d.2.3; server contract: cloudflare-worker/src/licensing/)
 * ============================================================================
 *
 * Pure module: constants only, no chrome APIs, no network, no time. The
 * worker's license endpoints mint "<payloadB64>.<sigB64>" entitlement tokens
 * signed with HMAC-SHA256 over the exact payloadB64 string using the
 * ENTITLEMENT_SIGNING_KEY env secret.
 */

/**
 * HMAC-SHA256 verification key. MUST equal the worker's
 * ENTITLEMENT_SIGNING_KEY secret (set the secret to this exact value at
 * deploy time) — otherwise every minted token fails verification and the
 * module stays locked.
 *
 * LIMITATION, stated honestly: a verification key shipped in the extension
 * bundle is NOT a secret. Anyone can read it from the bundle and mint
 * tokens that this client accepts. The HMAC is an INTEGRITY check (tamper
 * and corruption detection for the cached token), not an authenticity
 * guarantee against a determined attacker. Server-side activation limits
 * stay the real enforcement point. The asymmetric-signature (Ed25519)
 * upgrade is recorded in the phase-3 Pro design.
 */
export const ENTITLEMENT_VERIFY_KEY = 'cqd-entitlement-integrity-v1';

/**
 * Grace window after expiresAt. Mirror of the worker's
 * LICENSE_GRACE_PERIOD_MS (cloudflare-worker/src/licensing/service.ts):
 * 30 days. The minted payload already carries graceUntil = expiresAt + this
 * window; the client re-derives the boundary only when graceUntil is absent
 * or malformed.
 */
export const ENTITLEMENT_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** chrome.storage key for the signed entitlement token + fetchedAt. */
export const ENTITLEMENT_CACHE_KEY = 'cqd_entitlement_v1';

/**
 * chrome.storage key for the raw license key. Kept SEPARATE from the cache
 * record so the cache stays key-free; the key is needed to revalidate
 * online. Never logged, never put into an error message.
 */
export const LICENSE_KEY_STORAGE_KEY = 'cqd_license_key_v1';

/** License endpoint paths on the worker (contract: licensing/routes.ts). */
export const LICENSE_VALIDATE_PATH = '/license/validate';
export const LICENSE_ACTIVATE_PATH = '/license/activate';
