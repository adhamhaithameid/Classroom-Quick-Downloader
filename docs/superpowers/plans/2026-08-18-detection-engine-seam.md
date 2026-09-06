# Detection Engine Seam — Plan A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the V2 flag-detection path into `Detect → Decide` behind typed contracts, so that exactly one module in the extension is allowed to know about keywords or page language.

**Architecture:** `KeywordDetector` (the only keyword-aware module) emits a language-free `PostObservation` of semantic facts. `decideFlags()` turns that into a `PostDecision` using score thresholds alone. `scoreFlagsForPost()` keeps its current signature and return type and becomes a thin adapter over the two, so no caller changes and no user-visible behaviour changes.

**Tech Stack:** TypeScript 6, wxt 0.21 (Vite), vitest 4 + jsdom, pnpm workspace. All paths below are relative to `extension/` unless stated otherwise.

---

## 1. Scope

Implements steps **2, 3 and 4** of `docs/superpowers/specs/2026-08-16-detection-engine-seam-design.md`:

| Spec step | In this plan |
|---|---|
| 1. Golden fixtures frozen | Partially — Task 1 uses the 9 fixtures already frozen in `tests/fixtures/classroom/` and adds a characterization lock. Real-language captures (#396/#673) stay a separate, non-blocking track. |
| 2. Extract the seam (`PostObservation`, `PostDecision`, `Theme`) | Yes — Task 2 |
| 3. Move V1 logic into `KeywordDetector` behind the interface | Yes — Tasks 3, 5 |
| 4. Strip keyword imports from `flag-scoring.ts` | Yes — Tasks 6, 7 |
| 5. Build `StructuralDetector` | No — Plan B |
| 6. Compare mode: dual render + instrumentation | No — Plan B |
| 7. Evaluate and promote | No — Plan B |

### Scoping decision: which "V1 logic" moves

The `pageLang + en + ar` keyword union exists in **two** places:

1. `entrypoints/content/smart-detector-comments.ts:519` and `entrypoints/content/smart-detector.ts:389` — the V1 content scripts. These are the **production render path** in the default `shadow` mode.
2. `src/v2/decision/flag-scoring.ts:790-792` and `:839-841` — the V2 port of the same logic. This is the path the seam design targets ("the engine intended to work on UI structure is still coupled to the keyword monolith").

**This plan moves (2) only.** The V1 content scripts are not touched — the spec is explicit that "the keyword path stays live and unchanged in production throughout", and those two files are that path. Their unions become dead code when the V2 path is promoted (PRD Phase 3), not before.

### Two deliberate departures from the spec

1. **`PostDecision` carries no `showDownloadButton`.** The spec lists "whether a download button belongs" as part of Decide's output. Button placement currently lives in `src/v2/decision/file-placement.ts` and `placement-recipes.ts`, which have their own decision type and their own callers. Folding them into `PostDecision` would double this plan's blast radius for no gain to the language-coupling problem it exists to solve. The field is added in Plan B, when compare mode needs both engines to agree about buttons.
2. **`Theme` lands unused.** Task 2 creates both palettes with no consumer — Render is not touched in Plan A. This is intentional: the spec puts `Theme` in step 2, and pinning it now converts the "nile blue or nile green?" open question into committed, test-guarded data instead of leaving it to be re-litigated in Plan B.

### Non-goals

- No change to detection accuracy, thresholds, or scoring arithmetic. Every number is preserved exactly.
- No `_locales/` keyword migration (#611/#612) — explicitly out of scope in the spec.
- No EventBus. The PRD's bus is a later, larger seam; this plan uses direct calls behind interfaces so it can land without it.
- No new user-facing feature.

---

## 2. Goals

**G1 — One keyword owner.** After this plan, exactly one file tree (`src/detect/keyword/`) imports `keyword-loader` or `detection-keywords`. Enforced by an automated test, not by convention.

**G2 — A language-free decision layer.** `src/decide/` reasons only over numbers and booleans. It cannot see page text, so it cannot have a language bug.

**G3 — Zero behaviour change.** Byte-identical `FlagDecision` output across all 9 golden fixtures, proven by a committed characterization snapshot taken before the refactor starts.

**G4 — A detector interface a second implementation can plug into.** `StructuralDetector` (Plan B) implements the same `Detector` interface and emits the same `PostObservation`, making the two directly comparable with no adapter.

**G5 — The compare-mode palette is pinned, not deferred.** Both `Theme` values exist as data with a test asserting no two roles collide — the specific failure mode flagged during design review.

---

## 3. User stories

### Story 1 — Maintainer fixing a language bug

> As the maintainer, when a user reports "the comment badge is wrong on the Portuguese Classroom", I want to know before I start that the fix lives in exactly one file, so I do not have to read the decision engine, the renderer, and two content scripts to find it.

**Acceptance criteria**

- `grep -rl "keyword-loader\|detection-keywords" src/decide src/contracts` returns nothing.
- A test fails the build if any file outside `src/detect/keyword/` imports a keyword module.
- `src/decide/decide-flags.ts` takes no `lang` argument and has no access to page text.

### Story 2 — Maintainer adding the structural detector

> As the maintainer, I want to add a second detector without editing the decision or render layers, so that adding it cannot regress the shipping path.

**Acceptance criteria**

- `Detector` interface exists with a single method `observe(post, ctx): PostObservation`.
- `KeywordDetector` implements it and is constructed, not imported as free functions.
- `decideFlags()` accepts any `PostObservation` regardless of which detector produced it; it never branches on `observation.detector`.
- A test constructs a hand-written `PostObservation` (no DOM, no detector) and gets a correct `PostDecision`.

### Story 3 — Maintainer refactoring without fear

> As the maintainer, I want proof that a refactor changed nothing, so I can land it on a Friday.

**Acceptance criteria**

- `tests/characterization/flag-scoring-baseline.json` is committed **before** any source file moves.
- After every subsequent task, `pnpm -C extension test` reproduces that snapshot exactly.
- The snapshot is normalised (no timestamps, no durations) so it is stable across runs.

### Story 4 — Contributor reading the code for the first time

> As a new contributor, I want the three layers to be obvious from the directory tree, so I do not have to read 1,000 lines of `flag-scoring.ts` to find where a decision is made.

**Acceptance criteria**

- Top-level dirs `src/contracts/`, `src/detect/`, `src/decide/` exist with one responsibility each.
- `extension/docs/ENGINE_ARCHITECTURE.md` documents the `Detect → Decide → Render` direction and the one-way import rule.

### Story 5 — Extension user (student / teacher)

> As a user, I want nothing about the extension to change.

**Acceptance criteria**

- No change to any rendered DOM, badge, button, label, or setting.
- No new permission, no new network call, no measurable slowdown.
- `pnpm -C extension run test:golden` green; `wxt build` green on chrome, firefox and edge.

---

## 4. Global acceptance criteria (the ship gate)

Every one of these must pass on the final commit. This is the CI extension job, run locally:

```bash
pnpm -C extension run test:fixtures:manifest && pnpm -C extension test && pnpm -C extension run test:golden && pnpm -C extension compile && pnpm -C extension run test:coverage:all && pnpm -C extension exec wxt build -b chrome && pnpm -C extension exec wxt build -b firefox && pnpm -C extension exec wxt build -b edge
```

Plus:

| # | Criterion | How it is checked |
|---|---|---|
| AC1 | Characterization snapshot unchanged | `tests/characterization/flag-scoring-characterization.test.ts` |
| AC2 | No keyword import outside `src/detect/keyword/` | `tests/contracts/import-boundary.test.ts` |
| AC3 | `scoreFlagsForPost` signature and `FlagDecision` shape unchanged | `tests/v2-flag-scoring.test.ts` passes **unedited** |
| AC4 | `scoreComments` / `scoreEdited` / `getThresholds` still exported from `src/v2/decision/flag-scoring` | same test file, unedited |
| AC5 | Compare palette has no colliding roles | `tests/contracts/theme.test.ts` |
| AC6 | Decide layer is pure | `tests/decide/decide-flags.test.ts` runs with no DOM fixture |

**Note on AC3/AC4:** `tests/v2-flag-scoring.test.ts` must not be modified by this plan. It is the external contract. If a task requires editing it, the task is wrong.

---

## 5. File structure

**Create:**

| Path | Responsibility |
|---|---|
| `src/contracts/detection.ts` | `PostObservation`, `PostDecision`, `Detector`, `DetectContext`, `DetectorName`. Types only. |
| `src/contracts/theme.ts` | `Theme` type + the two theme constants. Data only. |
| `src/contracts/index.ts` | Re-export barrel. |
| `src/detect/keyword/keyword-scoring.ts` | The moved layer implementations + `scoreComments` / `scoreEdited`. The only keyword-aware code. |
| `src/detect/keyword/keyword-detector.ts` | `KeywordDetector implements Detector`. Owns language detection, keyword preload, and text-based exclusions. |
| `src/decide/thresholds.ts` | `THRESHOLDS` constant, moved unchanged. |
| `src/decide/decide-flags.ts` | `decideFlags(observation): PostDecision`. Pure. |
| `tests/characterization/flag-scoring-characterization.test.ts` | Locks `scoreFlagsForPost` over the 9 fixtures. |
| `tests/characterization/flag-scoring-baseline.json` | The committed snapshot. |
| `tests/contracts/theme.test.ts` | Palette collision guard. |
| `tests/contracts/import-boundary.test.ts` | Enforces G1. |
| `tests/decide/decide-flags.test.ts` | Decide layer, DOM-free. |
| `tests/detect/keyword-detector.test.ts` | Detector layer. |

**Modify:**

| Path | Change |
|---|---|
| `src/v2/decision/flag-scoring.ts` | Shrinks from ~1,015 lines to a ~90-line adapter. Keeps its three public exports. |
| `extension/docs/ENGINE_ARCHITECTURE.md` | Add the seam section. |

**Untouched (deliberately):** `entrypoints/content/smart-detector.ts`, `entrypoints/content/smart-detector-comments.ts`, `src/v2/decision/keyword-loader.ts`, `src/v2/decision/exclusion-engine.ts`, `src/engines/v2/engine-v2.ts`, `tests/v2-flag-scoring.test.ts`.

### Layer rules

```
Detect  →  Decide  →  Render
```

1. `src/decide/**` must not import from `src/detect/**`, `src/v2/decision/keyword-loader`, or `entrypoints/content/**`.
2. `src/contracts/**` imports nothing but `src/engines/types` (for `ViewKind`).
3. `PostObservation` carries **no raw page text**. Rule identifiers (`ruleId`) are semantic and allowed; matched strings are not, except inside the optional `debug` field.

---

## 6. Branch setup

- [ ] **Step 0: Create the working branch**

```bash
git checkout -b feat/detection-engine-seam
```

All commits in this plan land on that branch. One PR at the end. Do **not** push to `main` directly — the "Main Branch Protection" ruleset is active and bypassing it is what this plan is explicitly avoiding.

**Commit messages: no attribution trailers.** No `Co-Authored-By`, no "Generated with". The repo uses commitlint with Conventional Commits; subject ≤ 50 chars.

---

## Task 1: Characterization snapshot (the safety net)

Lock the current output of `scoreFlagsForPost` over every frozen fixture **before** moving a single line of code. Nothing else in this plan is safe without it.

**Files:**
- Create: `tests/characterization/flag-scoring-characterization.test.ts`
- Create: `tests/characterization/flag-scoring-baseline.json` (generated in step 3)

- [ ] **Step 1: Write the characterization test**

Create `tests/characterization/flag-scoring-characterization.test.ts`:

```ts
// filepath: extension/tests/characterization/flag-scoring-characterization.test.ts
/**
 * Characterization lock for the V2 flag scoring path.
 *
 * This test does not assert that the behaviour is CORRECT. It asserts that it
 * is UNCHANGED. The baseline was captured before the Detect/Decide seam was
 * extracted; any diff here means the refactor altered detection.
 *
 * To regenerate deliberately (only when a behaviour change is intended and
 * reviewed): UPDATE_CHARACTERIZATION=1 pnpm -C extension test characterization
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryPostCards } from '../../entrypoints/content/post-card-utils';
import { scoreFlagsForPost } from '../../src/v2/decision/flag-scoring';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures/classroom');
const BASELINE_PATH = resolve(
  process.cwd(),
  'tests/characterization/flag-scoring-baseline.json',
);

/** Fixture filename -> the ViewKind that page would be classified as. */
const VIEW_KIND_BY_FIXTURE: Record<string, ViewKind> = {
  'announcement-detail-en.html': ViewKind.ANNOUNCEMENT_DETAIL,
  'assignment-details-en.html': ViewKind.ASSIGNMENT_DETAILS,
  'classwork-material-post-en.html': ViewKind.CLASSWORK_LIST,
  'material-details-en.html': ViewKind.MATERIAL_DETAILS,
  'mixed-links-post-en.html': ViewKind.STREAM,
  'rtl-flagged-post-ar.html': ViewKind.STREAM,
  'stream-flagged-post-en.html': ViewKind.STREAM,
  'student-submissions-en.html': ViewKind.STUDENT_SUBMISSIONS,
  'student-work-teacher-en.html': ViewKind.STUDENT_WORK_TEACHER,
};

/** Page language to score each fixture with, derived from its filename. */
function langFor(fixture: string): string {
  return fixture.endsWith('-ar.html') ? 'ar' : 'en';
}

/**
 * Strip everything non-deterministic. `timestamp` is Date.now() and
 * `duration_ms` is a performance measurement — both change every run.
 */
type NormalizedDecision = {
  commentScore: number;
  editedScore: number;
  commentCount: number | null;
  editedDiff: string | null;
  finalVerdict: string;
  confidence: string;
  exclusionPenalties: Array<{ ruleId: string; penalty: number }>;
  layers: Array<{
    layerName: string;
    layerIndex: number;
    score: number;
    matched: boolean;
    matchedText: string | null;
    details: string;
  }>;
  exclusionRuleIds: string[];
  finalScore: number;
};

function normalize(decision: ReturnType<typeof scoreFlagsForPost>): NormalizedDecision {
  return {
    commentScore: decision.commentScore,
    editedScore: decision.editedScore,
    commentCount: decision.commentCount,
    editedDiff: decision.editedDiff,
    finalVerdict: decision.finalVerdict,
    confidence: decision.confidence,
    exclusionPenalties: decision.exclusionPenalties,
    layers: decision.trace.layers.map((l) => ({
      layerName: l.layerName,
      layerIndex: l.layerIndex,
      score: l.score,
      matched: l.matched,
      matchedText: l.matchedText,
      details: l.details,
    })),
    exclusionRuleIds: decision.trace.exclusions.map((e) => e.ruleId),
    finalScore: decision.trace.finalScore,
  };
}

function captureAll(): Record<string, NormalizedDecision[]> {
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter((n) => n.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b));

  const captured: Record<string, NormalizedDecision[]> = {};

  for (const fixture of fixtures) {
    document.body.innerHTML = readFileSync(resolve(FIXTURES_DIR, fixture), 'utf8');
    const viewKind = VIEW_KIND_BY_FIXTURE[fixture] ?? ViewKind.UNKNOWN;
    const lang = langFor(fixture);

    captured[fixture] = queryPostCards().map((post, index) =>
      normalize(scoreFlagsForPost(post, `${fixture}#${index}`, viewKind, lang)),
    );
  }

  return captured;
}

describe('flag scoring characterization', () => {
  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('every fixture is covered by the ViewKind map', () => {
    const fixtures = readdirSync(FIXTURES_DIR).filter((n) => n.endsWith('.html'));
    for (const fixture of fixtures) {
      expect(VIEW_KIND_BY_FIXTURE[fixture], `missing ViewKind for ${fixture}`).toBeDefined();
    }
  });

  it('produces output identical to the committed baseline', () => {
    const captured = captureAll();

    if (process.env.UPDATE_CHARACTERIZATION === '1') {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
    }

    expect(existsSync(BASELINE_PATH), 'baseline not captured yet').toBe(true);
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    expect(captured).toEqual(baseline);
  });

  it('detects at least one post in every fixture', () => {
    const captured = captureAll();
    for (const [fixture, decisions] of Object.entries(captured)) {
      expect(decisions.length, `${fixture} yielded no post cards`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts
```

Expected: the "identical to the committed baseline" case FAILS with `baseline not captured yet` (the JSON does not exist). The other two cases should PASS. If "detects at least one post in every fixture" fails, a fixture has no post card `queryPostCards()` recognises — fix the `VIEW_KIND_BY_FIXTURE` map or report the fixture as unusable before continuing; do **not** delete the assertion.

- [ ] **Step 3: Capture the baseline**

```bash
UPDATE_CHARACTERIZATION=1 pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts
```

Expected: PASS, and `tests/characterization/flag-scoring-baseline.json` now exists.

- [ ] **Step 4: Prove the baseline is stable**

Run it twice more with no env var. Both must pass with no diff.

```bash
pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts && pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts
```

Expected: PASS twice. If it flakes, something non-deterministic survived `normalize()` — find it and strip it before going further.

- [ ] **Step 5: Commit**

```bash
git add tests/characterization/
git commit -m "test: characterize v2 flag scoring output"
```

---

## Task 2: Contracts and the compare palette

**Files:**
- Create: `src/contracts/detection.ts`
- Create: `src/contracts/theme.ts`
- Create: `src/contracts/index.ts`
- Test: `tests/contracts/theme.test.ts`

- [ ] **Step 1: Write the failing palette test**

Create `tests/contracts/theme.test.ts`:

```ts
// filepath: extension/tests/contracts/theme.test.ts
import { describe, it, expect } from 'vitest';
import {
  KEYWORD_THEME,
  STRUCTURAL_THEME,
  THEME_ROLES,
  type Theme,
} from '../../src/contracts/theme';

const HEX = /^#[0-9a-f]{6}$/;

function roleValues(theme: Theme): string[] {
  return THEME_ROLES.map((role) => theme[role]);
}

describe('compare-mode themes', () => {
  it('uses lowercase 6-digit hex for every role', () => {
    for (const theme of [KEYWORD_THEME, STRUCTURAL_THEME]) {
      for (const role of THEME_ROLES) {
        expect(theme[role], `${theme.name}.${role}`).toMatch(HEX);
      }
    }
  });

  it('gives every role within a theme a distinct colour', () => {
    for (const theme of [KEYWORD_THEME, STRUCTURAL_THEME]) {
      const values = roleValues(theme);
      expect(new Set(values).size, `${theme.name} has a colliding role`).toBe(values.length);
    }
  });

  it('never reuses a colour for a different role across the two themes', () => {
    for (const role of THEME_ROLES) {
      for (const otherRole of THEME_ROLES) {
        if (role === otherRole) continue;
        expect(
          KEYWORD_THEME[role],
          `${role} in keyword theme collides with ${otherRole} in structural theme`,
        ).not.toBe(STRUCTURAL_THEME[otherRole]);
      }
    }
  });

  it('keeps the two themes fully distinguishable role-for-role', () => {
    for (const role of THEME_ROLES) {
      expect(KEYWORD_THEME[role], `${role} identical in both themes`).not.toBe(
        STRUCTURAL_THEME[role],
      );
    }
  });

  it('names the themes after their detector', () => {
    expect(KEYWORD_THEME.name).toBe('keyword');
    expect(STRUCTURAL_THEME.name).toBe('structural');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm -C extension test tests/contracts/theme.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/contracts/theme"`.

- [ ] **Step 3: Write the contracts**

Create `src/contracts/detection.ts`:

```ts
// filepath: extension/src/contracts/detection.ts
/**
 * ============================================================================
 * DETECTION CONTRACTS — the Detect -> Decide seam
 * ============================================================================
 *
 * Detect answers "what is physically on this page?" and emits a
 * PostObservation of SEMANTIC FACTS. Decide turns that into a PostDecision.
 *
 * The hard rule: a PostObservation carries no raw page text outside its
 * optional `debug` field. Rule identifiers are semantic and allowed; matched
 * strings are not. This is what makes Decide language-agnostic by
 * construction rather than by discipline.
 */
import type { ViewKind, LayerTrace } from '../engines/types';

/** Which detector produced an observation. */
export type DetectorName = 'keyword' | 'structural';

/** Everything a detector is told about the post it is looking at. */
export interface DetectContext {
  /** Stable id for this post, usually data-stream-item-id. */
  postId: string;
  /** Page classification. */
  viewKind: ViewKind;
  /**
   * Page language hint. Only KeywordDetector may read this.
   * StructuralDetector must ignore it entirely.
   */
  lang?: string;
}

/** What the detector saw regarding comments. */
export interface CommentObservation {
  /** Something comment-shaped is present. */
  present: boolean;
  /** Comment count if one could be read, else null. */
  count: number | null;
  /** 0-100 confidence in `present`, already net of any penalties. */
  strength: number;
  /** Which mechanism produced the finding, e.g. 'dom-truth', 'aria'. */
  source: string;
}

/** What the detector saw regarding the post being edited. */
export interface EditedObservation {
  present: boolean;
  /** An edit marker was found close to a date. */
  nearDate: boolean;
  /** 0-100 confidence in `present`, already net of any penalties. */
  strength: number;
  source: string;
}

/** A penalty a detector applied to itself, reported for auditability. */
export interface AppliedPenalty {
  ruleId: string;
  penalty: number;
}

/** The seam payload. Language-free. */
export interface PostObservation {
  postId: string;
  viewKind: ViewKind;
  detector: DetectorName;
  comment: CommentObservation;
  edited: EditedObservation;
  /** Penalties already folded into the strengths above. */
  penalties: AppliedPenalty[];
  /** Wall-clock cost of producing this observation. */
  elapsedMs: number;
  /**
   * DEBUG ONLY. May contain raw matched text. Decide MUST NOT read this;
   * it exists so the adapter can rebuild a DecisionTrace for DevTools.
   */
  debug?: LayerTrace[];
}

/** What Decide concluded. Fed to Render. */
export interface PostDecision {
  postId: string;
  verdict: 'comment' | 'edited' | 'both' | 'none';
  commentCount: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** The higher of the two strengths — the headline score. */
  score: number;
  commentScore: number;
  editedScore: number;
}

/** Every detector implements exactly this. */
export interface Detector {
  readonly name: DetectorName;
  observe(post: HTMLElement, ctx: DetectContext): PostObservation;
}
```

Create `src/contracts/theme.ts`:

```ts
// filepath: extension/src/contracts/theme.ts
/**
 * ============================================================================
 * THEME CONTRACT — compare-mode palettes
 * ============================================================================
 *
 * A Theme is data, never behaviour. Two exist so that in compare mode the two
 * engines can render over each other at 50% opacity: agreement blends into a
 * composite colour, disagreement shows as a pure single hue.
 *
 * That only works if no two roles share a value, which tests/contracts/
 * theme.test.ts enforces.
 *
 * The structural secondary is NILE GREEN, not nile blue. Blue would collide
 * with the structural tertiary and make secondary/tertiary disagreement
 * unreadable under overlap.
 */

export const THEME_ROLES = [
  'primary',
  'secondary',
  'tertiary',
  'error',
  'success',
] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];

export type Theme = { name: 'keyword' | 'structural' } & Record<ThemeRole, string>;

/** V1 / keyword engine — the existing production palette. */
export const KEYWORD_THEME: Theme = {
  name: 'keyword',
  primary: '#1a73e8',   // blue   — matches src/v2/render/button-styles.ts
  secondary: '#f9ab00', // yellow — matches src/v2/render/flag-styles.ts edited
  tertiary: '#e8710a',  // orange
  error: '#d93025',     // red    — matches flag-styles.ts
  success: '#137333',   // green  — matches button-styles.ts
};

/** V2 / structural engine — deliberately shifted so overlap is legible. */
export const STRUCTURAL_THEME: Theme = {
  name: 'structural',
  primary: '#7b3fe4',   // purple
  secondary: '#1a7f5a', // nile green
  tertiary: '#4285f4',  // blue
  error: '#f28b82',     // lighter red
  success: '#81c995',   // lighter green
};
```

Create `src/contracts/index.ts`:

```ts
// filepath: extension/src/contracts/index.ts
export type {
  DetectorName,
  DetectContext,
  CommentObservation,
  EditedObservation,
  AppliedPenalty,
  PostObservation,
  PostDecision,
  Detector,
} from './detection';

export {
  THEME_ROLES,
  KEYWORD_THEME,
  STRUCTURAL_THEME,
  type Theme,
  type ThemeRole,
} from './theme';
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm -C extension test tests/contracts/theme.test.ts && pnpm -C extension compile
```

Expected: 5 tests PASS, `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/contracts tests/contracts
git commit -m "feat: add detect/decide contracts and themes"
```

---

## Task 3: Move the scoring internals out of flag-scoring.ts

Pure mechanical move. No logic edits. The point is to get every keyword-aware line into `src/detect/keyword/` in one reviewable commit.

**Files:**
- Create: `src/detect/keyword/keyword-scoring.ts`
- Create: `src/decide/thresholds.ts`
- Modify: `src/v2/decision/flag-scoring.ts`

- [ ] **Step 1: Create the thresholds module**

`THRESHOLDS` is currently a private const at `src/v2/decision/flag-scoring.ts:116-122`. It is read only by `scoreFlagsForPost` and `getThresholds` — `scoreComments` and `scoreEdited` never touch it. Verify that before moving:

```bash
grep -n "THRESHOLDS" extension/src/v2/decision/flag-scoring.ts
```

Expected: hits only at the definition (116), inside `scoreFlagsForPost` (~928-941), and inside `getThresholds` (~1011). If a hit appears between lines 123 and 880, stop — the split below is wrong and the plan needs revising.

Create `src/decide/thresholds.ts`:

```ts
// filepath: extension/src/decide/thresholds.ts
/**
 * Score thresholds for turning detector strengths into a verdict.
 *
 * Moved verbatim from src/v2/decision/flag-scoring.ts. These numbers are the
 * output of five months of tuning against real Classroom pages — do not
 * change them without running the full golden suite and the characterization
 * baseline.
 */
export const THRESHOLDS = {
  comment_show: 40,
  comment_high_confidence: 70,
  edited_show: 35,
  edited_high_confidence: 65,
  both_minimum_each: 30,
} as const;

export type Thresholds = typeof THRESHOLDS;
```

- [ ] **Step 2: Split the file mechanically**

Do not retype the 870 lines of scoring logic. Cut the file at the `THE MAIN FUNCTION` banner that opens `scoreFlagsForPost`'s doc comment:

```bash
cd extension && mkdir -p src/detect/keyword src/decide && MAIN=$(grep -n "THE MAIN FUNCTION" src/v2/decision/flag-scoring.ts | cut -d: -f1) && sed -n "1,$((MAIN - 2))p" src/v2/decision/flag-scoring.ts > src/detect/keyword/keyword-scoring.ts && sed -n "$((MAIN - 1)),\$p" src/v2/decision/flag-scoring.ts > src/detect/keyword/.flag-scoring-tail.txt && wc -l src/detect/keyword/keyword-scoring.ts src/detect/keyword/.flag-scoring-tail.txt
```

Expected: roughly 864 lines in `keyword-scoring.ts` and 149 in the tail scratch file, totalling the original 1,013.

Now delete the `THRESHOLDS` block from the moved file — it belongs to Decide, and `scoreComments` / `scoreEdited` never read it:

```bash
cd extension && sed -i '' '/^const THRESHOLDS = {$/,/^};$/d' src/detect/keyword/keyword-scoring.ts && grep -c "THRESHOLDS" src/detect/keyword/keyword-scoring.ts
```

Expected: `0`. Anything else means the sed range caught the wrong closing brace — restore from git and delete lines 116-122 by hand.

- [ ] **Step 3: Fix the moved file's imports and exports**

The file moved from `src/v2/decision/` to `src/detect/keyword/` — both two levels under `src/`, so the `../../` depths are unchanged, but the two sibling imports now need full paths. Replace the import block at the top of `src/detect/keyword/keyword-scoring.ts` with:

```ts
// filepath: extension/src/detect/keyword/keyword-scoring.ts
// (header comment retained from flag-scoring.ts)

import type {
  DecisionTrace,
  LayerTrace,
  ExclusionTrace,
  ViewKind,
} from '../../engines/types';

import {
  getCommentKeywords,
  getEditedKeywords,
  preloadKeywords,
  detectPageLanguage,
  normalizeText,
  normalizeForComparison,
  parseUnicodeInteger,
  hasDatePattern,
  CONFIDENCE_WEIGHTS,
  GOLDEN_SELECTORS,
  type CommentKeywords,
} from '../../v2/decision/keyword-loader';

import {
  applyExclusions,
  isExcludedText,
  isInExcludedArea,
  getUserContentSelectors,
  type ExclusionResult,
} from '../../v2/decision/exclusion-engine';
```

Everything below that import block was produced by `sed` in Step 2 and is left exactly as it is. The only differences from the original are the two `from` paths above (`./keyword-loader` → `../../v2/decision/keyword-loader`, `./exclusion-engine` → `../../v2/decision/exclusion-engine`) and the dropped `FlagDecision` type import, which only `scoreFlagsForPost` used.

Append two export lines at the **end** of the moved file, so the detector in Task 5 can consume it:

```ts
/** Exported so KeywordDetector can build a PostObservation without re-deriving. */
export type { CommentLayerResult, EditedLayerResult };

/** Re-exported so KeywordDetector does not need its own keyword-loader import. */
export { detectPageLanguage, preloadKeywords, applyExclusions };
export type { ExclusionResult };
```

The two internal result interfaces are currently declared without `export` around line 66-80. Add `export` to both declarations.

- [ ] **Step 4: Rebuild flag-scoring.ts from the tail**

`src/detect/keyword/.flag-scoring-tail.txt` holds `scoreFlagsForPost` and `getThresholds` verbatim. Rebuild `src/v2/decision/flag-scoring.ts` as the header below followed by that tail, then delete the scratch file:

```bash
cd extension && cat src/detect/keyword/.flag-scoring-tail.txt >> src/v2/decision/flag-scoring.ts && rm src/detect/keyword/.flag-scoring-tail.txt
```

The header to write **before** running that append — overwrite `src/v2/decision/flag-scoring.ts` with exactly this first:

```ts
// filepath: extension/src/v2/decision/flag-scoring.ts
/**
 * ============================================================================
 * V2 FLAG SCORING — public entry point
 * ============================================================================
 *
 * The scoring implementation now lives in src/detect/keyword/. This module
 * stays as the stable public surface its callers already import:
 * src/engines/v2/engine-v2.ts and tests/v2-flag-scoring.test.ts.
 *
 * Task 6 of the seam plan replaces the body of scoreFlagsForPost with a
 * Detect -> Decide adapter. Until then it is the original implementation with
 * its scoring helpers imported rather than defined inline.
 */
import type {
  FlagDecision,
  DecisionTrace,
  LayerTrace,
  ExclusionTrace,
  ViewKind,
} from '../../engines/types';

import {
  scoreComments,
  scoreEdited,
  detectPageLanguage,
  preloadKeywords,
  applyExclusions,
  type ExclusionResult,
} from '../../detect/keyword/keyword-scoring';

import { THRESHOLDS } from '../../decide/thresholds';

export { scoreComments, scoreEdited };
```

Then run the append command above. The result is the header plus the untouched `scoreFlagsForPost` and `getThresholds`.

- [ ] **Step 5: Verify nothing changed**

```bash
pnpm -C extension compile && pnpm -C extension test tests/v2-flag-scoring.test.ts tests/characterization/flag-scoring-characterization.test.ts
```

Expected: `tsc` clean; both test files PASS. `tests/v2-flag-scoring.test.ts` must pass **with no edits to it** — it imports `scoreComments`, `scoreEdited`, `scoreFlagsForPost`, `getThresholds` from `../src/v2/decision/flag-scoring`, and all four are still exported there.

- [ ] **Step 6: Run the full suite**

```bash
pnpm -C extension test && pnpm -C extension run test:golden
```

Expected: full suite PASS. `tests/popup-legend-a11y.test.ts` fails on macOS with 2 failures — this is a known, pre-existing, macOS-only failure documented in the 2026-08-16 handoff. It is not a regression from this task. Everything else must be green.

- [ ] **Step 7: Commit**

```bash
git add src/detect src/decide src/v2/decision/flag-scoring.ts
git commit -m "refactor: move keyword scoring into src/detect"
```

---

## Task 4: The Decide layer

**Files:**
- Create: `src/decide/decide-flags.ts`
- Test: `tests/decide/decide-flags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/decide/decide-flags.test.ts`. Note there is no DOM anywhere in this file — that is the point.

```ts
// filepath: extension/tests/decide/decide-flags.test.ts
import { describe, it, expect } from 'vitest';
import { decideFlags } from '../../src/decide/decide-flags';
import { ViewKind } from '../../src/engines/types';
import type { PostObservation } from '../../src/contracts/detection';

function observation(overrides: {
  commentStrength?: number;
  commentCount?: number | null;
  editedStrength?: number;
} = {}): PostObservation {
  return {
    postId: 'p1',
    viewKind: ViewKind.STREAM,
    detector: 'keyword',
    comment: {
      present: (overrides.commentStrength ?? 0) > 0,
      count: overrides.commentCount ?? null,
      strength: overrides.commentStrength ?? 0,
      source: 'test',
    },
    edited: {
      present: (overrides.editedStrength ?? 0) > 0,
      nearDate: false,
      strength: overrides.editedStrength ?? 0,
      source: 'test',
    },
    penalties: [],
    elapsedMs: 0,
  };
}

describe('decideFlags', () => {
  it('returns none below both thresholds', () => {
    const d = decideFlags(observation({ commentStrength: 39, editedStrength: 34 }));
    expect(d.verdict).toBe('none');
  });

  it('returns comment at the comment threshold', () => {
    const d = decideFlags(observation({ commentStrength: 40, editedStrength: 0 }));
    expect(d.verdict).toBe('comment');
  });

  it('returns edited at the edited threshold', () => {
    const d = decideFlags(observation({ commentStrength: 0, editedStrength: 35 }));
    expect(d.verdict).toBe('edited');
  });

  it('returns both when each clears its threshold and the both-minimum', () => {
    const d = decideFlags(observation({ commentStrength: 40, editedStrength: 35 }));
    expect(d.verdict).toBe('both');
  });

  it('prefers comment when edited is below its threshold', () => {
    const d = decideFlags(observation({ commentStrength: 80, editedStrength: 34 }));
    expect(d.verdict).toBe('comment');
  });

  it('grades confidence high at 70 and above', () => {
    expect(decideFlags(observation({ commentStrength: 70 })).confidence).toBe('high');
    expect(decideFlags(observation({ commentStrength: 69 })).confidence).toBe('medium');
  });

  it('grades confidence low below the edited threshold', () => {
    expect(decideFlags(observation({ commentStrength: 34 })).confidence).toBe('low');
    expect(decideFlags(observation({ commentStrength: 35 })).confidence).toBe('medium');
  });

  it('carries the comment count through untouched', () => {
    const d = decideFlags(observation({ commentStrength: 80, commentCount: 7 }));
    expect(d.commentCount).toBe(7);
  });

  it('reports the higher strength as the headline score', () => {
    const d = decideFlags(observation({ commentStrength: 41, editedStrength: 88 }));
    expect(d.score).toBe(88);
    expect(d.commentScore).toBe(41);
    expect(d.editedScore).toBe(88);
  });

  it('does not branch on which detector produced the observation', () => {
    const asKeyword = observation({ commentStrength: 55, editedStrength: 40 });
    const asStructural: PostObservation = { ...asKeyword, detector: 'structural' };
    expect(decideFlags(asStructural)).toEqual({
      ...decideFlags(asKeyword),
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm -C extension test tests/decide/decide-flags.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/decide/decide-flags"`.

- [ ] **Step 3: Write the implementation**

Create `src/decide/decide-flags.ts`:

```ts
// filepath: extension/src/decide/decide-flags.ts
/**
 * ============================================================================
 * DECIDE — PostObservation -> PostDecision
 * ============================================================================
 *
 * Pure. No DOM. No keywords. No language. If this module ever needs to know
 * what language a page is in, the seam has been broken.
 *
 * The verdict and confidence arithmetic is lifted verbatim from the original
 * scoreFlagsForPost so that behaviour is bit-identical.
 */
import type { PostObservation, PostDecision } from '../contracts/detection';
import { THRESHOLDS } from './thresholds';

export function decideFlags(observation: PostObservation): PostDecision {
  const commentScore = observation.comment.strength;
  const editedScore = observation.edited.strength;

  let verdict: PostDecision['verdict'] = 'none';
  if (
    commentScore >= THRESHOLDS.comment_show &&
    editedScore >= THRESHOLDS.edited_show &&
    commentScore >= THRESHOLDS.both_minimum_each &&
    editedScore >= THRESHOLDS.both_minimum_each
  ) {
    verdict = 'both';
  } else if (commentScore >= THRESHOLDS.comment_show) {
    verdict = 'comment';
  } else if (editedScore >= THRESHOLDS.edited_show) {
    verdict = 'edited';
  }

  const score = Math.max(commentScore, editedScore);
  const confidence: PostDecision['confidence'] =
    score >= THRESHOLDS.comment_high_confidence
      ? 'high'
      : score >= THRESHOLDS.edited_show
        ? 'medium'
        : 'low';

  return {
    postId: observation.postId,
    verdict,
    commentCount: observation.comment.count,
    confidence,
    score,
    commentScore,
    editedScore,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm -C extension test tests/decide/decide-flags.test.ts && pnpm -C extension compile
```

Expected: 10 tests PASS, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/decide/decide-flags.ts tests/decide
git commit -m "feat: add language-free decide layer"
```

---

## Task 5: KeywordDetector

The only module allowed to know about keywords or language. It absorbs the `pageLang + en + ar` union, the keyword preload, language detection, and the text-based exclusion pass — everything `scoreFlagsForPost` currently does before it can produce numbers.

**Files:**
- Create: `src/detect/keyword/keyword-detector.ts`
- Test: `tests/detect/keyword-detector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/detect/keyword-detector.test.ts`:

```ts
// filepath: extension/tests/detect/keyword-detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeywordDetector } from '../../src/detect/keyword/keyword-detector';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', 'kd-test');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe('KeywordDetector', () => {
  let detector: KeywordDetector;

  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
    detector = new KeywordDetector();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('identifies itself as the keyword detector', () => {
    expect(detector.name).toBe('keyword');
  });

  it('observes a commented post', () => {
    const post = createPost('<div class="comment-count">5 class comments</div>');
    const obs = detector.observe(post, { postId: 'p1', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.detector).toBe('keyword');
    expect(obs.postId).toBe('p1');
    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(5);
    expect(obs.comment.strength).toBeGreaterThan(0);
  });

  it('observes an edited post', () => {
    const post = createPost('<div class="meta-row">Edited Mar 10</div>');
    const obs = detector.observe(post, { postId: 'p2', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.edited.present).toBe(true);
    expect(obs.edited.strength).toBeGreaterThan(0);
  });

  it('observes a plain post as neither', () => {
    const post = createPost('<p>Nothing interesting here.</p>');
    const obs = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.present).toBe(false);
    expect(obs.edited.present).toBe(false);
    expect(obs.comment.strength).toBe(0);
    expect(obs.edited.strength).toBe(0);
  });

  it('finds Arabic comment text when the page language says English', () => {
    const post = createPost('<div class="comment-count">٣ تعليقات في الصف</div>');
    const obs = detector.observe(post, { postId: 'p4', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.present).toBe(true);
  });

  it('never lets a strength go negative after penalties', () => {
    const post = createPost('<button role="button">Add class comment</button>');
    const obs = detector.observe(post, { postId: 'p5', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.strength).toBeGreaterThanOrEqual(0);
    expect(obs.edited.strength).toBeGreaterThanOrEqual(0);
  });

  it('reports penalties as rule ids, never as page text', () => {
    const post = createPost('<button role="button">Add class comment</button>');
    const obs = detector.observe(post, { postId: 'p6', viewKind: ViewKind.STREAM, lang: 'en' });

    for (const p of obs.penalties) {
      expect(typeof p.ruleId).toBe('string');
      expect(p.ruleId).toMatch(/^[A-Z0-9_]+$/);
      expect(typeof p.penalty).toBe('number');
    }
  });

  it('measures its own cost', () => {
    const post = createPost('<div class="comment-count">2 class comments</div>');
    const obs = detector.observe(post, { postId: 'p7', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(obs.elapsedMs)).toBe(true);
  });

  it('works without a lang hint by detecting the page language itself', () => {
    const post = createPost('<div class="comment-count">4 class comments</div>');
    const obs = detector.observe(post, { postId: 'p8', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
  });

  it('carries debug layer traces for the adapter', () => {
    const post = createPost('<div class="comment-count">5 class comments</div>');
    const obs = detector.observe(post, { postId: 'p9', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(Array.isArray(obs.debug)).toBe(true);
    expect(obs.debug!.length).toBeGreaterThan(0);
    expect(obs.debug![0]).toHaveProperty('layerName');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm -C extension test tests/detect/keyword-detector.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/detect/keyword/keyword-detector"`.

- [ ] **Step 3: Write the implementation**

Create `src/detect/keyword/keyword-detector.ts`. The exclusion partition below reproduces `scoreFlagsForPost`'s original arithmetic exactly: comment exclusions are collected first, then edited ones, then every penalty is routed by rule id and the result clamped at zero.

```ts
// filepath: extension/src/detect/keyword/keyword-detector.ts
/**
 * ============================================================================
 * KEYWORD DETECTOR — the only keyword-aware module in the extension
 * ============================================================================
 *
 * Everything that used to be scattered across scoreFlagsForPost lives here:
 * page-language detection, the keyword preload, the pageLang + en + ar union
 * (inside keyword-scoring), and the text-based exclusion pass.
 *
 * The output is a PostObservation carrying only semantic facts. Downstream
 * code cannot tell what language the page was in, which is the entire point.
 */
import type { LayerTrace } from '../../engines/types';
import type {
  Detector,
  DetectContext,
  PostObservation,
  AppliedPenalty,
} from '../../contracts/detection';

import {
  scoreComments,
  scoreEdited,
  detectPageLanguage,
  preloadKeywords,
  applyExclusions,
  type ExclusionResult,
} from './keyword-scoring';

export class KeywordDetector implements Detector {
  readonly name = 'keyword' as const;

  observe(post: HTMLElement, ctx: DetectContext): PostObservation {
    const startTime = performance.now();
    const pageLang = ctx.lang || detectPageLanguage();

    preloadKeywords(pageLang);

    const commentResult = scoreComments(post, pageLang);
    const editedResult = scoreEdited(post, pageLang);

    // Text-based exclusions run here, not downstream — they reason over the
    // matched page text, which never leaves this module.
    const exclusions: ExclusionResult[] = [];
    if (commentResult.matchedText) {
      exclusions.push(...applyExclusions(commentResult.matchedText, post, 'comment'));
    }
    if (editedResult.matchedText) {
      exclusions.push(...applyExclusions(editedResult.matchedText, post, 'edited'));
    }

    let commentScore = commentResult.score;
    let editedScore = editedResult.score;

    for (const exc of exclusions) {
      if (exc.ruleId.includes('COMMENT') || exc.ruleId.includes('ACTION_BTN')) {
        commentScore += exc.penalty;
      }
      if (exc.ruleId.includes('EDITED')) {
        editedScore += exc.penalty;
      }
    }

    commentScore = Math.max(0, commentScore);
    editedScore = Math.max(0, editedScore);

    const penalties: AppliedPenalty[] = exclusions.map((e) => ({
      ruleId: e.ruleId,
      penalty: e.penalty,
    }));

    const debug: LayerTrace[] = [];
    for (let i = 0; i < commentResult.layers.length; i++) {
      const l = commentResult.layers[i]!;
      debug.push({
        layerName: `comment-L${i}`,
        layerIndex: debug.length,
        score: l.score,
        matched: l.score > 0,
        matchedText: l.matchedText,
        selectorUsed: null,
        details: l.details,
      });
    }
    for (let i = 0; i < editedResult.layers.length; i++) {
      const l = editedResult.layers[i]!;
      debug.push({
        layerName: `edited-L${i + 1}`,
        layerIndex: debug.length,
        score: l.score,
        matched: l.score !== 0,
        matchedText: l.matchedText,
        selectorUsed: null,
        details: l.details,
      });
    }

    return {
      postId: ctx.postId,
      viewKind: ctx.viewKind,
      detector: this.name,
      comment: {
        present: commentScore > 0,
        count: commentResult.count,
        strength: commentScore,
        source: 'keyword',
      },
      edited: {
        present: editedScore > 0,
        nearDate: editedResult.hasDateProximity,
        strength: editedScore,
        source: 'keyword',
      },
      penalties,
      elapsedMs: performance.now() - startTime,
      debug,
    };
  }
}

/** Shared instance — the detector is stateless. */
export const keywordDetector = new KeywordDetector();
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm -C extension test tests/detect/keyword-detector.test.ts && pnpm -C extension compile
```

Expected: 10 tests PASS, `tsc` clean.

If "reports penalties as rule ids, never as page text" fails, read the actual `ruleId` values in `src/v2/decision/exclusion-engine.ts` and widen the `/^[A-Z0-9_]+$/` pattern to match the real convention. Do not delete the assertion — its job is to catch page text leaking into the observation.

- [ ] **Step 5: Commit**

```bash
git add src/detect/keyword/keyword-detector.ts tests/detect
git commit -m "feat: add KeywordDetector behind the seam"
```

---

## Task 6: Rewire scoreFlagsForPost as a Detect → Decide adapter

The behaviour-preserving payoff. `scoreFlagsForPost` keeps its exact signature and `FlagDecision` return shape; internally it becomes `detector.observe()` then `decideFlags()`.

**Files:**
- Modify: `src/v2/decision/flag-scoring.ts`

- [ ] **Step 1: Confirm the safety net is green before touching anything**

```bash
pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts
```

Expected: PASS. If it is not green, stop — you have nothing to compare against.

- [ ] **Step 2: Replace flag-scoring.ts with the adapter**

Overwrite `src/v2/decision/flag-scoring.ts` with:

```ts
// filepath: extension/src/v2/decision/flag-scoring.ts
/**
 * ============================================================================
 * V2 FLAG SCORING — Detect -> Decide adapter
 * ============================================================================
 *
 * This module used to be 1,000 lines of layered keyword heuristics. Those now
 * live in src/detect/keyword/. What is left is the adapter that keeps the
 * existing public surface working:
 *
 *   scoreFlagsForPost(post, postId, viewKind, lang?) -> FlagDecision
 *
 * Callers: src/engines/v2/engine-v2.ts:583, tests/v2-flag-scoring.test.ts.
 * Neither of them changed, and neither of them can tell the difference.
 *
 * NOTE: this file imports no keyword module and no language utility. That is
 * enforced by tests/contracts/import-boundary.test.ts.
 */
import type {
  FlagDecision,
  DecisionTrace,
  ExclusionTrace,
  ViewKind,
} from '../../engines/types';

import { keywordDetector } from '../../detect/keyword/keyword-detector';
import { scoreComments, scoreEdited } from '../../detect/keyword/keyword-scoring';
import { decideFlags } from '../../decide/decide-flags';
import { THRESHOLDS } from '../../decide/thresholds';

/**
 * Re-exported for the existing public surface. These are keyword-path
 * internals; new code should use KeywordDetector instead.
 */
export { scoreComments, scoreEdited };

/**
 * THE MAIN FUNCTION — Score all flags for a single post.
 *
 * Now a two-line pipeline: observe, then decide. The FlagDecision it returns
 * is assembled from both halves so the shape stays byte-identical to the
 * pre-seam implementation.
 */
export function scoreFlagsForPost(
  post: HTMLElement,
  postId: string,
  viewKind: ViewKind,
  lang?: string,
): FlagDecision {
  const observation = keywordDetector.observe(post, { postId, viewKind, lang });
  const decision = decideFlags(observation);

  // ExclusionTrace declares `reason: string` and `matchedText: string` — both
  // non-nullable — so these are empty strings, not null. The matched text is
  // deliberately dropped: it is page text and does not cross the seam.
  const exclusions: ExclusionTrace[] = observation.penalties.map((p) => ({
    ruleId: p.ruleId,
    penalty: p.penalty,
    reason: '',
    matchedText: '',
  }));

  const trace: DecisionTrace = {
    postId,
    timestamp: Date.now(),
    viewKind,
    layers: observation.debug ?? [],
    exclusions,
    finalScore: decision.score,
    duration_ms: observation.elapsedMs,
  };

  return {
    postId,
    commentScore: decision.commentScore,
    editedScore: decision.editedScore,
    commentCount: decision.commentCount,
    editedDiff: null, // computed by the render layer from date comparison
    exclusionPenalties: observation.penalties,
    finalVerdict: decision.verdict,
    confidence: decision.confidence,
    trace,
  };
}

/**
 * Get the current detection thresholds.
 * Exposed for testing and tuning.
 */
export function getThresholds(): typeof THRESHOLDS {
  return { ...THRESHOLDS };
}
```

- [ ] **Step 3: Run the characterization test — this is the whole point of Task 1**

```bash
pnpm -C extension test tests/characterization/flag-scoring-characterization.test.ts
```

Expected: PASS with zero diff.

**If it fails, do not regenerate the baseline.** Read the diff. The two likely causes:

1. `ExclusionTrace.reason` / `.matchedText` — the original built these from the live `ExclusionResult`. The adapter above sets `reason: ''` and `matchedText: null` because that text is not allowed to cross the seam. The `normalize()` function in Task 1 only snapshots `exclusions.map(e => e.ruleId)`, so this is invisible to the baseline **by design**. If the diff shows up anyway, `normalize()` was changed — revert that.
2. A real arithmetic difference in the exclusion partition. Compare the adapter's loop against the pre-move original:

```bash
git show "$(git log --format=%H --grep='refactor: move keyword scoring' -1)~1:extension/src/v2/decision/flag-scoring.ts" | sed -n '/THE MAIN FUNCTION/,/^}/p'
```

- [ ] **Step 4: Run the external-contract test unedited**

```bash
pnpm -C extension test tests/v2-flag-scoring.test.ts && git diff --exit-code -- extension/tests/v2-flag-scoring.test.ts
```

Expected: tests PASS and `git diff --exit-code` returns 0 (the file is untouched). A non-zero exit means the contract was bent to fit the refactor — revert the test file and fix the source instead.

- [ ] **Step 5: Run the full gate**

```bash
pnpm -C extension test && pnpm -C extension run test:golden && pnpm -C extension compile
```

Expected: green, minus the two known macOS-only `popup-legend-a11y` failures.

- [ ] **Step 6: Commit**

```bash
git add src/v2/decision/flag-scoring.ts
git commit -m "refactor: make flag scoring a detect/decide adapter"
```

---

## Task 7: Enforce the boundary and document the seam

Make G1 a build failure rather than a convention, then write it down.

**Files:**
- Create: `tests/contracts/import-boundary.test.ts`
- Modify: `extension/docs/ENGINE_ARCHITECTURE.md`

- [ ] **Step 1: Write the failing boundary test**

Create `tests/contracts/import-boundary.test.ts`:

```ts
// filepath: extension/tests/contracts/import-boundary.test.ts
/**
 * Enforces the one-way import rule of the detection seam.
 *
 *   Detect -> Decide -> Render
 *
 * Exactly one directory is allowed to know about keywords or page language.
 * If this test fails, someone reintroduced the coupling the seam removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

/** Modules that make a file keyword-aware or language-aware. */
const FORBIDDEN = [
  'keyword-loader',
  'detection-keywords',
  'exclusion-engine',
  'smart-detector',
];

/** The only place allowed to import them. */
const ALLOWED_DIR = 'detect/keyword';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function importsIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const matches = source.matchAll(/from\s+['"]([^'"]+)['"]/g);
  return [...matches].map((m) => m[1]!);
}

describe('detection seam import boundary', () => {
  it('confines keyword and language imports to src/detect/keyword', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (rel.startsWith(ALLOWED_DIR)) continue;

      for (const spec of importsIn(file)) {
        if (FORBIDDEN.some((f) => spec.includes(f))) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the decide layer free of any detect import', () => {
    const offenders: string[] = [];

    for (const file of walk(join(SRC, 'decide'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (spec.includes('/detect/') || spec.includes('detect/keyword')) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the contracts layer dependency-free apart from engine types', () => {
    const offenders: string[] = [];

    for (const file of walk(join(SRC, 'contracts'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (spec.startsWith('.') && !spec.includes('engines/types') && !spec.startsWith('./')) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm -C extension test tests/contracts/import-boundary.test.ts
```

Expected outcome depends on what is left in the tree. Two possibilities:

- **PASS** — Tasks 3-6 already removed every offending import. Good; move to step 4.
- **FAIL** with a list of offenders — each line names a file and the import to remove. Work through them in step 3.

Known candidates that will appear if anything was missed: `src/v2/decision/flag-scoring.ts` (fixed in Task 6), and `src/engines/v2/engine-v2.ts` if it imports `keyword-loader` directly. Check that one now:

```bash
grep -n "keyword-loader\|detection-keywords" extension/src/engines/v2/engine-v2.ts
```

- [ ] **Step 3: Remove any remaining offenders**

For each offender, route it through the seam instead. The pattern is always the same — replace a direct keyword call with a `keywordDetector.observe()` call, or drop the import if it was only used for a type. Do not add the file to `ALLOWED_DIR`; the allowlist has exactly one entry and stays that way.

Re-run until the test passes:

```bash
pnpm -C extension test tests/contracts/import-boundary.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 4: Document the seam**

Append to `extension/docs/ENGINE_ARCHITECTURE.md`:

```markdown
## Detection seam (2026-08-18)

Detection is split into three layers with strictly one-directional flow:

    Detect  ->  Decide  ->  Render

**Detect** (`src/detect/`) answers "what is physically on this page?" and emits
a `PostObservation` of semantic facts — "has a comment indicator, count 3", not
"this element contains the string 'تعليقات'". `KeywordDetector` is the only
module in the extension permitted to import keyword tables or reason about
page language; the `pageLang + en + ar` union lives inside it.

**Decide** (`src/decide/`) turns a `PostObservation` into a `PostDecision`
using score thresholds alone. It takes no language argument and can see no
page text, so it cannot have a language bug.

**Render** consumes a `PostDecision` plus a `Theme`. It never re-inspects the
page to decide anything.

Contracts live in `src/contracts/`. The one-way rule is enforced by
`tests/contracts/import-boundary.test.ts`, which fails the build if any file
outside `src/detect/keyword/` imports a keyword or language module.

`entrypoints/content/smart-detector.ts` and `smart-detector-comments.ts` are
the V1 production path and are deliberately unchanged. Their own keyword
unions become dead code when the V2 path is promoted (PRD Phase 3), not
before.

Design: `docs/superpowers/specs/2026-08-16-detection-engine-seam-design.md`
Plan: `docs/superpowers/plans/2026-08-18-detection-engine-seam.md`
```

- [ ] **Step 5: Run the complete ship gate**

```bash
pnpm -C extension run test:fixtures:manifest && pnpm -C extension test && pnpm -C extension run test:golden && pnpm -C extension compile && pnpm -C extension run test:coverage:all && pnpm -C extension exec wxt build -b chrome && pnpm -C extension exec wxt build -b firefox && pnpm -C extension exec wxt build -b edge
```

Expected: every command exits 0, except the two known macOS-only `popup-legend-a11y` failures inside `pnpm -C extension test`. Quote the full output in the session report — including those two failures — rather than summarising it away.

`test:coverage:all` runs the `critical` and `runtime` profiles at 100% thresholds. Those profiles cover `entrypoints/background/**` and `entrypoints/utils/analytics/**`, none of which this plan touches, so they must pass unchanged. If they drop, something moved that should not have.

- [ ] **Step 6: Commit and open the PR**

```bash
git add tests/contracts/import-boundary.test.ts extension/docs/ENGINE_ARCHITECTURE.md
git commit -m "test: enforce detection seam import boundary"
git push -u origin feat/detection-engine-seam
```

Then open the PR against `main` — through the PR flow, not an owner bypass of the "Main Branch Protection" ruleset. No attribution trailers in the PR body.

---

## 7. Blast radius

**What could break**

| Surface | Exposure | Why it is contained |
|---|---|---|
| Comment / edited badges on live Classroom pages | The scoring code moves wholesale | Characterization baseline over 9 fixtures + `test:golden` + 100 existing test files. Arithmetic is copied verbatim, not rewritten. |
| `src/engines/v2/engine-v2.ts:583` | Calls `scoreFlagsForPost` | Signature and return type unchanged; the file is not edited. |
| `tests/v2-flag-scoring.test.ts` | Imports 4 symbols from `flag-scoring` | All 4 still exported. The plan forbids editing this file — it is the contract. |
| Coverage gates | `critical` / `runtime` profiles at 100% | Neither profile includes `src/**`; nothing this plan touches is inside them. |
| Bundle size | Three new directories | Same code, moved. Tree-shaking unchanged; `wxt build` on all three targets is in the gate. |
| Production V1 render path | None | `entrypoints/content/smart-detector*.ts` are not touched. |

**Who is affected:** nobody, if the plan holds. This is a structural change with an explicitly zero-behaviour-change contract. The user-visible surface is identical.

**Rollback path**

- Before merge: the branch is unmerged; `git checkout main` and it never happened.
- After merge, per task: each task is one commit; `git revert <sha>` in reverse order. Tasks 1, 2 and 4 are pure additions and safe to leave in place — reverting Task 6 alone restores the original `scoreFlagsForPost`.
- Nuclear: `git revert` the merge commit. There is no data migration, no storage schema change, and no setting to unwind.
- The extension's existing `cqdV2.mode` toggle is untouched and still flips the whole V2 path off.

---

## 8. Open items carried forward

1. **#396 / #673 real-language fixtures.** Now a parallel track, not a blocker. Nine synthetic fixtures cover 8 ViewKinds and one RTL case; they do not cover the 11 other shipped languages. Real captures need a human session with a live Classroom account and cannot be committed (real student data). Until they exist, "zero behaviour change" is proven for English and Arabic only.
2. **Plan B.** Steps 5-7 of the spec: `StructuralDetector`, compare mode, evaluation. Write it after this plan merges, when the `Detector` interface exists to plan against.
3. **`entrypoints/content/smart-detector*.ts` keyword unions.** Untouched by design. They are removed at PRD Phase 4 (strip V1 detector), not here.
4. **EventBus.** The PRD's `TopicMap` seam is a larger, separate refactor. This plan uses direct calls behind interfaces; nothing here blocks the bus landing later, and `Detector` slots into `DetectEngine` unchanged when it does.

---

## 9. Explain-back checkpoints

After Task 6 lands, answer these without re-reading the code:

1. Why does the exclusion pass live inside `KeywordDetector` rather than in `decideFlags`, given the original code ran it after scoring?
2. `PostObservation` has a `debug` field that may contain raw page text. Why does that not violate the "no page text crosses the seam" rule — and what stops it from being abused?
3. The characterization baseline strips `timestamp` and `duration_ms`. Name a third field that would have made the snapshot flaky if it had been left in, and say why it is safe.
