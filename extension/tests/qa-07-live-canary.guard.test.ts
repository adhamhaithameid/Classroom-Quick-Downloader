import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* Hermetic regression guard for the live canary's auth contract (bead hl4.6).
   The original bug: the canary passed storageState to
   chromium.launchPersistentContext(), which silently ignores that option, so
   the canary always ran signed-out and its drift observations were
   meaningless. The fix routes the canary through the dedicated signed-in
   live profile plus a loud signed-in guard. These assertions are structural
   (source-level) so they run without any live Google session. */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(REPO_ROOT, 'tests', 'e2e', 'qa', 'qa-07-live-canary.spec.ts');
const HARNESS = join(REPO_ROOT, 'tests', 'e2e', 'live', 'live-harness.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('qa-07 live canary auth contract', () => {
  const spec = read(SPEC);

  it('launches the shared dedicated live profile, not a throwaway context', () => {
    expect(spec).toContain('launchPersistentContext(PROFILE_DIR');
    expect(spec).toContain("from \"../live/live-harness\"");
  });

  it('never passes storageState to launchPersistentContext (the silently-ignored option)', () => {
    const launchCall = spec.slice(
      spec.indexOf('launchPersistentContext(PROFILE_DIR'),
      spec.indexOf('});', spec.indexOf('launchPersistentContext(PROFILE_DIR'))
    );
    expect(launchCall).not.toMatch(/\bstorageState\s*:/);
  });

  it('fails loudly when the session is signed out', () => {
    expect(spec).toContain('async function isSignedIn');
    // Both tests must assert signed-in state before trusting observations.
    expect(spec.match(/await isSignedIn\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('imports legacy storage-state cookies explicitly instead of passing them as an option', () => {
    // The legacy QA_LIVE_STORAGE_STATE variable must only ever feed
    // context.addCookies — the only way cookies reach a persistent context.
    expect(spec).toContain('context.addCookies(state.cookies)');
    expect(spec).not.toMatch(/storageState\s*[:=]\s*STORAGE_STATE/);
  });

  it('documents why storageState is not used, so the bug story is not lost', () => {
    expect(spec).toContain('no `storageState` option');
  });

  it('the shared harness resolves the same profile directory', () => {
    const harness = read(HARNESS);
    expect(harness).toContain('tests/e2e/.live-profile');
    expect(harness).toContain('launchPersistentContext(PROFILE_DIR');
  });
});
