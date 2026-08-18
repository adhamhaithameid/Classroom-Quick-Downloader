// filepath: extension/tests/decide/decide-flags.test.ts
/**
 * The Decide layer, tested with no DOM anywhere in this file.
 *
 * That is the point: if these tests ever need a fixture, an element, or a
 * language, the seam has been broken.
 */
import { describe, it, expect } from 'vitest';
import { decideFlags } from '../../src/decide/decide-flags';
import { ViewKind } from '../../src/engines/types';
import type { PostObservation } from '../../src/contracts/detection';

function observation(overrides: {
  commentStrength?: number;
  commentCount?: number | null;
  editedStrength?: number;
} = {}): PostObservation {
  return {
    postId: 'p1',
    viewKind: ViewKind.STREAM,
    detector: 'keyword',
    comment: {
      present: (overrides.commentStrength ?? 0) > 0,
      count: overrides.commentCount ?? null,
      strength: overrides.commentStrength ?? 0,
      source: 'test',
    },
    edited: {
      present: (overrides.editedStrength ?? 0) > 0,
      nearDate: false,
      strength: overrides.editedStrength ?? 0,
      source: 'test',
    },
    penalties: [],
    elapsedMs: 0,
  };
}

describe('decideFlags', () => {
  it('returns none below both thresholds', () => {
    const d = decideFlags(observation({ commentStrength: 39, editedStrength: 34 }));
    expect(d.verdict).toBe('none');
  });

  it('returns comment at the comment threshold', () => {
    const d = decideFlags(observation({ commentStrength: 40, editedStrength: 0 }));
    expect(d.verdict).toBe('comment');
  });

  it('returns edited at the edited threshold', () => {
    const d = decideFlags(observation({ commentStrength: 0, editedStrength: 35 }));
    expect(d.verdict).toBe('edited');
  });

  it('returns both when each clears its threshold and the both-minimum', () => {
    const d = decideFlags(observation({ commentStrength: 40, editedStrength: 35 }));
    expect(d.verdict).toBe('both');
  });

  it('prefers comment when edited is below its threshold', () => {
    const d = decideFlags(observation({ commentStrength: 80, editedStrength: 34 }));
    expect(d.verdict).toBe('comment');
  });

  it('grades confidence high at 70 and above', () => {
    expect(decideFlags(observation({ commentStrength: 70 })).confidence).toBe('high');
    expect(decideFlags(observation({ commentStrength: 69 })).confidence).toBe('medium');
  });

  it('grades confidence low below the edited threshold', () => {
    expect(decideFlags(observation({ commentStrength: 34 })).confidence).toBe('low');
    expect(decideFlags(observation({ commentStrength: 35 })).confidence).toBe('medium');
  });

  it('carries the comment count through untouched', () => {
    const d = decideFlags(observation({ commentStrength: 80, commentCount: 7 }));
    expect(d.commentCount).toBe(7);
  });

  it('reports the higher strength as the headline score', () => {
    const d = decideFlags(observation({ commentStrength: 41, editedStrength: 88 }));
    expect(d.score).toBe(88);
    expect(d.commentScore).toBe(41);
    expect(d.editedScore).toBe(88);
  });

  it('does not branch on which detector produced the observation', () => {
    const asKeyword = observation({ commentStrength: 55, editedStrength: 40 });
    const asStructural: PostObservation = { ...asKeyword, detector: 'structural' };
    expect(decideFlags(asStructural)).toEqual({
      ...decideFlags(asKeyword),
    });
  });

  it('ignores the debug field entirely', () => {
    const plain = observation({ commentStrength: 55, editedStrength: 40 });
    const withDebug: PostObservation = {
      ...plain,
      debug: [
        {
          layerName: 'comment-L4',
          layerIndex: 0,
          score: 99,
          matched: true,
          matchedText: 'this raw page text must not influence anything',
          selectorUsed: null,
          details: 'debug only',
        },
      ],
    };
    expect(decideFlags(withDebug)).toEqual(decideFlags(plain));
  });

  it('carries the post id through', () => {
    const obs = observation({ commentStrength: 50 });
    expect(decideFlags(obs).postId).toBe('p1');
  });
});
