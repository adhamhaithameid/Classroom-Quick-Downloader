// filepath: extension/tests/v2-flag-corroborator.test.ts
/**
 * csaa.1 / p8tq — the API corroboration floor enters RENDERED decisions.
 *
 * Design (from .scratch/research/v2-flag-pipeline-seam.md, Option B):
 *   - scoreFlagsForPost accepts an optional trailing Detector (default: the
 *     bare keyword singleton — existing callers cannot tell the difference);
 *   - EngineV2 exposes an optional `flagCorroborator` field that
 *     detectFlags hands through;
 *   - EngineV3 assigns its ApiDetector in the constructor and runs one
 *     V2-level full scan after each snapshot refresh, so first-scan badges
 *     upgrade once the cache is warm (late, never wrong).
 *
 * The floor arithmetic itself is NOT re-tested here — the additive-only
 * contract is pinned in strategies/api-detector.test.ts. These tests pin
 * the WIRING: the floor now reaches the stored FlagDecision that renders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewKind } from '../src/engines/types';
import type { Detector, PostObservation } from '../src/contracts/detection';
import { ApiDetector, type ApiSnapshot } from '../src/strategies/detect/api-detector';
import { THRESHOLDS } from '../src/decide/thresholds';
import { scoreFlagsForPost } from '../src/v2/decision/flag-scoring';

const VIEW = ViewKind.STUDENT_WORK_TEACHER;
const CTX = { postId: 'p1', viewKind: VIEW };

function baseObservation(overrides: Partial<PostObservation> = {}): PostObservation {
  return {
    postId: 'p1',
    viewKind: VIEW,
    detector: 'keyword',
    comment: { present: false, count: null, strength: 0, source: 'none' },
    edited: { present: false, nearDate: false, strength: 0, source: 'unavailable' },
    penalties: [],
    elapsedMs: 1.5,
    debug: [],
    ...overrides,
  };
}

function stubBase(observation: PostObservation): Detector {
  return {
    name: 'keyword',
    observe: () => observation,
    reset() {
      // stateless stub
    },
  };
}

function apiSnapshot() {
  return {
    fetchedAt: Date.now(),
    context: {
      viewKind: VIEW,
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
    ],
  };
}

function makeDeps(token: string | null, snap: ApiSnapshot | null) {
  return {
    getToken: vi.fn(async () => token),
    getSnapshot: vi.fn(async () => snap),
  };
}

/** A real DOM numeral (3 comments) whose keyword strength died sub-threshold. */
function subThresholdObservation(): PostObservation {
  return baseObservation({
    comment: { present: true, count: 3, strength: 25, source: 'keyword' },
  });
}

async function makeCorroborator(): Promise<ApiDetector> {
  const api = new ApiDetector(stubBase(subThresholdObservation()), makeDeps('tok', apiSnapshot()));
  await api.refresh();
  return api;
}

describe('scoreFlagsForPost with a corroborating Detector', () => {
  it('floors a real sub-threshold comment finding into a comment verdict', async () => {
    const detector = await makeCorroborator();
    const decision = scoreFlagsForPost(document.createElement('div'), 'p1', VIEW, undefined, detector);

    // The floor raised the strength to exactly comment_show; the normal
    // decide branch turned that into a comment verdict with the count.
    expect(decision.finalVerdict).toBe('comment');
    expect(decision.commentScore).toBe(THRESHOLDS.comment_show);
    expect(decision.commentCount).toBe(3);
    expect(decision.confidence).toBe('medium');
  });

  it('keeps the default path byte-identical when no detector is passed', () => {
    const decision = scoreFlagsForPost(document.createElement('div'), 'p1', VIEW);
    // Same sub-threshold shape, no API layer: the observation never enters
    // through the corroborator, so nothing floors it.
    expect(decision.finalVerdict).toBe('none');
    expect(decision.commentScore).toBe(0);
  });

  it('the api-corroboration trace rides along into the decision trace', async () => {
    const detector = await makeCorroborator();
    const decision = scoreFlagsForPost(document.createElement('div'), 'p1', VIEW, undefined, detector);
    const layerNames = (decision.trace.layers ?? []).map((l) => l.layerName);
    expect(layerNames).toContain('api-corroboration');
  });
});

describe('EngineV2.flagCorroborator', () => {
  beforeEach(() => {
    // The extension setup fakes timers globally; engine init waits on real
    // async seams and stalls under them.
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('detectFlags routes through the corroborator when the field is set', async () => {
    const { EngineV2 } = await import('../src/engines/v2/engine-v2');
    const engine = new EngineV2();
    const detector = await makeCorroborator();
    const observe = vi.spyOn(detector, 'observe');
    engine.flagCorroborator = detector;

    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'p1');
    document.body.appendChild(post);

    const controller = new AbortController();
    await engine.init(VIEW, controller.signal);
    engine.fullScan();

    expect(observe).toHaveBeenCalled();
    expect(engine.getFlagDecisions().find((d) => d.postId === 'p1')?.finalVerdict).toBe('comment');
    engine.destroy();
  });

  it('a plain V2 never sets the field', async () => {
    const { EngineV2 } = await import('../src/engines/v2/engine-v2');
    const engine = new EngineV2();
    await engine.init(VIEW, new AbortController().signal);
    expect(engine.flagCorroborator).toBeUndefined();
    engine.destroy();
  });
});

describe('EngineV3 wires the floor end to end', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );
  });

  it('the constructor hands its ApiDetector to V2 as the corroborator', async () => {
    const { EngineV3 } = await import('../src/engines/v3/engine-v3');
    const engine = new EngineV3();
    expect(engine.getFlagDecisions).toBeTypeOf('function');
    // The corroborator is the same instance the engine drives refreshes on.
    // (No public accessor by design — behavior is pinned by the floor test
    // below, which fails if the handoff is missing.)
    expect((engine as unknown as { v2: { flagCorroborator?: Detector } }).v2.flagCorroborator).toBeDefined();
  });

  it('after the refresh chain, the stored decision is floored (late, never wrong)', async () => {
    // The keyword singleton is stubbed BEFORE the engine modules load, so
    // both V2's direct import and the ApiDetector's base see the same
    // sub-threshold finding.
    vi.doMock('../src/detect/keyword/keyword-detector', () => ({
      keywordDetector: stubBase(subThresholdObservation()),
    }));
    const snapshot = apiSnapshot();
    vi.doMock('../src/engines/v3/api', () => ({
      createDefaultApiDiscoveryService: () => ({ discover: vi.fn(async () => snapshot), clear: vi.fn() }),
      publishStudentWorkApiSnapshot: vi.fn(),
      resolveClassroomApiRouteContext: vi.fn(() => ({
        viewKind: VIEW,
        courseId: 'c1',
        courseWorkId: 'w1',
        authUser: null,
        studentSubmissionId: null,
      })),
      sharedClassroomRateLimiter: { acquire: vi.fn(() => true), reset: vi.fn() },
    }));
    vi.stubGlobal('chrome', {
      identity: {
        getAuthToken: (_details: unknown, cb: (token: string) => void) => cb('test-token'),
      },
      runtime: { lastError: null },
    });

    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'p1');
    document.body.appendChild(post);

    const { EngineV3 } = await import('../src/engines/v3/engine-v3');
    const engine = new EngineV3();
    await engine.init(VIEW, new AbortController().signal);

    // Settle the init chain: refresh → corroboration pass → upgrade rescan.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    engine.fullScan();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const decision = engine.getFlagDecisions().find((d) => d.postId === 'p1');
    expect(decision).toBeDefined();
    expect(decision?.finalVerdict).toBe('comment');
    expect(decision?.commentScore).toBe(THRESHOLDS.comment_show);
    expect(decision?.commentCount).toBe(3);
    engine.destroy();
  });
});
