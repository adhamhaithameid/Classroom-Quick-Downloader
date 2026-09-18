# Session Log — Engine V4 S11: Cross-browser & Performance (1yf.11, gate G5)

Dates: 2026-09-17 · Sprint: S11 of epic `1yf` (gh #685) · Subagent-driven development

## What shipped

| Commit | Content |
|---|---|
| `7a61aeaa` | `handleMutations` p95 instrumented (label existed, never recorded) + additive `__cqdPerfSnapshot` debug bridge + honest qa-perf budget check (shipped FAILING at 18–20ms — the gate working) |
| `c4968651` | Targeted mutation scans: only mutation-touched posts run the per-post pipeline (helpers extracted from fullScan's loop verbatim); >8-post/unresolvable batches escalate to fullScan; **p95 18.4ms → 1.905ms** (budget 6ms). Accuracy C1 green; qa-05 delayed-post journey green. Iteration-1 iterator regression (postMap double-consumption) caught by qa-02/06/08 and fixed |
| `45a56354` | Edge leg: `extension-edge` Playwright project (msedge channel passed through to launchPersistentContext — without which Edge silently runs vanilla Chromium), `test:e2e:edge` script, CI xvfb leg. Local: 10/10 green on genuine Edg/153 |
| `e73368a6` | `_locales` (#612→#611): generator (typescript-transpile loader, byte-idempotent, `--check`), 147 locales / 3,392 messages byte-identical to TRANSLATIONS, CI no-drift step. **Ruling:** `t()` stays on TRANSLATIONS — chrome.i18n resolves by browser locale (no locale argument) and would flip visible page-locale strings; `_locales` is the CI-enforced generated contract for manifest-driven surfaces; manifest `default_locale` + build wiring land together in bead `770` (S12) |
| `4c8c7805` | Selector audit (#615): hash-id fallback rate exposed via `__cqdPerfSnapshot` (`selectorStats`), `docs/engine/selector-audit-2026-09.md` monitoring contract (rising rate = Classroom markup drift early warning) |
| `2fa3537b` + `00bf3d42` | Build-stamp: chrome-mv3 rebuilds on source change (+ `QA_FORCE_REBUILD=1`); after review, fingerprint widened to `wxt.config.ts` + root lockfile (bead a6m, closed) — closes the stale-build masking hazard class from bead 0fe |
| `da0e0471` | Student-work button CSS single-sourced (`SHARED_BUTTON_SHEET`); FULL sheet byte-identical |
| `089fc44e` | Bridge drops responses for unknown/evicted request ids (no more stray broadcasts to extension pages); watchdog-stranding check passed |
| `f1784e2c` | AMO signing pipeline (#617 groundwork): `tools/sign-extension.mjs` (API v5, hand-rolled HS256 JWT, zero deps), `qa-firefox-signed` project existing only when `QA_SIGNED_XPI` set, harness fails hard in signed mode, CI env-mapped-secrets conditional leg, 10 specs de-hardcoded via `projectBrowser()` |

## G5 status

- **p95 < 6ms: MET and asserted** (1.905ms, honest qa gate on every run).
- **Chrome + Edge smoke: green locally; CI leg wired** (unobserved until the next push — no pushes without owner authority; first CI run proves it).
- **Firefox leg: built and env-gated; real validation owner-blocked** (needs `AMO_JWT_ISSUER`/`AMO_JWT_SECRET` repo secrets, then a signed run validates #617). Fallback honestly documented if credentials never arrive.

## Evidence at close

Unit 3,849 passed / 11 failed — the 11 are the documented pre-existing `acquire-corpus` failures caused by the parallel session's UNCOMMITTED `entrypoints/background/index.ts` work (weekly-flush analytics); three independent agents verified their diff-independence. That session must land or revert; it blocks a fully-green suite. Accuracy 20/20. tsc clean. qa-chromium 16/0/1 (env canary only).

## Parked

- Signer hardening minors (exp claim on the JWT; fileHash algorithm prefix; signed-xpi add-on-id filename check) — ride bead `1yf.11` comments until the owner-credential run.
- Popup i18n + `default_locale` wiring — bead `770` (S12).
- 11 acquire-corpus failures — the analytics session's landing.
