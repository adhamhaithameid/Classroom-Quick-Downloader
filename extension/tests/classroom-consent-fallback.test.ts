// filepath: extension/tests/classroom-consent-fallback.test.ts
/**
 * ============================================================================
 * CLASSROOM CLICK — INTERACTIVE CONSENT FALLBACK (bug 2.5)
 * ============================================================================
 *
 * The classroom-wide click used to die silently on installs with no cached
 * token: chrome.identity.getAuthToken({interactive:false}) resolves null,
 * getInventory resolves null, and the button just says "Couldn't list
 * files" until the user happened to visit a student-work view (the only
 * token warm-up path).
 *
 * The fix (scoped strictly to the classroom click path — a user gesture):
 * InteractiveConsentTokenProvider wraps the Chrome identity provider for the
 * classroom inventory client. A non-interactive miss escalates to ONE
 * interactive consent prompt; a granted token lets the flow proceed; a
 * denial surfaces as the existing classified failure state ("Couldn't list
 * files", via CourseInventoryService's catch → null snapshot) with no crash
 * and no unhandled rejection. The student-work paths keep the strictly
 * non-interactive provider (privacy model, docs/engine/api-assist-setup.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractiveConsentTokenProvider } from '../src/engines/v3/api/token-provider';
import type { ClassroomApiTokenProvider } from '../src/engines/v3/api/types';
import {
  ensureClassroomButton,
  handleClassroomClick,
  installClassroomDownloadController,
  resetClassroomDownloadController,
  uninstallClassroomDownloadController,
} from '../src/v2/render/classroom-download-controller';
import { CLASSROOM_ACTION_LABEL } from '../src/v2/render/classroom-action-label';
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

interface InnerScript {
  nonInteractive: string | null;
  interactive: string | null;
}

function makeInner(script: InnerScript) {
  return {
    getAccessToken: vi.fn(async (interactive: boolean) =>
      interactive ? script.interactive : script.nonInteractive),
  };
}

/** One courseWork page holding a single Drive attachment (json() shape). */
function courseWorkPage() {
  return {
    courseWork: [
      {
        id: 'cw1',
        title: 'HW',
        materials: [
          { driveFile: { driveFile: { id: 'FILE_1', title: 'Worksheet.pdf' } } },
        ],
      },
    ],
  };
}

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => courseWorkPage(),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function installedWith(inner: ReturnType<typeof makeInner>) {
  const timers = makeManualTimers();
  const { bus, published } = makeBus();
  const wrapper = new InteractiveConsentTokenProvider(inner as unknown as ClassroomApiTokenProvider);
  const uninstall = installClassroomDownloadController({
    bus: bus as never,
    setTimeoutFn: timers.setTimeoutFn as unknown as typeof setTimeout,
    clearTimeoutFn: timers.clearTimeoutFn as unknown as typeof clearTimeout,
    createTokenProvider: () => wrapper,
    // Consent-fallback tests exercise the token path, not the one-time
    // copyright gate (tests/classroom-copyright-gate.test.ts covers it).
    copyrightGate: async () => true,
  });
  return { timers, published, inner, uninstall };
}

beforeEach(() => {
  seedHeader();
});

afterEach(() => {
  uninstallClassroomDownloadController();
  resetClassroomDownloadController();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('InteractiveConsentTokenProvider (unit)', () => {
  it('returns the token without escalating when the non-interactive attempt succeeds', async () => {
    const inner = makeInner({ nonInteractive: 'cached-tok', interactive: null });
    const provider = new InteractiveConsentTokenProvider(inner as unknown as ClassroomApiTokenProvider);

    await expect(provider.getAccessToken(false)).resolves.toBe('cached-tok');
    expect(inner.getAccessToken.mock.calls).toEqual([[false]]);
  });

  it('escalates to ONE interactive attempt when the non-interactive attempt misses', async () => {
    const inner = makeInner({ nonInteractive: null, interactive: 'consent-tok' });
    const provider = new InteractiveConsentTokenProvider(inner as unknown as ClassroomApiTokenProvider);

    await expect(provider.getAccessToken(false)).resolves.toBe('consent-tok');
    expect(inner.getAccessToken.mock.calls).toEqual([[false], [true]]);
  });

  it('throws when consent is denied so callers classify it as a failure (never loops)', async () => {
    const inner = makeInner({ nonInteractive: null, interactive: null });
    const provider = new InteractiveConsentTokenProvider(inner as unknown as ClassroomApiTokenProvider);

    await expect(provider.getAccessToken(false)).rejects.toThrow(/consent/i);
    expect(inner.getAccessToken.mock.calls).toEqual([[false], [true]]);
  });

  it('an already-interactive miss returns null without re-escalating', async () => {
    const inner = makeInner({ nonInteractive: 'cached-tok', interactive: null });
    const provider = new InteractiveConsentTokenProvider(inner as unknown as ClassroomApiTokenProvider);

    await expect(provider.getAccessToken(true)).resolves.toBeNull();
    expect(inner.getAccessToken.mock.calls).toEqual([[true]]);
  });
});

describe('classroom click with interactive consent fallback (bug 2.5)', () => {
  it('non-interactive miss → interactive fallback called → flow proceeds with the token', async () => {
    const fetchMock = stubFetch();
    const ctx = installedWith(makeInner({ nonInteractive: null, interactive: 'consent-tok' }));
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;
    expect(button).not.toBeNull();

    const click = handleClassroomClick(CLASSWORK_URL);
    await ctx.timers.flushAll();
    await click;

    // The escalation happened exactly once, then the flow proceeded.
    expect(ctx.inner.getAccessToken.mock.calls).toEqual([[false], [true]]);
    expect(fetchMock).toHaveBeenCalled();
    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]?.file).toMatchObject({ fileId: 'FILE_1', name: 'Worksheet.pdf' });
  });

  it('user denies consent → classified failure state, no crash, nothing published', async () => {
    const fetchMock = stubFetch();
    const ctx = installedWith(makeInner({ nonInteractive: null, interactive: null }));
    ensureClassroomButton(CLASSWORK_URL);
    const button = document.getElementById('cqd-classroom-dl-btn') as HTMLButtonElement;

    // The click flow resolves (no unhandled rejection) and surfaces the
    // existing classified failure state for a null inventory.
    await expect(handleClassroomClick(CLASSWORK_URL)).resolves.toBeUndefined();

    expect(ctx.inner.getAccessToken.mock.calls).toEqual([[false], [true]]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ctx.published).toHaveLength(0);
    expect(button.textContent).toBe("Couldn't list files");

    // The transient state resets after the feedback window.
    await ctx.timers.flushAll();
    expect(button.textContent).toBe(CLASSROOM_ACTION_LABEL);
  });

  it('a cached token skips the prompt entirely and proceeds non-interactively', async () => {
    const fetchMock = stubFetch();
    const ctx = installedWith(makeInner({ nonInteractive: 'cached-tok', interactive: 'unused' }));
    ensureClassroomButton(CLASSWORK_URL);

    const click = handleClassroomClick(CLASSWORK_URL);
    await ctx.timers.flushAll();
    await click;

    expect(ctx.inner.getAccessToken.mock.calls).toEqual([[false]]);
    expect(ctx.published).toHaveLength(1);
  });
});
