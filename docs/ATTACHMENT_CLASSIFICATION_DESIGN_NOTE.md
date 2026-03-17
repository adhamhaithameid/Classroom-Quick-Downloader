# Attachment Classification Design Note

Last updated: 2026-03-11

## Purpose

This note describes a small, safe architecture improvement for the extension:
explicitly classify every detected target before deciding whether to render a
CQD button.

This is intentionally a design note only. It does not change runtime behavior
by itself.

## Why this matters

The extension is currently in a strong state, but the hardest class of bugs in
download detection still comes from ambiguous links:

1. real attachment cards that should get a button,
2. Google-hosted links that look file-like but are not downloadable,
3. body-copy links that should stay untouched,
4. indirect viewer routes that may become downloadable later.

Right now, many of those decisions are handled through guardrails and negative
filters. That works, but it is harder to reason about than a single explicit
classification model.

## Proposed model

Every discovered candidate should be classified into exactly one of these
states:

1. `downloadable`
2. `open_only`
3. `unsupported`
4. `unknown`

## What each class means

### `downloadable`

Use when the extension is confident that the target represents a real file that
CQD should handle.

Examples:

1. Drive file attachment cards
2. supported Google Docs-family file types that CQD can normalize safely
3. Classroom attachment containers with a real file identity

Expected behavior:

1. render a download button,
2. include in Download All when applicable,
3. allow downstream normalization and validation.

### `open_only`

Use when the target is a valid user resource, but not one CQD should download
directly.

Examples:

1. external learning links,
2. video links,
3. resources that should open in the browser instead of being downloaded.

Expected behavior:

1. do not render a CQD download button,
2. optionally support a future non-download action if the product ever wants it.

### `unsupported`

Use when the target is recognized, but CQD should explicitly avoid treating it
as downloadable.

Examples:

1. Google Forms,
2. Google Sheets editor/share links,
3. Classroom controls or body-copy links that are not file attachments.

Expected behavior:

1. no CQD button,
2. explicit trace reason explaining why it was rejected.

### `unknown`

Use when the engine cannot confidently decide yet.

Examples:

1. incomplete viewer routes,
2. malformed or partially normalized links,
3. future Classroom shapes that need more evidence.

Expected behavior:

1. default to no button,
2. keep a decision trace so the case can be diagnosed later,
3. allow future promotion to `downloadable` once enough evidence exists.

## Suggested classification inputs

Classification should combine multiple signals instead of depending on URL
shape alone.

Priority order:

1. attachment container evidence
2. canonical file ID evidence
3. normalized URL type
4. host allowlist result
5. known blocked product family
6. page context and placement rules

This lets the engine answer:

1. "is this inside a real attachment card?"
2. "does it resolve to one stable file identity?"
3. "is this a supported downloadable resource?"

## Suggested decision flow

1. discover candidate element,
2. resolve nearest eligible attachment container,
3. extract canonical identity if possible,
4. normalize URL,
5. classify candidate,
6. only if `downloadable`, continue to render/inject.

That means injection becomes a consequence of classification, not the other way
around.

## Why this is safer than broad rewrites

This improvement can be introduced gradually.

Safe rollout:

1. add classification as internal metadata only,
2. keep current visible behavior unchanged,
3. log/trace the classification during tests and debug flows,
4. promote existing render guards to depend on classification once parity is
   proven.

This avoids destabilizing the current `1.5.5` behavior.

## Immediate benefits

If implemented carefully, this would give us:

1. fewer random buttons on body links,
2. clearer reasoning for why a candidate was accepted or rejected,
3. easier future support for Student Work and indirect viewer flows,
4. simpler regression tests because the expected class becomes part of the
   contract.

## Relationship to the current baseline

This is not a reason to change the current user-visible behavior immediately.

The current `1.5.5` behavior remains the baseline.
Attachment classification should be introduced as an internal explanation layer
first, then used to simplify and harden the runtime later.

## Recommended next step

If this work is chosen later, the safest first implementation step is:

1. define a small `AttachmentClass` type,
2. add classification tests for current fixtures,
3. compute the class without changing render behavior,
4. compare the classified result against the current golden suite before
   letting the runtime depend on it.
