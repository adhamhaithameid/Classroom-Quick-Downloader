/**
 * Mutation killers, round 2 (2026-11-19, after the review fixes).
 * Each test names the Stryker mutant ids (BEFORE-run before2.json) it kills.
 * Targets: capability.ts, config.ts, token-source.ts.
 */
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeIdentityCapability } from '../src/engines/v3/api/capability';
import { isApiConfigured } from '../src/engines/v3/api/config';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';

if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capability.ts killers (round 2)', () => {
  const chromeApis = { getAuthToken: () => {}, launchWebAuthFlow: () => {} };

  it('Google Chrome brand WITHOUT a getAuthToken function never answers getAuthToken (mutant 32)', () => {
    const r = probeIdentityCapability({
      userAgent: CHROME_UA,
      apis: {},
      brands: ['Google Chrome'],
    });
    expect(r.identity).toBe('none');
  });

  // Each Edge/Opera token is pinned with a Google Chrome brand + getAuthToken
  // present, so only the Edge/Opera branch (not the Chrome branch) can answer
  // webAuthFlow. A weakened regex falls through to getAuthToken.
  it.each([
    ['Edg/ desktop (mutants 59,60,61)', `${CHROME_UA} Edg/131.0.0.0`],
    ['EdgA/ Android (mutants 62)', `${CHROME_UA} EdgA/131.0.0.0`],
    ['OPR/ (Opera Chromium)', `${CHROME_UA} OPR/110.0.0.0`],
    ['Opera/ legacy slash (mutant 63)', `${CHROME_UA} Opera/9.80`],
    ['Opera <space> legacy (mutant 64)', `${CHROME_UA} Opera 12.16`],
  ])('%s is webAuthFlow even next to a Google Chrome brand', (_name, userAgent) => {
    const r = probeIdentityCapability({
      userAgent,
      apis: chromeApis,
      brands: ['Google Chrome'],
      relayAvailable: true,
    });
    expect(r.identity).toBe('webAuthFlow');
  });

  it('EdgiOS/ iOS is none even next to a Google Chrome brand (review round 2, finding 6; was mutant 61)', () => {
    const r = probeIdentityCapability({
      userAgent: `${CHROME_UA} EdgiOS/131.0.0.0`,
      apis: chromeApis,
      brands: ['Google Chrome'],
      relayAvailable: true,
    });
    expect(r.identity).toBe('none');
  });

  it('Edge without any Chrome/ token still reaches webAuthFlow via its own branch (mutants 59,60)', () => {
    const r = probeIdentityCapability({
      userAgent: 'Mozilla/5.0 Edg/131.0.0.0',
      apis: chromeApis,
      relayAvailable: true,
    });
    expect(r.identity).toBe('webAuthFlow');
  });

  it('a bare Opera/ UA without Chrome/ reaches webAuthFlow (mutants 63,64)', () => {
    for (const userAgent of ['Mozilla/5.0 Opera/9.80', 'Mozilla/5.0 Opera 12.16']) {
      const r = probeIdentityCapability({
        userAgent,
        apis: chromeApis,
        relayAvailable: true,
      });
      expect(r.identity).toBe('webAuthFlow');
    }
  });
});

describe('config.ts killers (round 2, Google Chrome path)', () => {
  function stubChromeWith(oauth2: Record<string, unknown> | undefined) {
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ permissions: ['identity'], ...(oauth2 ? { oauth2 } : {}) }),
      },
      identity: { getAuthToken: () => {} },
    });
    vi.stubGlobal('navigator', {
      userAgent: CHROME_UA,
      userAgentData: { brands: [{ brand: 'Google Chrome' }] },
    });
  }

  it('baseline: a real client_id configures on Google Chrome', () => {
    stubChromeWith({ client_id: 'c.apps.googleusercontent.com' });
    expect(isApiConfigured()).toBe(true);
  });

  it('an absent oauth2 section is false and never throws (mutant 112)', () => {
    stubChromeWith(undefined);
    expect(isApiConfigured()).toBe(false);
  });

  it('an empty client_id is false (mutants 118,119)', () => {
    stubChromeWith({ client_id: '' });
    expect(isApiConfigured()).toBe(false);
  });

  it('a whitespace-only client_id is false (mutant 121)', () => {
    stubChromeWith({ client_id: '   ' });
    expect(isApiConfigured()).toBe(false);
  });
});

describe('token-source.ts killers (round 2)', () => {
  const REDIRECT = 'https://x.chromiumapp.org/';

  function echo(authUrl: string, params: Record<string, string> = { code: 'c' }): string {
    const state = new URL(authUrl).searchParams.get('state') ?? '';
    return `${REDIRECT}?${new URLSearchParams({ state, ...params }).toString()}`;
  }

  /** A source whose clock, flow outcome and token lifetime the test drives. */
  function harness(opts: {
    cooldownMs?: number;
    expiresIn?: number;
  } = {}) {
    const clock = { t: 0 };
    const outcome: { mode: 'ok' | 'fail' | 'badState' } = { mode: 'ok' };
    const launch = vi.fn(async ({ url }: { url: string; interactive: boolean }) => {
      if (outcome.mode === 'fail') return undefined;
      if (outcome.mode === 'badState') return `${REDIRECT}?state=WRONG&code=c`;
      return echo(url);
    });
    let n = 0;
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: launch,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: `at-${++n}`, expires_in: opts.expiresIn ?? 61 }),
      }),
      randomBytes: (len) => new Uint8Array(len).fill(0xa5),
      now: () => clock.t,
      silentRetryCooldownMs: opts.cooldownMs ?? 60_000,
      log: () => {},
    });
    return { source, clock, outcome, launch };
  }

  it('the FIRST silent re-auth runs even when the clock is inside the cooldown span (mutant 226)', async () => {
    const { source, clock, launch } = harness();
    expect(await source.getToken(true)).toBe('at-1'); // expiresAt = 1000
    clock.t = 2000; // expired; 2000 < 60000 so a null-vs-number mix-up would block it
    expect(await source.getToken(false)).toBe('at-2');
    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch.mock.calls[1][0].interactive).toBe(false);
  });

  it('a failed silent re-auth is retried exactly AT the cooldown boundary (mutant 229)', async () => {
    const { source, clock, outcome, launch } = harness({ cooldownMs: 5000 });
    await source.getToken(true);
    clock.t = 2000;
    outcome.mode = 'fail';
    expect(await source.getToken(false)).toBeNull(); // failure stamped at 2000
    expect(launch).toHaveBeenCalledTimes(2);
    clock.t = 6999; // 4999 after the failure: still cooling down
    expect(await source.getToken(false)).toBeNull();
    expect(launch).toHaveBeenCalledTimes(2);
    clock.t = 7000; // exactly cooldown later: allowed again
    outcome.mode = 'ok';
    expect(await source.getToken(false)).toBe('at-2');
    expect(launch).toHaveBeenCalledTimes(3);
  });

  it('a SUCCESSFUL silent re-auth does not start a cooldown (mutant 235)', async () => {
    const { source, clock, launch } = harness();
    await source.getToken(true); // expiresAt 1000
    clock.t = 2000;
    expect(await source.getToken(false)).toBe('at-2'); // expiresAt 3000
    clock.t = 4000; // expired again, 2000ms after the success
    expect(await source.getToken(false)).toBe('at-3');
    expect(launch).toHaveBeenCalledTimes(3);
  });

  it('a silent re-auth with a state mismatch resolves null and starts the cooldown (mutants 238 / 169)', async () => {
    const { source, clock, outcome, launch } = harness();
    await source.getToken(true);
    clock.t = 2000;
    outcome.mode = 'badState';
    expect(await source.getToken(false)).toBeNull();
    expect(launch).toHaveBeenCalledTimes(2);
    clock.t = 3000; // inside the cooldown of the thrown attempt
    outcome.mode = 'ok';
    expect(await source.getToken(false)).toBeNull();
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('an unparsable redirect that equals the redirect URI resolves null, not a TypeError (mutant 277)', async () => {
    // The auth URL itself is valid; the redirect "not a url" passes startsWith
    // but new URL() throws, which must land in the catch and answer null.
    const launch = vi.fn(async () => 'not a url');
    const src = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => 'not a url',
      launchWebAuthFlow: launch,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      randomBytes: (len) => new Uint8Array(len).fill(1),
      log: () => {},
    });
    expect(await src.getToken(true)).toBeNull();
  });
});
