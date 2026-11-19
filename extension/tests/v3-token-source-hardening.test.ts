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
    await expect(source.getToken(false)).resolves.toBeNull(); // silent attempt #1
    await expect(source.getToken(false)).resolves.toBeNull(); // cooldown: no flow
    await expect(source.getToken(false)).resolves.toBeNull(); // cooldown: no flow
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(2); // first login + ONE silent
    now += 60_001; // cooldown over -> one more silent attempt is allowed
    await expect(source.getToken(false)).resolves.toBeNull();
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

  it('a state mismatch on the expected redirect is refused with null (review #7)', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async () => `${REDIRECT_URL}?state=forged&code=c`),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
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

// Fresh-eyes review round 2 (2026-11-19): interactivity, cooldown, in-flight
// slots, launch timeout, one-line log.
describe('WebAuthFlowTokenSource — review round 2', () => {
  const launchCalls = (deps: ReturnType<typeof makeDeps>) =>
    (deps.launchWebAuthFlow as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as { url: string; interactive: boolean },
    );

  it('finding 1: after expiry a user click (interactive) opens the auth window', async () => {
    let now = T0;
    const deps = makeDeps({ now: () => now });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');
    now = T0 + 3600_000 + 1;
    await expect(source.getToken(true)).resolves.toBe('at-2');
    expect(launchCalls(deps)[1].interactive).toBe(true);
  });

  it('finding 1: one failed silent attempt does not disable a later user click', async () => {
    let now = T0;
    let calls = 0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        // login ok, silent re-auth fails, the interactive click succeeds
        return calls === 2 ? '' : redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');
    now = T0 + 3600_000 + 1;
    await expect(source.getToken(false)).resolves.toBeNull(); // silent fails
    await expect(source.getToken(true)).resolves.toBe('at-2'); // click recovers
    // ...and the recovered token is served from cache afterwards.
    await expect(source.getToken(false)).resolves.toBe('at-2');
    expect(calls).toBe(3);
  });

  it('finding 2: the cooldown never blocks an interactive caller', async () => {
    let now = T0;
    let calls = 0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        return calls === 2 ? '' : redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    now = T0 + 3600_000 + 1;
    await expect(source.getToken(false)).resolves.toBeNull(); // starts cooldown
    now += 1_000; // well inside the 60 s cooldown
    await expect(source.getToken(true)).resolves.toBe('at-2');
    expect(launchCalls(deps)[2].interactive).toBe(true);
  });

  it('finding 3: an interactive call during a silent flow still opens a window', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        if (!details.interactive) {
          await gate;
          return ''; // the silent flow fails
        }
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const silent = source.getToken(false);
    await vi.waitFor(() => expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1));
    const click = source.getToken(true);
    release();
    await expect(silent).resolves.toBeNull();
    await expect(click).resolves.toBe('at-1');
    expect(launchCalls(deps).map((c) => c.interactive)).toEqual([false, true]);
  });

  it('finding 3: concurrent interactive callers still share ONE window', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        if (!details.interactive) {
          await gate;
          return '';
        }
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const silent = source.getToken(false);
    await vi.waitFor(() => expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1));
    const a = source.getToken(true);
    const b = source.getToken(true);
    release();
    await silent;
    await expect(Promise.all([a, b])).resolves.toEqual(['at-1', 'at-1']);
    expect(launchCalls(deps).filter((c) => c.interactive)).toHaveLength(1);
  });

  it('finding 4: a hung auth window times out and frees the in-flight slot', async () => {
    let calls = 0;
    let settleHung: (value: string | undefined) => void = () => {};
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        if (calls === 1) return new Promise<string | undefined>((resolve) => (settleHung = resolve));
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource({ ...deps, launchTimeoutMs: 50 });
    const first = source.getToken(true);
    await vi.waitFor(() => expect(calls).toBe(1));
    await vi.advanceTimersByTimeAsync(60);
    await expect(first).resolves.toBeNull();
    // Round 3 (finding 4): the hung window may still be open, so the launch
    // gate refuses a second window until the old launch settles.
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(calls).toBe(1);
    settleHung(undefined);
    await vi.advanceTimersByTimeAsync(0);
    await expect(source.getToken(true)).resolves.toBe('at-1'); // not the hung promise
  });

  it('finding 4: a fast flow leaves no live launch timer behind', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource({ ...deps, launchTimeoutMs: 50 });
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finding 5: the missing client id is logged ONCE across many calls', async () => {
    const log = vi.fn();
    const source = new WebAuthFlowTokenSource(makeDeps({ getClientId: () => null, log }));
    await source.getToken(true);
    await source.getToken(false);
    await source.getToken(true);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

// Fourth fresh-eyes review (2026-11-19): launch gate ceiling, exchange URL,
// no-throw state mismatch, clock jumps, strict redirect comparison.
describe('WebAuthFlowTokenSource — review round 4', () => {
  it('finding 1: a never-settling launch frees the gate at the ceiling', async () => {
    let calls = 0;
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        if (calls === 1) return new Promise<string | undefined>(() => {});
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource({
      ...deps,
      launchTimeoutMs: 50,
      launchGateCeilingMs: 1_000,
    });
    const first = source.getToken(true);
    await vi.waitFor(() => expect(calls).toBe(1));
    await vi.advanceTimersByTimeAsync(60);
    await expect(first).resolves.toBeNull();
    // Still inside the ceiling: the old window may be open, no second one.
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect(calls).toBe(2);
  });

  it('finding 1: a click may open a window once a SILENT launch timed out', async () => {
    let calls = 0;
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        if (calls === 1) return new Promise<string | undefined>(() => {});
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource({
      ...deps,
      launchTimeoutMs: 50,
      launchGateCeilingMs: 600_000,
    });
    const silent = source.getToken(false);
    await vi.waitFor(() => expect(calls).toBe(1));
    await vi.advanceTimersByTimeAsync(60);
    await expect(silent).resolves.toBeNull();
    await expect(source.getToken(false)).resolves.toBeNull(); // silent stays gated
    await expect(source.getToken(true)).resolves.toBe('at-1'); // the click gets a window
    expect(calls).toBe(2);
  });

  it('finding 2: the code exchange goes to an injected exchange URL', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource({
      ...deps,
      exchangeUrl: 'https://exchange.example.test/oauth/token',
      allowedExchangeOrigins: ['https://exchange.example.test'],
    });
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
    expect((deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://exchange.example.test/oauth/token',
    );
  });

  it('finding 2: the exchange URL defaults to the Google token endpoint', async () => {
    const deps = makeDeps();
    await new WebAuthFlowTokenSource(deps).getToken(true);
    expect((deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
  });

  it('finding 3: a state mismatch resolves null, logs one fixed line, no exchange', async () => {
    const log = vi.fn();
    const deps = makeDeps({
      log,
      launchWebAuthFlow: vi.fn(async () => `${REDIRECT_URL}?state=forged-value&code=c`),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0][0]);
    expect(line).toMatch(/state mismatch/);
    expect(line).not.toContain('forged-value');
    expect(line).not.toContain(REDIRECT_URL);
  });

  it('finding 4: a backward clock jump expires the cached token', async () => {
    let now = T0;
    const deps = makeDeps({ now: () => now });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBe('at-1');
    now = T0 - 5_000; // clock stepped back: the stamp is in the future
    await expect(source.getToken(true)).resolves.toBe('at-2');
  });

  it('finding 4: a backward clock jump does not keep the silent cooldown', async () => {
    let now = T0;
    let calls = 0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async () => {
        calls += 1;
        return undefined;
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBeNull(); // starts cooldown
    now = T0 - 3_600_000; // one hour back
    await expect(source.getToken(false)).resolves.toBeNull();
    expect(calls).toBe(2); // the cooldown was reset, one more silent attempt ran
  });

  it('finding 5: a prefix-extended foreign redirect resolves null', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        const state = new URL(details.url).searchParams.get('state') ?? '';
        return `https://hardening-id.chromiumapp.org.evil.test/?state=${state}&code=c`;
      }),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('finding 5: a different path on the same origin resolves null', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        const state = new URL(details.url).searchParams.get('state') ?? '';
        return `https://hardening-id.chromiumapp.org/other?state=${state}&code=c`;
      }),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });
});

// Fifth fresh-eyes review (2026-11-19).
describe('WebAuthFlowTokenSource — review round 5', () => {
  const hang = () => new Promise<string | undefined>(() => {});

  it('finding 2: an INTERACTIVE launch that never settles keeps the gate shut past its 5 min window', async () => {
    let calls = 0;
    let now = T0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        if (calls === 1) return hang();
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const first = source.getToken(true);
    await vi.waitFor(() => expect(calls).toBe(1));
    await vi.advanceTimersByTimeAsync(300_000); // the interactive window timeout
    await expect(first).resolves.toBeNull();
    // The window may still be open: a click right after must not open a second one.
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(59_000);
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(calls).toBe(1);
    // Dead-button guarantee: the ceiling still releases the gate.
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect(calls).toBe(2);
  });

  it('finding 2: a SILENT launch that never settles releases the gate shortly after its 10 s window', async () => {
    let calls = 0;
    let now = T0;
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls += 1;
        if (calls === 1) return hang();
        return redirectEchoingState(details.url, { code: 'c' });
      }),
    });
    // A short cooldown so the gate, not the cooldown, decides below.
    const source = new WebAuthFlowTokenSource({ ...deps, silentRetryCooldownMs: 1_000 });
    const first = source.getToken(false);
    await vi.waitFor(() => expect(calls).toBe(1));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(first).resolves.toBeNull();
    now = T0 + 65_000;
    await vi.advanceTimersByTimeAsync(55_000); // 65 s total: gate (70 s) still shut
    await expect(source.getToken(false)).resolves.toBeNull();
    expect(calls).toBe(1);
    now = T0 + 71_000;
    await vi.advanceTimersByTimeAsync(6_000); // 71 s: gate released
    await expect(source.getToken(false)).resolves.toBe('at-1');
    expect(calls).toBe(2);
  });

  describe('finding 3: exchange URL allowlist', () => {
    const rejected = [
      'http://oauth2.googleapis.com/token',
      'https://evil.example.test/token',
      'https://user:pw@oauth2.googleapis.com/token',
      'https://oauth2.googleapis.com.evil.test/token',
      'javascript:alert(1)',
      'not a url',
      '',
    ];

    it('default URL and an explicitly allowlisted proxy are accepted', async () => {
      const ok = makeDeps();
      await expect(new WebAuthFlowTokenSource(ok).getToken(true)).resolves.toBe('at-1');
      const proxy = makeDeps();
      await expect(
        new WebAuthFlowTokenSource({
          ...proxy,
          exchangeUrl: 'https://proxy.example.test/exchange',
          allowedExchangeOrigins: ['https://proxy.example.test'],
        }).getToken(true),
      ).resolves.toBe('at-1');
      expect((proxy.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
        'https://proxy.example.test/exchange',
      );
    });

    it('an explicit Google token URL is accepted without an allowlist entry', async () => {
      const deps = makeDeps();
      await expect(
        new WebAuthFlowTokenSource({ ...deps, exchangeUrl: 'https://oauth2.googleapis.com/token' })
          .getToken(true),
      ).resolves.toBe('at-1');
    });

    it.each(rejected)('rejects %j: null, one fixed log line, no launch, no exchange', async (url) => {
      const log = vi.fn();
      const deps = makeDeps({ log });
      const source = new WebAuthFlowTokenSource({ ...deps, exchangeUrl: url });
      await expect(source.getToken(true)).resolves.toBeNull();
      await expect(source.getToken(false)).resolves.toBeNull();
      expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(deps.fetchImpl).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).toMatch(/exchange URL/);
      if (url.length > 3) expect(String(log.mock.calls[0][0])).not.toContain(url);
    });

    it('a non-allowlisted proxy stays rejected, and an http extra origin is ignored', async () => {
      const deps = makeDeps({ log: vi.fn() });
      const source = new WebAuthFlowTokenSource({
        ...deps,
        exchangeUrl: 'http://proxy.example.test/exchange',
        allowedExchangeOrigins: ['http://proxy.example.test'],
      });
      await expect(source.getToken(true)).resolves.toBeNull();
      expect(deps.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('finding 4: throwing setup deps never reject getToken', () => {
    it('getClientId throwing: null, one fixed line', async () => {
      const log = vi.fn();
      const deps = makeDeps({
        log,
        getClientId: () => {
          throw new Error('boom-secret');
        },
      });
      const source = new WebAuthFlowTokenSource(deps);
      await expect(source.getToken(true)).resolves.toBeNull();
      await expect(source.getToken(false)).resolves.toBeNull();
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).not.toContain('boom-secret');
    });

    it('getRedirectUrl throwing: interactive and silent both resolve null, no launch', async () => {
      const log = vi.fn();
      const deps = {
        ...makeDeps({ log }),
        getRedirectUrl: () => {
          throw new Error('no identity');
        },
      };
      const source = new WebAuthFlowTokenSource(deps);
      await expect(source.getToken(true)).resolves.toBeNull();
      await expect(source.getToken(false)).resolves.toBeNull();
      expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/setup failed/));
    });

    it('randomBytes throwing: null, and the silent failure starts the normal cooldown', async () => {
      let now = T0;
      let draws = 0;
      const deps = {
        ...makeDeps({ now: () => now }),
        randomBytes: () => {
          draws += 1;
          throw new Error('no entropy');
        },
      };
      const source = new WebAuthFlowTokenSource(deps);
      await expect(source.getToken(false)).resolves.toBeNull();
      await expect(source.getToken(false)).resolves.toBeNull();
      expect(draws).toBe(1); // second silent call hit the cooldown, not the setup
      await expect(source.getToken(true)).resolves.toBeNull(); // click still tries
      expect(draws).toBe(2);
      expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
    });
  });
});

// Sixth fresh-eyes review (2026-11-19).
describe('WebAuthFlowTokenSource — review round 6', () => {
  it('finding 1: mutating deps.exchangeUrl after construction does not redirect the exchange', async () => {
    const deps = {
      ...makeDeps(),
      exchangeUrl: 'https://proxy.example.test/exchange',
      allowedExchangeOrigins: ['https://proxy.example.test'],
    };
    const source = new WebAuthFlowTokenSource(deps);
    deps.exchangeUrl = 'https://evil.example.test/steal';
    await expect(source.getToken(true)).resolves.toBe('at-1');
    const calls = (deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://proxy.example.test/exchange');
  });

  it('finding 1: mutating an unset exchangeUrl after construction still uses Google', async () => {
    const deps = makeDeps() as ReturnType<typeof makeDeps> & { exchangeUrl?: string };
    const source = new WebAuthFlowTokenSource(deps);
    deps.exchangeUrl = 'https://evil.example.test/steal';
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect((deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
  });

  describe('finding 2: Google origin requires the /token path', () => {
    it.each([
      'https://oauth2.googleapis.com/',
      'https://oauth2.googleapis.com/evil',
      'https://oauth2.googleapis.com/token/extra',
      'https://oauth2.googleapis.com/tokens',
    ])('rejects %s', async (url) => {
      const deps = makeDeps({ log: vi.fn() });
      const source = new WebAuthFlowTokenSource({ ...deps, exchangeUrl: url });
      await expect(source.getToken(true)).resolves.toBeNull();
      expect(deps.fetchImpl).not.toHaveBeenCalled();
      expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it('accepts /token with a query string; a proxy origin keeps any path', async () => {
      const g = makeDeps();
      await expect(
        new WebAuthFlowTokenSource({ ...g, exchangeUrl: 'https://oauth2.googleapis.com/token?x=1' })
          .getToken(true),
      ).resolves.toBe('at-1');
      const p = makeDeps();
      await expect(
        new WebAuthFlowTokenSource({
          ...p,
          exchangeUrl: 'https://proxy.example.test/any/path',
          allowedExchangeOrigins: ['https://proxy.example.test'],
        }).getToken(true),
      ).resolves.toBe('at-1');
    });
  });

  it('finding 3: a silent caller waits for an interactive flow, capped at the silent timeout, then null', async () => {
    let launches = 0;
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(() => {
        launches += 1;
        return new Promise<string | undefined>(() => {});
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const click = source.getToken(true);
    await vi.waitFor(() => expect(launches).toBe(1));
    let silentSettled = false;
    const silent = source.getToken(false).then((v) => {
      silentSettled = true;
      return v;
    });
    await vi.advanceTimersByTimeAsync(9_000);
    expect(silentSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(silentSettled).toBe(true);
    await expect(silent).resolves.toBeNull();
    expect(launches).toBe(1);
    await vi.advanceTimersByTimeAsync(300_000);
    await expect(click).resolves.toBeNull();
  });

  it('finding 3: a silent caller gets the token when the interactive flow finishes within the cap', async () => {
    let finish: (url: string | undefined) => void = () => {};
    const base = makeDeps();
    let launches = 0;
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn((details: { url: string; interactive: boolean }) => {
        launches += 1;
        return new Promise<string | undefined>((resolve) => {
          finish = (u) => resolve(u);
        }).then(() => base.launchWebAuthFlow(details));
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    const click = source.getToken(true);
    await vi.waitFor(() => expect(launches).toBe(1));
    const silent = source.getToken(false);
    await vi.advanceTimersByTimeAsync(3_000);
    finish('x');
    await expect(click).resolves.toBe('at-1');
    await expect(silent).resolves.toBe('at-1');
    expect(launches).toBe(1);
  });

  it('finding 4: a throwing injected clock never rejects getToken', async () => {
    const log = vi.fn();
    const deps = makeDeps({
      log,
      now: () => {
        throw new Error('clock-boom');
      },
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(true)).resolves.toBe('at-1');
    await expect(source.getToken(false)).resolves.toBe('at-1');
    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('clock'))).toBe(true);
    expect(lines.join('\n')).not.toContain('clock-boom');
  });

  it('finding 3: a silent caller still shares a SILENT in-flight flow', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource(deps);
    const a = source.getToken(false);
    const b = source.getToken(false);
    await expect(a).resolves.toBe('at-1');
    await expect(b).resolves.toBe('at-1');
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  describe('finding 5: the setup catch logs the error class only', () => {
    it('logs error.name, never the message, once; cooldown kept', async () => {
      const log = vi.fn();
      const deps = {
        ...makeDeps({ log }),
        getRedirectUrl: () => {
          throw new RangeError('secret-detail-xyz');
        },
      };
      const source = new WebAuthFlowTokenSource(deps);
      await expect(source.getToken(false)).resolves.toBeNull();
      await expect(source.getToken(true)).resolves.toBeNull();
      expect(log).toHaveBeenCalledTimes(1);
      const line = String(log.mock.calls[0][0]);
      expect(line).toContain('RangeError');
      expect(line).not.toContain('secret-detail-xyz');
    });

    it('a hostile name (non-identifier) is not echoed; a non-Error throw logs the fixed line', async () => {
      const log = vi.fn();
      const evil = Object.assign(new Error('m'), { name: 'bad name\nwith tokens=abc' });
      const deps = {
        ...makeDeps({ log }),
        getClientId: () => {
          throw evil;
        },
      };
      await new WebAuthFlowTokenSource(deps).getToken(true);
      const line = String(log.mock.calls[0][0]);
      expect(line).not.toContain('bad name');
      expect(line).not.toContain('abc');
      const log2 = vi.fn();
      const deps2 = {
        ...makeDeps({ log: log2 }),
        getClientId: () => {
          throw 'a string';
        },
      };
      await new WebAuthFlowTokenSource(deps2).getToken(true);
      expect(String(log2.mock.calls[0][0])).toMatch(/setup failed/);
      expect(String(log2.mock.calls[0][0])).not.toContain('a string');
    });
  });

  describe('finding 6: a throwing logger never rejects getToken', () => {
    const boom = () => {
      throw new Error('logger down');
    };

    it('no client id', async () => {
      const deps = makeDeps({ log: boom, getClientId: () => null });
      await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    });

    it('rejected exchange URL', async () => {
      const deps = makeDeps({ log: boom });
      const source = new WebAuthFlowTokenSource({ ...deps, exchangeUrl: 'http://x.test/' });
      await expect(source.getToken(true)).resolves.toBeNull();
    });

    it('setup failure', async () => {
      const deps = {
        ...makeDeps({ log: boom }),
        getRedirectUrl: () => {
          throw new Error('x');
        },
      };
      await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    });

    it('state mismatch', async () => {
      const deps = makeDeps({
        log: boom,
        launchWebAuthFlow: vi.fn(async () => `${REDIRECT_URL}?state=wrong&code=c`),
      });
      await expect(new WebAuthFlowTokenSource(deps).getToken(true)).resolves.toBeNull();
    });
  });
});
