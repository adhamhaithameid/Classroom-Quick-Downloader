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
