// filepath: extension/tests/v3-token-source-hardening.test.ts
/**
 * Mutation hardening for src/engines/v3/api/token-source.ts (chat 7,
 * 2026-11-19). Baseline mutation score 71.84% with 24 survivors + 5
 * NoCoverage mutants; the brief targets 100% on this file (security and
 * parsing). Every test names the survivor cluster it kills; the AFTER
 * mutation run is the kill proof.
 *
 * Contract additions pinned here (all consistent with ADR-0010 + RFC 7636):
 *   - default PKCE verifiers are 43-char base64url WITHOUT padding, '+', or
 *     '/', and two draws never collide (entropy comes from getRandomValues),
 *   - the no-client-id log line names the problem ('no web client id'),
 *   - expiry is strict: a token whose expiry equals now() is EXPIRED (one
 *     silent re-auth),
 *   - the FIRST acquisition honors the caller's interactivity,
 *   - injected randomBytes drive the challenge (the default never leaks in),
 *   - an OAuth 'error' redirect is rejected BEFORE the code exchange,
 *   - a failed exchange (non-OK) is null even if the body carries a token,
 *   - non-string/empty access tokens are rejected,
 *   - expires_in honors the numeric lifetime exactly; a non-positive or
 *     non-numeric one falls back to the 1-hour default,
 *   - an exchange fetch that REJECTS resolves strictly null (never throws,
 *     never undefined).
 */
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WebAuthFlowTokenSource,
  computePkceChallenge,
  createPkcePair,
} from '../src/engines/v3/api/token-source';

if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

const CLIENT_ID = 'hardening-web-client.apps.googleusercontent.com';
const REDIRECT_URL = 'https://hardening-id.chromiumapp.org/';
const T0 = 1_000_000;

function fixedBytes(byte: number) {
  return (n: number) => new Uint8Array(n).fill(byte);
}

/** Bytes whose base64url carries '+', '/', and '==' padding. */
function hostileBytes() {
  return (n: number) => {
    const bytes = new Uint8Array(n);
    bytes.fill(0xfb); // 11111011 … → base64 alphabet hits '+' and '/'
    return bytes;
  };
}

function redirectEchoingState(authUrl: string, params: Record<string, string>) {
  const state = new URL(authUrl).searchParams.get('state') ?? '';
  const search = new URLSearchParams({ state, ...params });
  return `${REDIRECT_URL}?${search.toString()}`;
}

interface DepsOverrides {
  getClientId?: () => string | null;
  launchWebAuthFlow?: (
    details: { url: string; interactive: boolean },
  ) => Promise<string | undefined>;
  fetchImpl?: (
    url: string,
    init?: { method?: string; body?: URLSearchParams },
  ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  randomBytes?: (n: number) => Uint8Array;
  now?: () => number;
  log?: (message: string) => void;
}

function makeDeps(overrides: DepsOverrides = {}) {
  const launchWebAuthFlow =
    overrides.launchWebAuthFlow ??
    vi.fn(async (details: { url: string; interactive: boolean }) =>
      redirectEchoingState(details.url, { code: 'auth-code-1' }),
    );
  let fetchCall = 0;
  const fetchImpl =
    overrides.fetchImpl ??
    vi.fn(async () => {
      fetchCall += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: `at-${fetchCall}`, expires_in: 3600 }),
      };
    });
  return {
    getClientId: overrides.getClientId ?? (() => CLIENT_ID),
    getRedirectUrl: () => REDIRECT_URL,
    launchWebAuthFlow,
    fetchImpl,
    randomBytes: fixedBytes(0xa5),
    now: overrides.now ?? (() => T0),
    log: overrides.log ?? vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WebAuthFlowTokenSource — mutation hardening (chat 7)', () => {
  it('default PKCE pair: 43-char unpadded base64url, challenge matches (RFC shape)', () => {
    // Covers defaultRandomBytes and kills the padding/character regex +
    // literal survivors in base64url: a leaked '=' / '+' / '/' fails here.
    return createPkcePair().then(async ({ verifier, challenge }) => {
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await expect(computePkceChallenge(verifier)).resolves.toBe(challenge);
    });
  });

  it('two default draws never collide (randomness really comes from getRandomValues)', () => {
    return Promise.all([createPkcePair(), createPkcePair()]).then(([a, b]) => {
      expect(a.verifier).not.toBe(b.verifier);
    });
  });

  it('hostile bytes: no +, /, or = survives into the verifier or the challenge', () => {
    return createPkcePair(hostileBytes()).then(async ({ verifier, challenge }) => {
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await expect(computePkceChallenge(verifier)).resolves.toBe(challenge);
    });
  });

  it('missing web client id: the log line names the problem and the source stays off', async () => {
    const log = vi.fn();
    const deps = makeDeps({ getClientId: () => null, log });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('no web client id');
  });

  it('expiry boundary is strict: a token expiring exactly now re-auths silently', async () => {
    let now = T0;
    const deps = makeDeps({ now: () => now });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    // expires_in 3600 − 60s skew → expiresAt = T0 + 3_540_000.
    now = T0 + 3_540_000;
    await source.getToken(false);
    // Exactly one SILENT re-auth (interactive false), never a prompt.
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(2);
    expect((deps.launchWebAuthFlow as ReturnType<typeof vi.fn>).mock.calls[1][0]).toMatchObject({
      interactive: false,
    });
  });

  it('the first acquisition honors the caller interactivity', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(true);
    expect((deps.launchWebAuthFlow as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      interactive: true,
    });
  });

  it('injected randomBytes drive the challenge (the default never leaks in)', async () => {
    const deps = makeDeps({ randomBytes: fixedBytes(0x5a) });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    const expectedVerifier = await createPkcePair(fixedBytes(0x5a)).then((p) => p.verifier);
    const expectedChallenge = await computePkceChallenge(expectedVerifier);
    const url = new URL((deps.launchWebAuthFlow as ReturnType<typeof vi.fn>).mock.calls[0][0].url);
    expect(url.searchParams.get('code_challenge')).toBe(expectedChallenge);
  });

  it('a thrown launchWebAuthFlow resolves null (flow aborted)', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async () => {
        throw new Error('window closed');
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBeNull();
  });

  it("an OAuth error redirect is rejected BEFORE the code exchange", async () => {
    // The guard must short-circuit: no token request may fire for an error
    // redirect, even one that also carries a code.
    const errorDeps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string }) =>
        redirectEchoingState(details.url, { error: 'access_denied', code: 'good-code' }),
      ),
    });
    await expect(new WebAuthFlowTokenSource(errorDeps).getToken(false)).resolves.toBeNull();
    expect(errorDeps.fetchImpl).not.toHaveBeenCalled();
  });

  it('a failed exchange stays null even when the body carries an access token', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ access_token: 'smuggled-token' }),
      })),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBeNull();
  });

  it('a rejecting exchange fetch resolves STRICTLY null (never undefined)', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const result = await source.getToken(false);
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });

  it('a null token payload answers null (missing access_token)', async () => {
    const deps = makeDeps({ fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => null })) });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBeNull();
  });

  it('non-string and empty access tokens are rejected', async () => {
    const numeric = makeDeps({
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 12345 }) })),
    });
    await expect(new WebAuthFlowTokenSource(numeric).getToken(false)).resolves.toBeNull();

    const empty = makeDeps({
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: '' }) })),
    });
    await expect(new WebAuthFlowTokenSource(empty).getToken(false)).resolves.toBeNull();
  });

  it('expires_in honors a numeric lifetime exactly (past the default it is still cached)', async () => {
    let now = T0;
    const deps = makeDeps({
      now: () => now,
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'long-lived', expires_in: 7200 }),
      })),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    now += 4_000_000; // beyond the 1-hour default, inside the 2-hour lifetime
    await source.getToken(false);
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  it('a non-positive expires_in falls back to the default lifetime', async () => {
    let now = T0;
    const deps = makeDeps({
      now: () => now,
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'zero-lifetime', expires_in: 0 }),
      })),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    now += 1_000; // well inside the default lifetime the fallback must pick
    await source.getToken(false);
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  it('a non-numeric expires_in falls back to the default lifetime', async () => {
    let now = T0;
    const deps = makeDeps({
      now: () => now,
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'string-lifetime', expires_in: '5' }),
      })),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    now += 1_000; // a 5-second "lifetime" would already be expired here
    await source.getToken(false);
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  it('a full flow without injected clock uses the platform now and caches', async () => {
    // Covers both `deps.now ?? Date.now` default branches (getToken + runFlow).
    const deps = makeDeps({ now: undefined });
    delete (deps as { now?: unknown }).now;
    const source = new WebAuthFlowTokenSource(deps as ConstructorParameters<typeof WebAuthFlowTokenSource>[0]);
    const first = await source.getToken(false);
    expect(first).toBe('at-1');
    const second = await source.getToken(false);
    expect(second).toBe(first);
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });
});

// Fresh-eyes review fixes (2026-11-19): dedupe, backoff, redirect check, timeout.
describe('WebAuthFlowTokenSource — review fixes', () => {
  it('concurrent getToken(true) calls share ONE auth window (review #5)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        await gate;
        return redirectEchoingState(details.url, { code: 'auth-code-1' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const a = source.getToken(true);
    const b = source.getToken(true);
    release();
    await expect(Promise.all([a, b])).resolves.toEqual(['at-1', 'at-1']);
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('a failed flow clears the in-flight slot so a later call can retry (review #5)', async () => {
    let calls = 0;
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        return calls === 1 ? '' : redirectEchoingState(details.url, { code: 'auth-code-1' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBeNull();
    await expect(source.getToken(true)).resolves.toBe('at-1');
  });

  it('after expiry a failed silent re-auth is NOT retried inside the cooldown (review #6)', async () => {
    let now = T0;
    let calls = 0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        return calls === 1 ? redirectEchoingState(details.url, { code: 'c' }) : '';
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');
    now = T0 + 3600_000 + 1;
    await expect(source.getToken(true)).resolves.toBeNull(); // silent attempt #1
    await expect(source.getToken(true)).resolves.toBeNull(); // cooldown: no flow
    await expect(source.getToken(false)).resolves.toBeNull(); // cooldown: no flow
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(2); // first login + ONE silent
    now += 60_001; // cooldown over -> one more silent attempt is allowed
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(3);
  });

  it('rejects a redirect that is not the expected redirect URI (review #7)', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        const state = new URL(details.url).searchParams.get('state') ?? '';
        return `https://evil.example/?state=${state}&code=stolen`;
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('a malformed redirect resolves null instead of throwing (review #7)', async () => {
    const deps = makeDeps({ launchWebAuthFlow: vi.fn(async () => 'http://[bad') });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('a state mismatch on the expected redirect still rejects (review #7)', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async () => `${REDIRECT_URL}?state=forged&code=c`),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).rejects.toThrow(/state mismatch/);
  });

  it('aborts a hung token exchange after the timeout and resolves null (review #8)', async () => {
    let sawSignal: AbortSignal | undefined;
    const deps = makeDeps({
      fetchImpl: ((_url: string, init?: { signal?: AbortSignal }) => {
        sawSignal = init?.signal;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }) as never,
    });
    const source = new WebAuthFlowTokenSource({ ...deps, fetchTimeoutMs: 20 });
    const pending = source.getToken(true);
    await vi.waitFor(() => expect(sawSignal).toBeDefined()); // PKCE hashing is real async
    await vi.advanceTimersByTimeAsync(25); // global fake timers (tests/setup.ts)
    await expect(pending).resolves.toBeNull();
    expect(sawSignal?.aborted).toBe(true);
  });

  it('a fast exchange is not aborted and the timer does not leak (review #8)', async () => {
    let sawSignal: AbortSignal | undefined;
    const deps = makeDeps({
      fetchImpl: (async (_url: string, init?: { signal?: AbortSignal }) => {
        sawSignal = init?.signal;
        return { ok: true, status: 200, json: async () => ({ access_token: 'fast', expires_in: 3600 }) };
      }) as never,
    });
    const source = new WebAuthFlowTokenSource({ ...deps, fetchTimeoutMs: 20 });
    await expect(source.getToken(true)).resolves.toBe('fast');
    await vi.advanceTimersByTimeAsync(40);
    expect(sawSignal?.aborted).toBe(false);
  });
});
