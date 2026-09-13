# Extension Testing Runbook

Last updated: 2026-03-10

## Goal

This runbook explains how to verify the extension without relying on memory,
tribal knowledge, or the main browser profile.

## Fast local checks

Run these from the repo root:

```bash
pnpm -C extension run compile
pnpm -C extension run test
pnpm -C extension run test:golden
pnpm -C extension run build
```

What each command means:

1. `compile`
   - TypeScript safety only.
2. `test`
   - Full extension Vitest suite.
3. `test:golden`
   - Focused regression, fuzz, stress, and visual protection for current good Classroom behavior.
4. `build`
   - Confirms the browser bundle still emits correctly.

## Golden suites

```bash
pnpm -C extension run test:regression
pnpm -C extension run test:fuzz
pnpm -C extension run test:stress
pnpm -C extension run test:visual
```

Use these when a change is narrow and you want faster feedback than the full suite.

## Real Classroom verification

Use a dedicated browser profile, not the main daily-use profile.

Recommended flow:

1. start the dev extension,
2. open a dedicated Chrome or Brave profile,
3. sign into Google Classroom there,
4. verify a known-good classwork page and a known-good stream page.

Manual checks:

1. real attachment cards get one button,
2. Forms and Sheets links in post bodies do not get buttons,
3. flagged posts get one outer border only,
4. comment and edited toggles update the page live,
5. popup assets and settings render correctly.

## When to run the whole-project verification

Run this when the extension test and docs change is about to merge or when CI has been unstable:

```bash
pnpm run scan:repo
```

That includes:

1. strict repo-wide test matrix,
2. security scan,
3. package audits,
4. Oracle backend security checks.

## When to add or update a fixture

Add or update a fixture when:

1. a real Classroom page works especially well and you want to freeze that behavior,
2. a regression was fixed and should never come back,
3. a link shape or post layout caused a false positive or false negative.

Do not add raw Classroom HTML directly.

Use the fixture capture guide:

1. `docs/CLASSROOM_FIXTURE_CAPTURE_GUIDE.md`

## CI expectations

The extension CI job now checks:

1. full extension tests,
2. extension golden suites,
3. extension typecheck,
4. extension coverage gates.

If one of the golden suites fails, assume the change threatens current good behavior until proven otherwise.

## Automated Manual-QA Replay (2026-09-12)

The manual checks below are automated by the Manual-QA Replay pipeline
(`docs/superpowers/specs/2026-09-12-manual-qa-replay-design.md`). Run:

```bash
pnpm test:qa          # Chromium (MV3), headed, local simulator
pnpm test:qa:firefox  # Firefox (MV2)
pnpm test:qa:report   # rebuild qa-artifacts/report.md from artifacts
pnpm test:qa:live     # gated live-Classroom canary (read-only)
```

| Manual check | Automated check | Coverage |
|---|---|---|
| 1. attachment cards get one button | qa-01 | Full |
| 2. Forms/Sheets body links get no buttons | qa-01 | Full |
| Download All grouping/placement/progress/success/reset | qa-02 | Full |
| Download All hold-to-cancel | qa-02 | Full |
| Download All error state (all files fail) | qa-02-error | Skipped (HARNESS: retry timing) |
| Real download bytes + filename | qa-06 | Full (magic bytes + Content-Disposition) |
| Drive bypass flow lifecycle | qa-06-bypass | Full |
| Flagged post: one outer card, badges | qa-03 | Full |
| Comment count + tooltip | qa-03 | Full |
| Dark theme badges | qa-03-dark | Full |
| RTL ownership/geometry | qa-03-rtl | Full |
| 4. Live flag toggles (popup message path) | qa-03 | Full |
| 5. Popup render/settings/storage write | qa-04 | Partial (analytics card needs the real popup-window tab context) |
| Student-work submissions buttons | qa-05 | Skipped (HARNESS: needs fixture-derived rows) |
| SPA navigation, delayed posts, load-more, churn dedup | qa-05 | Full |
| Production DOM drift | qa-07 (gated, read-only canary) | Canary |

## Three testing layers

1. **Unit / golden tests** — engine logic, fast and deterministic (existing).
2. **Manual-QA Replay** — the built extension in real browsers against the
   minimal Classroom simulator (`tests/simulator/`).
3. **Live Classroom Canary** — read-only production drift detection against
   real Classroom; gated by `QA_LIVE_CLASSROOM=1` + `QA_LIVE_STORAGE_STATE`.

Never merge the three layers: they answer different questions.

## Firefox QA limitation (ENVIRONMENT, 2026-09-13)

`pnpm test:qa:firefox` runs the shared suite on the qa-firefox project. Verified
by probe: the MV2 xpi is present in the prepared profile
(`tests/e2e/.firefox-profile`) before launch, but Playwright's bundled Firefox
build deletes it within seconds of startup — it ignores
`xpinstall.signatures.required = false`, rejects the unsigned add-on and removes
the file, so no extension background page ever exists.

Consequences, by design of the failure-classification contract:

- Every extension journey (qa-01 … qa-06) **skips** on qa-firefox with the
  recorded `ENVIRONMENT:` reason — it does not fail and it does not fake a pass.
- `simulator-sanity` still runs on Firefox (it exercises the simulator, not the
  extension).
- Chromium journeys keep failing hard on qa-chromium, preserving the acceptance
  criterion that breaking the extension (e.g. renaming `.cqd-download-btn`)
  fails qa-01.

The journeys DO exercise the real Firefox MV2 build logic wherever possible at
the unit seam: `extension/tests/background-bypass-flow.test.ts` toggles the
Firefox adapter (bypass-tab flow) against the shared state machine. Revisit this
section if Playwright ships a Firefox build that honors unsigned sideloading.
