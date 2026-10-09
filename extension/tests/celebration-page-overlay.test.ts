// filepath: extension/tests/celebration-page-overlay.test.ts
/**
 * 1.9.1 page celebrations — the Classroom-tab surface. Contract: the page
 * plays ONE overlay per pending milestone (confetti burst + banner), clears
 * pending through the existing background chain message, never re-celebrates
 * a pending the popup already cleared (fresh re-check before playing), and
 * collapses to banner-only under the reduced-motion double gate. The banner
 * is interactive-but-small: close button, Esc, auto-dismiss; the positioning
 * layer never intercepts Classroom clicks.
 *
 * canvas-confetti is module-mocked: the burst is asserted by call, not drawn.
 * The entrypoint module is re-imported per test (vi.resetModules) so the
 * claimed-pending guard starts fresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CQD_STATS_CLEAR_MILESTONE,
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
} from '../src/history/download-stats';
import { computeChecksum } from '../src/history/history-store';
import { PAGE_BANNER_DISMISS_MS } from '../src/celebration/page-celebration';

/** The burst fn canvas-confetti.create hands back (mocked at the module). */
const burstFn = vi.fn();

vi.mock('canvas-confetti', () => ({
  default: {
    create: vi.fn(() => burstFn),
  },
}));

type Store = Map<string, unknown>;

interface ContentScript {
  matches: string[];
  runAt: string;
  main: () => void;
}

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
  // Simulated background: acks the clear message and performs the chained
  // record write itself, exactly like the service worker's settle chain.
  (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(
    (msg: { type?: string }, cb?: (res?: { ok?: boolean }) => void) => {
      if (msg?.type === CQD_STATS_CLEAR_MILESTONE) {
        const stats = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown> | undefined;
        if (stats) {
          const next = { ...stats, milestonePending: null };
          store.set(DOWNLOAD_STATS_KEY, next);
          store.set(
            DOWNLOAD_STATS_INTEGRITY_KEY,
            computeChecksum(JSON.stringify(next)),
          );
        }
      }
      cb?.({ ok: true });
    },
  );
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
  for (const listener of storedListeners()) {
    listener({ [DOWNLOAD_STATS_KEY]: { newValue: undefined } }, 'local');
  }
}

/**
 * Deep flush: the boot chain is settings load (with migration write) →
 * watcher attach → stats load → the fresh re-check load → the overlay, and
 * the burst lands a couple of microtask rounds after the banner (the
 * dynamic canvas-confetti import). Microtask work is deterministic, so a
 * generous fixed depth is exact, not a sleep.
 */
async function flushTasks(rounds = 40): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/** Fresh entrypoint module per test: the claimed-pending guard resets. */
async function boot(): Promise<void> {
  vi.resetModules();
  const mod = await import('../entrypoints/celebration.content');
  (mod.default as ContentScript).main();
  await flushTasks();
}

function bannerLayer(): HTMLElement | null {
  return document.querySelector('.cqd-celebration-layer');
}

function banner(): HTMLElement | null {
  return document.querySelector('.cqd-celebration-banner');
}

function clearCalls(): number {
  return ((chrome.runtime.sendMessage as any) as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c: unknown[]) => (c[0] as { type?: string })?.type === CQD_STATS_CLEAR_MILESTONE,
  ).length;
}

describe('milestone celebration on Classroom pages (1.9.1)', () => {
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { matchMedia?: unknown }).matchMedia; // jsdom default: OS gate off
    store = installMemoryStore();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    // Drain any pending dismiss timers so they never leak into the next test.
    await vi.advanceTimersByTimeAsync(PAGE_BANNER_DISMISS_MS + 3000);
    bannerLayer()?.remove();
    document.body.querySelectorAll(':scope > canvas').forEach((c) => c.remove());
  });

  it('registers only on classroom.google.com at document_idle', async () => {
    vi.resetModules();
    const mod = await import('../entrypoints/celebration.content');
    const script = mod.default as ContentScript;
    expect(script.matches).toEqual(['https://classroom.google.com/*']);
    expect(script.runAt).toBe('document_idle');
    expect(typeof script.main).toBe('function');
  });

  it('plays the overlay when a milestone is pending at page open', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).toHaveBeenCalledTimes(1);
    // Rung 100 is the 3rd ladder value: the banner names level 3, same copy
    // contract as the popup toast.
    expect(banner()?.textContent).toContain('Level 3 reached — 100 files!');
    // The burst canvas is aria-hidden; the banner announces politely.
    expect(document.body.querySelector(':scope > canvas')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(banner()?.getAttribute('role')).toBe('status');
    expect(banner()?.getAttribute('aria-live')).toBe('polite');
    // No focus steal: Classroom keyboard behavior is untouched.
    expect(document.activeElement).toBe(document.body);
  });

  it('clears pending through the background chain message after playing', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).toHaveBeenCalledTimes(1);
    const sendMessage = (chrome.runtime.sendMessage as any) as ReturnType<typeof vi.fn>;
    // The clear rides CQD_STATS_CLEAR_MILESTONE with a response callback —
    // the ack channel the background's return-true listener keeps open.
    expect(sendMessage).toHaveBeenCalledWith(
      { type: CQD_STATS_CLEAR_MILESTONE },
      expect.any(Function),
    );
    expect(clearCalls()).toBe(1);
    const cleared = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>;
    expect(cleared.milestonePending).toBeNull();
  });

  it('does not celebrate a pending the popup already cleared', async () => {
    // The popup played first: the record carries no pending when the page
    // boots (the page load is the onChanged dispatch it missed).
    seedStats(store, statsRecord({ milestonePending: null }));
    await boot();
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    expect(clearCalls()).toBe(0);
  });

  it('re-checks pending before playing: a clear landing mid-flight wins', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 37, milestonePending: null, lastMilestoneReached: null }),
    );
    await boot();
    expect(burstFn).not.toHaveBeenCalled();

    // The settle writes pending=50 and storage fires. The popup clears the
    // record between the watcher's read and the page's fresh re-check, so
    // the second stats-key read serves the cleared record.
    seedStats(
      store,
      statsRecord({ lifetimeCount: 50, milestonePending: 50, lastMilestoneReached: 50 }),
    );
    let statsKeyReads = 0;
    const fastGet = chrome.storage.local.get as any;
    (chrome.storage.local.get as any) = vi.fn(
      (keys: string[], cb: (r: Record<string, unknown>) => void) => {
        if ((keys as string[]).includes(DOWNLOAD_STATS_KEY)) {
          statsKeyReads += 1;
          if (statsKeyReads === 2) {
            const cleared = statsRecord({
              lifetimeCount: 50,
              lastMilestoneReached: 50,
              milestonePending: null,
            });
            cb({
              [DOWNLOAD_STATS_KEY]: cleared,
              [DOWNLOAD_STATS_INTEGRITY_KEY]: computeChecksum(JSON.stringify(cleared)),
            });
            return;
          }
        }
        fastGet(keys, cb);
      },
    );

    fireStatsChange();
    await flushTasks();

    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    expect(clearCalls()).toBe(0);
  });

  it('celebrates live when a milestone lands while the page is open', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 37, milestonePending: null, lastMilestoneReached: null }),
    );
    await boot();
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();

    seedStats(
      store,
      statsRecord({ lifetimeCount: 50, milestonePending: 50, lastMilestoneReached: 50 }),
    );
    fireStatsChange();
    await flushTasks();

    expect(burstFn).toHaveBeenCalledTimes(1);
    // Rung 50 is the 2nd ladder value: level 2.
    expect(banner()?.textContent).toContain('Level 2 reached — 50 files!');
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('does not replay for duplicate storage re-fires of the same pending', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).toHaveBeenCalledTimes(1);
    // A duplicate onChanged dispatch (or another settle rewrite) must not
    // burst again: the claimed-pending guard pins one play per value.
    seedStats(store, statsRecord());
    fireStatsChange();
    await flushTasks();
    expect(burstFn).toHaveBeenCalledTimes(1);
    expect(clearCalls()).toBe(1);
  });

  it('shows banner only under the OS reduced-motion gate', async () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = vi.fn(() => ({ matches: true }));
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()?.textContent).toContain('Level 3 reached — 100 files!');
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('shows banner only under the in-app reducedMotionPreferred gate', async () => {
    store.set('reducedMotionPreferred', true);
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()?.textContent).toContain('reached — 100 files!');
    expect((store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>).milestonePending).toBeNull();
  });

  it('banner layer passes clicks through; only the card is interactive', async () => {
    seedStats(store, statsRecord());
    await boot();
    const style = document.getElementById('cqd-celebration-style');
    expect(style?.textContent).toContain('.cqd-celebration-layer');
    // The layer never intercepts Classroom interactions; the banner card does.
    const layerRule = style?.textContent ?? '';
    expect(layerRule).toMatch(/\.cqd-celebration-layer\s*{[^}]*pointer-events:\s*none/);
    expect(layerRule).toMatch(/\.cqd-celebration-banner\s*{[^}]*pointer-events:\s*auto/);
    // cqd-* naming and both reduce-motion gates in the injected sheet.
    expect(layerRule).toMatch(/cqd-celebration-/);
    expect(layerRule).toContain('prefers-reduced-motion');
    expect(layerRule).toContain('.cqd-reduce-motion');
  });

  it('close button dismisses the banner', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(banner()).not.toBeNull();
    const close = banner()?.querySelector('.cqd-celebration-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Dismiss celebration');
    expect(close.type).toBe('button');
    close.click();
    expect(bannerLayer()).toBeNull();
  });

  it('Escape dismisses the banner; other keys do not', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(banner()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(bannerLayer()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(bannerLayer()).toBeNull();
  });

  it('auto-dismisses the banner after ~6s', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(banner()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(PAGE_BANNER_DISMISS_MS - 1);
    expect(bannerLayer()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(bannerLayer()).toBeNull();
  });
});
