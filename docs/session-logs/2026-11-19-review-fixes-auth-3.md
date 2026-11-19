# Review fixes, auth, round 3 (2026-11-19)

Branch feat/v3-base-engine. No commits made. All 8 findings were real.
Gate: `pnpm exec tsc --noEmit -p .` exit 0. Targeted vitest: 8 auth files, 180 tests pass.

## Findings

1. config flag-OFF drift. Verdict: real. Base: any context with getAuthToken returned hasClientId; the content-script path needed an explicit 'Google Chrome' brand and no UA fallback.
   Red: "8 failed | ... expected false to be true" (Edge/Brave/Opera background, empty navigator; Chrome UA content script returned true, base false).
   Fix: config.ts returns the base logic when getEngineBase() !== 'v3'; brand/UA gate and web flow only for 'v3'. Header comment updated. Parity test (14 matrix cases + 2 pins) in v3-api-config. Brand-gated old tests now set flag 'v3'.
   Green: v3-api-config 41 passed. engine-base "byte-identical" comment is now true (file untouched).
2. capability UA fallback. Verdict: real. Red: "5 failed | 13 passed" for HeadlessChrome/, SamsungBrowser/, YaBrowser/, Whale/.
   Fix: four tokens added to the reject regex in capability.ts. ADR states Brave has no UA token, so the fallback serves only contexts with no userAgentData.
   Green: v3-identity-capability* 28 passed.
3. First silent attempt had no cooldown. Verdict: real. Red: "expected vi.fn() to be called 1 times, but got 3 times".
   Fix: hadSession removed; every silent null or throw records lastSilentFailureAt (success clears it); the cooldown gates all non-interactive calls.
4. Launch timeout freed the slot but left the window. Verdict: real. Red: test timeout (second window flow hung/launched).
   Fix: launchOpen gate, held until the underlying launch promise settles (not the race); a new flow resolves null while it is closed. Test uses a never-settling launch, then releases it.
5. Exchange hung if fetch ignored the signal. Verdict: real. Red: "Test timed out in 30000ms".
   Fix: exchange moved to exchangeCode(); raced against a timer that aborts and resolves null; caching happens after the race so a late result is dropped.
6. Error redirect without state threw. Verdict: real. Red: `promise rejected "Error: ... state mismatch" instead of resolving`.
   Fix: error param checked before state. Success redirect with wrong state still rejects (tested).
7. Cache not keyed by clientId. Verdict: real. Red: "expected 'at-1' to be 'at-2'".
   Fix: CachedToken.clientId; compared on read, mismatch drops the cache.
8. Queued click waits up to 30 s + 15 s. Verdict: real. Red: silent default timeout test timed out at 10 s mark (default was 30 s).
   Fix: DEFAULT_SILENT_LAUNCH_TIMEOUT_MS 30 s to 10 s; interactive stays 5 min. Header and ADR document the worst case (10 s + 15 s).
   Green for 3 to 8: v3-webauthflow-token-source 23, v3-token-source-hardening, v3-mutation-killers* pass (111 tests across 5 files).

## Existing tests changed (mutant legitimately changed)
- v3-mutation-killers-3: "failed FIRST silent flow is not cooldown-gated" (mutants 243, 284; hadSession removed) now asserts the opposite (cooldown gates the first failure, retry at exactly the cooldown).
- v3-token-source-hardening: "hung auth window" now asserts the gate refuses a second window until the old launch settles.
- v3-api-config: five brand/UA tests now set engineBase 'v3'.
- v3-webauthflow-token-source: DepsOverrides gained launchTimeoutMs and fetchTimeoutMs.

## Files
Product files:
- src/engines/v3/api/token-source.ts
- src/engines/v3/api/capability.ts
- src/engines/v3/api/config.ts

Docs: docs/adr/0010 (the cross-browser OAuth ADR) and this log.

Tests:
- v3-api-config
- v3-identity-capability
- v3-webauthflow (token source)
- v3 token-source hardening
- v3 mutation killers, round 3

## Blast radius
- Flag OFF: config now identical to base; the earlier brand gate no longer reaches flag-OFF users.
- Flag ON: a click during an open or hung old auth window gets null (no second window) until that launch settles. Silent failures now back off 60 s from the first failure.
- Silent windows time out after 10 s (was 30 s); a slow silent consent screen can be cut off. Interactive unchanged.
- Mutation-killer tests for token-source/config tied to old line shapes may need a Stryker re-run (not run).
- Test note: tests that time out on timers must wait for PKCE (real crypto) before advancing fake time; use vi.waitFor.

## Rollback
Revert the five source/doc files and the test edits (git checkout of the listed paths); no data or schema changes.
