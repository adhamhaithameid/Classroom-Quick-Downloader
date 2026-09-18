// filepath: extension/tests/v3-engine-api-corroboration.test.ts
/**
 * S13 Task 3 — EngineV3 × ApiDetector composition wiring.
 *
 * The registry only activates EngineV3 when isApiConfigured() (identity +
 * oauth2 client_id). Once active, EngineV3 is the composition root for the
 * ApiDetector: it wires the real token provider and its own discovery
 * service into the detector's deps and pre-resolves the cache during init
 * on student-work views (the refresh contract — observe never fetches).
 *
 * Pinned here:
 *   - PRIVACY (#398): token acquisition happens ONLY on student-work views
 *     while v3 is active — never on other views, never in the background.
 *   - The corroboration pass runs ApiDetector.observe over V2's tracked
 *     posts and exposes the 'api-corroboration' LayerTrace per post (the
 *     debug/explanation surface).
 *   - destroy() drops the detector cache and the corroboration surface.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewKind } from '../src/engines/types';

type MockedSetup = {
  EngineV3: new () => import('../src/engines/v3/engine-v3').EngineV3;
  discover: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  publishStudentWorkApiSnapshot: ReturnType<typeof vi.fn>;
  resolveClassroomApiRouteContext: ReturnType<typeof vi.fn>;
  getAuthToken: ReturnType<typeof vi.fn>;
};

const CONTEXT = {
  viewKind: ViewKind.STUDENT_WORK_TEACHER,
  courseId: 'COURSE_1',
  courseWorkId: 'WORK_1',
  authUser: null,
  studentSubmissionId: null,
};

/** Built per-load so fetchedAt is read under the SAME timer regime the
 *  assertions run under (the vitest setup fakes timers — a module-load
 *  Date.now() is eons stale by test time). */
function makeSnapshot() {
  return {
    fetchedAt: Date.now(),
    context: CONTEXT,
    submissions: [
      {
        id: 'SUB_1',
        state: 'TURNED_IN',
        attachments: [
          {
            id: 'FILE_1',
            title: 'report.pdf',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
            source: 'driveFile' as const,
          },
        ],
      },
    ],
  };
}

async function loadEngineWithApiMocks(): Promise<MockedSetup> {
  vi.resetModules();

  const snapshot = makeSnapshot();
  const discover = vi.fn(async () => snapshot);
  const clear = vi.fn();
  const publishStudentWorkApiSnapshot = vi.fn();
  const resolveClassroomApiRouteContext = vi.fn(() => CONTEXT);
  const getAuthToken = vi.fn();
  getAuthToken.mockImplementation(
    (_details: unknown, callback: (token: string) => void) => {
      callback('test-token');
    },
  );

  vi.stubGlobal('chrome', {
    identity: { getAuthToken: getAuthToken },
    runtime: { lastError: null },
  });

  vi.doMock('../src/engines/v3/api', () => ({
    createDefaultApiDiscoveryService: () => ({ discover, clear }),
    publishStudentWorkApiSnapshot,
    resolveClassroomApiRouteContext,
  }));

  const { EngineV3 } = await import('../src/engines/v3/engine-v3');
  return {
    EngineV3,
    discover,
    clear,
    publishStudentWorkApiSnapshot,
    resolveClassroomApiRouteContext,
    getAuthToken,
  };
}

/** Let the refresh chain (discover → publish → detector refresh) settle. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('EngineV3 ApiDetector wiring (S13)', () => {
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

  it('acquires a token ONLY on student-work views (privacy, #398)', async () => {
    const setup = await loadEngineWithApiMocks();
    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STREAM, controller.signal);
    expect(setup.getAuthToken).not.toHaveBeenCalled();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);
    expect(setup.getAuthToken).toHaveBeenCalledTimes(1);

    engine.destroy();
  });

  it('exposes the api-corroboration trace for tracked posts after a fullScan', async () => {
    const setup = await loadEngineWithApiMocks();
    document.body.innerHTML = '<div data-stream-item-id="post-1"></div>';

    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);

    // v2's init scan was skipped (aborted signal) — a manual fullScan tracks
    // the fixture post and triggers the refresh → corroboration chain.
    engine.fullScan();
    await flushAsync();

    const trace = engine.getApiCorroborationTrace('post-1');
    expect(trace).not.toBeNull();
    expect(trace?.layerName).toBe('api-corroboration');
    expect(trace?.details).toContain('COURSE_1/WORK_1');
    expect(trace?.selectorUsed).toBe('classroom.googleapis.com/v1/studentSubmissions');

    engine.destroy();
  });

  it('yields no corroboration trace when the token was denied (silent fallback)', async () => {
    const setup = await loadEngineWithApiMocks();
    // Denial: the callback answers with an empty token — the provider
    // resolves null (its never-rejects contract).
    setup.getAuthToken.mockImplementation(
      (_details: unknown, callback: (token: string) => void) => {
        callback('');
      },
    );
    document.body.innerHTML = '<div data-stream-item-id="post-1"></div>';

    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);
    engine.fullScan();
    await flushAsync();

    expect(engine.getApiCorroborationTrace('post-1')).toBeNull();

    engine.destroy();
  });

  it('destroy() clears the corroboration surface and the detector cache', async () => {
    const setup = await loadEngineWithApiMocks();
    document.body.innerHTML = '<div data-stream-item-id="post-1"></div>';

    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);
    engine.fullScan();
    await flushAsync();
    expect(engine.getApiCorroborationTrace('post-1')).not.toBeNull();

    engine.destroy();
    expect(engine.getApiCorroborationTrace('post-1')).toBeNull();
  });
});
