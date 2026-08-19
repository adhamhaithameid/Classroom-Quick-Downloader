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
