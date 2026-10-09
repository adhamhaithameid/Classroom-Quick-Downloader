// filepath: extension/tests/popup-milestone-celebration.test.ts
/**
 * 1.9.0 confetti, commit 2 — the popup celebration. Contract: ONE burst per
 * pending milestone, pending cleared after play, the reduced-motion double
 * gate (OS query OR in-app setting) leaves the toast only, and a milestone
 * landing while the popup is open celebrates live through the storage watch.
 * canvas-confetti is module-mocked: the burst is asserted by call, not drawn.
 */
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MilestoneCelebration } from '../entrypoints/popup/MilestoneCelebration';
import { celebrationUsesConfetti, prefersReducedMotionOS } from '../src/celebration/confetti';
import {
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
} from '../src/history/download-stats';
import { computeChecksum } from '../src/history/history-store';

// React's act needs the environment flag outside RTL's setup.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The burst fn canvas-confetti.create hands back (mocked at the module). */
const burstFn = vi.fn();

vi.mock('canvas-confetti', () => ({
  default: {
    create: vi.fn(() => burstFn),
  },
}));

type Store = Map<string, unknown>;

function statsRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    installId: 'install-1',
    lifetimeCount: 100,
    lastMilestoneReached: 100,
    milestonePending: 100,
    countedDownloadIds: ['req-1'],
    ...overrides,
  };
}

function installMemoryStore(): Store {
  const store: Store = new Map();
  (chrome.storage.local.get as any) = vi.fn(
    (keys: string[], cb: (r: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (store.has(k)) out[k] = store.get(k);
      cb(out);
    },
  );
  (chrome.storage.local.set as any) = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
    for (const [k, v] of Object.entries(kv)) store.set(k, v);
    cb?.();
  });
  return store;
}

function seedStats(store: Store, stats: Record<string, unknown>): void {
  store.set(DOWNLOAD_STATS_KEY, stats);
  store.set(DOWNLOAD_STATS_INTEGRITY_KEY, computeChecksum(JSON.stringify(stats)));
}

function storedListeners(): Array<(c: Record<string, { newValue?: unknown }>, area: string) => void> {
  return (chrome.storage.onChanged.addListener as any).mock.calls.map(
    (c: unknown[]) => c[0],
  );
}

/** Real chrome dispatches to every listener; each filters its own keys. */
function fireStatsChange(): void {
  act(() => {
    for (const listener of storedListeners()) {
      listener({ [DOWNLOAD_STATS_KEY]: { newValue: undefined } }, 'local');
    }
  });
}

async function flushTasks(rounds = 8): Promise<void> {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

describe('milestone celebration (1.9.0 commit 2)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { matchMedia?: unknown }).matchMedia; // jsdom default: OS gate off
    store = installMemoryStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  function mount(): void {
    flushSync(() => {
      root.render(createElement(MilestoneCelebration));
    });
  }

  it('plays one burst and shows the toast when a milestone is pending on open', async () => {
    seedStats(store, statsRecord());
    mount();
    await flushTasks();
    expect(burstFn).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      '100 files downloaded!',
    );
    // Pending cleared: the write-back nulls the flag in the record.
    const cleared = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>;
    expect(cleared.milestonePending).toBeNull();
  });

  it('does not replay the burst when the watcher re-fires after the clear', async () => {
    seedStats(store, statsRecord());
    mount();
    await flushTasks();
    expect(burstFn).toHaveBeenCalledTimes(1);
    // Duplicate onChanged dispatch; the record is already cleared, and the
    // played-pending guard blocks a second burst either way.
    seedStats(store, statsRecord());
    fireStatsChange();
    await flushTasks(4);
    expect(burstFn).toHaveBeenCalledTimes(1);
  });

  it('shows toast only under the OS reduced-motion gate', async () => {
    (globalThis as any).matchMedia = vi.fn(() => ({ matches: true }));
    expect(prefersReducedMotionOS()).toBe(true);
    expect(celebrationUsesConfetti(false)).toBe(false);
    seedStats(store, statsRecord());
    mount();
    await flushTasks();
    expect(burstFn).not.toHaveBeenCalled();
    expect(container.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      '100 files downloaded!',
    );
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('shows toast only under the in-app reducedMotionPreferred gate', async () => {
    seedStats(store, statsRecord());
    (chrome.storage.local.get as any) = vi.fn(
      (keys: string[], cb: (r: Record<string, unknown>) => void) => {
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          if (k === 'reducedMotionPreferred') out[k] = true;
          else if (store.has(k)) out[k] = store.get(k);
        }
        cb(out);
      },
    );
    // OS gate off (no matchMedia), in-app gate on.
    expect(celebrationUsesConfetti(true)).toBe(false);
    mount();
    await flushTasks();
    expect(burstFn).not.toHaveBeenCalled();
    expect(container.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      'files downloaded!',
    );
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('celebrates live through the storage watch while the popup is open', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 37, milestonePending: null, lastMilestoneReached: null }),
    );
    mount();
    await flushTasks();
    expect(burstFn).not.toHaveBeenCalled();
    expect(container.querySelector('.cqd-milestone-toast')).toBeNull();

    // Milestone lands mid-session: a settle writes the record, the watcher
    // re-reads it through the checksummed load path and celebrates.
    seedStats(
      store,
      statsRecord({ lifetimeCount: 50, milestonePending: 50, lastMilestoneReached: 50 }),
    );
    fireStatsChange();
    await flushTasks(4);
    expect(burstFn).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      '50 files downloaded!',
    );
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('renders nothing (and never bursts) with no pending milestone', async () => {
    seedStats(store, statsRecord({ milestonePending: null }));
    mount();
    await flushTasks();
    expect(burstFn).not.toHaveBeenCalled();
    expect(container.querySelector('.cqd-milestone-toast')).toBeNull();
  });

  it('announces the first file with singular copy', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 1, milestonePending: 1, lastMilestoneReached: 1 }),
    );
    mount();
    await flushTasks();
    expect(container.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      'First file downloaded!',
    );
  });

  it('toast is aria-live=polite and the burst canvas carries aria-hidden', async () => {
    seedStats(store, statsRecord());
    mount();
    await flushTasks();
    const toast = container.querySelector('.cqd-milestone-toast');
    expect(toast?.getAttribute('aria-live')).toBe('polite');
    expect(toast?.getAttribute('role')).toBe('status');
    // The burst canvas is created outside the toast and hidden from AT.
    const canvas = document.body.querySelector(':scope > canvas');
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    // Keyboard behavior untouched: no focus steal, no tab stops added.
    expect(document.activeElement).toBe(document.body);
  });
});
