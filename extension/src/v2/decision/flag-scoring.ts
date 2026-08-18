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

/**
 * THE MAIN FUNCTION — Score all flags for a single post.
 *
 * This replaces V1's:
 * - detectComments() from smart-detector-comments.ts
 * - detectEdited() from smart-detector.ts
 * - detectPostState() from smart-detector.ts
 *
 * One call → FlagDecision with full DecisionTrace.
 *
 * @param post - The post element to analyze
 * @param postId - Canonical post ID
 * @param viewKind - Current page type
 * @param lang - Page language (auto-detected if not provided)
 * @returns FlagDecision with verdict, scores, and trace
 */
export function scoreFlagsForPost(
  post: HTMLElement,
  postId: string,
  viewKind: ViewKind,
  lang?: string,
): FlagDecision {
  const startTime = performance.now();
  const pageLang = lang || detectPageLanguage();

  // Ensure keywords are loaded
  preloadKeywords(pageLang);

  // Run comment detection
  const commentResult = scoreComments(post, pageLang);

  // Run edited detection
  const editedResult = scoreEdited(post, pageLang);

  // Apply cross-type exclusions
  const exclusionResults: ExclusionResult[] = [];
  if (commentResult.matchedText) {
    exclusionResults.push(...applyExclusions(commentResult.matchedText, post, 'comment'));
  }
  if (editedResult.matchedText) {
    exclusionResults.push(...applyExclusions(editedResult.matchedText, post, 'edited'));
  }

  // Compute final scores (with exclusion penalties)
  let commentScore = commentResult.score;
  let editedScore = editedResult.score;

  for (const exc of exclusionResults) {
    if (exc.ruleId.includes('COMMENT') || exc.ruleId.includes('ACTION_BTN')) {
      commentScore += exc.penalty;
    }
    if (exc.ruleId.includes('EDITED')) {
      editedScore += exc.penalty;
    }
  }

  // Clamp to 0
  commentScore = Math.max(0, commentScore);
  editedScore = Math.max(0, editedScore);

  // Determine verdict
  let verdict: FlagDecision['finalVerdict'] = 'none';
  if (commentScore >= THRESHOLDS.comment_show && editedScore >= THRESHOLDS.edited_show &&
      commentScore >= THRESHOLDS.both_minimum_each && editedScore >= THRESHOLDS.both_minimum_each) {
    verdict = 'both';
  } else if (commentScore >= THRESHOLDS.comment_show) {
    verdict = 'comment';
  } else if (editedScore >= THRESHOLDS.edited_show) {
    verdict = 'edited';
  }

  // Determine confidence
  const maxScore = Math.max(commentScore, editedScore);
  const confidence: FlagDecision['confidence'] =
    maxScore >= THRESHOLDS.comment_high_confidence ? 'high' :
    maxScore >= THRESHOLDS.edited_show ? 'medium' : 'low';

  const elapsed = performance.now() - startTime;

  // Build trace
  const layers: LayerTrace[] = [];

  // Comment layers
  for (let i = 0; i < commentResult.layers.length; i++) {
    const l = commentResult.layers[i];
    layers.push({
      layerName: `comment-L${i}`,
      layerIndex: layers.length,
      score: l.score,
      matched: l.score > 0,
      matchedText: l.matchedText,
      selectorUsed: null,
      details: l.details,
    });
  }

  // Edited layers
  for (let i = 0; i < editedResult.layers.length; i++) {
    const l = editedResult.layers[i];
    layers.push({
      layerName: `edited-L${i + 1}`,
      layerIndex: layers.length,
      score: l.score,
      matched: l.score !== 0,
      matchedText: l.matchedText,
      selectorUsed: null,
      details: l.details,
    });
  }

  // Convert exclusion results to traces
  const exclusions: ExclusionTrace[] = exclusionResults.map(e => ({
    ruleId: e.ruleId,
    penalty: e.penalty,
    reason: e.reason,
    matchedText: e.matchedText,
  }));

  const trace: DecisionTrace = {
    postId,
    timestamp: Date.now(),
    viewKind,
    layers,
    exclusions,
    finalScore: maxScore,
    duration_ms: elapsed,
  };

  return {
    postId,
    commentScore,
    editedScore,
    commentCount: commentResult.count,
    editedDiff: null, // Will be computed by the render layer from date comparison
    exclusionPenalties: exclusionResults.map(e => ({ ruleId: e.ruleId, penalty: e.penalty })),
    finalVerdict: verdict,
    confidence,
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
