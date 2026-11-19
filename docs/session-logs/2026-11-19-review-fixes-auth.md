# 2026-11-19 review fixes: auth / identity (feat/v3-base-engine)

Scope: nine fresh-eyes findings on config.ts, capability.ts, token-source.ts,
engine-base.ts. TDD: red first, then fix, then green. No git writes.

All nine findings were real. Common red/green evidence:

- RED run (before src edits): `Tests 27 failed` across the six v3 files.
- GREEN run (after): 6 files, `Tests 98 passed (98)`.
- Final run incl. 5 collateral files: `Test Files 11 passed, Tests 135 passed (135)`.

| # | Verdict | Red quote | Fix | Green |
|---|---------|-----------|-----|-------|
| 1 | BUG, real. `if (typeof chrome.identity?.getAuthToken === 'function') return hasClientId;` ran before the web gate. | `is false on a non-Chrome brand that exposes getAuthToken`: `expected true to be false` | Early return now also needs `isGoogleChromeBrand(brandNames)`; otherwise falls through to permission check and web gate. Google Chrome path unchanged. | passes |
| 2 | RISK, real. `/Edg\//` missed EdgA/EdgiOS. | `classifies Edge Android (EdgA/) as webAuthFlow` failed (UA reached the Chrome branch -> getAuthToken) | Regex `Edg[A-Za-z]*\/`. EdgiOS has no `Chrome/` and stays `none` through the Safari rule (iOS has no extension identity). | passes |
| 3 | RISK, real. Empty brands trusted the UA. | `never reports getAuthToken without an explicit Google Chrome brand` failed | UA heuristic removed. One shared `isGoogleChromeBrand(brands)` in capability.ts, used by config.ts. Tradeoff in ADR: Chrome without userAgentData (pre-90 or insecure context) gets webAuthFlow, the safe direction. | passes |
| 4 | RISK, real. | `setNonChromeTokenSourceWired is not a function` (symbol absent) plus `ships with NO non-Chrome token source wired` failed | `NON_CHROME_TOKEN_SOURCE_WIRED = false` + test seam `setNonChromeTokenSourceWired`; web gate returns false until flipped. ADR line added. engine-v3.ts untouched. | passes |
| 5 | RISK, real. | `concurrent getToken(true) calls share ONE auth window` failed (2 flows) | `inflight` promise returned to concurrent callers, cleared in `finally`. | passes |
| 6 | RISK, real. | `after expiry a failed silent re-auth is NOT retried inside the cooldown` failed | `lastSilentFailureAt` + `silentRetryCooldownMs` (default 60s, injectable). One silent attempt per cooldown window. | passes |
| 7 | RISK, real. | `rejects a redirect that is not the expected redirect URI`, `a malformed redirect resolves null` failed (code exchanged / throw) | `redirect.startsWith(getRedirectUrl())` and `new URL` inside `try`; both -> null. State mismatch still throws (test kept). | passes |
| 8 | RISK, real. | `aborts a hung token exchange...` timed out (30s) | `AbortController` + `fetchTimeoutMs` (default 15s, injectable), `signal` passed to fetch, timer cleared in `finally`; abort -> null. | passes |
| 9 | RISK, doc only. | n/a (no test, as requested) | Header warning in engine-base.ts and ADR rollout checklist line. Not wired. | n/a |

## Files changed (mine)

- src: `engines/v3/api/config.ts`, `engines/v3/api/capability.ts`,
  `engines/v3/api/token-source.ts`, `engines/engine-base.ts` (comment only).
- docs: `docs/adr/0010-cross-browser-oauth-web-auth-flow.md`, this log.
- tests updated: `v3-api-config`, `v3-identity-capability`,
  `v3-mutation-killers`, `v3-token-source-hardening` (8 new tests).
- Collateral tests needing a Google Chrome brand stub (finding 1 changes
  behavior): `v3-engine-base`, `v2-orchestrator-classroom-button`,
  `options-permissions`. Each only adds a `navigator.userAgentData` stub.
- Test-note: tests/setup.ts enables global fake timers; the timeout tests use
  `vi.waitFor` + `vi.advanceTimersByTimeAsync`.

## Blast radius

- Chrome with `userAgentData` (all Chrome 90+): byte-identical result.
- Brave/Edge/Opera on the background path: now false instead of true
  (the intended bug fix; they could never fetch a token).
- Real Chrome without userAgentData: false (documented tradeoff).
- Non-Chrome: false everywhere until the rollout PR flips the constant.
- WebAuthFlowTokenSource has no caller, so findings 5-8 affect no shipped path.

## Rollback

Revert the listed files. Or, for one finding: the `isGoogleChromeBrand`
conjunct in config.ts (1), the constant (4), per-method changes in
token-source.ts (5-8).

## Open items

- Rollout PR: flip `NON_CHROME_TOKEN_SOURCE_WIRED` and its pinning test.
- Persist `engineBase` in chrome.storage before the flag is enabled (ADR).
- Full gate and mutation run left to the coordinator.
