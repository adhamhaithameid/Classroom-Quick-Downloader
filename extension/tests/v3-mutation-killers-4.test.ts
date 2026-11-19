/**
 * Mutation killers, round 4 (2026-11-19, after the round-3 review fixes).
 * Mutant ids refer to the BEFORE run (scratchpad mut/before4.json) over
 * token-source.ts, capability.ts, config.ts, file-reconciler.ts, canonical-id.ts.
 * Mutants proven equivalent are listed in docs/session-logs/2026-11-19-mutation-4.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driveFileKeys, toCanonicalDriveId } from '../src/engines/canonical-id';
import { isApiConfigured, setNonChromeTokenSourceWired } from '../src/engines/v3/api/config';
import { setEngineBase } from '../src/engines/engine-base';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';
import { reconcileApiFiles } from '../src/engines/v3/file-reconciler';
import { ViewKind } from '../src/engines/types';
import type { PostNode } from '../src/engines/types';
import type { ClassroomApiSnapshot } from '../src/engines/v3/api/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canonical-id.ts killers (round 4)', () => {
  // mutants 2, 3: the 'drive-' prefix literal and the template result
  it('toCanonicalDriveId prefixes a bare id and keeps a prefixed one (mutants 2, 3)', () => {
    expect(toCanonicalDriveId('abc')).toBe('drive-abc');
    expect(toCanonicalDriveId('drive-abc')).toBe('drive-abc');
  });

  // mutants 7, 8: the canonical key is present; no 'drive-null' key without an id
  it('driveFileKeys is exactly the canonical key when the URL names no Drive id (mutants 7, 8)', () => {
    expect(driveFileKeys({ canonicalId: 'x', downloadUrl: 'https://example.com/page' })).toEqual(['drive-x']);
    expect(driveFileKeys({ canonicalId: 'url-9', downloadUrl: 'https://drive.google.com/open?id=ID1' })).toEqual([
      'drive-url-9',
      'drive-ID1',
    ]);
  });

  // union-4 #1: the generic google.com host test is gone; only the exact Drive
  // hosts count, so the bare google.com host is NOT a Drive host.
  it('the bare google.com host is not a Drive host (union-4 #1)', () => {
    expect(driveFileKeys({ canonicalId: 'x', downloadUrl: 'https://google.com/file/d/ID2/view' })).toEqual([
      'drive-x',
    ]);
  });

  // mutant 4: no $ anchor, so google.com.evil.com matched
  it('a host that only starts with google.com or ends with it without a dot is not trusted (mutant 4)', () => {
    expect(driveFileKeys({ canonicalId: 'x', downloadUrl: 'https://drive.google.com.evil.com/file/d/ID3/view' })).toEqual([
      'drive-x',
    ]);
    expect(driveFileKeys({ canonicalId: 'x', downloadUrl: 'https://notdrive.google.com/file/d/ID3/view' })).toEqual([
      'drive-x',
    ]);
  });
});

describe('token-source.ts killers (round 4)', () => {
  const REDIRECT = 'https://x.chromiumapp.org/';

  beforeEach(() => {
    vi.stubGlobal('crypto', {
      subtle: { digest: async () => new ArrayBuffer(32) },
      getRandomValues: (a: Uint8Array) => a,
    });
  });

  async function flush(): Promise<void> {
    for (let i = 0; i < 60; i++) await Promise.resolve();
  }

  function ctl() {
    const calls: Array<{ interactive: boolean; settle: (ok: boolean) => void }> = [];
    let n = 0;
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: (d) =>
        new Promise((resolve) => {
          calls.push({
            interactive: d.interactive,
            settle: (ok) => {
              const state = new URL(d.url).searchParams.get('state') ?? '';
              resolve(ok ? `${REDIRECT}?state=${encodeURIComponent(state)}&code=c` : undefined);
            },
          });
        }),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: `at-${++n}`, expires_in: 3600 }),
      }),
      randomBytes: (len) => new Uint8Array(len).fill(0xa5),
      now: () => 0,
      silentRetryCooldownMs: 60_000,
      log: () => {},
    });
    return { source, calls };
  }

  // mutant 367: catch { return null } on a synchronous launchWebAuthFlow throw
  it.each([false, true])('a launchWebAuthFlow that throws synchronously resolves null (interactive=%s, mutant 367)', async (interactive) => {
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: () => {
        throw new Error('identity API unavailable');
      },
      fetchImpl: async () => {
        throw new Error('must not be reached');
      },
      log: () => {},
    });
    await expect(source.getToken(interactive)).resolves.toBeNull();
  });

  // mutant 337: `if (this.inflight === pending)` -> true. The silent flow's
  // finally must not clear the slot that a queued click flow now owns.
  it('a third caller joins the queued click flow after the silent flow settles (mutant 337)', async () => {
    const { source, calls } = ctl();
    const silent = source.getToken(false);
    await flush();
    expect(calls).toHaveLength(1);
    const click = source.getToken(true); // queued behind the silent flow
    calls[0].settle(false);
    expect(await silent).toBeNull();
    await flush();
    expect(calls).toHaveLength(2); // the click flow opened its own window
    const third = source.getToken(true); // must share the click flow
    await flush();
    expect(calls).toHaveLength(2);
    calls[1].settle(true);
    expect(await click).toBe('at-1');
    expect(await third).toBe('at-1');
  });
});

describe('config.ts killers (round 4)', () => {
  const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  interface Setup {
    manifest: Record<string, unknown>;
    getAuthToken?: boolean;
    navigatorStub: unknown;
  }

  function arrange({ manifest, getAuthToken, navigatorStub }: Setup): void {
    setNonChromeTokenSourceWired(false);
    setEngineBase('v3');
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => manifest, sendMessage: () => {} },
      ...(getAuthToken ? { identity: { getAuthToken: () => {} } } : {}),
    });
    vi.stubGlobal('navigator', navigatorStub);
  }

  const chromeNav = {
    userAgent: CHROME_UA,
    userAgentData: { brands: [{ brand: 'Google Chrome' }] },
  };

  afterEach(() => {
    setEngineBase('v2');
    setNonChromeTokenSourceWired(false);
  });

  // mutant 135: a throwing userAgentData getter must read as "not absent"
  it('a throwing userAgentData getter never falls back to the Chrome UA (mutant 135)', () => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions: ['identity'] },
      getAuthToken: true,
      navigatorStub: {
        userAgent: CHROME_UA,
        get userAgentData(): unknown {
          throw new Error('blocked');
        },
      },
    });
    expect(isApiConfigured()).toBe(false);
  });

  // mutant 200: the background-path condition -> true
  it('a non-Chrome browser without getAuthToken is not configured by the client id alone (mutant 200)', () => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions: ['identity'] },
      navigatorStub: { userAgent: 'Mozilla/5.0 Firefox/133.0' },
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('Edge exposing getAuthToken is not configured by the client id alone (mutant 200)', () => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions: ['identity'] },
      getAuthToken: true,
      navigatorStub: {
        userAgent: `${CHROME_UA} Edg/131.0.0.0`,
        userAgentData: { brands: [{ brand: 'Microsoft Edge' }] },
      },
    });
    expect(isApiConfigured()).toBe(false);
  });

  // mutant 205: Array.isArray(permissions) -> true
  it.each([
    ['missing', undefined],
    ['a string', 'identity'],
  ])('permissions that are %s are not an identity grant (mutant 205)', (_n, permissions) => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions },
      navigatorStub: chromeNav,
    });
    expect(() => isApiConfigured()).not.toThrow();
    expect(isApiConfigured()).toBe(false);
  });

  // mutant 211: if (!hasIdentityPermission) return false -> never
  it('the content-script path needs the identity permission even on Google Chrome (mutant 211)', () => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions: [] },
      navigatorStub: chromeNav,
    });
    expect(isApiConfigured()).toBe(false);
  });

  // mutant 214: if (isGoogleChrome) return hasClientId -> never
  it('the content-script path on Google Chrome is configured by permission plus client id (mutant 214)', () => {
    arrange({
      manifest: { oauth2: { client_id: 'cid' }, permissions: ['identity'] },
      navigatorStub: chromeNav,
    });
    expect(isApiConfigured()).toBe(true);
  });
});

describe('file-reconciler.ts killers (round 4)', () => {
  const NOW = 1_000_000_000;

  function post(): PostNode {
    return {
      id: 'p',
      element: document.createElement('article'),
      viewKind: ViewKind.STUDENT_SUBMISSIONS,
      files: [],
      flags: null,
      lastScannedAt: 0,
    };
  }

  function snapshot(authUser: string | null, downloadUrl: string): ClassroomApiSnapshot {
    return {
      fetchedAt: NOW,
      context: {
        viewKind: ViewKind.STUDENT_SUBMISSIONS,
        courseId: 'C',
        courseWorkId: 'W',
        authUser,
        studentSubmissionId: 'S',
      },
      submissions: [
        { id: 'S', attachments: [{ id: 'F', title: 'f.pdf', downloadUrl, source: 'driveFile' }] },
      ],
    } as ClassroomApiSnapshot;
  }

  const URL_OK = 'https://drive.google.com/uc?id=F&export=download';

  // union-4 #3: the digits filter is gone (mutant 480 no longer exists); the
  // DOM path passes the raw value, so a URL-safe value is carried and only a
  // value that breaks the validator is retried without authuser.
  it('a URL-safe non-numeric authuser is carried; a validator-breaking one is dropped (union-4 #3)', () => {
    const [kept] = reconcileApiFiles(snapshot('1x', URL_OK), post(), NOW);
    expect(new URL(kept.downloadUrl).searchParams.get('authuser')).toBe('1x');
    const [dropped] = reconcileApiFiles(snapshot('a..b', URL_OK), post(), NOW);
    expect(dropped.downloadUrl).not.toContain('authuser');
  });

  // mutant 481: /^\d$/ accepted only one digit
  it('a multi-digit authuser is kept (mutant 481)', () => {
    const [file] = reconcileApiFiles(snapshot('12', URL_OK), post(), NOW);
    expect(new URL(file.downloadUrl).searchParams.get('authuser')).toBe('12');
  });

  // mutant 499: the second validateDownloadUrl (on the converted URL) removed.
  // The input passes (the encoded dots hide the '..'), the conversion decodes
  // the id to '..' and the result must be dropped.
  it('a URL whose converted form fails validation is dropped (mutant 499)', () => {
    const input = 'https://drive.google.com/open?id=%2E%2E';
    expect(reconcileApiFiles(snapshot(null, input), post(), NOW)).toEqual([]);
  });
});
