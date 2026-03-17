import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewKind, type CQDEngine } from '../src/engines/types';

type MockedSetup = {
  EngineV3: new () => CQDEngine;
  discover: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  publishStudentWorkApiSnapshot: ReturnType<typeof vi.fn>;
  resolveClassroomApiRouteContext: ReturnType<typeof vi.fn>;
  context: {
    viewKind: ViewKind;
    courseId: string;
    courseWorkId: string;
    authUser: string | null;
    studentSubmissionId: string | null;
  };
  snapshot: {
    fetchedAt: number;
    context: {
      viewKind: ViewKind;
      courseId: string;
      courseWorkId: string;
      authUser: string | null;
      studentSubmissionId: string | null;
    };
    submissions: Array<{
      id: string;
      attachments: Array<{
        id: string;
        title: string;
        downloadUrl: string;
        source: 'driveFile';
      }>;
    }>;
  };
};

async function loadEngineWithApiMocks(
  overrides?: {
    context?: MockedSetup['context'] | null;
  },
): Promise<MockedSetup> {
  vi.resetModules();

  const context = overrides?.context === undefined
    ? {
      viewKind: ViewKind.STUDENT_WORK_TEACHER,
      courseId: 'COURSE_1',
      courseWorkId: 'WORK_1',
      authUser: null,
      studentSubmissionId: null,
    }
    : overrides.context;

  const snapshot = {
    fetchedAt: Date.now(),
    context: {
      viewKind: ViewKind.STUDENT_WORK_TEACHER,
      courseId: 'COURSE_1',
      courseWorkId: 'WORK_1',
      authUser: null,
      studentSubmissionId: null,
    },
    submissions: [
      {
        id: 'SUB_1',
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

  const discover = vi.fn(async () => snapshot);
  const clear = vi.fn();
  const publishStudentWorkApiSnapshot = vi.fn();
  const resolveClassroomApiRouteContext = vi.fn(() => context);

  vi.doMock('../src/engines/v3/api', () => ({
    createDefaultApiDiscoveryService: () => ({
      discover,
      clear,
    }),
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
    context: context ?? {
      viewKind: ViewKind.STUDENT_WORK_TEACHER,
      courseId: '',
      courseWorkId: '',
      authUser: null,
      studentSubmissionId: null,
    },
    snapshot,
  };
}

describe('EngineV3 student work API scope', () => {
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

  it('does not run API discovery for non-student-work views', async () => {
    const setup = await loadEngineWithApiMocks();
    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STREAM, controller.signal);

    expect(setup.resolveClassroomApiRouteContext).not.toHaveBeenCalled();
    expect(setup.discover).not.toHaveBeenCalled();
    expect(setup.publishStudentWorkApiSnapshot).toHaveBeenCalledWith(null);

    engine.destroy();
    expect(setup.clear).toHaveBeenCalledTimes(1);
  });

  it('runs API discovery only on student-work views and republishes on fullScan', async () => {
    const setup = await loadEngineWithApiMocks();
    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);

    expect(setup.resolveClassroomApiRouteContext).toHaveBeenCalledWith(window.location.href);
    expect(setup.discover).toHaveBeenCalledWith(setup.context, { signal: controller.signal });
    expect(setup.publishStudentWorkApiSnapshot).toHaveBeenCalledWith(setup.snapshot);

    engine.fullScan();
    await Promise.resolve();
    await Promise.resolve();

    expect(setup.discover).toHaveBeenCalledTimes(2);

    engine.destroy();
    expect(setup.clear).toHaveBeenCalledTimes(1);
    expect(setup.publishStudentWorkApiSnapshot).toHaveBeenLastCalledWith(null);
  });

  it('clears published snapshot when route context is unavailable', async () => {
    const setup = await loadEngineWithApiMocks({ context: null });
    const engine = new setup.EngineV3();
    const controller = new AbortController();
    controller.abort();

    await engine.init(ViewKind.STUDENT_WORK_TEACHER, controller.signal);

    expect(setup.discover).not.toHaveBeenCalled();
    expect(setup.publishStudentWorkApiSnapshot).toHaveBeenCalledWith(null);
  });
});
