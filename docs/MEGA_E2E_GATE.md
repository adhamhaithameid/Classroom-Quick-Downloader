# MEGA-E2E — the pre-deploy quality gate

One command runs every verification layer the project has, writes a
discovery report, and fails loudly when anything required is missing. The
stores workflow (`extension-stores.yml`) runs its CI-side scope
automatically on every dispatch; the full local matrix (Edge, signed
Firefox, live Classroom) runs via `scripts/mega-e2e` — see the agent skill
at `.agents/skills/mega-e2e/SKILL.md`.

## Why this exists

On 2026-10-25 the live HITL gate caught Google dropping `data-drive-id`
from Classroom attachment cards (bead `bs7c`): download buttons silently
disappeared from assignment details pages for every user, while every
fixture test stayed green. The lesson: fixture suites prove the past; a
pre-deploy gate needs a discovery layer that watches the contracts
themselves. The mega-e2e drift probes are that layer.

## Quick start

```bash
scripts/mega-e2e --quick        # ~3 min: build, unit, golden, chromium, drift
scripts/mega-e2e                # full matrix (edge/firefox/popup/live as available)
scripts/mega-e2e --require-live # store-dispatch mode: live suites required
```

Report: `qa-artifacts/mega-e2e/report.md` (+ `report.json`, per-stage logs,
`drift-probes.json`).

## Stages

| Stage | Command | Required |
| --- | --- | --- |
| build | `pnpm -C extension run build` | yes |
| unit | `pnpm -C extension test` | yes |
| golden | `pnpm -C extension run test:golden` | yes |
| e2e-chromium | `pnpm test:e2e` | yes |
| e2e-edge | `pnpm test:e2e:edge` | when Edge installed |
| e2e-firefox | `pnpm -C extension test:qa:firefox-signed` | with `--require-firefox` |
| popup-qa | `playwright --project=qa-chromium` | optional |
| live | `LIVE_CLASSROOM=1 playwright --project=live-chromium tests/e2e/live/` | with `--require-live` |
| drift | `node tools/mega-e2e/drift-probes.mjs` | yes |

## The discovery layer

`drift-probes.mjs` pins three REQUIRED selector families (drive anchors,
`aria-label="Attachment:"` cards, stream posts) against the committed
fixtures and fails when a family matches nothing. It also records the
marker ratio (`data-drive-id` vs aria-label fixtures) so a drift trend is
visible before it becomes an outage. When it fires:

1. Capture a fresh fixture (docs/CLASSROOM_FIXTURE_CAPTURE_GUIDE.md).
2. Update the selectors in `extension/entrypoints/content/state.ts` /
   the observers' container resolution.
3. Add a regression test with the captured markup (pattern:
   "2026-10 card markup" in `extension/tests/content-observers.test.ts`).

## Automation

- **Stores workflow**: the `mega-e2e-gate` job (quick scope) runs before
  every store publish and blocks all three publish jobs on failure; the
  report is uploaded as an artifact.
- **Local**: run the full matrix before dispatching; `--require-live` for
  release mode.
- **Agents**: the skill `.agents/skills/mega-e2e/SKILL.md` teaches reading
  the report and reacting to each failure class.
