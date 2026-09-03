# Engine V4 — Sprint 1: Accuracy Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two-tier accuracy harness that turns "is CQD's detection accurate?" into a number CI can gate on, and record today's engine as the baseline.

**Architecture:** Test-only code under `extension/tests/accuracy/`. A corpus of labelled cases (`page.html` + `expected.json`); a Tier B runner that goes HTML → `PostObservation[]` through the real `KeywordDetector`; a Tier A runner that goes `PostObservation[]` → `PostDecision[]` through the real pure `decideFlags`; a metrics module that scores predictions against labels; and a gate test driven by a versioned `accuracy-budget.json` holding floors plus an explicit `knownFailures` ratchet list.

**Tech Stack:** TypeScript, Vitest (jsdom env), Node `fs`/`path`. No new dependencies.

**Context:** Program plan `docs/ENGINE_V4_MASTER_PLAN.md` (Sprint S1). Definitions `docs/adr/0008-accuracy-definition-and-gates.md`. Design `extension/docs/ENGINE_V4_SYSTEM_DESIGN.md` §10.

**Run all commands from `extension/`** unless stated otherwise.

---

## File Structure

| Path | Responsibility |
|---|---|
| `extension/tests/accuracy/types.ts` | Corpus label + report types. No logic. |
| `extension/tests/accuracy/metrics.ts` | Pure scoring: confusion counts, precision, recall, coverage. |
| `extension/tests/accuracy/corpus.ts` | Read cases off disk, validate their shape. |
| `extension/tests/accuracy/tier-b.ts` | HTML → `PostObservation[]` via the real detector (jsdom). |
| `extension/tests/accuracy/tier-a.ts` | `PostObservation[]` → `PostDecision[]` via real `decideFlags` (pure). |
| `extension/tests/accuracy/accuracy-budget.json` | Versioned floors + `knownFailures` ratchet. |
| `extension/tests/accuracy/corpus/<case>/page.html` | Sanitized page fragment. |
| `extension/tests/accuracy/corpus/<case>/expected.json` | Hand-written labels. |
| `extension/tests/accuracy/metrics.test.ts` | Unit tests for the scorer. |
| `extension/tests/accuracy/corpus.test.ts` | Unit tests for the loader. |
| `extension/tests/accuracy/runners.test.ts` | Unit tests for both runners. |
| `extension/tests/accuracy/accuracy.test.ts` | The gate. Runs the corpus, enforces the budget. |
| `extension/tools/accuracy-report.mjs` | Prints the baseline table for humans. |

Split rationale: `metrics.ts` is pure arithmetic and must be testable without a
DOM; `tier-b.ts` is the only file in the harness that touches jsdom. Keeping
that boundary inside the *test* harness is the same rule ADR-0007 imposes on
`src/` — the harness must not be harder to trust than the code it measures.

---

### Task 1: Corpus label types

**Files:**
- Create: `extension/tests/accuracy/types.ts`

- [ ] **Step 1: Write the types**

```ts
// filepath: extension/tests/accuracy/types.ts
/**
 * Types for the accuracy corpus. See docs/adr/0008-accuracy-definition-and-gates.md.
 *
 * A label describes what a human decided is TRUE about a page. It never
 * describes what the engine currently does — that distinction is the whole
 * point of the corpus.
 */
import type { ViewKind } from '../../src/engines/types';

/** Ground truth for one post inside a case. */
export interface ExpectedPost {
  /** Must equal the post's data-stream-item-id in page.html. */
  postId: string;
  /** True if a human can see class comments on this card. */
  commentPresent: boolean;
  /** Visible comment count, or null when no number is shown. */
  commentCount: number | null;
  /** True if a human can see an edited marker on this card. */
  editedPresent: boolean;
}

/** One labelled corpus case. */
export interface ExpectedCase {
  /** Directory name. Stable forever — it is the regression's name. */
  caseId: string;
  viewKind: ViewKind;
  /** BCP-47 tag of the page content, e.g. 'en', 'ar', 'hu'. */
  lang: string;
  /** Why this case exists. Written for the person who breaks it in 2027. */
  note: string;
  posts: ExpectedPost[];
}

/** A case plus its raw HTML, as loaded from disk. */
export interface LoadedCase {
  expected: ExpectedCase;
  html: string;
}

/** What the engine predicted for one post. */
export interface PredictedPost {
  postId: string;
  commentPresent: boolean;
  commentCount: number | null;
  editedPresent: boolean;
}

/** Counts for one binary signal. */
export interface ConfusionCounts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/** Scored result for the whole run. */
export interface AccuracyReport {
  comment: ConfusionCounts;
  edited: ConfusionCounts;
  /** Posts where the predicted comment count equals the label exactly. */
  countExact: number;
  /** Posts where a count was labelled at all (the denominator for countExact). */
  countLabelled: number;
  /** Posts the engine produced any prediction for. */
  observed: number;
  /** Posts the labels say exist. */
  expected: number;
  /** caseIds where every post matched its label exactly. */
  exactCases: string[];
  /** caseIds where at least one post did not match. */
  failedCases: string[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm compile`
Expected: PASS, no output.

- [ ] **Step 3: Commit**

```bash
git add extension/tests/accuracy/types.ts
git commit -m "test(accuracy): add corpus label types"
```

---

### Task 2: Metrics module

**Files:**
- Create: `extension/tests/accuracy/metrics.ts`
- Test: `extension/tests/accuracy/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// filepath: extension/tests/accuracy/metrics.test.ts
import { describe, it, expect } from 'vitest';
import { emptyReport, scoreCase, precision, recall, coverage } from './metrics';
import type { ExpectedCase, PredictedPost } from './types';
import { ViewKind } from '../../src/engines/types';

const oneCase: ExpectedCase = {
  caseId: 'demo',
  viewKind: ViewKind.STREAM,
  lang: 'en',
  note: 'unit test fixture',
  posts: [
    { postId: 'p1', commentPresent: true, commentCount: 5, editedPresent: true },
    { postId: 'p2', commentPresent: false, commentCount: null, editedPresent: false },
  ],
};

describe('accuracy metrics', () => {
  it('scores a perfect run as an exact case', () => {
    const predicted: PredictedPost[] = [
      { postId: 'p1', commentPresent: true, commentCount: 5, editedPresent: true },
      { postId: 'p2', commentPresent: false, commentCount: null, editedPresent: false },
    ];
    const report = scoreCase(emptyReport(), oneCase, predicted);

    expect(report.comment).toEqual({ tp: 1, fp: 0, fn: 0, tn: 1 });
    expect(report.edited).toEqual({ tp: 1, fp: 0, fn: 0, tn: 1 });
    expect(report.countExact).toBe(1);
    expect(report.countLabelled).toBe(1);
    expect(report.exactCases).toEqual(['demo']);
    expect(report.failedCases).toEqual([]);
  });

  it('counts a false positive comment flag and fails the case', () => {
    const predicted: PredictedPost[] = [
      { postId: 'p1', commentPresent: true, commentCount: 5, editedPresent: true },
      { postId: 'p2', commentPresent: true, commentCount: 1, editedPresent: false },
    ];
    const report = scoreCase(emptyReport(), oneCase, predicted);

    expect(report.comment).toEqual({ tp: 1, fp: 1, fn: 0, tn: 0 });
    expect(report.failedCases).toEqual(['demo']);
    expect(report.exactCases).toEqual([]);
  });

  it('treats a post the engine never saw as a miss, not a pass', () => {
    const predicted: PredictedPost[] = [
      { postId: 'p1', commentPresent: true, commentCount: 5, editedPresent: true },
    ];
    const report = scoreCase(emptyReport(), oneCase, predicted);

    expect(report.observed).toBe(1);
    expect(report.expected).toBe(2);
    expect(coverage(report)).toBe(0.5);
    expect(report.failedCases).toEqual(['demo']);
  });

  it('computes precision and recall from confusion counts', () => {
    expect(precision({ tp: 3, fp: 1, fn: 0, tn: 0 })).toBe(0.75);
    expect(recall({ tp: 3, fp: 0, fn: 1, tn: 0 })).toBe(0.75);
  });

  it('reports precision and recall of 1 when there is nothing to get wrong', () => {
    expect(precision({ tp: 0, fp: 0, fn: 0, tn: 4 })).toBe(1);
    expect(recall({ tp: 0, fp: 0, fn: 0, tn: 4 })).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/accuracy/metrics.test.ts`
Expected: FAIL — `Failed to resolve import "./metrics"`.

- [ ] **Step 3: Write the implementation**

```ts
// filepath: extension/tests/accuracy/metrics.ts
/**
 * Pure scoring for the accuracy corpus. No DOM, no fs, no clock.
 *
 * Design note: a post the engine never produced a prediction for is scored as
 * a MISS on every signal it was labelled positive for, and the case fails.
 * Silently ignoring unseen posts is the single easiest way to build a harness
 * that reports 100% while the engine sees nothing.
 */
import type {
  AccuracyReport,
  ConfusionCounts,
  ExpectedCase,
  PredictedPost,
} from './types';

export function emptyReport(): AccuracyReport {
  return {
    comment: { tp: 0, fp: 0, fn: 0, tn: 0 },
    edited: { tp: 0, fp: 0, fn: 0, tn: 0 },
    countExact: 0,
    countLabelled: 0,
    observed: 0,
    expected: 0,
    exactCases: [],
    failedCases: [],
  };
}

function tally(counts: ConfusionCounts, actual: boolean, predicted: boolean): void {
  if (actual && predicted) counts.tp += 1;
  else if (!actual && predicted) counts.fp += 1;
  else if (actual && !predicted) counts.fn += 1;
  else counts.tn += 1;
}

export function precision(c: ConfusionCounts): number {
  const denom = c.tp + c.fp;
  return denom === 0 ? 1 : c.tp / denom;
}

export function recall(c: ConfusionCounts): number {
  const denom = c.tp + c.fn;
  return denom === 0 ? 1 : c.tp / denom;
}

export function coverage(report: AccuracyReport): number {
  return report.expected === 0 ? 1 : report.observed / report.expected;
}

export function countExactRate(report: AccuracyReport): number {
  return report.countLabelled === 0 ? 1 : report.countExact / report.countLabelled;
}

/** Fold one case's predictions into a running report. Returns the same object. */
export function scoreCase(
  report: AccuracyReport,
  expected: ExpectedCase,
  predicted: PredictedPost[],
): AccuracyReport {
  const byId = new Map(predicted.map((p) => [p.postId, p]));
  let caseExact = true;

  for (const post of expected.posts) {
    report.expected += 1;
    const got = byId.get(post.postId);

    if (!got) {
      tally(report.comment, post.commentPresent, false);
      tally(report.edited, post.editedPresent, false);
      if (post.commentCount !== null) report.countLabelled += 1;
      caseExact = false;
      continue;
    }

    report.observed += 1;
    tally(report.comment, post.commentPresent, got.commentPresent);
    tally(report.edited, post.editedPresent, got.editedPresent);

    if (post.commentCount !== null) {
      report.countLabelled += 1;
      if (got.commentCount === post.commentCount) report.countExact += 1;
      else caseExact = false;
    }

    if (
      got.commentPresent !== post.commentPresent ||
      got.editedPresent !== post.editedPresent
    ) {
      caseExact = false;
    }
  }

  if (caseExact) report.exactCases.push(expected.caseId);
  else report.failedCases.push(expected.caseId);

  return report;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/accuracy/metrics.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add extension/tests/accuracy/metrics.ts extension/tests/accuracy/metrics.test.ts
git commit -m "test(accuracy): add pure scoring metrics for the corpus"
```

---

### Task 3: Corpus loader

**Files:**
- Create: `extension/tests/accuracy/corpus.ts`
- Test: `extension/tests/accuracy/corpus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// filepath: extension/tests/accuracy/corpus.test.ts
import { describe, it, expect } from 'vitest';
import { loadCorpus, CORPUS_DIR } from './corpus';
import { existsSync } from 'node:fs';

describe('accuracy corpus', () => {
  it('has a corpus directory', () => {
    expect(existsSync(CORPUS_DIR)).toBe(true);
  });

  it('loads every case with html and labels', () => {
    const cases = loadCorpus();
    expect(cases.length).toBeGreaterThan(0);

    for (const c of cases) {
      expect(c.html.length).toBeGreaterThan(0);
      expect(c.expected.caseId.length).toBeGreaterThan(0);
      expect(c.expected.note.length).toBeGreaterThan(0);
      expect(c.expected.posts.length).toBeGreaterThan(0);
    }
  });

  it('uses the directory name as the caseId', () => {
    for (const c of loadCorpus()) {
      expect(c.expected.caseId).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('labels every post with an id that appears in the html', () => {
    for (const c of loadCorpus()) {
      for (const post of c.expected.posts) {
        expect(c.html).toContain(post.postId);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/accuracy/corpus.test.ts`
Expected: FAIL — `Failed to resolve import "./corpus"`.

- [ ] **Step 3: Write the implementation**

```ts
// filepath: extension/tests/accuracy/corpus.ts
/**
 * Reads labelled cases off disk. Deliberately strict: a malformed case is a
 * thrown error, not a skipped case. A silently skipped case is a regression
 * test that stops testing without telling anyone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExpectedCase, LoadedCase } from './types';

export const CORPUS_DIR = resolve(process.cwd(), 'tests/accuracy/corpus');

function assertShape(caseId: string, parsed: ExpectedCase): void {
  if (parsed.caseId !== caseId) {
    throw new Error(`corpus: ${caseId}/expected.json declares caseId "${parsed.caseId}"`);
  }
  if (!parsed.note?.trim()) {
    throw new Error(`corpus: ${caseId} has no note — say why this case exists`);
  }
  if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
    throw new Error(`corpus: ${caseId} labels no posts`);
  }
  const ids = new Set<string>();
  for (const post of parsed.posts) {
    if (ids.has(post.postId)) {
      throw new Error(`corpus: ${caseId} labels postId "${post.postId}" twice`);
    }
    ids.add(post.postId);
  }
}

export function loadCorpus(): LoadedCase[] {
  const entries = readdirSync(CORPUS_DIR)
    .filter((name) => statSync(join(CORPUS_DIR, name)).isDirectory())
    .sort();

  return entries.map((caseId) => {
    const dir = join(CORPUS_DIR, caseId);
    const expected = JSON.parse(
      readFileSync(join(dir, 'expected.json'), 'utf8'),
    ) as ExpectedCase;
    assertShape(caseId, expected);
    return { expected, html: readFileSync(join(dir, 'page.html'), 'utf8') };
  });
}
```

- [ ] **Step 4: Run test to verify it fails for the right reason**

Run: `pnpm vitest run tests/accuracy/corpus.test.ts`
Expected: FAIL — `ENOENT ... tests/accuracy/corpus`. The corpus directory arrives in Task 5.

- [ ] **Step 5: Commit**

```bash
git add extension/tests/accuracy/corpus.ts extension/tests/accuracy/corpus.test.ts
git commit -m "test(accuracy): add strict corpus loader"
```

---

### Task 4: Tier B and Tier A runners

**Files:**
- Create: `extension/tests/accuracy/tier-b.ts`
- Create: `extension/tests/accuracy/tier-a.ts`
- Test: `extension/tests/accuracy/runners.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// filepath: extension/tests/accuracy/runners.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { observeHtml, segmentPosts } from './tier-b';
import { decideObservations } from './tier-a';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

const HTML = `
<article data-stream-item-id="post-a">
  <div class="IMvYId Vu2fZd">Edited Mar 10</div>
  <div class="qCWAqb"><div class="huI6Cb">5</div></div>
  <section data-stream-item-id="post-a"><span>nested duplicate</span></section>
</article>
<article data-stream-item-id="post-b"><p>plain post</p></article>`;

describe('tier B runner', () => {
  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('segments outermost posts only, deduped by id', () => {
    document.body.innerHTML = HTML;
    expect(segmentPosts(document.body).map((el) => el.getAttribute('data-stream-item-id')))
      .toEqual(['post-a', 'post-b']);
  });

  it('produces one observation per post', () => {
    const observations = observeHtml(HTML, ViewKind.STREAM, 'en');
    expect(observations.map((o) => o.postId)).toEqual(['post-a', 'post-b']);
    expect(observations[0]!.comment.count).toBe(5);
  });
});

describe('tier A runner', () => {
  it('turns observations into predictions via the real decide layer', () => {
    const observations = observeHtml(HTML, ViewKind.STREAM, 'en');
    const predicted = decideObservations(observations);

    const a = predicted.find((p) => p.postId === 'post-a')!;
    expect(a.commentPresent).toBe(true);
    expect(a.commentCount).toBe(5);
    expect(a.editedPresent).toBe(true);

    const b = predicted.find((p) => p.postId === 'post-b')!;
    expect(b.commentPresent).toBe(false);
    expect(b.editedPresent).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/accuracy/runners.test.ts`
Expected: FAIL — `Failed to resolve import "./tier-b"`.

- [ ] **Step 3: Write Tier B**

```ts
// filepath: extension/tests/accuracy/tier-b.ts
/**
 * TIER B — HTML in, PostObservation[] out, through the real detector.
 * This is the only file in the harness that touches jsdom.
 */
import { KeywordDetector } from '../../src/detect/keyword/keyword-detector';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import type { PostObservation } from '../../src/contracts/detection';
import type { ViewKind } from '../../src/engines/types';

const POST_SELECTOR = '[data-stream-item-id]';

/**
 * Outermost post elements, one per id.
 *
 * Classroom nests elements that repeat the parent's stream-item-id (see
 * tests/fixtures/classroom/stream-flagged-post-en.html). Scoring the nested
 * copies would inflate every number, so only the outermost wins.
 */
export function segmentPosts(root: HTMLElement): HTMLElement[] {
  const seen = new Set<string>();
  const out: HTMLElement[] = [];

  for (const el of Array.from(root.querySelectorAll<HTMLElement>(POST_SELECTOR))) {
    if (el.parentElement?.closest(POST_SELECTOR)) continue;
    const id = el.getAttribute('data-stream-item-id');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(el);
  }
  return out;
}

export function observeHtml(
  html: string,
  viewKind: ViewKind,
  lang: string,
): PostObservation[] {
  clearKeywordCache();
  document.body.innerHTML = html;
  document.documentElement.lang = lang;

  const detector = new KeywordDetector();
  const observations = segmentPosts(document.body).map((post) =>
    detector.observe(post, {
      postId: post.getAttribute('data-stream-item-id')!,
      viewKind,
      lang,
    }),
  );

  document.body.innerHTML = '';
  return observations;
}
```

- [ ] **Step 4: Write Tier A**

```ts
// filepath: extension/tests/accuracy/tier-a.ts
/**
 * TIER A — PostObservation[] in, predictions out, through the real pure
 * decide layer. No DOM. Fast enough to run over hundreds of cases when a
 * decision-policy change needs evaluating.
 */
import { decideFlags } from '../../src/decide/decide-flags';
import type { PostObservation } from '../../src/contracts/detection';
import type { PredictedPost } from './types';

export function decideObservations(observations: PostObservation[]): PredictedPost[] {
  return observations.map((observation) => {
    const decision = decideFlags(observation);
    return {
      postId: decision.postId,
      commentPresent: decision.verdict === 'comment' || decision.verdict === 'both',
      editedPresent: decision.verdict === 'edited' || decision.verdict === 'both',
      commentCount: decision.commentCount,
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/accuracy/runners.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add extension/tests/accuracy/tier-a.ts extension/tests/accuracy/tier-b.ts extension/tests/accuracy/runners.test.ts
git commit -m "test(accuracy): add tier A and tier B corpus runners"
```

---

### Task 5: Seed the corpus from existing fixtures

Three seed cases, reusing HTML we already trust. Labels are written by reading
the HTML as a human would — **not** by running the engine.

**Files:**
- Create: `extension/tests/accuracy/corpus/stream-edited-and-comments-en/page.html`
- Create: `extension/tests/accuracy/corpus/stream-edited-and-comments-en/expected.json`
- Create: `extension/tests/accuracy/corpus/rtl-flagged-post-ar/page.html`
- Create: `extension/tests/accuracy/corpus/rtl-flagged-post-ar/expected.json`
- Create: `extension/tests/accuracy/corpus/plain-post-no-flags-en/page.html`
- Create: `extension/tests/accuracy/corpus/plain-post-no-flags-en/expected.json`

- [ ] **Step 1: Copy the two source fixtures**

```bash
mkdir -p extension/tests/accuracy/corpus/stream-edited-and-comments-en extension/tests/accuracy/corpus/rtl-flagged-post-ar extension/tests/accuracy/corpus/plain-post-no-flags-en
cp extension/tests/fixtures/classroom/stream-flagged-post-en.html extension/tests/accuracy/corpus/stream-edited-and-comments-en/page.html
cp extension/tests/fixtures/classroom/rtl-flagged-post-ar.html extension/tests/accuracy/corpus/rtl-flagged-post-ar/page.html
```

- [ ] **Step 2: Write the negative case by hand**

```bash
cat > extension/tests/accuracy/corpus/plain-post-no-flags-en/page.html <<'HTML'
<!-- Negative control. No comments, no edit marker. Any flag here is a false positive. -->
<article class="n4xnA JUr7jb" data-stream-item-id="corpus-plain-1">
  <header class="IMvYId">
    <div class="author-row">Test User</div>
    <div class="meta-row">Posted Nov 6</div>
  </header>
  <div class="asQXV QRiHXd">
    <p>Commentary on the reading is due next week. Add comment below if unclear.</p>
  </div>
</article>
HTML
```

The body text is deliberately hostile: it contains "Commentary" and "Add
comment", the exact substrings behind defects D6 and D3 in
`docs/ENGINE_V4_MASTER_PLAN.md`.

- [ ] **Step 3: Write the labels**

```bash
cat > extension/tests/accuracy/corpus/stream-edited-and-comments-en/expected.json <<'JSON'
{
  "caseId": "stream-edited-and-comments-en",
  "viewKind": "stream",
  "lang": "en",
  "note": "Stream card with an edit marker and a 5-comment shell. Nested elements repeat the parent stream-item-id and must not be scored twice.",
  "posts": [
    { "postId": "fixture-stream-2", "commentPresent": true, "commentCount": 5, "editedPresent": true }
  ]
}
JSON
cat > extension/tests/accuracy/corpus/plain-post-no-flags-en/expected.json <<'JSON'
{
  "caseId": "plain-post-no-flags-en",
  "viewKind": "stream",
  "lang": "en",
  "note": "Negative control. Body text contains 'Commentary' and 'Add comment' to catch substring and action-button false positives (defects D3, D6).",
  "posts": [
    { "postId": "corpus-plain-1", "commentPresent": false, "commentCount": null, "editedPresent": false }
  ]
}
JSON
```

- [ ] **Step 4: Write the Arabic labels**

Ground truth read off `rtl-flagged-post-ar.html` by hand: one post
`fixture-stream-ar-1`, edited marker `تم التعديل في ١٠ مارس`, comment count `٥` (Arabic-Indic
five) in `.comment-count`. Note that this card has **no** `.qCWAqb .huI6Cb`
element, so the layer-0 DOM-truth shortcut does not apply here — the count has
to come from a lower layer. That is exactly why this case is worth holding.

```bash
cat > extension/tests/accuracy/corpus/rtl-flagged-post-ar/expected.json <<'JSON'
{
  "caseId": "rtl-flagged-post-ar",
  "viewKind": "stream",
  "lang": "ar",
  "note": "RTL Arabic card: edited marker plus 5 class comments written in Arabic-Indic numerals. No .qCWAqb .huI6Cb element, so layer-0 DOM truth does not apply and the count must come from a lower layer. Also the one-card-ownership RTL case.",
  "posts": [
    { "postId": "fixture-stream-ar-1", "commentPresent": true, "commentCount": 5, "editedPresent": true }
  ]
}
JSON
```

- [ ] **Step 5: Run the loader tests**

Run: `pnpm vitest run tests/accuracy/corpus.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add extension/tests/accuracy/corpus
git commit -m "test(accuracy): seed corpus with three labelled cases"
```

---

### Task 6: The gate

**Files:**
- Create: `extension/tests/accuracy/accuracy-budget.json`
- Create: `extension/tests/accuracy/accuracy.test.ts`

- [ ] **Step 1: Write the budget file with impossible-to-fail floors**

Floors start at zero and `knownFailures` starts empty. Step 4 replaces both with
the measured baseline — that is the ratchet's zero point, and it must be
measured, never guessed.

```bash
cat > extension/tests/accuracy/accuracy-budget.json <<'JSON'
{
  "version": 1,
  "note": "Floors may only move UP. Lowering one is a policy change and needs an ADR (docs/adr/0008-accuracy-definition-and-gates.md). knownFailures may only SHRINK.",
  "measuredOn": "unset",
  "floors": {
    "commentPrecision": 0,
    "commentRecall": 0,
    "editedPrecision": 0,
    "editedRecall": 0,
    "countExactRate": 0,
    "coverage": 0
  },
  "knownFailures": []
}
JSON
```

- [ ] **Step 2: Write the gate test**

```ts
// filepath: extension/tests/accuracy/accuracy.test.ts
/**
 * THE GATE. See docs/adr/0008-accuracy-definition-and-gates.md.
 *
 * C1 — every corpus case must match its labels exactly, except cases listed in
 *      knownFailures. A knownFailure that starts passing FAILS the test, which
 *      is how the list ratchets down instead of rotting.
 * C2 — statistical floors, which may only move up.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCorpus } from './corpus';
import { observeHtml } from './tier-b';
import { decideObservations } from './tier-a';
import {
  emptyReport,
  scoreCase,
  precision,
  recall,
  coverage,
  countExactRate,
} from './metrics';
import type { AccuracyReport } from './types';

const BUDGET_PATH = resolve(process.cwd(), 'tests/accuracy/accuracy-budget.json');
const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as {
  floors: Record<string, number>;
  knownFailures: string[];
};

function runCorpus(): AccuracyReport {
  const report = emptyReport();
  for (const item of loadCorpus()) {
    const observations = observeHtml(item.html, item.expected.viewKind, item.expected.lang);
    scoreCase(report, item.expected, decideObservations(observations));
  }
  return report;
}

describe('accuracy gate', () => {
  const report = runCorpus();

  it('C1: every case outside knownFailures matches its labels exactly', () => {
    const unexpected = report.failedCases.filter((id) => !budget.knownFailures.includes(id));
    expect(unexpected).toEqual([]);
  });

  it('C1: no knownFailure is silently passing', () => {
    const fixed = budget.knownFailures.filter((id) => report.exactCases.includes(id));
    expect(
      fixed,
      `These cases now pass. Remove them from knownFailures in ${BUDGET_PATH}.`,
    ).toEqual([]);
  });

  it('C2: comment precision meets its floor', () => {
    expect(precision(report.comment)).toBeGreaterThanOrEqual(budget.floors.commentPrecision!);
  });

  it('C2: comment recall meets its floor', () => {
    expect(recall(report.comment)).toBeGreaterThanOrEqual(budget.floors.commentRecall!);
  });

  it('C2: edited precision meets its floor', () => {
    expect(precision(report.edited)).toBeGreaterThanOrEqual(budget.floors.editedPrecision!);
  });

  it('C2: edited recall meets its floor', () => {
    expect(recall(report.edited)).toBeGreaterThanOrEqual(budget.floors.editedRecall!);
  });

  it('C2: comment count exact-match rate meets its floor', () => {
    expect(countExactRate(report)).toBeGreaterThanOrEqual(budget.floors.countExactRate!);
  });

  it('C2: post coverage meets its floor', () => {
    expect(coverage(report)).toBeGreaterThanOrEqual(budget.floors.coverage!);
  });
});
```

- [ ] **Step 3: Run the gate**

Run: `pnpm vitest run tests/accuracy/accuracy.test.ts`
Expected: PASS, 8 tests. Floors of 0 cannot fail; C1 tells you which cases the
current engine gets wrong.

- [ ] **Step 4: Record the measured baseline**

Read the C1 failure list from Step 3's output. Put those caseIds in
`knownFailures`, set `measuredOn` to today's date, and set each floor to the
value Task 7's report prints, **rounded down to 3 decimals**. Re-run:

Run: `pnpm vitest run tests/accuracy/accuracy.test.ts`
Expected: PASS with real floors.

- [ ] **Step 5: Commit**

```bash
git add extension/tests/accuracy/accuracy-budget.json extension/tests/accuracy/accuracy.test.ts
git commit -m "test(accuracy): add corpus gate with ratcheting budget"
```

---

### Task 7: Human-readable baseline report

**Files:**
- Create: `extension/tools/accuracy-report.mjs`
- Modify: `extension/package.json`

- [ ] **Step 1: Write the reporter**

```js
// filepath: extension/tools/accuracy-report.mjs
/**
 * Prints the accuracy table for humans. The gate is the test; this is the
 * number you paste into a session log or a status update.
 *
 * Usage: pnpm --dir extension run accuracy:report
 */
import { execFileSync } from 'node:child_process';

const out = execFileSync(
  'pnpm',
  ['vitest', 'run', 'tests/accuracy/accuracy.test.ts', '--reporter=verbose'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
console.log(out);
```

- [ ] **Step 2: Add the scripts**

In `extension/package.json`, inside `"scripts"`, after the `"test:golden"` line, add:

```json
    "test:accuracy": "vitest run tests/accuracy",
    "accuracy:report": "node tools/accuracy-report.mjs",
```

- [ ] **Step 3: Run both**

Run: `pnpm test:accuracy`
Expected: PASS — metrics, corpus, runners and gate suites all green.

Run: `pnpm run accuracy:report`
Expected: the verbose vitest output, listing each gate assertion.

- [ ] **Step 4: Commit**

```bash
git add extension/tools/accuracy-report.mjs extension/package.json
git commit -m "test(accuracy): add accuracy report script and pnpm tasks"
```

---

### Task 8: Wire the gate into CI

**Files:**
- Modify: `.github/workflows/ci.yml` (the `extension-tests` job, after the
  "Run Extension Golden Regression Suites" step at lines 53–60)

- [ ] **Step 1: Add the step**

Insert after the golden-regression step, before "Run Extension Typecheck":

```yaml
      - name: Run Extension Accuracy Gate
        run: |
          if [ -d extension/tests/accuracy/corpus ]; then
            pnpm -C extension run test:accuracy
          else
            echo "Accuracy corpus is not present on this branch yet; skipping."
          fi
```

The guard matches the existing convention in this job (the fixture-manifest and
golden steps both guard the same way) so the workflow stays green on branches
cut before this sprint.

- [ ] **Step 2: Verify the YAML parses**

Run from the repo root: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`

- [ ] **Step 3: Run the full extension suite locally**

Run: `pnpm test`
Expected: PASS, including the four new accuracy suites.

Run: `pnpm compile`
Expected: PASS, no output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the extension accuracy gate on every PR"
```

---

## Sprint exit checklist

- [ ] `pnpm test`, `pnpm compile`, `pnpm test:golden`, `pnpm test:accuracy` all pass locally
- [ ] `accuracy-budget.json` has `measuredOn` set and floors derived from a real run
- [ ] `knownFailures` lists exactly the cases today's engine gets wrong — each one is a defect to file, not a shrug
- [ ] Every `knownFailure` is filed as a `bd` issue and linked to its defect ID (D1–D11) in `docs/ENGINE_V4_MASTER_PLAN.md` §7
- [ ] Session log written to `docs/session-logs/<date>-engine-v4-s1-accuracy-harness.md`

**Not in this sprint** (S2 owns them): corpus growth to 40 cases, the capture and
sanitization tool, V1 characterization tests, and Tier A observation recording.
