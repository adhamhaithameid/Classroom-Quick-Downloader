/**
 * ============================================================================
 * ENTITLEMENT VERIFY — pure WebCrypto verification of minted license tokens
 * (bead 0h4d.2.3; token format: cloudflare-worker/src/licensing/service.ts)
 * ============================================================================
 *
 * Token: "<payloadB64>.<sigB64>" where payloadB64 is base64url UTF-8 JSON
 * {"license_ref","plan","expiresAt","graceUntil","issuedAt"} (exact key
 * order is load-bearing server-side) and sigB64 is base64url HMAC-SHA256
 * over the EXACT payloadB64 string.
 *
 * Consumer rule: verify the HMAC over payloadB64 FIRST, and only then
 * decode. A decoded-then-verified copy is never trusted.
 *
 * Pure: no chrome APIs, no fetch, no Date.now() — the caller supplies `now`.
 * WebCrypto (crypto.subtle) is a standard web API, not a chrome API.
 */

import { ENTITLEMENT_GRACE_PERIOD_MS } from './config';

/** Signed entitlement payload (mirror of the worker's EntitlementPayload). */
export interface EntitlementPayload {
  license_ref: string;
  plan: string;
  /** Epoch ms; null = perpetual license. */
  expiresAt: number | null;
  /** Epoch ms = expiresAt + grace window; null when expiresAt is null. */
  graceUntil: number | null;
  /** Epoch ms when the worker minted this token. */
  issuedAt: number;
}

/** Why an entitlement is locked. Opaque codes only — never key material. */
export type EntitlementLockReason = 'malformed' | 'invalid_signature' | 'expired';

/** Verification outcome for one token at one point in time. */
export type EntitlementState =
  | { state: 'licensed'; payload: EntitlementPayload }
  | { state: 'grace'; payload: EntitlementPayload }
  | { state: 'locked'; reason: EntitlementLockReason };

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Split a token into its two base64url parts. Exactly one dot, both halves
 * non-empty — anything else is malformed.
 */
export function splitEntitlementToken(
  token: string,
): { payloadB64: string; sigB64: string } | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;
  return { payloadB64, sigB64 };
}

async function importVerifyKey(verifyKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textToBytes(verifyKey) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Coerce a decoded payload into EntitlementPayload; null when any field is
 * the wrong shape (mirror of the worker's field checks).
 */
export function sanitizeEntitlementPayload(raw: unknown): EntitlementPayload | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.license_ref !== 'string' || typeof p.plan !== 'string') return null;
  if (p.expiresAt !== null && typeof p.expiresAt !== 'number') return null;
  if (p.graceUntil !== null && typeof p.graceUntil !== 'number') return null;
  if (typeof p.issuedAt !== 'number') return null;
  return {
    license_ref: p.license_ref,
    plan: p.plan,
    expiresAt: p.expiresAt as number | null,
    graceUntil: p.graceUntil as number | null,
    issuedAt: p.issuedAt as number,
  };
}

/**
 * Signature + expiry status of a license at `now` (epoch ms). Locked only
 * via tamper/malformation or expiry past grace — NEVER anything that would
 * disable free features; callers map every state to a Pro flag, free paths
 * stay untouched.
 */
export async function verifyEntitlementToken(
  token: string,
  verifyKey: string,
  now: number,
): Promise<EntitlementState> {
  const parts = splitEntitlementToken(token);
  if (!parts) return { state: 'locked', reason: 'malformed' };
  const { payloadB64, sigB64 } = parts;
  try {
    const key = await importVerifyKey(verifyKey);
    const sigBytes = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as ArrayBuffer,
      textToBytes(payloadB64) as unknown as ArrayBuffer,
    );
    // Verify over payloadB64 BEFORE decoding; a bad signature never gets
    // decoded (tamper rejection test pins this order via flipped chars).
    if (!valid) return { state: 'locked', reason: 'invalid_signature' };
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    const payload = sanitizeEntitlementPayload(decoded);
    if (!payload) return { state: 'locked', reason: 'malformed' };
    return entitlementStateFor(payload, now);
  } catch {
    return { state: 'locked', reason: 'malformed' };
  }
}

/**
 * Expiry → grace → lock math for an already-verified payload. Perpetual
 * licenses (expiresAt null) never expire. Past expiresAt but inside the
 * grace window still works (offline-tolerant grace); past grace locks
 * until an online revalidation renews the token.
 */
export function entitlementStateFor(
  payload: EntitlementPayload,
  now: number,
): EntitlementState {
  if (payload.expiresAt === null || !Number.isFinite(payload.expiresAt)) {
    return { state: 'licensed', payload };
  }
  const graceUntil =
    payload.graceUntil !== null && Number.isFinite(payload.graceUntil)
      ? payload.graceUntil
      : payload.expiresAt + ENTITLEMENT_GRACE_PERIOD_MS;
  if (now < payload.expiresAt) return { state: 'licensed', payload };
  if (now < graceUntil) return { state: 'grace', payload };
  return { state: 'locked', reason: 'expired' };
}
