import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLASSROOM_FEEDBACK_MS,
  ensureClassroomButton,
  handleClassroomClick,
  installClassroomDownloadController,
  resetClassroomDownloadController,
  uninstallClassroomDownloadController,
} from '../src/v2/render/classroom-download-controller';
import type { CourseInventoryService } from '../src/engines/v3/api/course-inventory';
import type { PageTopicMap } from '../src/contracts/topics';

const CLASSWORK_URL = 'https://classroom.google.com/w/COURSE_1/t/all';
const STREAM_URL = 'https://classroom.google.com/c/COURSE_1';

type SettledHandler = (payload: PageTopicMap['download:settled']) => void;

function makeBus() {
  const handlers: Partial<Record<keyof PageTopicMap, SettledHandler>> = {};
  const published: Array<PageTopicMap['download:requested']> = [];
  const bus = {
    publish: vi.fn((topic: keyof PageTopicMap, payload: unknown) => {
      if (topic === 'download:requested') published.push(payload as PageTopicMap['download:requested']);
    }),
    subscribe: vi.fn((_topic: keyof PageTopicMap, handler: SettledHandler) => {
      handlers['download:settled'] = handler;
      return () => {};
    }),
  };
  return { bus, published, settle: () => handlers['download:settled'] };
}

function makeInventory(files: Array<{ driveId: string; title: string; downloadUrl: string }> | null) {
  return {
    getInventory: vi.fn(async () =>
      files ? { fetchedAt: 1, courseId: 'COURSE_1', files } : null,
    ),
    clear: vi.fn(),
  } as unknown as CourseInventoryService;
}

/** Manual clock: stagger waits and feedback resets only run when flushed. */
function makeManualTimers() {
  let pending: Array<() => void> = [];
  const setTimeoutFn = vi.fn((fn: () => void) => {
    pending.push(fn);
    return pending.length as unknown as ReturnType<typeof setTimeout>;
  });
  const clearTimeoutFn = vi.fn((id: unknown) => {
    pending = pending.filter((_, index) => index !== (id as number) - 1);
  });
  // Drain to quiescence: the click flow registers new timers from microtask
  // continuations, so keep yielding until no timer work remains.
  const flushAll = async () => {
    for (let guard = 0; guard < 64; guard += 1) {
      while (pending.length > 0) {
        pending.shift()?.();
        await Promise.resolve();
        await Promise.resolve();
      }
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return { setTimeoutFn, clearTimeoutFn, flushAll };
}

function seedHeader(): void {
  document.body.innerHTML = '<div class="N5dSp"></div>';
}

function installed(files: Array<{ driveId: string; title: string; downloadUrl: string }> | null) {
  const timers = makeManualTimers();
  const bus = makeBus();
  const uninstall = installClassroomDownloadController({
    bus: bus.bus as never,
    setTimeoutFn: timers.setTimeoutFn as unknown as typeof setTimeout,
    clearTimeoutFn: timers.clearTimeoutFn as unknown as typeof clearTimeout,
    createInventory: () => makeInventory(files),
  });
  return { timers, ...bus, uninstall };
}

beforeEach(() => {
  seedHeader();
});

afterEach(() => {
  uninstallClassroomDownloadController();
  resetClassroomDownloadController();
  document.body.innerHTML = '';
});

describe('classroom download controller', () => {
  it('renders the button on classwork routes and removes it elsewhere', () => {
    installed([]);
    ensureClassroomButton(CLASSWORK_URL);
    expect(document.getElementById('cqd-classroom-dl-btn')).not.toBeNull();

    // Gating lives in EngineV3; the controller only honors the route shape.
    ensureClassroomButton(STREAM_URL);
    expect(document.getElementById('cqd-classroom-dl-btn')).toBeNull();
  });

  it('stays inert when never asked to ensure (non-v3 modes see nothing)', () => {
    ensureClassroomButton(CLASSWORK_URL);
    expect(document.getElementById('cqd-classroom-dl-btn')).toBeNull();
  });

  it('publishes one staggered download per inventory file and reports completion', async () => {
    const ctx = installed([
      { driveId: 'FILE_1', title: 'Worksheet.pdf', downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1' },
      { driveId: 'FILE_2', title: 'Notes.docx', downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_2' },
    ]);
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    const click = handleClassroomClick(CLASSWORK_URL);
    await ctx.timers.flushAll();

    expect(ctx.published).toHaveLength(2);
    expect(ctx.published[0]?.file).toMatchObject({ fileId: 'FILE_1', name: 'Worksheet.pdf' });
    expect(ctx.published[0]?.nameHint).toMatchObject({ preferredStem: 'Worksheet', ext: 'pdf', source: 'drive-meta' });
    expect(button.textContent).toContain('Downloading…');

    // The bridge settles both — success and failure are counted honestly.
    ctx.settle()!({ requestId: ctx.published[0]!.requestId, outcome: { status: 'saved' } } as never);
    ctx.settle()!({ requestId: ctx.published[1]!.requestId, outcome: { status: 'failed' } } as never);
    expect(button.textContent).toBe('1/2 downloaded');

    // Terminal state resets after the feedback window.
    await ctx.timers.flushAll();
    expect(button.textContent).toBe('Download all classroom files');
    expect(CLASSROOM_FEEDBACK_MS).toBe(3000);
    await click;
  });

  it('a mid-run click stops issuing new requests', async () => {
    const ctx = installed([
      { driveId: 'FILE_1', title: 'A.pdf', downloadUrl: 'u1' },
      { driveId: 'FILE_2', title: 'B.pdf', downloadUrl: 'u2' },
      { driveId: 'FILE_3', title: 'C.pdf', downloadUrl: 'u3' },
    ]);
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    const click = handleClassroomClick(CLASSWORK_URL);
    await vi.waitFor(() => {
      expect(ctx.published.length).toBeGreaterThanOrEqual(1);
    });

    const stop = handleClassroomClick(CLASSWORK_URL);
    // The stop is a synchronous state flip on the busy run.
    expect(button.textContent).toContain('Stopping');

    // Draining the clock lets the loop observe the stop, then the idle reset.
    await ctx.timers.flushAll();
    await stop;
    await click;

    expect(ctx.published).toHaveLength(1);
    expect(button.textContent).toBe('Download all classroom files');
  });

  it('reports an empty course and an inventory failure without throwing', async () => {
    const ctx = installed([]);
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    await handleClassroomClick(CLASSWORK_URL);
    expect(button.textContent).toBe('No downloadable files found');
    await ctx.timers.flushAll();

    uninstallClassroomDownloadController();
    seedHeader();
    const failing = installed(null);
    ensureClassroomButton(CLASSWORK_URL);
    const errorButton = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;
    await handleClassroomClick(CLASSWORK_URL);
    expect(errorButton.textContent).toBe("Couldn't list files");
  });
});
