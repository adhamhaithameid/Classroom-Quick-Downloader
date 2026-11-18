/**
 * Entitlement controller tests (bead 0h4d.2.3).
 *
 * Covers the behaviors the verify/cache unit tests cannot: offline
 * tolerance (cached state serves with the network dead), the no-retry-storm
 * rule, the 429 rate gate honoring retryAfterSec, authoritative-failure
 * cleanup, and key hygiene (no raw key ever leaves the controller through
 * analytics, storage records, or error surfaces).
 */
import { describe, it, expect, vi } from 'vitest';
import { createEntitlementController, type EntitlementCheckEvent } from '../src/entitlement/activate';
import type { EntitlementStoragePort } from '../src/entitlement/cache';
import { ENTITLEMENT_CACHE_KEY, LICENSE_KEY_STORAGE_KEY } from '../src/entitlement/config';
import type { EntitlementPayload } from '../src/entitlement/verify';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-01-24T08:00:00.000Z');
const KEY = 'cqd-entitlement-integrity-v1';

function encodeB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function mintToken(payload: Record<string, unknown>): Promise<string> {
  const payloadB64 = encodeB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${encodeB64Url(new Uint8Array(mac))}`;
}

function makePayload(overrides: Partial<EntitlementPayload> = {}): Record<string, unknown> {
  const expiresAt = NOW + 30 * DAY_MS;
  return {
    license_ref: 'lic_test123',
    plan: 'pro',
    expiresAt,
    graceUntil: expiresAt + 30 * DAY_MS,
    issuedAt: NOW,
    ...overrides,
  };
}

/** In-memory storage port double. */
function memoryStorage(): EntitlementStoragePort & { dump(): Record<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (map.has(k)) out[k] = map.get(k);
      return out;
    },
    async set(kv) {
      for (const [k, v] of Object.entries(kv)) map.set(k, v);
    },
    async remove(keys) {
      for (const k of keys) map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

const INSTALL_ID = 'install-abc-123';

interface Harness {
  storage: ReturnType<typeof memoryStorage>;
  http: ReturnType<typeof vi.fn>;
  checks: EntitlementCheckEvent[];
  controller: ReturnType<typeof createEntitlementController>;
}

function makeHarness(opts: {
  reply?: () => Response | Promise<Response>;
  reject?: boolean;
} = {}): Harness {
  const storage = memoryStorage();
  const http = vi.fn(async () => {
    if (opts.reject) throw new TypeError('network dead');
    return (await opts.reply?.()) ?? new Response(JSON.stringify({ ok: false, error: 'license_service_failed' }), { status: 500 });
  });
  const checks: EntitlementCheckEvent[] = [];
  const controller = createEntitlementController({
    storage,
    http: http as unknown as Parameters<typeof createEntitlementController>[0]['http'],
    getInstallId: async () => INSTALL_ID,
    workerBaseUrl: 'https://worker.example',
    now: () => NOW,
    onCheck: (e) => checks.push(e),
  });
  return { storage, http, checks, controller };
}

function okEnvelope(entitlement: string): Response {
  return new Response(JSON.stringify({ ok: true, status: 'active', entitlement }), { status: 200 });
}

describe('entitlement controller — offline tolerance', () => {
  it('serves the cached licensed state with the network dead', async () => {
    const h = makeHarness({ reject: true });
    const token = await mintToken(makePayload());
    await h.storage.set({ [ENTITLEMENT_CACHE_KEY]: { schemaVersion: 1, entitlement: token, fetchedAt: NOW } });

    const state = await h.controller.checkEntitlement();
    expect(state?.state).toBe('licensed');
    expect(h.controller.isPro()).toBe(true);
    expect(h.http).not.toHaveBeenCalled(); // cached answer serves; refresh is fire-and-forget
  });

  it('returns unlicensed (no throw, no retry storm) with no cache and no stored key', async () => {
    const h = makeHarness({ reject: true });
    const state = await h.controller.checkEntitlement();
    expect(state).toBeNull();
    expect(h.controller.isPro()).toBe(false);
    expect(h.http).not.toHaveBeenCalled();
    expect(h.checks.some((c) => c.source === 'none' && c.outcome === 'unlicensed')).toBe(true);
  });

  it('makes ONE blocking attempt with a stored key, then stays unlicensed offline', async () => {
    const h = makeHarness({ reject: true });
    await h.storage.set({ [LICENSE_KEY_STORAGE_KEY]: 'abcd1234efgh' });

    const state = await h.controller.checkEntitlement();
    expect(state).toBeNull();
    expect(h.http).toHaveBeenCalledTimes(1);
    // The stored key survives a network failure (only authoritative
    // invalid/expired answers drop it).
    expect((await h.storage.get([LICENSE_KEY_STORAGE_KEY]))[LICENSE_KEY_STORAGE_KEY]).toBe('abcd1234efgh');
  });
});

describe('entitlement controller — rate gate', () => {
  it('honors retryAfterSec without a second network call', async () => {
    const h = makeHarness({
      reply: () =>
        new Response(JSON.stringify({ ok: false, error: 'rate_limited', retryAfterSec: 90 }), { status: 429 }),
    });
    await h.storage.set({ [LICENSE_KEY_STORAGE_KEY]: 'abcd1234efgh' });

    const first = await h.controller.revalidate();
    expect(first.code).toBe('rate_limited');
    expect(first.retryAfterSec).toBe(90);
    expect(h.http).toHaveBeenCalledTimes(1);

    const second = await h.controller.revalidate();
    expect(second.code).toBe('rate_limited');
    expect(h.http).toHaveBeenCalledTimes(1); // gated locally
  });
});

describe('entitlement controller — activate + cleanup', () => {
  it('caches the token and stores the key on success; isPro flips true', async () => {
    const h = makeHarness();
    const token = await mintToken(makePayload());
    (h.http as ReturnType<typeof vi.fn>).mockImplementation(async () => okEnvelope(token));

    const result = await h.controller.activate('abcd1234efgh');
    expect(result.ok).toBe(true);
    expect(result.state?.state).toBe('licensed');
    expect(h.controller.isPro()).toBe(true);
    expect((await h.storage.get([LICENSE_KEY_STORAGE_KEY]))[LICENSE_KEY_STORAGE_KEY]).toBe('abcd1234efgh');
    const cacheRecord = (await h.storage.get([ENTITLEMENT_CACHE_KEY]))[ENTITLEMENT_CACHE_KEY] as {
      entitlement: string;
    };
    expect(cacheRecord.entitlement).toBe(token);
  });

  it('drops the stored key and cache on an authoritative license_invalid', async () => {
    const h = makeHarness({
      reply: () => new Response(JSON.stringify({ ok: false, error: 'license_invalid' }), { status: 403 }),
    });
    await h.storage.set({ [LICENSE_KEY_STORAGE_KEY]: 'abcd1234efgh' });

    const result = await h.controller.revalidate();
    expect(result.ok).toBe(false);
    expect(result.code).toBe('license_invalid');
    const stored = (await h.storage.get([LICENSE_KEY_STORAGE_KEY, ENTITLEMENT_CACHE_KEY]));
    expect(stored[LICENSE_KEY_STORAGE_KEY]).toBeUndefined();
    expect(stored[ENTITLEMENT_CACHE_KEY]).toBeUndefined();
    expect(h.controller.isPro()).toBe(false);
  });

  it('deactivate clears the key and the cached token', async () => {
    const h = makeHarness();
    const token = await mintToken(makePayload());
    (h.http as ReturnType<typeof vi.fn>).mockImplementation(async () => okEnvelope(token));
    await h.controller.activate('abcd1234efgh');
    expect(h.controller.isPro()).toBe(true);

    await h.controller.deactivate();
    const stored = (await h.storage.get([LICENSE_KEY_STORAGE_KEY, ENTITLEMENT_CACHE_KEY]));
    expect(stored[LICENSE_KEY_STORAGE_KEY]).toBeUndefined();
    expect(stored[ENTITLEMENT_CACHE_KEY]).toBeUndefined();
    expect(h.controller.isPro()).toBe(false);
  });
});

describe('entitlement controller — key hygiene', () => {
  it('never puts the raw key or install id into analytics events', async () => {
    const rawKey = 'abcd1234efgh';
    const h = makeHarness({
      reply: () => new Response(JSON.stringify({ ok: false, error: 'license_invalid' }), { status: 403 }),
    });
    await h.storage.set({ [LICENSE_KEY_STORAGE_KEY]: rawKey });
    await h.controller.revalidate();
    await h.controller.activate(rawKey);

    const serialized = JSON.stringify(h.checks);
    expect(serialized).not.toContain(rawKey);
    expect(serialized).not.toContain(INSTALL_ID);
  });

  it('keeps the cache record key-free', async () => {
    const h = makeHarness();
    const token = await mintToken(makePayload());
    (h.http as ReturnType<typeof vi.fn>).mockImplementation(async () => okEnvelope(token));
    await h.controller.activate('abcd1234efgh');

    const cacheRecord = h.storage.dump()[ENTITLEMENT_CACHE_KEY] as Record<string, unknown>;
    expect(JSON.stringify(cacheRecord)).not.toContain('abcd1234efgh');
  });

  it('rejects implausible keys without any network call', async () => {
    const h = makeHarness();
    const result = await h.controller.activate('../etc/passwd');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('license_key_format_invalid');
    expect(h.http).not.toHaveBeenCalled();
  });
});
