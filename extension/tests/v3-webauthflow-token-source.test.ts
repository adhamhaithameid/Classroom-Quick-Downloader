// filepath: extension/tests/v3-webauthflow-token-source.test.ts
/**
 * ADR-0010 — WebAuthFlowTokenSource: the launchWebAuthFlow token path for
 * browsers without a working getAuthToken (Edge, Brave, Opera, Firefox).
 *
 * Contract pinned here (docs/adr/0010-cross-browser-oauth-web-auth-flow.md):
 *   - Authorization Code + PKCE S256 (RFC 7636 Appendix B vectors), state
 *     checked on return — a mismatch REJECTS,
 *   - user cancel / denial / exchange failure resolve null (never throw),
 *   - a missing web client id resolves null and logs exactly one line,
 *   - an expired cached token triggers exactly ONE silent re-auth,
 *   - tokens stay in memory: storage.local (and session) never receive one,
 *   - ChromeRelayTokenSource delegates to the existing relay provider.
 *
 * The module must not exist yet for these tests to mean anything — RED first.
 */
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChromeRelayTokenSource,
  WEB_AUTH_SCOPES,
  WebAuthFlowTokenSource,
  computePkceChallenge,
  createPkcePair,
} from '../src/engines/v3/api/token-source';

// jsdom's crypto lacks SubtleCrypto; the platform (and Node) both have it.
if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLIENT_ID = 'test-web-client.apps.googleusercontent.com';
const REDIRECT_URL = 'https://test-id.chromiumapp.org/';
const T0 = 1_000_000;

function fixedBytes(byte: number) {
  return (n: number) => new Uint8Array(n).fill(byte);
}

/** Builds a redirect URL the way Google would, echoing the flow's state. */
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
});

describe('PKCE (RFC 7636)', () => {
  it('computes the RFC 7636 Appendix B S256 challenge vector', async () => {
    await expect(computePkceChallenge(RFC_VERIFIER)).resolves.toBe(RFC_CHALLENGE);
  });

  it('generates a 43-char base64url verifier whose challenge is its S256 hash', async () => {
    const pair = await createPkcePair(fixedBytes(0x5a));
    expect(pair.verifier).toHaveLength(43);
    expect(pair.verifier).not.toMatch(/[+/=]/);
    await expect(computePkceChallenge(pair.verifier)).resolves.toBe(pair.challenge);
  });

  it('exposes the read-only classroom scopes + openid, nothing else', () => {
    expect(WEB_AUTH_SCOPES).toEqual([
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
      'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
      'openid',
    ]);
  });
});

describe('WebAuthFlowTokenSource', () => {
  it('runs the code+PKCE flow and returns the exchanged token', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');

    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    const launchArg = vi.mocked(deps.launchWebAuthFlow).mock.calls[0][0];
    expect(launchArg.interactive).toBe(false);
    const authUrl = new URL(launchArg.url);
    expect(authUrl.origin).toBe('https://accounts.google.com');
    expect(authUrl.pathname).toBe('/o/oauth2/v2/auth');
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(REDIRECT_URL);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('scope')).toBe(WEB_AUTH_SCOPES.join(' '));
    expect(authUrl.searchParams.get('code_challenge')).toHaveLength(43);

    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(deps.fetchImpl).mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init?.method).toBe('POST');
    const body = init?.body ?? new URLSearchParams();
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-1');
    expect(body.get('client_id')).toBe(CLIENT_ID);
    expect(body.get('redirect_uri')).toBe(REDIRECT_URL);
    expect(body.get('code_verifier')).toHaveLength(43);
  });

  it('caches the token in memory — a second call runs no new flow', async () => {
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');
    await expect(source.getToken(true)).resolves.toBe('at-1');
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects when the returned state does not match the flow state', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async () => `${REDIRECT_URL}?state=tampered&code=auth-code-1`),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).rejects.toThrow(/state/i);
  });

  it('returns null on user cancel (empty, undefined, and aborted flows)', async () => {
    for (const outcome of ['', undefined] as const) {
      const deps = makeDeps({ launchWebAuthFlow: vi.fn(async () => outcome) });
      await expect(new WebAuthFlowTokenSource(deps).getToken(false)).resolves.toBeNull();
    }
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async () => {
        throw new Error('flow aborted');
      }),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(false)).resolves.toBeNull();
  });

  it('returns null (no throw) on an access_denied redirect', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string }) =>
        redirectEchoingState(details.url, { error: 'access_denied' }),
      ),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(false)).resolves.toBeNull();
  });

  it('returns null when the redirect carries no code', async () => {
    const deps = makeDeps({
      launchWebAuthFlow: vi.fn(async (details: { url: string }) =>
        redirectEchoingState(details.url, {}),
      ),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(false)).resolves.toBeNull();
  });

  it('returns null on a failed token exchange', async () => {
    const deps = makeDeps({
      fetchImpl: vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })),
    });
    await expect(new WebAuthFlowTokenSource(deps).getToken(false)).resolves.toBeNull();
  });

  it('returns null and logs exactly one line when the client id is missing', async () => {
    const log = vi.fn();
    const deps = makeDeps({ getClientId: () => null, log });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(deps.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('triggers exactly ONE silent re-auth when the cached token expires', async () => {
    let now = T0;
    const deps = makeDeps({ now: () => now });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');

    now = T0 + 3600_000 + 1; // past the 3600s expiry
    await expect(source.getToken(true)).resolves.toBe('at-2');
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(deps.launchWebAuthFlow).mock.calls[1][0];
    expect(secondCall.interactive).toBe(false); // silent, never a prompt
  });

  it('returns null without prompting when the silent re-auth fails', async () => {
    let now = T0;
    const calls: { interactive: boolean }[] = [];
    const deps = makeDeps({
      now: () => now,
      launchWebAuthFlow: vi.fn(async (details: { url: string; interactive: boolean }) => {
        calls.push({ interactive: details.interactive });
        if (calls.length > 1) return ''; // silent re-auth cancelled
        return redirectEchoingState(details.url, { code: 'auth-code-1' });
      }),
    });
    const source = new WebAuthFlowTokenSource(deps);
    await expect(source.getToken(false)).resolves.toBe('at-1');
    now = T0 + 3600_000 + 1;
    await expect(source.getToken(true)).resolves.toBeNull();
    expect(calls[1]?.interactive).toBe(false);
    expect(calls).toHaveLength(2); // no interactive escalation loop
  });

  it('never writes the token to storage.local or storage.session', async () => {
    const localSet = vi.fn();
    const sessionSet = vi.fn();
    vi.stubGlobal('chrome', {
      storage: { local: { set: localSet }, session: { set: sessionSet } },
    });
    const deps = makeDeps();
    const source = new WebAuthFlowTokenSource(deps);
    await source.getToken(false);
    await source.getToken(true);
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });
});

describe('ChromeRelayTokenSource', () => {
  it('delegates getToken to the existing relay provider unchanged', async () => {
    const provider = {
      getAccessToken: vi.fn(async (interactive?: boolean) => (interactive ? 'tok-i' : 'tok-s')),
    };
    const source = new ChromeRelayTokenSource(provider);
    await expect(source.getToken(true)).resolves.toBe('tok-i');
    await expect(source.getToken(false)).resolves.toBe('tok-s');
    expect(provider.getAccessToken).toHaveBeenCalledWith(true);
    expect(provider.getAccessToken).toHaveBeenCalledWith(false);
  });
});
