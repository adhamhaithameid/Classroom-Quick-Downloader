/**
 * Entitlement verify tests (bead 0h4d.2.3).
 *
 * Tokens are minted HERE with the WebCrypto HMAC-SHA256 over the exact
 * payloadB64 string — the same primitive the worker uses. Worker code is
 * never imported into extension tests. Global fake timers are active; the
 * boundary tests drive vi.setSystemTime across expiry and grace edges.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyEntitlementToken,
  entitlementStateFor,
  splitEntitlementToken,
  sanitizeEntitlementPayload,
  base64UrlEncode,
  base64UrlDecode,
  type EntitlementPayload,
} from '../src/entitlement/verify';
import { ENTITLEMENT_VERIFY_KEY } from '../src/entitlement/config';

function encodeB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Mint a token exactly like the worker: HMAC-SHA256 over the exact payloadB64. */
async function mintToken(
  payload: Record<string, unknown>,
  key: string = ENTITLEMENT_VERIFY_KEY,
): Promise<string> {
  const payloadB64 = encodeB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${encodeB64Url(new Uint8Array(mac))}`;
}

function makePayload(overrides: Partial<EntitlementPayload> = {}): Record<string, unknown> {
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  // Exact key order from the worker contract.
  return {
    license_ref: 'lic_test123',
    plan: 'pro',
    expiresAt,
    graceUntil: expiresAt + 30 * 24 * 60 * 60 * 1000,
    issuedAt: now,
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('splitEntitlementToken', () => {
  it('splits a well-formed token', () => {
    expect(splitEntitlementToken('abc.def')).toEqual({ payloadB64: 'abc', sigB64: 'def' });
  });
  it('rejects missing halves and extra dots', () => {
    expect(splitEntitlementToken('abc')).toBeNull();
    expect(splitEntitlementToken('.def')).toBeNull();
    expect(splitEntitlementToken('abc.')).toBeNull();
    expect(splitEntitlementToken('a.b.c')).toBeNull();
    expect(splitEntitlementToken('')).toBeNull();
  });
});

describe('base64url helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
  });
  it('emits no padding and url-safe alphabet', () => {
    const out = base64UrlEncode(new TextEncoder().encode('any carnal pleasure'));
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe('verifyEntitlementToken — happy paths', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });
  afterEach(() => {
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  it('accepts a minted token inside expiry as licensed', async () => {
    const token = await mintToken(makePayload());
    const state = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, Date.now());
    expect(state.state).toBe('licensed');
    if (state.state === 'licensed') {
      expect(state.payload.license_ref).toBe('lic_test123');
      expect(state.payload.plan).toBe('pro');
    }
  });

  it('accepts a perpetual token (expiresAt null) far in the future', async () => {
    const token = await mintToken(makePayload({ expiresAt: null, graceUntil: null }));
    const farFuture = Date.now() + 3650 * DAY_MS;
    const state = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, farFuture);
    expect(state.state).toBe('licensed');
  });

  it('rejects a token minted with a different key', async () => {
    const token = await mintToken(makePayload(), 'some-other-key');
    const state = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, Date.now());
    expect(state).toEqual({ state: 'locked', reason: 'invalid_signature' });
  });
});

describe('verifyEntitlementToken — tamper rejection', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  async function mintAndTamperPayload(): Promise<string> {
    const token = await mintToken(makePayload());
    const [payloadB64, sigB64] = token.split('.');
    // Flip one payload character without changing base64url validity.
    const flipped = payloadB64.startsWith('e') ? 'f' + payloadB64.slice(1) : 'e' + payloadB64.slice(1);
    return `${flipped}.${sigB64}`;
  }

  async function mintAndTamperSignature(): Promise<string> {
    const token = await mintToken(makePayload());
    const [payloadB64, sigB64] = token.split('.');
    const flipped = sigB64.startsWith('A') ? 'B' + sigB64.slice(1) : 'A' + sigB64.slice(1);
    return `${payloadB64}.${flipped}`;
  }

  it('locks with invalid_signature when a payload char flips', async () => {
    const state = await verifyEntitlementToken(await mintAndTamperPayload(), ENTITLEMENT_VERIFY_KEY, Date.now());
    expect(state).toEqual({ state: 'locked', reason: 'invalid_signature' });
  });

  it('locks with invalid_signature when a sig char flips', async () => {
    const state = await verifyEntitlementToken(await mintAndTamperSignature(), ENTITLEMENT_VERIFY_KEY, Date.now());
    expect(state).toEqual({ state: 'locked', reason: 'invalid_signature' });
  });
});

describe('verifyEntitlementToken — malformed tokens', () => {
  it('locks with malformed on structurally broken tokens', async () => {
    const now = Date.now();
    expect(await verifyEntitlementToken('', ENTITLEMENT_VERIFY_KEY, now)).toEqual({
      state: 'locked',
      reason: 'malformed',
    });
    expect(await verifyEntitlementToken('not-a-token', ENTITLEMENT_VERIFY_KEY, now)).toEqual({
      state: 'locked',
      reason: 'malformed',
    });
    expect(await verifyEntitlementToken('a.b.c', ENTITLEMENT_VERIFY_KEY, now)).toEqual({
      state: 'locked',
      reason: 'malformed',
    });
    // Valid base64url halves, but unsigned: signature verification runs
    // BEFORE decode, so an unsigned garbage payload locks as
    // invalid_signature, not malformed. (A validly-SIGNED non-JSON payload
    // is the malformed case — covered by the bad-fields test below.)
    expect(await verifyEntitlementToken('YWJj.YWJj', ENTITLEMENT_VERIFY_KEY, now)).toEqual({
      state: 'locked',
      reason: 'invalid_signature',
    });
  });

  it('locks with malformed on a validly-signed payload with bad fields', async () => {
    const bad = makePayload();
    delete (bad as Record<string, unknown>).license_ref;
    const token = await mintToken(bad);
    const state = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, Date.now());
    expect(state).toEqual({ state: 'locked', reason: 'malformed' });
  });
});

describe('expiry → grace → lock boundaries (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  it('crosses licensed → grace at expiresAt', async () => {
    const expiresAt = Date.now() + 10 * DAY_MS;
    const token = await mintToken(makePayload({ expiresAt, graceUntil: expiresAt + 30 * DAY_MS }));
    const before = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt - 1);
    expect(before.state).toBe('licensed');
    const at = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt);
    expect(at.state).toBe('grace');
  });

  it('crosses grace → locked at expiresAt + 30d, and recovers on time reversal', async () => {
    const expiresAt = Date.now() + 10 * DAY_MS;
    const token = await mintToken(makePayload({ expiresAt, graceUntil: expiresAt + 30 * DAY_MS }));
    const inside = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt + 30 * DAY_MS - 1);
    expect(inside.state).toBe('grace');
    const past = await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt + 30 * DAY_MS);
    expect(past).toEqual({ state: 'locked', reason: 'expired' });
    // The same token still verifies signature-true; only time locks it. A
    // renewed mint (fresh issuedAt/expiry) is licensed again.
    const renewed = await mintToken(
      makePayload({ expiresAt: expiresAt + 40 * DAY_MS, graceUntil: expiresAt + 70 * DAY_MS }),
    );
    expect((await verifyEntitlementToken(renewed, ENTITLEMENT_VERIFY_KEY, expiresAt + 30 * DAY_MS)).state).toBe('licensed');
  });

  it('derives the grace edge when graceUntil is null on a finite expiry', async () => {
    const expiresAt = Date.now() + 10 * DAY_MS;
    // graceUntil null with a finite expiresAt is a contract-shaped mint the
    // worker never sends; the client still honors the shared 30-day window.
    const partial = makePayload({ expiresAt, graceUntil: null });
    const token = await mintToken(partial);
    expect((await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt + 30 * DAY_MS - 1)).state).toBe('grace');
    expect(await verifyEntitlementToken(token, ENTITLEMENT_VERIFY_KEY, expiresAt + 30 * DAY_MS)).toEqual({
      state: 'locked',
      reason: 'expired',
    });
  });
});

describe('entitlementStateFor + sanitizeEntitlementPayload', () => {
  it('sanitizes wrong-shaped payloads to null', () => {
    expect(sanitizeEntitlementPayload(null)).toBeNull();
    expect(sanitizeEntitlementPayload('x')).toBeNull();
    expect(sanitizeEntitlementPayload([])).toBeNull();
    expect(sanitizeEntitlementPayload({ license_ref: 1 })).toBeNull();
    expect(sanitizeEntitlementPayload(makePayload())).not.toBeNull();
  });

  it('treats non-finite expiresAt as perpetual', () => {
    const payload = sanitizeEntitlementPayload(makePayload({ expiresAt: null, graceUntil: null }));
    expect(payload).not.toBeNull();
    const state = entitlementStateFor(payload!, Number.NaN);
    expect(state.state).toBe('licensed');
  });
});
