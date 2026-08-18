# Session log — Detection engine seam, Plan A

Date: 2026-08-18
Branch: `feat/detection-engine-seam` (7 commits, **not pushed**)
Base: `main` @ `e4745536`

---

## What was asked

1. Define goals, user stories, acceptance criteria and a plan for the approved
   detection-engine seam design.
2. Execute that plan inline, without stopping.

## What was delivered

### The plan

`docs/superpowers/plans/2026-08-18-detection-engine-seam.md` — 1,711 lines.
Covers spec steps 2-4; steps 5-7 (StructuralDetector, compare mode, evaluation)
are deferred to a Plan B written after this merges.

Four decisions were taken before writing, by asking rather than guessing:

| Decision | Choice | Consequence |
|---|---|---|
| Ordering | Seam-first | #396/#673 real captures become a parallel track, not a blocker |
| Nile | Nile **green** `#1a7f5a` | Avoids collision with the structural tertiary blue |
| Scope | Two plans, A now | Plan A ships value alone |
| Git flow | Feature branch + PR | No ruleset bypass |

### The implementation

Seven commits, one per task, each independently revertible:

```
6b5f0312 test: enforce detection seam import boundary
3fc58876 refactor: make flag scoring a detect/decide adapter
e2ca6e54 feat: add KeywordDetector behind the seam
4f443592 feat: add language-free decide layer
7e7bca1e refactor: move keyword scoring into src/detect
5478fe4d feat: add detect/decide contracts and themes
8d8a76cd test: characterize v2 flag scoring output
```

16 files, +2,575 / -957.

**New structure**

- `src/contracts/` — `PostObservation`, `PostDecision`, `Detector`,
  `DetectContext`, plus the two compare-mode themes. Types and data only.
- `src/detect/keyword/` — `keyword-scoring.ts` (862 lines moved out of
  `flag-scoring.ts`) and `keyword-detector.ts`. The only keyword-aware code.
- `src/decide/` — `thresholds.ts` and `decide-flags.ts`. Pure; no DOM, no
  language, no page text.
- `src/v2/decision/flag-scoring.ts` — 1,013 lines to 95. Now an adapter.

**Behaviour change: none.** Proven, not asserted — see Verification.

---

## Technicalities worth being able to explain

1. **Why exclusions moved into the detector.** `applyExclusions` reasons over
   matched page *text*. If it ran downstream, `PostDecision` would have to carry
   that text across the seam, and Decide would become language-aware again. So
   exclusions run inside `KeywordDetector` and `PostObservation.strength` is
   already net of penalties. The penalty *rule ids* still cross the seam —
   `ruleId` is semantic, the matched string is not.

2. **Why the arithmetic is bit-identical.** The exclusion partition was copied
   verbatim: comment exclusions collected first, then edited, then every penalty
   routed by whether its `ruleId` contains `COMMENT`/`ACTION_BTN` (to comment) or
   `EDITED` (to edited), then both clamped at zero. Order matters because a
   penalty derived from the edited match can still route to the comment score.

3. **Why `THRESHOLDS` is not `as const`.** The original was a plain object
   literal, and `getThresholds(): typeof THRESHOLDS` is part of the public
   surface that `tests/v2-flag-scoring.test.ts` consumes unedited. `as const`
   would have narrowed the return type.

4. **Why `Detector.reset()` exists.** `EngineV2.destroy()` called
   `clearKeywordCache()` directly — orchestration knowing the detector has a
   keyword cache. It now calls `keywordDetector.reset()`. The hook is optional on
   the interface because `StructuralDetector` is not expected to hold state.

5. **Why the characterization snapshots layer scores, not just verdicts.** Only
   two of six posts produce a non-`none` verdict, and both are `edited`. If the
   snapshot held verdicts alone, a comment-path regression would be invisible.
   It holds every layer's score, match flag and matched text, so
   `comment-L4 score=20` on `stream-flagged-post-en.html` is locked even though
   it sits below the `comment_show: 40` threshold.

---

## Verification performed

Full CI extension job, run locally, all green:

| Gate | Result |
|---|---|
| `test:fixtures:manifest` | 2 passed |
| `test` | 106 files, 3,324 tests passed |
| `test:golden` | 4 sub-suites, 102 tests passed |
| `compile` (`tsc --noEmit`) | clean |
| `test:coverage:all` (critical + runtime, 100% thresholds) | both passed |
| `wxt build -b chrome / firefox / edge` | all three succeeded, 3.01 MB each |

Acceptance criteria:

- **AC1** characterization baseline byte-identical after the rewiring — passed.
- **AC2** no keyword import outside the keyword layer — passed, and
  *negative-tested*: adding `import { detectPageLanguage } from
  '../v2/decision/keyword-loader'` to `src/decide/` made the test fail naming
  the exact offender; removing it went green.
- **AC3/AC4** `tests/v2-flag-scoring.test.ts` passes (22 tests) and
  `git diff --exit-code` on it returns 0 — the contract file was never edited.
- **AC5** palette collision guard — 5 tests passed.
- **AC6** Decide tested with no DOM in the file — 12 tests passed.

Note: the two macOS-only `popup-legend-a11y` failures the 2026-08-16 handoff
warned about **did not occur** in any run this session. Not investigated; simply
observed as green.

---

## Deviations from the plan, and why

1. **The "at least one post in every fixture" assertion was wrong.** Three
   fixtures — `assignment-details-en.html`, `material-details-en.html`,
   `student-work-teacher-en.html` — contain zero post cards. Verified this is a
   property of the fixtures, not of the enumerator: `queryPostCards()` and
   `DOMScanner.fullScan()` agree on the count for all nine. Their own header
   comments confirm they are attachment/button fixtures. Replaced with an
   explicit partition asserting those three yield *exactly* zero — strictly
   stronger, since it also catches a post-less fixture starting to produce posts,
   which is the loose-selector regression they exist to guard.

2. **The import-boundary test's model was wrong on first run.** It flagged
   `keyword-loader.ts` and `exclusion-engine.ts` for importing
   `detection-keywords` — but those two *are* the keyword layer. Corrected to
   distinguish the keyword layer from its consumers, and added a guard asserting
   every allowlisted path exists so the allowlist cannot rot into a silencer.

3. **One genuine offender found and fixed.** `src/engines/v2/engine-v2.ts:74`
   imported `clearKeywordCache` from `keyword-loader`. Routed through
   `Detector.reset()` as described above. The plan predicted this file by name.

4. **Two plan-text defects caught in self-review before execution.**
   `ExclusionTrace.matchedText` is `string`, not `string | null` — the adapter
   would have failed `tsc`; and a duplicated `node:fs` import.

---

## Blast radius

**What could break:** nothing user-visible. Detection arithmetic is unchanged and
locked by the baseline; the V1 production render path was not touched; the two
100%-threshold coverage profiles cover `entrypoints/background/**` and
`entrypoints/utils/analytics/**`, none of which this branch modifies.

**Exposure that remains:** "zero behaviour change" is proven for **English and
Arabic only**. The nine fixtures cover 8 ViewKinds and one RTL case; the other 11
shipped languages have no fixture coverage. That gap is #396/#673 and needs a
human capture session with a live Classroom account.

**Rollback:**
- Nothing is pushed. `git checkout main` and the branch is inert.
- Per task: `git revert <sha>` in reverse order. Commits 8d8a76cd, 5478fe4d and
  4f443592 are pure additions and safe to leave.
- Reverting 3fc58876 alone restores the original `scoreFlagsForPost`.
- No storage schema change, no migration, no settings change. The existing
  `cqdV2.mode` toggle still disables the whole V2 path.

---

## Dead code noticed, not touched

- `src/detection/index.ts` — a barrel re-exporting the V1 content scripts, with
  **zero importers**. Left over from commit `407a8484`. Deletion candidate.
- `isInExcludedArea` is imported by `keyword-scoring.ts` and never used. This was
  already true in `flag-scoring.ts` before the move; preserved to keep the move
  faithful.

---

## Open items

1. **Push and PR not done** — stopped deliberately. Publishing to a public repo
   needs a separate yes.
2. **#396/#673 real-language fixtures** — parallel track, still owed.
3. **Plan B** — spec steps 5-7. Write against the `Detector` interface now that
   it exists.
4. **Render is not wired to `PostDecision`.** Render still consumes
   `FlagDecision` via the adapter. `Theme` has no consumer yet — deliberate.
5. **`PostDecision` has no `showDownloadButton`**, though the spec lists it.
   Placement lives in `file-placement.ts` with its own type and callers; folding
   it in would have doubled the blast radius. Deferred to Plan B.
