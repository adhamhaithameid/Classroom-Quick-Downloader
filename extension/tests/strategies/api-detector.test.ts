// filepath: extension/tests/strategies/api-detector.test.ts
/**
 * ApiDetector — the S13 API-assist decorator over a base DOM detector.
 *
 * The defining property is SILENT FALLBACK: with no token, no snapshot, a
 * stale snapshot, or a route mismatch, observe() returns the base detector's
 * observation VERBATIM (same object). Enrichment only ever fires on a fresh,
 * route-matching snapshot with a granted token, and it is additive only —
 * it can raise the confidence of a REAL DOM finding (D12 corroboration-floor
 * precedent), never create one, never lower one, never change a count.
 */
import { describe, it, expect, vi } from 'vitest';
import { ApiDetector, type ApiSnapshot } from '../../src/strategies/detect/api-detector';
import type { Detector, PostObservation } from '../../src/contracts/detection';
import { ViewKind } from '../../src/engines/types';
import { THRESHOLDS } from '../../src/decide/thresholds';

function baseObservation(overrides: Partial<PostObservation> = {}): PostObservation {
  return {
    postId: 'p1',
    viewKind: ViewKind.STUDENT_WORK_TEACHER,
    detector: 'keyword',
    comment: { present: false, count: null, strength: 0, source: 'none' },
    edited: { present: false, nearDate: false, strength: 0, source: 'unavailable' },
    penalties: [],
    elapsedMs: 1.5,
    debug: [],
    ...overrides,
  };
}

function stubBase(observation: PostObservation): Detector & { observeCalls: number } {
  const detector = {
    name: 'keyword' as const,
    observeCalls: 0,
    observe() {
      detector.observeCalls += 1;
      return observation;
    },
    reset() {
      // stateless stub
    },
  };
  return detector;
}

function snapshot(overrides: Partial<ApiSnapshot> = {}): ApiSnapshot {
  return {
    fetchedAt: Date.now(),
    context: {
      viewKind: ViewKind.STUDENT_WORK_TEACHER,
      courseId: 'c1',
      courseWorkId: 'w1',
      studentSubmissionId: null,
    },
    submissions: [
      {
        id: 's1',
        userId: 'u1',
        state: 'TURNED_IN',
        attachments: [{ id: 'f1', title: 'a.pdf', downloadUrl: 'https://drive.example/f1' }],
      },
      { id: 's2', state: 'CREATED', attachments: [] },
    ],
    ...overrides,
  };
}

function makeDeps(token: string | null, snap: ApiSnapshot | null) {
  return {
    getToken: vi.fn(async () => token),
    getSnapshot: vi.fn(async () => snap),
  };
}

const VIEW = ViewKind.STUDENT_WORK_TEACHER;
const CTX = { postId: 'p1', viewKind: VIEW };

describe('ApiDetector', () => {
  it('identifies itself as the api detector', () => {
    const api = new ApiDetector(stubBase(baseObservation()), makeDeps(null, null));
    expect(api.name).toBe('api');
  });

  it('falls back verbatim when the token was denied (output deep-equals base)', async () => {
    const base = baseObservation();
    const stub = stubBase(base);
    const api = new ApiDetector(stub, makeDeps(null, snapshot()));
    await api.refresh();

    const result = api.observe(document.createElement('div'), CTX);
    expect(result).toBe(base);
    expect(result).toEqual(base);
    expect(stub.observeCalls).toBe(1);
  });

  it('falls back verbatim when there is no snapshot at all', async () => {
    const base = baseObservation();
    const api = new ApiDetector(stubBase(base), makeDeps('tok', null));
    await api.refresh();

    expect(api.observe(document.createElement('div'), CTX)).toBe(base);
  });

  it('falls back verbatim before the first refresh (cache empty)', () => {
    const base = baseObservation();
    const api = new ApiDetector(stubBase(base), makeDeps('tok', snapshot()));
    expect(api.observe(document.createElement('div'), CTX)).toBe(base);
  });

  it('observe() is synchronous and uses the cache — deps run once per refresh', async () => {
    const deps = makeDeps('tok', snapshot());
    const base = baseObservation({
      comment: { present: true, count: 3, strength: 25, source: 'keyword' },
    });
    const api = new ApiDetector(stubBase(base), deps);
    await api.refresh();

    const post = document.createElement('div');
    const first = api.observe(post, CTX);
    const second = api.observe(post, CTX);

    expect(typeof (first as { then?: unknown }).then).not.toBe('function');
    expect(deps.getToken).toHaveBeenCalledTimes(1);
    expect(deps.getSnapshot).toHaveBeenCalledTimes(1);
    expect(second.comment.strength).toBe(THRESHOLDS.comment_show);
  });

  it('a fresh snapshot floors a real-but-sub-threshold DOM comment finding (D12 shape)', async () => {
    const base = baseObservation({
      comment: { present: true, count: 3, strength: 25, source: 'keyword' },
    });
    const api = new ApiDetector(stubBase(base), makeDeps('tok', snapshot()));
    await api.refresh();

    const result = api.observe(document.createElement('div'), CTX);
    // Additive only: the count, presence and source stay the DOM's.
    expect(result.comment.count).toBe(3);
    expect(result.comment.present).toBe(true);
    expect(result.comment.source).toBe('keyword');
    expect(result.comment.strength).toBe(THRESHOLDS.comment_show);
    // Everything the API did not speak to is untouched.
    expect(result.edited).toEqual(base.edited);
    expect(result.penalties).toEqual(base.penalties);
    expect(result.elapsedMs).toBe(base.elapsedMs);
    // Traceability: the api-corroboration debug layer appended, not replaced.
    const last = result.debug![result.debug!.length - 1]!;
    expect(last.layerName).toBe('api-corroboration');
    expect(last.layerIndex).toBe(base.debug!.length);
    expect(last.matched).toBe(true);
    expect(last.matchedText).toBeNull();
    expect(last.details).toContain('w1');
    // Pre-existing base layers survive untouched as the debug prefix.
    expect(result.debug!.slice(0, base.debug!.length)).toEqual(base.debug!);
  });

  it('never invents a finding: no DOM comment count means no field change', async () => {
    const base = baseObservation({
      comment: { present: false, count: null, strength: 0, source: 'none' },
    });
    const api = new ApiDetector(stubBase(base), makeDeps('tok', snapshot()));
    await api.refresh();

    const result = api.observe(document.createElement('div'), CTX);
    expect(result.comment).toEqual(base.comment);
    expect(result.edited).toEqual(base.edited);
    // The corroboration context is still traced for DevTools rebuilds.
    expect(result.debug![result.debug!.length - 1]!.layerName).toBe('api-corroboration');
  });

  it('never lowers or fabricates: strength 0 and strength 100 stay as they are', async () => {
    for (const strength of [0, THRESHOLDS.comment_high_confidence]) {
      const base = baseObservation({
        comment: { present: strength > 0, count: 3, strength, source: 'keyword' },
      });
      const api = new ApiDetector(stubBase(base), makeDeps('tok', snapshot()));
      await api.refresh();
      const result = api.observe(document.createElement('div'), CTX);
      expect(result.comment.strength).toBe(strength);
    }
  });

  it('a snapshot for a different route (view changed) is stale — verbatim fallback', async () => {
    const base = baseObservation();
    const stale = snapshot({
      context: {
        viewKind: ViewKind.STREAM,
        courseId: 'c1',
        courseWorkId: 'w1',
        studentSubmissionId: null,
      },
    });
    const api = new ApiDetector(stubBase(base), makeDeps('tok', stale));
    await api.refresh();

    expect(api.observe(document.createElement('div'), CTX)).toBe(base);
  });

  it('an expired snapshot (past the age bound) is stale — verbatim fallback', async () => {
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
    const base = baseObservation();
    const api = new ApiDetector(stubBase(base), makeDeps('tok', snapshot()));
    await api.refresh();

    // 121 seconds later the route snapshot is no longer fresh.
    vi.setSystemTime(new Date('2026-01-24T08:02:01.000Z'));
    try {
      expect(api.observe(document.createElement('div'), CTX)).toBe(base);
    } finally {
      vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
    }
  });

  it('reset() clears the cache; the next refresh re-populates it', async () => {
    const base = baseObservation({
      comment: { present: true, count: 3, strength: 25, source: 'keyword' },
    });
    const deps = makeDeps('tok', snapshot());
    const api = new ApiDetector(stubBase(base), deps);
    await api.refresh();
    api.reset();
    expect(api.observe(document.createElement('div'), CTX)).toBe(base);

    await api.refresh();
    expect(api.observe(document.createElement('div'), CTX).comment.strength).toBe(
      THRESHOLDS.comment_show,
    );
    expect(deps.getToken).toHaveBeenCalledTimes(2);
  });

  it('refresh() never rejects, even when both deps throw', async () => {
    const base = baseObservation();
    const api = new ApiDetector(stubBase(base), {
      getToken: async () => {
        throw new Error('host exploded');
      },
      getSnapshot: async () => {
        throw new Error('bridge gone');
      },
    });

    await expect(api.refresh()).resolves.toBeUndefined();
    expect(api.observe(document.createElement('div'), CTX)).toBe(base);
  });

  it('conformance: the Detector contract holds on both the fallback and enriched paths', async () => {
    const fallbackBase = baseObservation();
    const structuralStub = { ...stubBase(fallbackBase), name: 'structural' as const };
    const fallback = new ApiDetector(structuralStub, makeDeps(null, snapshot()));
    await fallback.refresh();
    const plain = fallback.observe(document.createElement('div'), CTX);
    expect(plain).toBe(fallbackBase);

    const enrichedBase = baseObservation({
      comment: { present: true, count: 3, strength: 25, source: 'structural' },
    });
    const enriched = new ApiDetector(stubBase(enrichedBase), makeDeps('tok', snapshot()));
    await enriched.refresh();
    const obs = enriched.observe(document.createElement('div'), CTX);

    for (const key of [
      'postId',
      'viewKind',
      'detector',
      'comment',
      'edited',
      'penalties',
      'elapsedMs',
      'debug',
    ] as const) {
      expect(obs).toHaveProperty(key);
    }
    expect(obs.detector).toBe('keyword'); // the BASE's name — api never claims authorship
    expect(obs.comment.strength).toBeGreaterThanOrEqual(enrichedBase.comment.strength);
    expect(() => {
      enriched.reset();
      enriched.reset();
    }).not.toThrow();
  });
});
