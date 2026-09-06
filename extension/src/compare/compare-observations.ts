// filepath: extension/src/compare/compare-observations.ts
/**
 * ============================================================================
 * COMPARE — turning two observations into one auditable record
 * ============================================================================
 *
 * One record per post per scan. Plain JSON underneath, so the same shape can
 * later feed a telemetry canary without rework.
 *
 * The important rule: THREE outcomes, not two.
 *
 *   agree        both engines evaluated the signal and reached the same answer
 *   disagree     both engines evaluated it and reached different answers
 *   unavailable  one engine could not evaluate it at all
 *
 * `unavailable` exists because StructuralDetector cannot detect "edited" — no
 * structural signal for it exists in any DOM we hold. If that collapsed into
 * `agree` whenever both engines happened to report `present: false`, the
 * structural engine would score near-perfect agreement on edited while
 * actually being blind to it, and the promotion decision would be made on a
 * number that means nothing.
 */
import type { PostObservation } from '../contracts/detection';
import type { ViewKind } from '../engines/types';

/** How the two engines related on a single signal. */
export type ComparisonOutcome = 'agree' | 'disagree' | 'unavailable';

/** What one engine reported for one signal. */
export interface SignalFinding {
  present: boolean;
  count: number | null;
}

/** Both engines' findings for one signal, plus the verdict. */
export interface SignalComparison {
  outcome: ComparisonOutcome;
  keyword: SignalFinding;
  structural: SignalFinding;
}

/** The full per-post comparison. Plain JSON. */
export interface ComparisonRecord {
  postId: string;
  viewKind: ViewKind;
  comment: SignalComparison;
  edited: SignalComparison;
  keywordMs: number;
  structuralMs: number;
}

/**
 * A detector reports `source: 'unavailable'` when it cannot evaluate a signal
 * at all, as distinct from evaluating it and finding nothing.
 */
const UNAVAILABLE = 'unavailable';

function classify(
  keyword: SignalFinding,
  structural: SignalFinding,
  keywordSource: string,
  structuralSource: string,
): ComparisonOutcome {
  if (keywordSource === UNAVAILABLE || structuralSource === UNAVAILABLE) {
    return UNAVAILABLE;
  }

  if (keyword.present !== structural.present) return 'disagree';
  if (keyword.present && keyword.count !== structural.count) return 'disagree';

  return 'agree';
}

export function compareObservations(
  keyword: PostObservation,
  structural: PostObservation,
): ComparisonRecord {
  const commentKeyword: SignalFinding = {
    present: keyword.comment.present,
    count: keyword.comment.count,
  };
  const commentStructural: SignalFinding = {
    present: structural.comment.present,
    count: structural.comment.count,
  };

  // Edited carries no count on either engine.
  const editedKeyword: SignalFinding = { present: keyword.edited.present, count: null };
  const editedStructural: SignalFinding = { present: structural.edited.present, count: null };

  return {
    postId: keyword.postId,
    viewKind: keyword.viewKind,
    comment: {
      outcome: classify(
        commentKeyword,
        commentStructural,
        keyword.comment.source,
        structural.comment.source,
      ),
      keyword: commentKeyword,
      structural: commentStructural,
    },
    edited: {
      outcome: classify(
        editedKeyword,
        editedStructural,
        keyword.edited.source,
        structural.edited.source,
      ),
      keyword: editedKeyword,
      structural: editedStructural,
    },
    keywordMs: keyword.elapsedMs,
    structuralMs: structural.elapsedMs,
  };
}
