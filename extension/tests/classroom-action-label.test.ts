// filepath: extension/tests/classroom-action-label.test.ts
/**
 * ============================================================================
 * CLASSROOM_ACTION_LABEL — single source for the classroom action copy (2.7)
 * ============================================================================
 *
 * Task 2.7 extracted the copy into ONE exported constant that every render
 * site must read, so any rename is a one-line change. Phase 4 (direction A,
 * owner ballot) adopted the owner's pick "Download Classroom"
 * (prototypes/components.html section D, candidate 1). These tests pin the
 * ADOPTED value and that both render sites — initial button text and the
 * post-run terminal reset — use the constant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASSROOM_ACTION_LABEL } from '../src/v2/render/classroom-action-label';
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

type SettledHandler = (payload: PageTopicMap['download:settled']) => void;

function makeBus() {
  const handlers: Partial<Record<keyof PageTopicMap, SettledHandler>> = {};
  const bus = {
    publish: vi.fn(),
    subscribe: vi.fn((_topic: keyof PageTopicMap, handler: SettledHandler) => {
      handlers['download:settled'] = handler;
      return () => {};
    }),
  };
  return { bus };
}

/** Manual clock: the terminal-state reset only runs when flushed. */
function makeManualTimers() {
  let pending: Array<() => void> = [];
  const setTimeoutFn = vi.fn((fn: () => void) => {
    pending.push(fn);
    return pending.length as unknown as ReturnType<typeof setTimeout>;
  });
  const clearTimeoutFn = vi.fn((id: unknown) => {
    pending = pending.filter((_, index) => index !== (id as number) - 1);
  });
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
  const { bus } = makeBus();
  const uninstall = installClassroomDownloadController({
    bus: bus as never,
    setTimeoutFn: timers.setTimeoutFn as unknown as typeof setTimeout,
    clearTimeoutFn: timers.clearTimeoutFn as unknown as typeof clearTimeout,
    createInventory: () =>
      ({
        getInventory: vi.fn(async () =>
          files ? { fetchedAt: 1, courseId: 'COURSE_1', files } : null),
        clear: vi.fn(),
      }) as unknown as CourseInventoryService,
    // Action-label tests exercise the button copy, not the one-time
    // copyright gate (tests/classroom-copyright-gate.test.ts covers it).
    copyrightGate: async () => true,
  });
  return { timers, uninstall };
}

beforeEach(() => {
  seedHeader();
});

afterEach(() => {
  uninstallClassroomDownloadController();
  resetClassroomDownloadController();
  document.body.innerHTML = '';
});

describe('CLASSROOM_ACTION_LABEL (task 2.7 + Phase 4 rename)', () => {
  it('pins the adopted copy — the owner pick from components.html candidate 1', () => {
    expect(CLASSROOM_ACTION_LABEL).toBe('Download Classroom');
  });

  it('is the label the initial render uses', () => {
    installed(null);
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    expect(button.textContent).toBe(CLASSROOM_ACTION_LABEL);
  });

  it('is the label the terminal-state reset restores', async () => {
    const ctx = installed(null);
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    // A failed inventory leaves the classified failure state...
    await handleClassroomClick(CLASSWORK_URL);
    expect(button.textContent).toBe("Couldn't list files");

    // ...which the feedback-window reset must restore to the constant.
    await ctx.timers.flushAll();
    expect(button.textContent).toBe(CLASSROOM_ACTION_LABEL);
    expect(CLASSROOM_FEEDBACK_MS).toBe(3000);
  });
});
