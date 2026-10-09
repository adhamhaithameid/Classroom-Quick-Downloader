// filepath: extension/tests/classroom-copyright-gate.test.ts
/**
 * Legal round 2, surface 04 Treatment 1 — the owner-approved one-time gate
 * (legal-round2.html, stage 04 T1). Before the FIRST classroom-wide download
 * run, the classroom-download-controller shows a small in-page dialog: the
 * materials belong to their owners, download only what you have rights to,
 * and one specific check ("for my own study") unlocks the run. Decisions
 * pinned here:
 *   - Placement: the gate lives at the controller's click path — the
 *     controller already owns Classroom-page DOM, so the dialog renders
 *     in the page (the popup never triggers classroom-wide runs).
 *   - The check gates the run: dismissal without the check ("Not now",
 *     Escape) blocks the run and writes nothing.
 *   - The acknowledgement is the flat settings key
 *     copyrightReminderAcknowledged (default false — store compat rules);
 *     once true the dialog never shows again.
 *   - Keyboard: the dialog takes focus, Escape cancels, the checkbox is a
 *     real checkbox, focus returns to the classroom button on close.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureClassroomButton,
  handleClassroomClick,
  installClassroomDownloadController,
  resetClassroomDownloadController,
  uninstallClassroomDownloadController,
} from '../src/v2/render/classroom-download-controller';
import type { ClassroomDownloadDeps } from '../src/v2/render/classroom-download-controller';
import {
  COPYRIGHT_DIALOG_LABEL,
  resetCopyrightReminderForTests,
} from '../src/v2/render/copyright-reminder';
import type { CourseInventoryService } from '../src/engines/v3/api/course-inventory';
import type { PageTopicMap } from '../src/contracts/topics';

const CLASSWORK_URL = 'https://classroom.google.com/w/COURSE_1/t/all';

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
  return { bus, published };
}

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

function makeStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  const get = vi.fn((keys: unknown, cb?: (r: Record<string, unknown>) => void) => {
    const res: Record<string, unknown> = {};
    if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
    else if (typeof keys === 'string') res[keys] = store[keys];
    cb?.(res);
    return Promise.resolve(res);
  });
  const set = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
    Object.assign(store, kv);
    cb?.();
    return Promise.resolve();
  });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get, set } },
  };
  return { store, get, set };
}

const FILES = [
  { driveId: 'FILE_1', title: 'Worksheet.pdf', downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1' },
  { driveId: 'FILE_2', title: 'Notes.docx', downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_2' },
];

function installed(storage: ReturnType<typeof makeStorage>) {
  const timers = makeManualTimers();
  const bus = makeBus();
  const deps: ClassroomDownloadDeps = {
    bus: bus.bus as never,
    setTimeoutFn: timers.setTimeoutFn as unknown as typeof setTimeout,
    clearTimeoutFn: timers.clearTimeoutFn as unknown as typeof clearTimeout,
    createInventory: () =>
      ({
        getInventory: vi.fn(async () => ({ fetchedAt: 1, courseId: 'COURSE_1', files: FILES })),
        clear: vi.fn(),
      }) as unknown as CourseInventoryService,
    // NO copyrightGate override: the tests below exercise the REAL gate.
  };
  const uninstall = installClassroomDownloadController(deps);
  return { timers, ...bus, uninstall, ...storage };
}

function dialog(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>('[data-cqd-ip-dialog]');
}

function dialogCheckbox(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('[data-cqd-ip-check]')!;
}

function dialogGo(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-cqd-ip-go]')!;
}

function dialogCancel(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-cqd-ip-cancel]')!;
}

beforeEach(() => {
  vi.useRealTimers();
  seedHeader();
});

afterEach(async () => {
  uninstallClassroomDownloadController();
  resetClassroomDownloadController();
  resetCopyrightReminderForTests();
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
  document.body.innerHTML = '';
});

describe('classroom copyright gate (legal round 2, surface 04 T1)', () => {
  it('the first click opens the check-gated dialog; the run waits behind it', async () => {
    const ctx = installed(makeStorage());
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;
    button.focus();

    const click = handleClassroomClick(CLASSWORK_URL);
    // The gate dialog must appear and hold the run (no inventory yet).
    for (let i = 0; i < 40 && !dialog(); i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(dialog()).not.toBeNull();
    expect(dialog()?.getAttribute('aria-label')).toBe(COPYRIGHT_DIALOG_LABEL);
    expect(document.activeElement).toBe(dialogCheckbox());
    expect(ctx.published).toHaveLength(0);
    // The store's migration write back-fills the flat key FALSE (documented
    // self-heal) — the assertion is "not acknowledged".
    expect(Boolean(ctx.store['copyrightReminderAcknowledged'])).toBe(false);

    // The check is the key: the run button stays disabled until it is ticked.
    expect(dialogGo().disabled).toBe(true);
    dialogCheckbox().click();
    expect(dialogGo().disabled).toBe(false);

    // Decline path: Not now closes the dialog and blocks the run.
    dialogCancel().click();
    await click;
    expect(dialog()).toBeNull();
    // Focus returns to the classroom button.
    expect(document.activeElement).toBe(button);
    expect(ctx.published).toHaveLength(0);
    expect(Boolean(ctx.store['copyrightReminderAcknowledged'])).toBe(false);
  });

  it('ticking the check and confirming persists the acknowledgement and runs', async () => {
    const ctx = installed(makeStorage());
    ensureClassroomButton(CLASSWORK_URL);

    const click = handleClassroomClick(CLASSWORK_URL);
    for (let i = 0; i < 40 && !dialog(); i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(dialog()).not.toBeNull();

    dialogCheckbox().click();
    dialogGo().click();
    // Drain the stagger timers first — the click promise settles only once
    // the whole run has been flushed through the manual clock.
    await ctx.timers.flushAll();
    await click;

    expect(ctx.store['copyrightReminderAcknowledged']).toBe(true);
    expect(dialog()).toBeNull();
    // The run proceeds: one download request per inventory file.
    expect(ctx.published).toHaveLength(FILES.length);
  });

  it('once acknowledged, later runs start immediately with no dialog', async () => {
    const ctx = installed(makeStorage({ copyrightReminderAcknowledged: true }));
    ensureClassroomButton(CLASSWORK_URL);

    const click = handleClassroomClick(CLASSWORK_URL);
    // Give the gate a chance to (wrongly) show the dialog.
    await new Promise((r) => setTimeout(r, 20));
    expect(dialog()).toBeNull();

    await ctx.timers.flushAll();
    await click;
    expect(ctx.published).toHaveLength(FILES.length);
  });

  it('Escape cancels the dialog and blocks the run (keyboard)', async () => {
    const ctx = installed(makeStorage());
    ensureClassroomButton(CLASSWORK_URL);

    const click = handleClassroomClick(CLASSWORK_URL);
    for (let i = 0; i < 40 && !dialog(); i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(dialog()).not.toBeNull();

    dialogCheckbox().click();
    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await click;

    expect(dialog()).toBeNull();
    expect(ctx.published).toHaveLength(0);
    expect(Boolean(ctx.store['copyrightReminderAcknowledged'])).toBe(false);
  });
});
