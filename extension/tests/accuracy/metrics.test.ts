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
