# Review fixes, auth source, round 6 (2026-11-19)

Scope: extension/src/engines/v3/api/token-source.ts, config.ts, ADR-0010,
tests/v3-token-source-hardening.test.ts. Test-first: 12 new tests red, then green.

| # | Verdict | Red (before) | Fix | Green (after) |
|---|---------|--------------|-----|---------------|
| 1 | Real. fetchImpl read `this.deps.exchangeUrl` at exchange time. | 2 tests failed: exchange hit the mutated host | Private readonly `exchangeUrl` copied in the constructor; the only value fetchImpl gets | both pass |
| 2 | Real. Origin-only check passed any Google path. | 4 failed: `/`, `/evil`, `/token/extra`, `/tokens` accepted | On Google's origin require pathname `/token`; proxy origin stays origin-only (documented) | 4 reject, `/token?x=1` and proxy any-path accept |
| 3 | Real. Silent caller awaited a click's flow. | 1 failed: silent call did not settle | `!interactive` and interactive flow in flight returns null at once; silent still joins silent | pass |
| 4 | Real (doc only). Header said "never a second window". | n/a | Header states the bounded guarantee until the ceiling | n/a |
| 5 | Real. Setup catch dropped the error class. | 1 failed: line had no class name | Log `(ErrorName)` once, only if identifier-shaped; never message or value; cooldown kept | pass (hostile name and string throw tested) |
| 6 | Real. Logger ran outside try. | 4 failed: getToken rejected | `log()` wrapped in try/catch | 4 pass |
| 7 | Already safe. The probe sits after `if (!nonChromeTokenSourceWired) return false`, so relayAvailable cannot over-promise and flag OFF never reaches it. No code change. | n/a | Code comment + ADR checklist item: replace with a real background answer before flipping the gate | parity tests pass |
| 8 | Confirmed in ADR (secret finding, lines ~91-105); added to the round 6 checklist | n/a | ADR text | n/a |

Verification: red run 12 failed / 60 passed (72) in the hardening file. Green run
of 8 files (hardening, webauthflow, api-config, mutation-killers 1 to 5): 222 passed.
`pnpm exec tsc --noEmit -p .` exit 0. No change needed in mutation-killers or other test files.

Blast radius: WebAuthFlowTokenSource only; the source is unwired (gate false), so
no shipped behavior changes. A silent caller racing a click now gets null instead of
waiting. A Google exchange URL with a non-/token path now disables the source.
Setup log line gains a class name suffix.

Rollback: revert the three source/doc files and the appended test block
(describe "review round 6").
