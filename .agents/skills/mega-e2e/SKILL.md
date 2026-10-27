# Skill: mega-e2e

Run the full pre-deploy quality gate for the Classroom Quick Downloader
extension. USE THIS BEFORE ANY STORE DISPATCH — the stores workflow runs the
CI-side gate automatically, but the local full matrix (Edge, signed Firefox,
live Classroom) only runs through this skill.

## When to run

- Before publishing any version to any store (required; use
  `--require-live` for store-dispatch mode).
- After any change to detection selectors, the download pipeline, the popup,
  or anything Classroom-DOM-facing.
- When investigating "works on my machine" reports — the drift probes and
  report often name the regression directly.

## How to run

```bash
scripts/mega-e2e              # full local matrix (see stage list)
scripts/mega-e2e --quick      # build + unit + golden + chromium + drift
scripts/mega-e2e --require-live  # store mode: live suites become required
```

The run writes `qa-artifacts/mega-e2e/report.md` (human summary),
`report.json` (machine), per-stage logs, and `drift-probes.json`.

## Stages and what a failure means

| Stage | Covers | On failure |
| --- | --- | --- |
| build | chrome-mv3 + firefox-mv2 compile | build config broke; read `build.log` |
| unit | full extension vitest suite (incl. security, xss, validator) | a regression test caught a real defect — fix before anything else |
| golden | regression + fuzz + stress + visual sub-suites | detection contract drifted against fixtures |
| e2e-chromium | real-browser injection + downloads on fixtures | the product broke end-to-end on Chrome-for-Testing |
| e2e-edge | same suite on Microsoft Edge | skip if Edge absent locally (CI covers it) |
| e2e-firefox | signed-Firefox QA leg on the staged signed.xpi | skip when no signed xpi — mint via the AMO QA companion (docs/EXTENSION_TESTING_RUNBOOK.md); remember AMO version endpoints go by SLUG now |
| popup-qa | qa/ journeys incl. the whole popup surface | popup UI or its messaging broke |
| live | real classroom.google.com as teacher+student (own account) | needs `LIVE_CLASSROOM=1` + a signed-in `tests/e2e/.live-profile` (`pnpm test:live:login`) |
| drift | DOM-drift probes over fixtures (+ ratios) | a required selector family matched NOTHING — capture a fresh fixture and update selectors; this stage exists because Google silently dropped `data-drive-id` (bead bs7c) |

## Reading the discovery layer

- `report.md` lists every skip with the exact unlock command — nothing
  silently passes.
- `drift-probes.json` shows the marker ratio (`data-drive-id` vs
  `aria-label="Attachment:"` cards). A flip toward zero on a family the
  engine keys on is the early warning of another markup change.
- For styling/placement suspicion, open `qa-artifacts/mega-e2e/*.log` for
  the failing stage and the Playwright error contexts (screenshots) it
  references; the popup/qa journeys already assert placement contracts.

## After a failure

1. Read the stage log — the tail is copied into `report.json`.
2. Selector/drift failures: capture a fresh Classroom fixture
   (docs/CLASSROOM_FIXTURE_CAPTURE_GUIDE.md), update
   `extension/entrypoints/content/state.ts` selectors or the observers'
   container resolution, and add a regression test with the captured markup
   (see `content-observers.test.ts` "2026-10 card markup" for the pattern).
3. Never re-run with a stage disabled to "get to green" — fix or explicitly
  accept the skip in the PR description.
