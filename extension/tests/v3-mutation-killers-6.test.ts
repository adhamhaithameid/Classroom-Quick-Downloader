/**
 * Mutation killers, round 6 (2026-11-19, after the round-5 review fixes).
 * Mutant ids refer to the BEFORE run (scratchpad mut/before6.json) over
 * token-source.ts, config.ts, capability.ts, file-reconciler.ts, canonical-id.ts.
 * Mutants proven equivalent are listed in docs/session-logs/2026-11-19-mutation-6.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driveFileKeys } from '../src/engines/canonical-id';
import { setEngineBase } from '../src/engines/engine-base';
import { isApiConfigured } from '../src/engines/v3/api/config';
import { reconcileApiFiles } from '../src/engines/v3/file-reconciler';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';
import { ViewKind } from '../src/engines/types';
import type { PostNode } from '../src/engines/types';
import type { ClassroomApiSnapshot } from '../src/engines/v3/api/types';

afterEach(() => {
  vi.unstubAllGlobals();
  setEngineBase('v2');
});

describe('canonical-id.ts killers (round 6)', () => {
  const keys = (downloadUrl: string) => driveFileKeys({ canonicalId: 'x', downloadUrl });

  // mutants 43, 36: query('id') -> query('') and `if (cont)` -> true (an
  // auth_warmup link with no continue must fall back to its own id=).
  it('auth_warmup without continue yields its own id (mutants 43, 36)', () => {
    expect(keys('https://drive.google.com/auth_warmup?id=WARM1')).toEqual(['drive-x', 'drive-WARM1']);
    expect(keys('https://drive.google.com/auth_warmup')).toEqual(['drive-x']);
  });

  // mutant 32: path.startsWith('/auth_warmup') -> path.endsWith('/auth_warmup')
  it('auth_warmup is recognized by path prefix only (mutant 32)', () => {
    expect(keys('https://drive.google.com/x/auth_warmup?id=WARM1')).toEqual(['drive-x']);
    expect(keys('https://drive.google.com/auth_warmup/more?id=WARM2')).toEqual(['drive-x', 'drive-WARM2']);
  });
});

describe('file-reconciler.ts killers (round 6)', () => {
  const NOW = 1_000_000;
  const post = (): PostNode => ({
    id: 'p',
    element: document.createElement('article'),
    viewKind: ViewKind.STUDENT_SUBMISSIONS,
    files: [],
    flags: null,
    lastScannedAt: 0,
  });
  const snapshot = (downloadUrl: string): ClassroomApiSnapshot => ({
    fetchedAt: NOW,
    context: {
      viewKind: ViewKind.STUDENT_SUBMISSIONS,
      courseId: 'C',
      courseWorkId: 'W',
      authUser: null,
      studentSubmissionId: 'S',
    },
    submissions: [
      {
        id: 'S',
        state: 'TURNED_IN',
        attachments: [{ id: 'A', title: 'a.png', downloadUrl, source: 'driveFile' }],
      },
    ],
  });

  // mutant 647: `if (!has('authuser')) return rawUrl` -> false re-serialized every
  // URL (a space in the query was percent-encoded) even with no authuser to strip.
  it('a URL without authuser reaches the file byte-for-byte (mutant 647)', () => {
    const [file] = reconcileApiFiles(snapshot('https://drive.usercontent.google.com/download?id=A&export=download&n=a b'), post(), NOW);
    expect(file.downloadUrl).toBe('https://drive.usercontent.google.com/download?id=A&export=download&n=a b');
  });
});

describe('config.ts killers (round 6)', () => {
  // mutant 197: the catch of userAgentBrandsUnavailable -> {} returned undefined,
  // which `!` read as "no userAgentData": a throwing userAgentData getter then
  // fell back to the plain Chrome UA and a non-Google browser counted as Chrome.
  it('a throwing userAgentData getter never counts as Google Chrome (mutant 197)', () => {
    setEngineBase('v3');
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      get userAgentData(): never {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ oauth2: { client_id: 'cid' }, permissions: ['identity'] }),
      },
      identity: { getAuthToken: () => undefined },
    });
    expect(isApiConfigured()).toBe(false);
  });
});

describe('config.ts null userAgentData (round 6)', () => {
  // mutant 195: `uaData === null` -> false. A null userAgentData is "no object at
  // all" like undefined, so real Chrome with a plain UA keeps its pre-ADR answer.
  it('a null userAgentData falls back to the plain Chrome UA (mutant 195)', () => {
    setEngineBase('v3');
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      userAgentData: null,
    });
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: 'cid' }, permissions: ['identity'] }) },
      identity: { getAuthToken: () => undefined },
    });
    expect(isApiConfigured()).toBe(true);
  });
});

describe('token-source.ts killers (round 6)', () => {
  const REDIRECT = 'https://x.chromiumapp.org/';
  const LINE = '[CQD Classroom] WebAuthFlow setup failed — sign-in skipped';
  const GOOGLE = 'https://oauth2.googleapis.com/token';

  beforeEach(() => {
    vi.stubGlobal('crypto', {
      subtle: { digest: async () => new ArrayBuffer(32) },
      getRandomValues: (a: Uint8Array) => a,
    });
  });

  function make(extra: Partial<ConstructorParameters<typeof WebAuthFlowTokenSource>[0]> = {}) {
    const launch = vi.fn(async (details: { url: string }) => {
      const state = new URL(details.url).searchParams.get('state') ?? '';
      return `${REDIRECT}?state=${state}&code=c`;
    });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    }));
    const logs: string[] = [];
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: launch,
      fetchImpl,
      randomBytes: (len) => new Uint8Array(len).fill(0xa5),
      now: () => 0,
      log: (m) => logs.push(m),
      ...extra,
    });
    return { source, launch, fetchImpl, logs };
  }

  async function rejected(extra: Partial<ConstructorParameters<typeof WebAuthFlowTokenSource>[0]>) {
    const { source, launch, fetchImpl } = make(extra);
    expect(await source.getToken(true)).toBeNull();
    expect(launch).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  }

  // mutants 345, 342: a non-string exchangeUrl. A number is not a URL; a URL
  // OBJECT parses, so only the typeof guard stops it (the stored value would
  // reach fetchImpl as an object).
  it('a non-string exchange URL disables the source (mutants 345, 342)', async () => {
    await rejected({ exchangeUrl: 42 as unknown as string });
    await rejected({ exchangeUrl: new URL(GOOGLE) as unknown as string });
  });

  // mutants 349-352: userinfo on the exchange URL, each half on its own
  // (username only, password only, both), on Google's origin and a proxy.
  it('an exchange URL with userinfo is rejected, username or password alone (mutants 349-352)', async () => {
    for (const url of [
      'https://user@oauth2.googleapis.com/token',
      'https://:pw@oauth2.googleapis.com/token',
      'https://user:pw@oauth2.googleapis.com/token',
      'https://user@proxy.example/x',
      'https://:pw@proxy.example/x',
    ]) {
      await rejected({ exchangeUrl: url, allowedExchangeOrigins: ['https://proxy.example'] });
    }
  });

  // mutants 361, 363-366: an allowlist entry with userinfo allows nothing (the
  // parsed .origin drops the userinfo, so only the explicit check rejects it).
  it('an allowlist entry with userinfo adds no origin (mutants 361, 363-366)', async () => {
    for (const entry of [
      'https://user@proxy.example',
      'https://:pw@proxy.example',
      'https://user:pw@proxy.example',
    ]) {
      await rejected({ exchangeUrl: 'https://proxy.example/x', allowedExchangeOrigins: [entry] });
    }
  });

  // mutant 494: the class-name guard `typeof raw === 'string' && regex` -> true
  // logged a name that is not identifier-shaped, or not even a string.
  it('only an identifier-shaped error name reaches the setup log line (mutant 494)', async () => {
    for (const name of ['Bad Name!', 'x'.repeat(41), 42, ['TypeError']]) {
      const { source, logs } = make({
        getClientId: () => {
          throw { name };
        },
      });
      expect(await source.getToken(false)).toBeNull();
      expect(logs).toEqual([LINE]);
    }
    const ok = make({
      getClientId: () => {
        throw { name: 'TypeError' };
      },
    });
    await ok.source.getToken(false);
    expect(ok.logs).toEqual([`${LINE} (TypeError)`]);
  });
});
