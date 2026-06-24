# CQD Refactor Plan — Current Practical Roadmap

Last updated: 2026-03-11

## Purpose

This file is the practical roadmap for the extension engine work.
It is intentionally written in a simpler, to-do style format.

It exists to answer:

1. what the refactor is supposed to achieve,
2. what is still worth doing,
3. what can safely wait,
4. how release numbering should map to the real work.

## Release Mapping

Use this version mapping from now on:

- `1.5.5` = the major DOM-first engine milestone.
- `1.6.0` = the first real API-assisted engine milestone.

This replaces the old planning names:

- old `4.0.0` → now `1.5.5`
- old `4.2.1` → now `1.6.0`

## Important Reality Check

The extension is currently in a strong state.

That changes how this plan should be used:

- this is no longer a "rewrite everything immediately" plan,
- this is now mostly a "protect what works, improve only where it matters, and avoid self-inflicted regressions" plan.

So every phase below should be read through that lens.

## Operating Rule For `1.5.5`

For the current release line:

1. treat the current runtime behavior as the product baseline,
2. preserve current button and flag behavior unless a real bug proves they are wrong,
3. use fixtures and regression tests as the enforcement layer for that baseline,
4. capture new fixtures only when Google Classroom changes shape or a real bug exposes a missing case.

This keeps the plan grounded in the product that already works well instead of
pulling us into unnecessary engine churn.

## Current Progress Snapshot

Already completed in the protection-focused pass:

1. initial real Classroom baseline capture from a dedicated non-Arc browser profile,
2. committed sanitized golden fixtures for current good attachment and flag behavior,
3. extension-only regression, fuzz, stress, and visual suites,
4. CI gating for the extension golden suites,
5. dedicated runbooks for testing and fixture capture,
6. explicit policy that `1.5.5` is the protected product baseline,
7. explicit maintenance rule to capture new fixtures only when Classroom changes or a real bug reveals a missing case.

Still intentionally not done in this pass:

1. runtime ownership changes,
2. Student Work support,
3. API-assisted discovery,
4. broad V2 promotion.

---

## Phase 0 — Protect The Current Good State

### [x] Capture real baselines from working Classroom pages

What this means:
- Save real HTML snapshots and screenshots from the exact page types where CQD currently behaves correctly.

Why do it:
- The current state is good enough that losing it would be expensive.

Effect:
- Future changes become much safer.
- You get a real before/after reference instead of relying on memory.

Maintenance rule:

1. do not keep capturing fixtures just to grow the library,
2. add new fixtures only when Classroom changes or when a real bug reveals a new shape,
3. treat the current fixture set as the default protection layer for `1.5.5`.

### [x] Convert those baselines into reusable test fixtures

What this means:
- Turn the captured pages into sanitized regression fixtures for tests.

Why do it:
- Real fixtures are the best defense against breaking good placements and good detections.

Effect:
- Safer selector work.
- Safer engine work.

### [x] Record a simple issue catalog for any remaining misses

What this means:
- Document the exact pages or link types that still fail, instead of keeping them as vague future work.

Why do it:
- Refactor work is much easier when the missing cases are concrete.

Effect:
- Better prioritization.
- Less speculative engineering.

---

## Phase 1 — Clean Up The Runtime Without Changing User Experience

### [ ] Move more behavior behind one shared V2-style lifecycle

What this means:
- Reduce the amount of behavior owned by separate legacy scripts.

Why do it:
- The current codebase still has split ownership between old and new paths.

Effect:
- Cleaner internals.
- Easier debugging.
- Lower long-term maintenance cost.

### [ ] Reduce overlapping observers and timers

What this means:
- Move toward fewer independent mutation observers and heartbeat loops.

Why do it:
- Multiple scanners increase CPU cost and complexity.

Effect:
- Better performance on heavy Classroom pages.
- Fewer timing races.

### [ ] Keep legacy as rollback, not as the long-term normal path

What this means:
- Preserve fallback safety, but stop treating legacy as the place where new behavior should continue to grow.

Why do it:
- A permanent dual system becomes expensive and fragile.

Effect:
- Clearer ownership of behavior.
- Cleaner future releases.

---

## Phase 2 — Improve Detection Logic Only Where It Actually Helps

### [ ] Make attachment classification explicit

What this means:
- Every candidate becomes one of:
  - downloadable,
  - open-only,
  - unsupported,
  - unknown.

Why do it:
- This is the cleanest way to prevent random download buttons on the wrong link types.

Effect:
- Better accuracy.
- Cleaner logic.
- Easier future extension of the engine.

### [ ] Enforce canonical identity for files

What this means:
- Give every file one stable internal identity.

Why do it:
- Dedupe, grouping, and stable button behavior all depend on this.

Effect:
- Better Download All behavior.
- Fewer duplicates.

### [ ] Expand page coverage only when the usage justifies it

What this means:
- Do not chase every Classroom page immediately.
- Expand only where users actually need more coverage.

Why do it:
- The extension already feels strong in the main path.

Effect:
- Better engineering ROI.
- Lower regression risk.

---

## Phase 3 — Finish The Missing Big Functional Gap

### [ ] Close Student Work support

What this means:
- Support the surfaces where Classroom hides the real file behind student-work or indirect viewer flows.

Why do it:
- This is still one of the most meaningful remaining product gaps.

Effect:
- Better real-world completeness.
- Fewer missed files.

### [ ] Decide whether network-based correlation is enough before starting API work

What this means:
- Try the lighter-weight route first if it solves the actual gap.

Why do it:
- API work brings more complexity, more permissions, and more publishing risk.

Effect:
- Possibly better coverage without a permission jump.

---

## Phase 4 — Make The Engine Easier To Explain And Safer To Change

### [ ] Build a per-post decision trace

What this means:
- For each post/file, record why the engine made the decision it made.

Why do it:
- Debugging becomes dramatically easier when decisions are explainable.

Effect:
- Faster fixes.
- Lower risk when touching selectors or scoring.

### [ ] Keep exclusions centralized and test-backed

What this means:
- The rules for what should not trigger a button or flag should live in a shared, explicit place.

Why do it:
- False positives usually come from scattered, implicit exclusions.

Effect:
- Better trust in CQD behavior.
- Easier maintenance.

### [ ] Treat dark mode, RTL, and long posts as mandatory validation cases

What this means:
- These are not edge polish items; they are real reliability requirements.

Why do it:
- Visual correctness often breaks first in these environments.

Effect:
- Better global stability.

---

## Phase 5 — Security And Safety Discipline

### [ ] Keep strict URL validation in place

What this means:
- Continue validating every download target before it is used.

Why do it:
- Download features are security-sensitive.

Effect:
- Lower risk.
- Fewer malformed-target bugs.

### [ ] Keep Classroom fixtures sanitized

What this means:
- No raw student/teacher/account data should land in the repo.

Why do it:
- Privacy and repo hygiene matter.

Effect:
- Safer testing workflow.

### [ ] Keep DOM evidence treated as untrusted input

What this means:
- Never assume arbitrary text or attributes are safe to trust.

Why do it:
- Classroom pages are full of mutable content and UI noise.

Effect:
- Fewer false positives and fewer risky assumptions.

---

## Phase 6 — `1.5.5` Stabilization And Sign-Off

### [ ] Freeze the behavior that already feels correct

What this means:
- Treat the current placements and detections as the target baseline for `1.5.5` quality.

Why do it:
- You are already happy with the current state.

Effect:
- The release line becomes stable and defendable.

### [ ] Use shadow/validation only as evidence, not as an excuse to rewrite good behavior

What this means:
- Validation should protect success, not force unnecessary churn.

Why do it:
- The refactor should serve the product, not the other way around.

Effect:
- Better judgment about what actually needs work.

---

## Phase 7 — `1.6.0` API Work (Optional, Later)

### [ ] Decide whether the DOM-first line has truly reached its ceiling

What this means:
- Only start API work if there are important files or workflows the DOM-first engine genuinely cannot cover well enough.

Why do it:
- API work is expensive in complexity and permissions.

Effect:
- Better product judgment.

### [ ] Design consent and fallback before implementing API logic

What this means:
- The permission UX, failure UX, and DOM-only fallback must be clear before any API release work begins.

Why do it:
- `identity` is not just a technical change; it is a product and trust change.

Effect:
- Safer rollout.
- Better store-review posture.

### [ ] Use API as inventory truth, not placement truth

What this means:
- The API should help discover what exists.
- The DOM should still decide what the user is looking at and where controls belong.

Why do it:
- This produces the strongest hybrid model.

Effect:
- Better completeness without sacrificing placement quality.

---

## Recommended Order From Here

If the goal is to be practical and low-risk, use this order:

1. preserve and maintain the current good state,
2. add first-class attachment classification,
3. close Student Work only if it matters to real usage,
4. consolidate the runtime only if more engine work is still planned,
5. defer API work until the DOM-first line clearly needs it.

## Final Guidance

Because the extension currently feels excellent, the smartest move is not a dramatic refactor.

The smartest move is:

1. preserve the current good state,
2. explain it better,
3. only touch deeper engine architecture where it buys real value.
