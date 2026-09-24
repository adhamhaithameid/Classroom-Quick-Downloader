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

  // A count is an ATTRIBUTE of a comment verdict, not an independent fact.
  // Surfacing a parsed number without its verdict is the prose leak: body
  // copy like "your draft has 3 comments from reviewers" parses a count that
  // then displays even though no comment chip was accepted. D12 keeps real
  // shell-drift counts alive by promoting the verdict itself; everything
  // that stays below the verdict keeps its number now too.
  const commentCount =
    verdict === 'comment' || verdict === 'both' ? observation.comment.count : null;

  return {
    postId: observation.postId,
    verdict,
    commentCount,
    confidence,
    score,
    commentScore,
    editedScore,
  };
}
