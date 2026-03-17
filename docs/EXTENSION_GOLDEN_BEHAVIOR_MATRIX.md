# Extension Golden Behavior Matrix

Last updated: 2026-03-17

## Purpose

This document defines the current behavior that must stay true while the
extension engine continues to evolve.

It is not an architecture document. It is the contract for "do not break this."

## Baseline policy

As of `1.5.5`, the current extension behavior is the product baseline.

That means:

1. current button placement is treated as correct unless a real user bug proves otherwise,
2. current flag placement and one-card ownership are treated as correct unless a real user bug proves otherwise,
3. future engine work must preserve this behavior first and improve it second,
4. new fixtures should be added only when Google Classroom changes shape or when a real bug exposes a missing case.

This keeps the project focused on protecting the current good experience instead
of rewriting working behavior unnecessarily.

## Golden rules

1. Real Classroom attachment cards must get exactly one CQD button.
2. Loose post-body links must not get CQD buttons unless they are inside a real attachment container.
3. Google Forms links must never get download buttons.
4. Google Sheets editor/share links must never get download buttons.
5. A flagged post must resolve to one outer visual card, not an outer card plus an inner bordered section.
6. Comment and edited indicators must stay attached to the same visual post card.
7. RTL pages must preserve the same one-card ownership as LTR pages.
8. Toggle changes in the popup must apply live for comment and edited flags.

## Golden surfaces

### Stream post with flags

Required outcomes:

1. exactly one post card is detected,
2. edited metadata remains part of the same card,
3. comment count remains part of the same card,
4. nested wrappers do not become a second flagged card.

Fixtures:

1. `extension/tests/fixtures/classroom/stream-flagged-post-en.html`
2. `extension/tests/fixtures/classroom/rtl-flagged-post-ar.html`

Primary tests:

1. `extension/tests/classroom-baseline-regression.test.ts`
2. `extension/tests/classroom-visual-regression.test.ts`
3. `extension/tests/content-post-card-utils.test.ts`

### Classwork material card with mixed links

Required outcomes:

1. the real attachment card gets a button,
2. loose Forms and Sheets links in the body do not get buttons,
3. nested comment shell does not become a second card.

Fixtures:

1. `extension/tests/fixtures/classroom/classwork-material-post-en.html`
2. `extension/tests/fixtures/classroom/mixed-links-post-en.html`

Primary tests:

1. `extension/tests/classroom-baseline-regression.test.ts`
2. `extension/tests/content-observers.test.ts`
3. `extension/tests/classroom-dom-stress.test.ts`

## URL safety matrix

Allowed discovery examples:

1. `drive.google.com/file/d/...`
2. `drive.google.com/u/<n>/file/d/...`
3. `docs.google.com/document/d/...`
4. `docs.google.com/presentation/d/...`
5. `docs.google.com/drawings/d/...`
6. `classroom.google.com/drive?...`

Blocked examples:

1. `docs.google.com/forms/...`
2. `docs.google.com/spreadsheets/...`
3. `youtube.com/...`
4. `example.com/...`
5. `javascript:...`
6. `data:...`
7. malformed or suspiciously encoded Google URLs

Primary tests:

1. `extension/tests/classroom-link-fuzz.test.ts`
2. `extension/tests/download-validator.test.ts`
3. `extension/tests/content-url-utils.test.ts`

## Stress expectations

The extension should remain logically correct when the page contains:

1. hundreds of posts,
2. hundreds of real attachment cards,
3. many unsupported links mixed into post bodies,
4. deeply nested wrapper elements.

Primary tests:

1. `extension/tests/classroom-dom-stress.test.ts`
2. `extension/tests/scan_optimization.test.ts`

## Validation checklist before merge

1. `pnpm -C extension run compile`
2. `pnpm -C extension run test`
3. `pnpm -C extension run test:golden`
4. spot-check one real Classroom page in a non-primary browser profile if the change touches selector behavior

## When to add more fixtures

Do add a new fixture when:

1. Google Classroom changes the structure of a currently protected surface,
2. a real bug report shows a missing page shape,
3. a regression slips past the current suite,
4. a new supported surface is intentionally added.

Do not add a new fixture just because:

1. the existing behavior already matches the expected result,
2. the page is visually different but structurally equivalent to an existing fixture,
3. the change is only internal and does not alter a protected surface.

## What this document intentionally does not cover

1. Student Work support
2. API-assisted discovery
3. future V2 and V3 rollout decisions

Those are future engine improvements, not the current golden behavior contract.
