# Detection Engine Seam — Plan B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `StructuralDetector` that uses no language signal, run it beside `KeywordDetector` in a build-gated compare mode, and instrument both so the promotion decision is made on measured evidence instead of opinion.

**Architecture:** `StructuralDetector` implements the same `Detector` interface Plan A introduced, so both emit `PostObservation` and are directly comparable. Compare mode is a **build-time** flag (`import.meta.env.MODE === 'compare'`), dead-code-eliminated from production builds. Instrumentation emits one plain-JSON record per post per engine.

**Tech Stack:** TypeScript 6, wxt 0.21 (Vite), vitest 4 + jsdom, pnpm workspace. Paths relative to `extension/` unless stated.

**Prerequisite:** Plan A merged — `src/contracts/`, `src/detect/keyword/`, `src/decide/` exist.

---

## 1. What changed from the spec, and why

Three corrections, each grounded in code or fixture DOM read on 2026-08-20.

### 1.1 `EngineMode` is not redefined

The spec proposes `EngineMode = 'v1' | 'v2' | 'compare'`. But `src/engines/types.ts:102` already defines:

```ts
export type EngineMode = 'legacy' | 'shadow' | 'v2' | 'v3';
```

That type is load-bearing — `engine-registry`, `mode-controller`, the popup toggle and `chrome.storage.local.cqdV2Mode` all use it. Redefining it would be a breaking change across the orchestrator for no benefit.

**Instead:** compare mode is a separate build-time constant, `IS_COMPARE_BUILD`, derived from `import.meta.env.MODE`. It is orthogonal to `EngineMode` and cannot be reached from the popup or storage. This also gives the spec's guarantee for free — there is no runtime path to compare mode in a store build.

### 1.2 `StructuralDetector`'s primary layer is a move, not new code

`commentLayer0_DOMTruth` in `src/detect/keyword/keyword-scoring.ts` is **already language-free**. It reads `.qCWAqb .huI6Cb`, `.qCWAqb.seqYL`, `.seqYL` and extracts a count from Unicode numerals. No keyword table, no `pageLang`, nothing lexical.

It is proven production logic that happens to live in the keyword module. `StructuralDetector` takes it as layer S0. This is the single biggest de-risking fact in this plan: the structural path starts with working code rather than guesses.

Its helpers (`normalizeText`, `extractCount`, `parseUnicodeInteger`) are likewise language-free and move to `src/detect/shared/` so both detectors can use them without either importing the other.

### 1.3 Structural "edited" detection is not possible yet — and the plan says so

Read the three fixtures:

| Fixture | Meta row |
|---|---|
| `stream-flagged-post-en.html` | `<div class="meta-row">Edited Mar 10</div>` |
| `rtl-flagged-post-ar.html` | `<div class="meta-row">تم التعديل في ١٠ مارس</div>` |
| `announcement-detail-en.html` | `<div class="meta-row">Posted Nov 6, 2025</div>` |

Structurally identical. The only difference is the words. There is **no** DOM shape, ARIA role, or element relationship in any fixture we hold that separates "edited" from "posted".

**Therefore `StructuralDetector` reports edited as explicitly unavailable** — `present: false`, `strength: 0`, `source: 'unavailable'` — rather than guessing and producing a silent false-negative that instrumentation would misread as agreement.

This is not a gap in the plan. It is the plan's first measured result: compare mode will show 100% structural miss on edited, quantifying exactly what real captures (#396/#673) must resolve. Promotion of the structural path was never going to be possible without them; now that is a number instead of an assumption.

---

## 2. Goals

**G1 — A second detector behind the same interface.** `StructuralDetector implements Detector`, emits `PostObservation`, reads no keyword table and no `lang`.

**G2 — Compare mode cannot reach production.** Gated on `import.meta.env.MODE === 'compare'`; absent from chrome/firefox/edge store builds; no storage key, no popup control.

**G3 — Measured evidence, not opinion.** One JSON record per post per engine: engine, elapsed ms, what it found, confidence, agreement. Summary on demand via `window.__cqd.report()`.

**G4 — Honest gaps.** Where the structural path cannot decide, it says so, and the report counts it separately from a genuine disagreement.

**G5 — Zero production behaviour change, again.** The Plan A characterization baseline stays byte-identical.

---

## 3. User stories

### Story 1 — Maintainer deciding whether to trust the structural path

> As the maintainer, I want to open a real Classroom page in a compare build and see, per post, which engine found what and where they disagreed, so promotion is a decision about data.

**Acceptance criteria**
- Every scanned post emits one grouped console line per engine in a compare build.
- `window.__cqd.report()` prints per-engine totals, mean and median latency, agreement rate, and a disagreement list with post ids.
- The report separates three outcomes: agree, disagree, and structural-unavailable.

### Story 2 — Maintainer avoiding a false promotion

> As the maintainer, I do not want the structural engine to look good because it silently reported "no flag" on everything it cannot see.

**Acceptance criteria**
- `StructuralDetector` sets `source: 'unavailable'` on any signal it cannot evaluate.
- `compareObservations()` classifies unavailable as `'unavailable'`, never as agreement.
- A test asserts that an unavailable edited signal against a keyword `edited: present` is **not** counted as agreement.

### Story 3 — User of a store build

> As a user, I want none of this in my browser.

**Acceptance criteria**
- `IS_COMPARE_BUILD` is `false` in chrome/firefox/edge builds.
- A test asserts no compare-mode module is imported from a production entrypoint path.
- `wxt build -b chrome|firefox|edge` output contains no `__cqd` global and no compare CSS.

### Story 4 — Contributor reading the structural detector

> As a contributor, I want to know why the structural detector does not do edited detection, without digging through git history.

**Acceptance criteria**
- `structural-detector.ts` documents the gap and names the fixtures that prove it.
- `ENGINE_ARCHITECTURE.md` records it.

---

## 4. Global acceptance criteria

```bash
pnpm -C extension run test:fixtures:manifest && pnpm -C extension test && pnpm -C extension run test:golden && pnpm -C extension compile && pnpm -C extension run test:coverage:all && pnpm -C extension exec wxt build -b chrome && pnpm -C extension exec wxt build -b firefox && pnpm -C extension exec wxt build -b edge
```

| # | Criterion | Checked by |
|---|---|---|
| AC1 | Plan A characterization baseline unchanged | `tests/characterization/flag-scoring-characterization.test.ts` |
| AC2 | Import boundary still holds, now with `src/detect/shared` | `tests/contracts/import-boundary.test.ts` |
| AC3 | `StructuralDetector` imports no keyword module and no `lang` | boundary test + dedicated assertion |
| AC4 | Compare mode absent from production builds | `tests/compare/compare-gating.test.ts` |
| AC5 | Unavailable never counted as agreement | `tests/compare/compare-observations.test.ts` |
| AC6 | `tests/v2-flag-scoring.test.ts` still passes unedited | `git diff --exit-code` |

---

## 5. File structure

**Create**

| Path | Responsibility |
|---|---|
| `src/detect/shared/numerals.ts` | `parseUnicodeInteger`, `extractCount` — language-free numeral parsing |
| `src/detect/shared/text.ts` | `normalizeText` — Unicode normalization, no keywords |
| `src/detect/structural/structural-detector.ts` | `StructuralDetector implements Detector` |
| `src/compare/compare-mode.ts` | `IS_COMPARE_BUILD` constant |
| `src/compare/compare-observations.ts` | `compareObservations()` + `ComparisonRecord` |
| `src/compare/compare-instrumentation.ts` | Collector, live logging, `window.__cqd.report()` |
| `src/compare/compare-styles.ts` | The dev transform class, compare-build only |
| `tests/detect/structural-detector.test.ts` | Structural detection |
| `tests/detect/numerals.test.ts` | Numeral parsing across scripts |
| `tests/compare/compare-observations.test.ts` | Agreement classification |
| `tests/compare/compare-gating.test.ts` | Production exclusion |

**Modify**

| Path | Change |
|---|---|
| `src/detect/keyword/keyword-scoring.ts` | Import numerals/text from `src/detect/shared` instead of defining/importing them |
| `tests/contracts/import-boundary.test.ts` | Add the rule that `src/detect/structural` is keyword-free |
| `package.json` | Add `build:compare` script |
| `extension/docs/ENGINE_ARCHITECTURE.md` | Document the structural gap and compare mode |

### Layer rules, extended

```
             ┌──────────────────┐
             │ detect/shared    │  language-free primitives
             └────────┬─────────┘
        ┌─────────────┴─────────────┐
        ▼                           ▼
  detect/keyword              detect/structural
  (keyword tables OK)         (NO keyword imports, NO lang)
        └─────────────┬─────────────┘
                      ▼
                   decide           →   render
```

`src/detect/structural/**` must not import: keyword modules, `detect/keyword/**`, or read `ctx.lang`.

---

## Task 1: Language-free primitives

Move numeral and text helpers out of the keyword layer so both detectors can share them.

**Files:**
- Create: `src/detect/shared/numerals.ts`, `src/detect/shared/text.ts`
- Test: `tests/detect/numerals.test.ts`
- Modify: `src/detect/keyword/keyword-scoring.ts`

- [ ] **Step 1: Write the failing test**

```ts
// filepath: extension/tests/detect/numerals.test.ts
import { describe, it, expect } from 'vitest';
import { parseUnicodeInteger, extractCount } from '../../src/detect/shared/numerals';

describe('parseUnicodeInteger', () => {
  it('parses ASCII digits', () => {
    expect(parseUnicodeInteger('5')).toBe(5);
  });

  it('parses Arabic-Indic digits', () => {
    expect(parseUnicodeInteger('٥')).toBe(5);
  });

  it('parses Devanagari digits', () => {
    expect(parseUnicodeInteger('५')).toBe(5);
  });

  it('returns null for no digits', () => {
    expect(parseUnicodeInteger('none at all')).toBeNull();
  });
});

describe('extractCount', () => {
  it('pulls the count out of an English phrase', () => {
    expect(extractCount('5 class comments')).toBe(5);
  });

  it('pulls the count out of an Arabic phrase', () => {
    expect(extractCount('٥ تعليقات صفية')).toBe(5);
  });

  it('returns null when the phrase has no numeral', () => {
    expect(extractCount('No class comments')).toBeNull();
  });

  it('is language-agnostic — same numeral, different scripts, same answer', () => {
    expect(extractCount('٣ تعليقات')).toBe(extractCount('3 comments'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm -C extension test tests/detect/numerals.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the shared modules**

Move `parseUnicodeInteger` from `src/v2/decision/keyword-loader.ts` and `extractCount` from `src/detect/keyword/keyword-scoring.ts` into `src/detect/shared/numerals.ts`, and `normalizeText` / `normalizeForComparison` into `src/detect/shared/text.ts`. Both files must import nothing from the keyword layer.

Re-export from their old locations so existing callers are unaffected:

```ts
// in keyword-scoring.ts
export { extractCount } from '../shared/numerals';
```

- [ ] **Step 4: Verify**

```bash
pnpm -C extension test tests/detect/numerals.test.ts && pnpm -C extension test && pnpm -C extension compile
```

Expected: numerals tests PASS; full suite PASS; characterization baseline unchanged; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/detect/shared tests/detect/numerals.test.ts src/detect/keyword/keyword-scoring.ts
git commit -m "refactor: extract language-free numeral helpers"
```

---

## Task 2: StructuralDetector

**Files:**
- Create: `src/detect/structural/structural-detector.ts`
- Test: `tests/detect/structural-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// filepath: extension/tests/detect/structural-detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StructuralDetector } from '../../src/detect/structural/structural-detector';
import { ViewKind } from '../../src/engines/types';

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', 'sd-test');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe('StructuralDetector', () => {
  let detector: StructuralDetector;

  beforeEach(() => {
    document.body.innerHTML = '';
    detector = new StructuralDetector();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('identifies itself as the structural detector', () => {
    expect(detector.name).toBe('structural');
  });

  it('finds a comment count via the DOM-truth container', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">3</div></div>');
    const obs = detector.observe(post, { postId: 'p1', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(3);
    expect(obs.comment.source).toBe('dom-truth');
  });

  it('finds an Arabic-numeral comment count with no language hint', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">٥</div></div>');
    const obs = detector.observe(post, { postId: 'p2', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(5);
  });

  it('gives the same answer regardless of the lang hint', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">7</div></div>');
    const asEn = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'en' });
    const asAr = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'ar' });
    const asNone = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM });

    expect(asEn.comment).toEqual(asAr.comment);
    expect(asEn.comment).toEqual(asNone.comment);
  });

  it('reports no comment when the shell has no numeral', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">No class comments</div></div>');
    const obs = detector.observe(post, { postId: 'p4', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(false);
    expect(obs.comment.count).toBeNull();
  });

  it('reports edited as explicitly unavailable, never as absent', () => {
    const post = createPost('<div class="meta-row">Edited Mar 10</div>');
    const obs = detector.observe(post, { postId: 'p5', viewKind: ViewKind.STREAM });

    expect(obs.edited.present).toBe(false);
    expect(obs.edited.strength).toBe(0);
    expect(obs.edited.source).toBe('unavailable');
  });

  it('measures its own cost', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">2</div></div>');
    const obs = detector.observe(post, { postId: 'p6', viewKind: ViewKind.STREAM });

    expect(obs.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(obs.elapsedMs)).toBe(true);
  });

  it('emits a well-formed observation for a post with nothing in it', () => {
    const post = createPost('<p>plain</p>');
    const obs = detector.observe(post, { postId: 'p7', viewKind: ViewKind.STREAM });

    expect(obs.detector).toBe('structural');
    expect(obs.postId).toBe('p7');
    expect(obs.comment.present).toBe(false);
    expect(obs.penalties).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm -C extension test tests/detect/structural-detector.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`StructuralDetector.observe()` runs layer S0 (DOM truth, ported from `commentLayer0_DOMTruth` — selectors `.qCWAqb .huI6Cb`, `.qCWAqb.seqYL`, `.seqYL`), then S1 (comment shell via `[jscontroller="h38nBf"]` ancestor plus a numeral in a descendant). Edited always returns `{ present: false, nearDate: false, strength: 0, source: 'unavailable' }` with the reason documented inline, naming `stream-flagged-post-en.html`, `rtl-flagged-post-ar.html` and `announcement-detail-en.html` as the fixtures that prove the gap.

- [ ] **Step 4: Verify**

```bash
pnpm -C extension test tests/detect/structural-detector.test.ts && pnpm -C extension compile
```

Expected: 8 tests PASS, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/detect/structural tests/detect/structural-detector.test.ts
git commit -m "feat: add StructuralDetector with no language signal"
```

---

## Task 3: Comparison record

**Files:**
- Create: `src/compare/compare-observations.ts`
- Test: `tests/compare/compare-observations.test.ts`

- [ ] **Step 1: Write the failing test**

Covers, at minimum: two agreeing observations classify as `agree`; differing comment presence classifies as `disagree`; a keyword `edited.present` against a structural `edited.source === 'unavailable'` classifies as `unavailable` and **not** `agree`; the record carries both engines' elapsed ms.

- [ ] **Step 2–5:** run/fail, implement `compareObservations(keyword, structural): ComparisonRecord`, verify, commit as `feat: add engine comparison record`.

---

## Task 4: Compare-mode gating

**Files:**
- Create: `src/compare/compare-mode.ts`
- Test: `tests/compare/compare-gating.test.ts`
- Modify: `package.json`

- [ ] **Step 1:** test asserts `IS_COMPARE_BUILD === false` under the default vitest mode, and that no file under `entrypoints/` imports `src/compare/`.

- [ ] **Step 2–4:** implement

```ts
export const IS_COMPARE_BUILD = import.meta.env.MODE === 'compare';
```

add `"build:compare": "wxt build --mode compare"`, verify, commit as `feat: gate compare mode on the build flag`.

---

## Task 5: Instrumentation

**Files:**
- Create: `src/compare/compare-instrumentation.ts`

Collector holding `ComparisonRecord[]`, a live grouped console line per post, and `window.__cqd.report()` printing per-engine totals, mean and median latency, agreement rate, and disagreements with post ids. All of it behind `if (IS_COMPARE_BUILD)`.

**Caveat to document in the report output itself:** both engines contend for the same main thread in compare mode, so absolute timings are inflated. Relative comparison is meaningful; absolute numbers are not.

---

## Task 6: Dual run and dev transform

**Files:**
- Create: `src/compare/compare-styles.ts`
- Modify: the V2 engine's flag path, guarded by `IS_COMPARE_BUILD`

Both engines observe every post; both render in the same position; the render root gets a single `cqd-compare` class applying `opacity: 0.5` plus a drop shadow to every `cqd-*` descendant — one class on the root, never per component.

- [ ] **Gate:** `wxt build -b chrome` output contains no `cqd-compare` string and no `__cqd` global.

---

## Task 7: Evaluation runbook

**Files:**
- Create: `extension/docs/COMPARE_MODE_RUNBOOK.md`

How to build (`pnpm build:compare`), load unpacked, which pages to visit, how to read `report()`, and the promotion thresholds — starting reference 99.5% coverage / 98% precision from the PRD, to be set from real data rather than guessed.

---

## 6. Blast radius

| Surface | Exposure | Containment |
|---|---|---|
| Production detection | none | All compare code behind `IS_COMPARE_BUILD`, dead-code-eliminated |
| Keyword path | numeral helpers move | Re-exported from old locations; characterization baseline unchanged |
| Render | dual render in compare builds only | Gated; production render path untouched |
| Bundle size | none in production | Verified by the gating test and a build-output grep |

**Rollback:** every task is one commit; `git revert` in reverse order. `src/compare/` and `src/detect/structural/` are pure additions — deleting them cannot affect production.

---

## 7. Known limits

1. **Structural edited detection does not exist.** Blocked on #396/#673 real captures. Compare mode will report 100% structural miss on edited; that is the expected, correct result, not a bug.
2. **Structural comment detection is only as good as the class selectors.** `.qCWAqb`/`.huI6Cb`/`.seqYL` are obfuscated Google class names that can change without notice — the same exposure the keyword path already has.
3. **Absolute latency numbers from compare mode are not trustworthy.** Main-thread contention. Relative only.
4. **Promotion cannot be decided from the 9 synthetic fixtures.** It needs compare-mode runs on real Classroom pages in several languages.
