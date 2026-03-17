# Extension Hardening Follow-Up Board

Last updated: 2026-03-17
Branch: `try/extension-hardening-followup`
Target PR base: `Not_Stable`

## Purpose

This board defines the next implementation slice after the current `1.5.5` stabilization work.

The extension is already in a strong state. Buttons feel correct, flags feel correct, and the main user flow works well. Because of that, the goal of this follow-up is not to rewrite the product for the sake of refactoring. The goal is to protect what already works, harden the remaining weak areas, and prepare future engine work without destabilizing the current line.

## Why this PR exists

The open `Not_Stable -> main` PR is already carrying the `1.5.5` stabilization work. The safest next step is to branch from that line and keep the remaining hardening work in a dedicated follow-up PR instead of mixing it into the current release candidate.

This follow-up branch exists to do three things:

1. lock the current good behavior into durable fixtures and regression tests,
2. improve the internal model of attachments and post decisions,
3. scope the future `1.6.0` API-assisted work without forcing it into the stable DOM-first line.

## Issue map

### Protect the current good state
- #396 Freeze 1.5.5 Classroom golden fixtures and regression matrix
- #399 Build a per-post and per-file decision trace for extension debugging

### Smarter and safer download detection
- #397 Introduce first-class attachment classification in the extension engine
- #395 Enforce canonical attachment identity across scan, render, and download-all flows
- #394 Close the Student Work download gap with viewer and network correlation

### Runtime cleanup and long-term maintainability
- #401 Consolidate extension runtime ownership behind the V2 lifecycle
- #400 Centralize exclusion rules and validate extension visuals in dark mode, RTL, and long posts

### Future API milestone design
- #398 Design the 1.6.0 API-assisted engine consent and fallback model

## Proposed implementation order

### Step 1 — Freeze the current strong behavior
Start with #396 and #399.

Why first:
- These tasks reduce risk immediately.
- They make future changes measurable.
- They protect the exact placements and exclusions that already feel right.

Expected effect:
- future engine changes become much safer,
- regressions become cheaper to catch,
- debugging becomes faster and more explainable.

### Step 2 — Improve the attachment model
Continue with #397 and #395.

Why next:
- These are the cleanest internal hardening tasks.
- They reduce false positives without forcing a broad rewrite.
- They improve the consistency of detection, render, and Download All behavior.

Expected effect:
- clearer rules for which targets should get a button,
- fewer edge-case duplicates,
- stronger foundation for future page coverage.

### Step 3 — Close the biggest remaining functional gap
Then take #394.

Why here:
- Student Work is still one of the most meaningful remaining real-world misses.
- By this point, the attachment model and regression harness will be strong enough to support that work.

Expected effect:
- broader completeness,
- fewer missed files in indirect Classroom surfaces.

### Step 4 — Clean up ownership without destabilizing the UI
After that, take #401 and #400.

Why later:
- The product already behaves well for users.
- Ownership cleanup matters, but it should be driven by evidence and fixture coverage, not by impatience.

Expected effect:
- cleaner internals,
- lower maintenance cost,
- better behavior on heavy, RTL, or dark-mode pages.

### Step 5 — Decide whether API work is truly worth the complexity
Keep #398 last.

Why last:
- API work changes permissions, trust, and release risk.
- The DOM-first line should prove its ceiling before API work starts.

Expected effect:
- better product judgment,
- clearer future `1.6.0` scope,
- lower risk of overbuilding.

## Non-goals for this follow-up branch

This branch should not:
- rewrite the entire extension just because the architecture can be cleaner,
- ship API permissions early,
- destabilize the current `1.5.5` button or flag behavior,
- reopen already-solved placement problems without real evidence.

## Release intent

This branch is intended to feed the work that comes after the current `1.5.5` stabilization line.

- `1.5.5` remains the strong DOM-first milestone.
- `1.6.0` remains reserved for real API-assisted work, if and only if that work proves necessary.

## Validation expectations

Any implementation under this branch should preserve the following:

1. Forms and Sheets should not receive download buttons.
2. Real Classroom file cards should keep their download buttons.
3. Flags should remain single, stable, and real-time reactive.
4. New hardening work should be backed by fixtures and regression tests.
5. No change should be considered complete until the extension suite and coverage gates are green.
