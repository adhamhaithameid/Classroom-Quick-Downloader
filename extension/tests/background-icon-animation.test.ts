import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_ICON_PATHS,
  SPIN_FRAME_PATHS,
  SUCCESS_ICON_PATHS,
  createIconAnimationController,
} from '../entrypoints/background/icon-animation';
import type { CountRenderer } from '../entrypoints/background/icon-count-renderer';
import { COLOR_ICON_PATHS, GRAY_ICON_PATHS, setActionIcon } from '../entrypoints/background/icon-manager';

/** Minimal deterministic timers: manual interval ticks + timeout expiry. */
function createFakeTimers() {
  const intervals: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  const timeouts: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  return {
    intervals,
    timeouts,
    liveCount: () =>
      intervals.filter((i) => i.live).length + timeouts.filter((t) => t.live).length,
    setInterval(fn: () => void, ms: number): number {
      intervals.push({ fn, ms, live: true });
      return intervals.length;
    },
    clearInterval(handle: unknown): void {
      const job = intervals[Number(handle) - 1];
      if (job) job.live = false;
    },
    setTimeout(fn: () => void, ms: number): number {
      timeouts.push({ fn, ms, live: true });
      return timeouts.length;
    },
    clearTimeout(handle: unknown): void {
      const job = timeouts[Number(handle) - 1];
      if (job) job.live = false;
    },
    tick(times: number): void {
      for (let n = 0; n < times; n += 1) for (const i of intervals) if (i.live) i.fn();
    },
    fireTimeouts(): void {
      for (const t of timeouts)
        if (t.live) {
          t.live = false;
          t.fn();
        }
    },
  };
}

type FakeRenderer = CountRenderer & { calls: Array<[string, number, number]> };

function makeRenderer(available: boolean, impl?: FakeRenderer['render']): FakeRenderer {
  const calls: Array<[string, number, number]> = [];
  return {
    calls,
    isAvailable: () => available,
    render:
      impl ??
      (vi.fn(async (framePath: string, size: number, count: number) => {
        calls.push([framePath, size, count]);
        return { marker: framePath, size, count } as unknown as ImageData;
      })),
    cacheSize: () => 0,
  };
}

const TABS = [
  { id: 1, url: 'https://classroom.google.com/u/0/h' },
  { id: 2, url: 'https://example.com' },
];

function setupChrome() {
  const setIcon = vi.fn();
  (chrome as any).action = { setIcon };
  (chrome.tabs as any).query = vi.fn((_q: unknown, cb: (tabs: typeof TABS) => void) =>
    cb(TABS),
  );
  return setIcon;
}

describe('background icon animation controller', () => {
  let timers: ReturnType<typeof createFakeTimers>;
  let setIcon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    timers = createFakeTimers();
    setIcon = setupChrome();
    (chrome as any).action.setBadgeText = vi.fn();
    (chrome as any).action.setBadgeBackgroundColor = vi.fn();
  });

  it('paints spinner frame 0 on every known tab when the queue goes active', () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(1);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: SPIN_FRAME_PATHS[0] });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 2, path: SPIN_FRAME_PATHS[0] });
  });

  it('composites the count into frames when a renderer is available', async () => {
    const renderer = makeRenderer(true);
    const c = createIconAnimationController({ timers, renderer });
    c.setActiveCount(2);
    await vi.waitFor(() => {
      expect(setIcon).toHaveBeenCalledWith({
        tabId: 1,
        imageData: expect.objectContaining({ 48: expect.objectContaining({ marker: 'icon/fx/spin-0-48.png' }) }),
      });
      expect(setIcon).toHaveBeenCalledWith({
        tabId: 2,
        imageData: expect.anything(),
      });
    });
    expect(renderer.calls[0]).toEqual(['icon/fx/spin-0-16.png', 16, 2]);
    expect(renderer.calls.find((call) => call[1] === 48)?.[2]).toBe(2);
  });

  it('falls back to path frames + badge text when the renderer is unavailable', () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(3);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: SPIN_FRAME_PATHS[0] });
    expect((chrome as any).action.setBadgeText).toHaveBeenCalledWith({ text: '3' });
  });

  it('falls back to paths + badge when compositing fails at runtime', async () => {
    const renderer = makeRenderer(true, vi.fn(async () => null));
    const c = createIconAnimationController({ timers, renderer });
    c.setActiveCount(1);
    await vi.waitFor(() => {
      expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: SPIN_FRAME_PATHS[0] });
      expect((chrome as any).action.setBadgeText).toHaveBeenCalledWith({ text: '1' });
    });
  });

  it('keeps only the latest composite when ticks race ahead (latest wins)', async () => {
    let releaseStale!: (v: ImageData | null) => void;
    const renderer = makeRenderer(true, (path) => {
      if (path.endsWith('spin-0-16.png')) {
        // Stall the first apply on its first size.
        return new Promise((resolve) => {
          releaseStale = resolve;
        });
      }
      return Promise.resolve({ marker: path } as unknown as ImageData);
    });
    const c = createIconAnimationController({ timers, renderer });
    c.setActiveCount(1); // apply #1 stalls on spin-0-16
    timers.tick(1); // apply #2 composites frame 1 fully
    await vi.waitFor(() => expect(setIcon).toHaveBeenCalled());
    const appliedArg = setIcon.mock.calls.at(-1)![0] as {
      imageData?: Record<number, { marker?: string }>;
    };
    expect(appliedArg.imageData?.[48]?.marker).toContain('spin-1-48');

    releaseStale({ marker: 'icon/fx/spin-0-16.png' } as unknown as ImageData); // apply #1 finishes late
    await vi.advanceTimersByTimeAsync(1); // flush microtasks (global fake timers)
    const lastArg = setIcon.mock.calls.at(-1)![0] as {
      imageData?: Record<number, { marker?: string }>;
    };
    expect(lastArg.imageData?.[48]?.marker).toContain('spin-1-48'); // stale discarded
  });

  it('clears the badge when the queue drains into a flash or idle', async () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(2);
    c.notifySettled('success');
    c.setActiveCount(0);
    expect((chrome as any).action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: SUCCESS_ICON_PATHS });
    timers.fireTimeouts();
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: COLOR_ICON_PATHS });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 2, path: GRAY_ICON_PATHS });
    expect(timers.liveCount()).toBe(0);
  });

  it('uses flash paths when the renderer is available too (count is active-only)', async () => {
    const renderer = makeRenderer(true);
    const c = createIconAnimationController({ timers, renderer });
    c.setActiveCount(1);
    await vi.waitFor(() => expect(renderer.calls.length).toBeGreaterThan(0));
    c.notifySettled('fail');
    c.setActiveCount(0);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: ERROR_ICON_PATHS });
    expect((chrome as any).action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });

  it('advances to the next spinner frame on interval ticks', async () => {
    const renderer = makeRenderer(false);
    const c = createIconAnimationController({ timers, renderer });
    c.setActiveCount(1);
    setIcon.mockClear();
    timers.tick(3);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: SPIN_FRAME_PATHS[3] });
  });

  it('paints the error frame when the batch failed', () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(2);
    c.notifySettled('fail');
    c.setActiveCount(0);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: ERROR_ICON_PATHS });
    timers.fireTimeouts();
    expect(timers.liveCount()).toBe(0);
  });

  it('disable clears the frame override and stops timers', () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(1);
    setIcon.mockClear();
    c.setEnabled(false);
    expect(timers.liveCount()).toBe(0);
    expect(setIcon).not.toHaveBeenCalled(); // the adapter itself never repaints
    timers.tick(5);
    expect(setIcon).not.toHaveBeenCalled();
    // Override cleared → per-tab base mapping is back; the gray walk that
    // index.ts runs right after sees a clean state.
    setActionIcon(9, true);
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 9, path: COLOR_ICON_PATHS });
  });

  it('idle drain without outcomes restores base icons directly', () => {
    const c = createIconAnimationController({ timers, renderer: makeRenderer(false) });
    c.setActiveCount(1);
    setIcon.mockClear();
    c.setActiveCount(0);
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: COLOR_ICON_PATHS });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 2, path: GRAY_ICON_PATHS });
  });
});
