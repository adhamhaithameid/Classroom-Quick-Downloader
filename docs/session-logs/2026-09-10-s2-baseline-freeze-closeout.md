# S2 — Baseline Freeze Closeout (gate G0) — 2026-09-10

Closes [Classroom-Quick-Downloader-1yf.2](bd://Classroom-Quick-Downloader-1yf.2) (S2 — Baseline freeze, gate G0).

## Evidence

- **Corpus**: `extension/tests/accuracy/corpus/` — 40 labelled cases + `manifest.json`
  (41 entries). Locales: en, ar, es, hu, ja, ru (syn-* synthetic families) plus
  fx-* captured fixtures → **≥ 6 locales, ≥ 40 cases: met**.
- **Baseline numbers**: `extension/tests/accuracy/accuracy-budget.json` v2,
  `measuredOn 2026-08-22`. Floors (may only move up per ADR-0008):
  commentPrecision 1.0, commentRecall 0.777, editedPrecision 1.0,
  editedRecall 0.866, countExactRate 1.0, coverage 1.0.
- **knownFailures (6, may only shrink)**: rtl-flagged-post-ar,
  stream-edited-and-comments-en, fx-classwork-material-comments,
  fx-mixed-links-comments, syn-hu-both-flags, syn-hu-edited-only.
  First two = D12 (bead `…-ass`), rest are V2/detector gaps owned by S4+.
- **Tier A + Tier B**: `pnpm run test:accuracy` green (20 tests).
- **V1 characterization suite**: `extension/tests/characterization/` present,
  pinned, passing (`pnpm run test` 3474/3474 green on 2026-09-10).
- **CI wiring**: `.github/workflows/ci.yml` runs the accuracy suites — confirmed 2026-09-10.

## Verification protocol run 2026-09-10

- `pnpm --dir extension run compile` ✅
- `pnpm run test` ✅ 121 files / 3474 tests
- `pnpm run test:accuracy` ✅ 20 tests
- `pnpm run test:golden` ✅ 20 tests

## Verdict

G0 acceptance criteria met; S2 closed. S3 (gate G1) unblocked and also
delivered this window (see engine task list 2026-09-07, section F).
