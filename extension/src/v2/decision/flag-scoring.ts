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
 * Callers: src/engines/v2/engine-v2.ts, tests/v2-flag-scoring.test.ts.
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
import type { Detector } from '../../contracts/detection';

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
 *
 * @param post - The post element to analyze
 * @param postId - Canonical post ID
 * @param viewKind - Current page type
 * @param lang - Page language (auto-detected if not provided)
 * @param detector - Optional corroborating Detector (csaa.1 / p8tq): when
 *   provided (EngineV3 hands over its ApiDetector), observe runs through it
 *   and its additive-only API floor can raise a real DOM numeral's strength
 *   to comment_show. Default: the bare keyword singleton — byte-identical
 *   behavior for every caller that does not pass one.
 * @returns FlagDecision with verdict, scores, and trace
 */
export function scoreFlagsForPost(
  post: HTMLElement,
  postId: string,
  viewKind: ViewKind,
  lang?: string,
  detector: Detector = keywordDetector,
): FlagDecision {
  const observation = detector.observe(post, { postId, viewKind, lang });
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
    editedDiff: null, // Will be computed by the render layer from date comparison
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
