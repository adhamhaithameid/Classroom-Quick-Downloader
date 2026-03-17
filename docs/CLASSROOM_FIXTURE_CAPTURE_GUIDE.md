# Classroom Fixture Capture Guide

Last updated: 2026-03-17

## Purpose

This guide explains how to capture real Google Classroom pages for extension
testing while keeping private data out of git.

## Capture policy

Fixture capture is now maintenance-driven, not endless.

We capture new fixtures only when one of these is true:

1. Google Classroom changed the DOM shape of a protected surface,
2. a real bug report exposed a missing page shape,
3. we intentionally added support for a new surface,
4. an existing regression test was not enough to explain a failure.

If none of those happened, the current committed fixture set is enough and
should be treated as the baseline safety net for `1.5.5`.

## Safety rule

Raw Classroom captures are local-only.

Commit only:

1. sanitized fixture HTML,
2. metadata manifests,
3. test files that use the sanitized fixtures.

Do not commit:

1. raw signed-in Classroom HTML,
2. raw screenshots containing private course or student content,
3. browser profiles,
4. anything with real names, emails, or private identifiers.

## Recommended browser setup

Use a dedicated non-primary browser profile.

Why:

1. avoids disturbing the daily browser session,
2. keeps capture work reproducible,
3. reduces the chance of accidentally mixing private browsing data.

This also means fixture capture should be an explicit maintenance task, not part
of normal daily browsing.

## Step 1 - Capture raw baseline pages locally

```bash
npx tsx tools/capture-classroom-snapshot.ts \
  --profile "/path/to/dedicated/chrome-profile" \
  --output "verification/baseline/$(date +%F)"
```

During capture:

1. sign in first,
2. navigate to the requested page type,
3. press Enter in the terminal to capture that page.

Useful high-value surfaces:

1. stream
2. classwork list
3. material details
4. assignment details
5. one page with comment and edited flags
6. one RTL page if available

## Step 2 - Sanitize a raw snapshot into a test fixture

```bash
npx tsx tools/extract-fixture.ts \
  verification/baseline/2026-03-10/snapshots/stream/snapshot.html \
  --output extension/tests/fixtures/classroom \
  --page-type stream-flagged-post \
  --lang en
```

What the extractor removes or normalizes:

1. emails,
2. profile image URLs,
3. authuser values,
4. class IDs,
5. post IDs,
6. Drive IDs,
7. common action labels containing user-specific text.

## Step 3 - Add or update a matching regression test

Every committed fixture should have a real test.

Good homes:

1. `extension/tests/classroom-baseline-regression.test.ts`
2. `extension/tests/classroom-visual-regression.test.ts`
3. `extension/tests/classroom-dom-stress.test.ts`

## Step 4 - Update the capture metadata

Update:

1. `verification/baseline/<date>/README.md`
2. `verification/baseline/<date>/manifest.json`
3. `verification/baseline/<date>/issues.json`

These files should say:

1. what was captured,
2. what was committed safely,
3. what still needs more coverage.

## Step 5 - Validate before commit

```bash
pnpm -C extension run test:golden
pnpm -C extension run test
pnpm -C extension run build
```

If the fixture is meant to protect a known-good behavior, the corresponding regression test must fail when the fixture is removed or changed incorrectly.
