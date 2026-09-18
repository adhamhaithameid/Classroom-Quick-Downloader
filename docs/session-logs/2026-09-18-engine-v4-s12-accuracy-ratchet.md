# Session Log — Engine V4 S12: Accuracy Ratchet & Closeout (1yf.12, gates G4)

Dates: 2026-09-17 → 2026-09-18 · Sprint: S12 of epic `1yf` (gh #685) · Subagent-driven development

## G4 evidence (all verified by the final reviewer's independent re-execution)

| Gate criterion | Result | Commits |
|---|---|---|
| C1 exact, knownFailures [] | **Met** — all four cases fixed at root, list emptied | `105afe1a` (chip-shell golden selectors → L3 45 ≥ 40), `5b235980` (hu EDITED_KEYWORDS: szerkesztve/szerkesztett/módosítva/utolsó szerkesztés), `e8e9e7d8` (characterization baseline regenerated, diff confined to the 4 chip fixtures) |
| C2 floors met, only up | **Met — all floors 1.0** (commentRecall 0.777→1, editedRecall 0.866→1; measured tp/fn table in the report) | `0b943f05` |
| Mutation ≥ 80% on src/core | **95.64%** (from 73.93%; 61 killer tests, 14 justified inline disables, 32 documented survivors; nightly gate + auto-issue) | `97d75370`, `8aa2ea74`, `ca6cdf07` |
| Property tests (ADR-0008) | 39 properties / 37 tests across name/detect/acquire parsers + the validateDownloadUrl security gate; 0 bugs found | `5af4bb66` |
| Decision trace (#399) | Debug-panel trace viewer + corpus-case export with test-pinned PII canary; the field-report→corpus-case path is live | `a3c1a4d8` |
| Corpus checksum manifest | sha256 over 101 corpus files, drift = build failure, `corpus:check` wired into the CI accuracy step | `4f9171a9` |
| ADR-0008 → Accepted | Status Accepted (2026-09-18) with evidence links | `6f7949e1` |

Also in-sprint: all QA tests went **headless** (Chromium new headless via `channel: 'chromium'`; qa 16/0/1, chromium smoke 20/20, edge 10/10 — identical to headed; `9b774a4d`). Bead `770` (popup i18n + `_locales` bundle copy) built but deliberately gated: the generator ships `_locales` only when `default_locale: 'en'` lands in wxt.config — which waits for the parallel session's uncommitted homepage_url edit (one-liner + `locales:generate` then closes it).

## Verification at close

test:accuracy 24/24 · corpus:check 101 files · characterization green · Stryker gate re-scored 95.64% PASS · tsc clean · unit suite 3,975+ passed / 11 failed (the standing parallel-session acquire-corpus set — analytics session's uncommitted background work) · qa-chromium 16 passed / 0 failed / 1 skipped (env canary), headless.

## Process note (ruled deviation)

Per-task reviews for T1–T6 were collapsed into one whole-sprint review (context budget). Risk accepted and mitigated: every task carried RED-first test evidence, and the final reviewer independently re-executed the gates rather than trusting the ledger.

## Parked

- 770 one-liner (default_locale) — after homepage_url lands.
- `.comment-count`/`.comment-text` generic-class FP watch (precision 1.0 on corpus; field reports would surface).
- Tripwire regex for default_locale could false-positive on a commented-out line (local load catches it).
- The 11 acquire-corpus failures — analytics session's landing.
