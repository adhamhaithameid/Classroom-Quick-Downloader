// filepath: extension/tests/popup-lifetime-tracker.test.ts
/**
 * 1.9.0 confetti, commit 3 — the lifetime download tracker card. Contract:
 * zero state ("Download your first file..."), mid-ladder progress ("37 to
 * 100 files"), the post-final legend state, compact big-number formatting
 * ("1M"), and live updates through the storage watch.
 */
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifetimeTrackerCard } from '../entrypoints/popup/LifetimeTrackerCard';
import { formatMilestoneCount } from '../src/history/download-stats';
import {
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
} from '../src/history/download-stats';
import { computeChecksum } from '../src/history/history-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Store = Map<string, unknown>;

function statsRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    installId: 'install-1',
    lifetimeCount: 0,
    lastMilestoneReached: null,
    milestonePending: null,
    countedDownloadIds: [],
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
  return (chrome.storage.onChanged.addListener as any).mock.calls.map((c: unknown[]) => c[0]);
}

function fireStatsChange(): void {
  act(() => {
    for (const listener of storedListeners()) {
      listener({ [DOWNLOAD_STATS_KEY]: { newValue: undefined } }, 'local');
    }
  });
}

async function flushTasks(rounds = 6): Promise<void> {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

describe('lifetime tracker card (1.9.0 commit 3)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
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
      root.render(createElement(LifetimeTrackerCard));
    });
  }

  it('renders the zero state when nothing has been downloaded', async () => {
    mount();
    await flushTasks();
    const card = container.querySelector('.cqd-lifetime-card');
    expect(card?.textContent).toContain('Lifetime downloads');
    expect(card?.querySelector('.cqd-lifetime-empty')?.textContent).toBe(
      'Download your first file to start the count',
    );
    expect(card?.querySelector('.cqd-lifetime-bar')).toBeNull();
  });

  it('renders the mid-ladder progress line ("37 to 100 files")', async () => {
    seedStats(store, statsRecord({ lifetimeCount: 63, lastMilestoneReached: 50 }));
    mount();
    await flushTasks();
    const card = container.querySelector('.cqd-lifetime-card');
    expect(card?.querySelector('.cqd-lifetime-count')?.textContent).toBe('63');
    expect(card?.querySelector('.cqd-lifetime-progress')?.textContent).toBe('37 to 100 files');
    // The bar reflects progress toward the rung.
    expect(card?.querySelector<HTMLElement>('.cqd-lifetime-bar-fill')?.style.width).toBe('63%');
  });

  it('renders the compact post-final legend state past 1,000,000', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 1_234_567, lastMilestoneReached: 1_000_000 }),
    );
    mount();
    await flushTasks();
    const card = container.querySelector('.cqd-lifetime-card');
    expect(card?.querySelector('.cqd-lifetime-count')?.textContent).toBe('1.2M');
    expect(card?.querySelector('.cqd-lifetime-progress')?.textContent).toBe(
      '1,234,567 files — legend',
    );
    expect(card?.querySelector('.cqd-lifetime-bar')).toBeNull();
  });

  it('updates live when the stats record changes under the storage watch', async () => {
    seedStats(store, statsRecord({ lifetimeCount: 63 }));
    mount();
    await flushTasks();
    expect(container.querySelector('.cqd-lifetime-progress')?.textContent).toBe('37 to 100 files');

    seedStats(store, statsRecord({ lifetimeCount: 500, lastMilestoneReached: 500 }));
    fireStatsChange();
    await flushTasks(4);
    expect(container.querySelector('.cqd-lifetime-count')?.textContent).toBe('500');
    expect(container.querySelector('.cqd-lifetime-progress')?.textContent).toBe('500 to 1,000 files');
  });

  it('uses compact notation for big counts and plain digits below', () => {
    expect(formatMilestoneCount(1_000_000)).toBe('1M');
    expect(formatMilestoneCount(1_234_567)).toBe('1.2M');
    expect(formatMilestoneCount(50_000)).toBe('50K');
    expect(formatMilestoneCount(10_000)).toBe('10K');
    expect(formatMilestoneCount(5_000)).toBe('5,000');
    expect(formatMilestoneCount(1_000)).toBe('1,000');
    expect(formatMilestoneCount(37)).toBe('37');
    expect(formatMilestoneCount(0)).toBe('0');
  });

  it('shows the compact milestone header ("1M") exactly at the final rung boundary', async () => {
    seedStats(store, statsRecord({ lifetimeCount: 1_000_000, lastMilestoneReached: 1_000_000 }));
    mount();
    await flushTasks();
    const card = container.querySelector('.cqd-lifetime-card');
    expect(card?.querySelector('.cqd-lifetime-count')?.textContent).toBe('1M');
    expect(card?.querySelector('.cqd-lifetime-progress')?.textContent).toBe(
      '1,000,000 files — legend',
    );
  });

  it('keeps the card labeled for assistive tech without live-region noise', async () => {
    seedStats(store, statsRecord({ lifetimeCount: 63 }));
    mount();
    await flushTasks();
    const section = container.querySelector('section[aria-label="Lifetime downloads"]');
    expect(section).not.toBeNull();
    // The decorative bar is hidden from AT; no focusable elements added.
    expect(section?.querySelector('.cqd-lifetime-bar')?.getAttribute('aria-hidden')).toBe('true');
    expect(section?.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
  });
});
