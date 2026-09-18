// filepath: extension/src/v2/debug/decision-trace-view.ts
/**
 * ============================================================================
 * DECISION TRACE VIEW HELPERS — S12 #399 (ADR-0008)
 * ============================================================================
 *
 * Pure helpers behind the debug panel's "Decision Trace" section:
 * - classify a trace as the V1 sentinel ("V1 keeps no real traces")
 * - build a labelled-corpus case skeleton from a DecisionTrace (+ the post's
 *   FlagDecision when one exists)
 * - download the case as JSON via Blob + anchor click
 *
 * The corpus-case shape mirrors tests/accuracy/types.ts ExpectedCase, minus
 * `lang` and the human labels — those are filled in by a person looking at
 * the page. The export is deliberately minimal: it carries NO raw page text
 * (no innerHTML, no matchedText/selector/reason copies) — only the trace's
 * structural facts. That PII posture is pinned by
 * tests/v2-debug-panel-trace.test.ts.
 */

import type { DecisionTrace, FlagDecision, ViewKind } from '../../engines/types';

/** Shown when the engine's trace is the V1 sentinel (V1 keeps no traces). */
export const TRACE_UNAVAILABLE_V1 = 'trace unavailable for this engine';

/** Shown when the engine has no trace recorded for the requested post. */
export const TRACE_NOT_RECORDED = 'no trace recorded for this post';

/** Written into every exported case so labels get verified by a human. */
export const CORPUS_CASE_NOTE =
  'exported from decision trace — verify labels against the page';

/** The layer name V1's sentinel trace uses (see engines/v1/engine-v1.ts). */
const V1_SENTINEL_LAYER = 'v1-legacy';

/**
 * True when the trace is V1's "legacy engine, no detailed trace" sentinel.
 * V1 is contractually allowed to return a non-null trace that carries no
 * information; the viewer must not present it as a real trace.
 */
export function isV1SentinelTrace(trace: DecisionTrace): boolean {
  return (
    trace.finalScore < 0 &&
    trace.layers.length === 1 &&
    trace.layers[0].layerName === V1_SENTINEL_LAYER
  );
}

/** Lowercase slug: runs of non-alphanumerics collapse to single dashes. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'post' : slug;
}

/** Label skeleton for one post — mirrors accuracy ExpectedPost, pre-label. */
export interface CorpusCasePost {
  postId: string;
  commentPresent: boolean;
  commentCount: number | null;
  editedPresent: boolean;
}

/** Case skeleton — mirrors accuracy ExpectedCase, minus lang + human labels. */
export interface CorpusCase {
  /** slug(postId)-timestamp — stable enough to name a regression folder. */
  caseId: string;
  note: string;
  viewKind: ViewKind;
  posts: CorpusCasePost[];
}

/**
 * Build a corpus-case skeleton from a decision trace.
 *
 * commentPresent/editedPresent are BEST-EFFORT: from the post's
 * FlagDecision verdict when the engine tracks one, else from which trace
 * layers actually matched. commentCount comes from the decision only —
 * traces don't carry counts. Everything here is structural; the caller
 * (or a human) re-checks the labels against the real page.
 */
export function buildCorpusCase(
  trace: DecisionTrace,
  decision: FlagDecision | null,
  timestamp: number = Date.now(),
): CorpusCase {
  let commentPresent: boolean;
  let editedPresent: boolean;
  if (decision) {
    commentPresent =
      decision.finalVerdict === 'comment' || decision.finalVerdict === 'both';
    editedPresent =
      decision.finalVerdict === 'edited' || decision.finalVerdict === 'both';
  } else {
    commentPresent = trace.layers.some(
      (l) => l.matched && l.layerName.startsWith('comment'),
    );
    editedPresent = trace.layers.some(
      (l) => l.matched && l.layerName.startsWith('edited'),
    );
  }

  return {
    caseId: `${slugify(trace.postId)}-${timestamp}`,
    note: CORPUS_CASE_NOTE,
    viewKind: trace.viewKind,
    posts: [
      {
        postId: trace.postId,
        commentPresent,
        commentCount: decision?.commentCount ?? null,
        editedPresent,
      },
    ],
  };
}

/**
 * Download the case JSON. Blob + anchor click — works from a content-script
 * context without any permissions.
 */
export function downloadCorpusCase(corpusCase: CorpusCase): void {
  const json = JSON.stringify(corpusCase, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${corpusCase.caseId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
