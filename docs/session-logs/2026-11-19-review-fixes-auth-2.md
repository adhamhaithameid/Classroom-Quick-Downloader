# Review fixes, auth round 2 (2026-11-19)

Branch feat/v3-base-engine, worktree CQD-wt-v3base. Nothing committed.
Files: extension/src/engines/v3/api/{token-source,capability,config}.ts, tests listed below, docs/adr/0010-*.

Verdicts: 1 BUG real, 2 RISK real, 3 RISK real, 4 RISK real, 5 NIT real,
6 RISK real but latent (behavior was already 'none'), 7 RISK real (service-worker brands UNVERIFIED).

## 1. Expired path ignored interactive (BUG)
- Code (before): `const silent = this.runFlow(clientId, false).then(` at the expiry branch; `this.cached` never cleared.
- Red: `AssertionError: expected false to be true` (after expiry, launch interactive false) and `expected null to be 'at-2'` (click after failed silent).
- Fix: interactive callers call `runFlow(clientId, true)`; expired token dropped (`this.cached = null`); a `hadSession` flag keeps the silent path cooldown-gated.
- Green: 7 new + all token tests pass (113 in the 6 touched files).
- Tests changed: two existing tests used `getToken(true)` and expected a silent flow; now `getToken(false)` (legit semantic change).

## 2. Cooldown blocked clicks (RISK)
- Code (before): `if (this.lastSilentFailureAt !== null && now() - ... < cooldown) return null;` for every caller.
- Red: `expected null to be 'at-2'`.
- Fix: gate is only reached for non-interactive callers. Existing cooldown test now uses `getToken(false)` for the gated calls.

## 3. Click got the silent in-flight flow (RISK)
- Code (before): `if (this.inflight) return this.inflight;`
- Red: `expected null to be 'at-1'`; `expected [ null, null ] to deeply equal [ 'at-1', 'at-1' ]`.
- Fix: `inflightInteractive` slot flag; an interactive call during a silent flow chains: silent settles, then `runFlow(true)`. Concurrent clicks share the chain (one window).

## 4. No launchWebAuthFlow timeout (RISK)
- Red: test timed out (30016 ms) because the hung promise was returned forever.
- Fix: `Promise.race` against `launchTimeoutMs` (dep; default 30 s silent, 5 min interactive); timer cleared in `finally`; timeout resolves null, inflight cleared by `track`.
- Green: hung flow resolves null, next call runs a new flow; fast flow leaves `vi.getTimerCount() === 0`.

## 5. Missing-client-id log (NIT)
- Red: `expected "vi.fn()" to be called 1 times, but got 3 times`.
- Fix: `missingClientIdLogged` latch.

## 6. Edge iOS (RISK, latent)
- Code: `isSafari` caught `EdgiOS/` first, so the result was already 'none'; the comment and ADR said iOS was covered by the Edge branch, and a killer test pinned a synthetic `Chrome/ EdgiOS/` UA as webAuthFlow.
- Red: not reachable with a real UA (already 'none'); new test green from the start. The synthetic-UA killer failed once the explicit branch landed (`expected 'none' to be 'webAuthFlow'`).
- Decision: EdgiOS is 'none' (WebKit shell, no extension host). Explicit early branch, Edge regex narrowed to `Edg(?:A)?/`, header comment and ADR table/rule aligned.
- Test change: that killer row moved to its own 'none' test (coverage kept).

## 7. Background brand check (RISK)
- Source: MDN WorkerNavigator.userAgentData: "only available in Web Workers", secure contexts only. Extension service worker specifically: UNVERIFIED (no explicit Chrome statement found; ctx7 not used, MDN fetched directly).
- Red: `expected false to be true` for plain Chrome UA with no userAgentData.
- Fix: config.ts `isGoogleChromeContext`: explicit brand wins; only when userAgentData is wholly absent, fall back to `isPlainChromeUserAgent` (capability.ts). Empty or non-Chrome brands stay false. Applied to background and content-script paths.
- ADR documents the Brave/Edge/Opera change (getAuthToken present but unusable => V2 DOM fallback).

## Verification
- `pnpm exec vitest run` on the 6 touched suites: 6 files, 113 tests passed.
- Also run: v3-mutation-killers.test.ts, v3-engine-base.test.ts, popup-engine-mode.test.ts pass except 2 failures in v3-mutation-killers (file-reconciler 318, 345): file-reconciler.ts is being edited by another agent, not touched here.
- `pnpm exec tsc --noEmit -p .` in extension: exit 0.

## Blast radius
Only the non-Chrome path (flag OFF by default, NON_CHROME_TOKEN_SOURCE_WIRED false) and isApiConfigured. Google Chrome with brands: identical. Brave/Edge/Opera in mode 'v3': now false (documented, intentional). Chrome without userAgentData: identical via fallback.

## Rollback
Revert the three src files and tests; ADR note stays harmless.
