/**
 * Mutation killers, round 5 (2026-11-19, after the round-4 review fixes).
 * Mutant ids refer to the BEFORE run (scratchpad mut/before5.json) over
 * token-source.ts, config.ts, canonical-id.ts, file-reconciler.ts.
 * Mutants proven equivalent are listed in docs/session-logs/2026-11-19-mutation-5.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { driveFileKeys } from '../src/engines/canonical-id';
import { isApiConfigured } from '../src/engines/v3/api/config';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canonical-id.ts killers (round 5)', () => {
  const keys = (downloadUrl: string) => driveFileKeys({ canonicalId: 'x', downloadUrl });

  // mutant 18: catch { return null } -> {} (parsed stays unassigned, TypeError)
  it('an unparsable download URL yields only the canonical key (mutant 18)', () => {
    expect(keys('not a url')).toEqual(['drive-x']);
  });

  // mutant 19: /\/u\/\d+(?=\/)/ (no ^) stripped a /u/<n> from the MIDDLE of a path
  it('a /u/<n> segment that is not the path prefix is not stripped (mutant 19)', () => {
    expect(keys('https://drive.google.com/file/u/1/d/ID/view')).toEqual(['drive-x']);
  });

  // mutant 20: /^\/u\/\d(?=\/)/ (one digit) left /u/10 unstripped
  it('a multi-digit account prefix is stripped (mutant 20)', () => {
    expect(keys('https://drive.google.com/u/10/file/d/ID/view')).toEqual(['drive-x', 'drive-ID']);
  });

  // mutants 13, 14: drive /file/d/<id> unanchored, and a one-char id capture
  it('drive file ids are the whole id and only from a /file/d/ path prefix (mutants 13, 14)', () => {
    expect(keys('https://drive.google.com/file/d/ABC123/view')).toEqual(['drive-x', 'drive-ABC123']);
    expect(keys('https://drive.google.com/x/file/d/ABC123/view')).toEqual(['drive-x']);
  });

  // mutants 10, 11: docs path unanchored, and a one-char id capture
  it('docs ids are the whole id and only from a /<kind>/d/ path prefix (mutants 10, 11)', () => {
    expect(keys('https://docs.google.com/document/d/ABC123/edit')).toEqual(['drive-x', 'drive-ABC123']);
    expect(keys('https://docs.google.com/spreadsheets/d/SHEET9/edit')).toEqual(['drive-x', 'drive-SHEET9']);
    expect(keys('https://docs.google.com/x/document/d/ABC123/edit')).toEqual(['drive-x']);
  });

  // mutant 44: path === '/download' -> true
  it('usercontent ids come only from /download (mutant 44)', () => {
    expect(keys('https://drive.usercontent.google.com/download?id=ID9')).toEqual(['drive-x', 'drive-ID9']);
    expect(keys('https://drive.usercontent.google.com/other?id=ID9')).toEqual(['drive-x']);
  });

  // mutants 55, 59: startsWith('/drive') -> endsWith / startsWith('')
  it('classroom ids come only from a /drive path prefix (mutants 55, 59)', () => {
    expect(keys('https://classroom.google.com/drive?id=ID7')).toEqual(['drive-x', 'drive-ID7']);
    expect(keys('https://classroom.google.com/foo/drive?id=ID7')).toEqual(['drive-x']);
    expect(keys('https://classroom.google.com/other?id=ID7')).toEqual(['drive-x']);
  });
});

describe('config.ts killers (round 5)', () => {
  // mutant 110: typeof chrome === 'undefined' -> false (then chrome.runtime threw)
  it('an absent chrome global is "not configured", never a throw (mutant 110)', () => {
    vi.stubGlobal('chrome', undefined);
    expect(isApiConfigured()).toBe(false);
  });
});

describe('token-source.ts killers (round 5)', () => {
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

  // mutant 292: the silent-flow rejection handler -> {} (swallowed the error,
  // never stamped the cooldown)
  it('a silent flow that throws rejects and starts the cooldown (mutant 292)', async () => {
    const randomBytes = vi.fn((): Uint8Array => {
      throw new Error('entropy unavailable');
    });
    const launch = vi.fn();
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: launch,
      fetchImpl: async () => {
        throw new Error('must not be reached');
      },
      randomBytes,
      now: () => 0,
      silentRetryCooldownMs: 60_000,
      log: () => {},
    });
    await expect(source.getToken(false)).rejects.toThrow('entropy unavailable');
    await expect(source.getToken(false)).resolves.toBeNull();
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(launch).not.toHaveBeenCalled();
  });

  // mutant 338: `if (launchId !== this.launchSeq) return` -> false. A late settle
  // of an OLDER launch must not reopen the gate of a newer launch that is open.
  it('a late settle of an older launch keeps the newer launch gate closed (mutant 338)', async () => {
    const settlers: Array<() => void> = [];
    const launch = vi.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          settlers.push(() => resolve(undefined));
        }),
    );
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: launch,
      fetchImpl: async () => {
        throw new Error('must not be reached');
      },
      randomBytes: (len) => new Uint8Array(len).fill(0xa5),
      now: () => 0,
      launchTimeoutMs: 1_000,
      launchGateCeilingMs: 1_000_000_000,
      log: () => {},
    });

    const silent = source.getToken(false); // launch A, never settles
    await flush();
    await vi.advanceTimersByTimeAsync(1_000); // A's window timeout elapses
    expect(await silent).toBeNull();

    const click1 = source.getToken(true); // passes the gate: A was silent and timed out
    await flush();
    expect(launch).toHaveBeenCalledTimes(2); // launch B
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await click1).toBeNull();

    settlers[0](); // A settles LATE; B has not settled, B's window may be open
    await flush();

    const click2 = source.getToken(true);
    await flush();
    expect(launch).toHaveBeenCalledTimes(2); // no third window next to B
    expect(await click2).toBeNull();
  });
});
