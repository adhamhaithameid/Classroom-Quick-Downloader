// filepath: extension/tests/compare/compare-observations.test.ts
/**
 * Engine comparison.
 *
 * The load-bearing test here is that `unavailable` is never counted as
 * agreement. If the structural engine cannot evaluate a signal, and the
 * keyword engine says the signal is present, that is a KNOWN GAP — not two
 * engines agreeing. Collapsing the two would make the structural path look
 * ready for promotion when it is not.
 */
import { describe, it, expect } from 'vitest';
import { compareObservations } from '../../src/compare/compare-observations';
import { ViewKind } from '../../src/engines/types';
import type { PostObservation, DetectorName } from '../../src/contracts/detection';

function observation(
  detector: DetectorName,
  opts: {
    commentPresent?: boolean;
    commentCount?: number | null;
    commentStrength?: number;
    editedPresent?: boolean;
    editedStrength?: number;
    editedSource?: string;
    elapsedMs?: number;
  } = {},
): PostObservation {
  return {
    postId: 'post-1',
    viewKind: ViewKind.STREAM,
    detector,
    comment: {
      present: opts.commentPresent ?? false,
      count: opts.commentCount ?? null,
      strength: opts.commentStrength ?? 0,
      source: 'test',
    },
    edited: {
      present: opts.editedPresent ?? false,
      nearDate: false,
      strength: opts.editedStrength ?? 0,
      source: opts.editedSource ?? 'test',
    },
    penalties: [],
    elapsedMs: opts.elapsedMs ?? 0,
  };
}

describe('compareObservations', () => {
  it('reports agreement when both engines find a comment', () => {
    const record = compareObservations(
      observation('keyword', { commentPresent: true, commentCount: 3 }),
      observation('structural', { commentPresent: true, commentCount: 3 }),
    );

    expect(record.comment.outcome).toBe('agree');
  });

  it('reports agreement when neither engine finds a comment', () => {
    const record = compareObservations(
      observation('keyword'),
      observation('structural'),
    );

    expect(record.comment.outcome).toBe('agree');
  });

  it('reports disagreement when only one engine finds a comment', () => {
    const record = compareObservations(
      observation('keyword', { commentPresent: true, commentCount: 5 }),
      observation('structural'),
    );

    expect(record.comment.outcome).toBe('disagree');
  });

  it('reports disagreement when the counts differ', () => {
    const record = compareObservations(
      observation('keyword', { commentPresent: true, commentCount: 5 }),
      observation('structural', { commentPresent: true, commentCount: 3 }),
    );

    expect(record.comment.outcome).toBe('disagree');
  });

  it('NEVER counts an unavailable signal as agreement', () => {
    const record = compareObservations(
      observation('keyword', { editedPresent: true, editedStrength: 80 }),
      observation('structural', { editedSource: 'unavailable' }),
    );

    expect(record.edited.outcome).toBe('unavailable');
    expect(record.edited.outcome).not.toBe('agree');
  });

  it('reports unavailable even when both engines happen to say "not present"', () => {
    // The trap: structural says false because it CANNOT LOOK, keyword says
    // false because it looked and found nothing. Those are not the same fact.
    const record = compareObservations(
      observation('keyword', { editedPresent: false }),
      observation('structural', { editedPresent: false, editedSource: 'unavailable' }),
    );

    expect(record.edited.outcome).toBe('unavailable');
  });

  it('carries both engines timings', () => {
    const record = compareObservations(
      observation('keyword', { elapsedMs: 4.5 }),
      observation('structural', { elapsedMs: 1.25 }),
    );

    expect(record.keywordMs).toBe(4.5);
    expect(record.structuralMs).toBe(1.25);
  });

  it('carries the post id and view kind', () => {
    const record = compareObservations(
      observation('keyword'),
      observation('structural'),
    );

    expect(record.postId).toBe('post-1');
    expect(record.viewKind).toBe(ViewKind.STREAM);
  });

  it('records what each engine actually found, for the disagreement list', () => {
    const record = compareObservations(
      observation('keyword', { commentPresent: true, commentCount: 7 }),
      observation('structural', { commentPresent: false }),
    );

    expect(record.comment.keyword).toEqual({ present: true, count: 7 });
    expect(record.comment.structural).toEqual({ present: false, count: null });
  });

  it('is plain JSON — no DOM, no functions, no page text', () => {
    const record = compareObservations(
      observation('keyword', { commentPresent: true, commentCount: 2 }),
      observation('structural', { commentPresent: true, commentCount: 2 }),
    );

    expect(() => JSON.parse(JSON.stringify(record))).not.toThrow();
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });
});
