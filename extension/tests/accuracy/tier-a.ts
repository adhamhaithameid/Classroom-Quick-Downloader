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
