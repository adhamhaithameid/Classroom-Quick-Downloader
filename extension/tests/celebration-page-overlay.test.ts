// filepath: extension/tests/celebration-page-overlay.test.ts
/**
 * 1.9.1 page celebrations, celebration fix round — the Classroom-tab
 * surface. Contract: the page CLAIMS the pending milestone through the
 * background's atomic chain arbiter (CQD_STATS_CLAIM_CELEBRATION) and plays
 * ONE overlay only on a claimed:true ack — confetti burst + banner. A
 * claim lost to the popup plays nothing; a claim that never acks plays
 * nothing and writes nothing (no local fallback — the page never writes
 * the stats record). The reduced-motion double gate collapses the
 * celebration to banner-only. The banner is interactive-but-small: close
 * button, Esc, auto-dismiss; the positioning layer never intercepts
 * Classroom clicks.
 *
 * canvas-confetti is module-mocked: the burst is asserted by call, not
 * drawn. The entrypoint module is re-imported per test (vi.resetModules)
 * so module state starts fresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CQD_STATS_CLAIM_CELEBRATION,
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

/**
 * Simulated background: the claim branch IS the service worker's arbiter —
 * it clears the pending atomically in the same turn it answers, exactly
 * like claimMilestonePending on the serialized chain.
 */
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
  (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(
    (msg: { type?: string }, cb?: (res?: Record<string, unknown>) => void) => {
      if (msg?.type === CQD_STATS_CLAIM_CELEBRATION) {
        const stats = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown> | undefined;
        const milestone =
          stats && typeof stats.milestonePending === 'number' ? stats.milestonePending : null;
        if (milestone !== null) {
          const next = { ...stats, milestonePending: null };
          store.set(DOWNLOAD_STATS_KEY, next);
          store.set(
            DOWNLOAD_STATS_INTEGRITY_KEY,
            computeChecksum(JSON.stringify(next)),
          );
        }
        cb?.({ ok: true, claimed: milestone !== null, milestone });
        return;
      }
      if (msg?.type === CQD_STATS_CLEAR_MILESTONE) cb?.({ ok: true });
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
 * watcher attach → stats load → the claim round-trip → the overlay, and
 * the burst lands a couple of microtask rounds after the banner (the
 * dynamic canvas-confetti import). Microtask work is deterministic, so a
 * generous fixed depth is exact, not a sleep.
 */
async function flushTasks(rounds = 40): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/** Fresh entrypoint module per test: module state resets. */
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

function claimCalls(): number {
  return ((chrome.runtime.sendMessage as any) as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c: unknown[]) => (c[0] as { type?: string })?.type === CQD_STATS_CLAIM_CELEBRATION,
  ).length;
}

function clearMessageCalls(): number {
  return ((chrome.runtime.sendMessage as any) as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c: unknown[]) => (c[0] as { type?: string })?.type === CQD_STATS_CLEAR_MILESTONE,
  ).length;
}

describe('milestone celebration on Classroom pages (claim arbiter)', () => {
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { matchMedia?: unknown }).matchMedia; // jsdom default: OS gate off
    store = installMemoryStore();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    // Drain pending dismiss + claim-timeout timers so they never leak into
    // the next test.
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

  it('plays the overlay when its claim wins a pending milestone at page open', async () => {
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

  it('claims through the background chain and never sends the popup clear message', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).toHaveBeenCalledTimes(1);
    const sendMessage = (chrome.runtime.sendMessage as any) as ReturnType<typeof vi.fn>;
    // The claim rides CQD_STATS_CLAIM_CELEBRATION with a response callback —
    // the ack channel the background's return-true listener keeps open.
    expect(sendMessage).toHaveBeenCalledWith(
      { type: CQD_STATS_CLAIM_CELEBRATION },
      expect.any(Function),
    );
    expect(claimCalls()).toBe(1);
    // The page never writes and never uses the popup-context clear path:
    // the claim itself cleared the record inside the background.
    expect(clearMessageCalls()).toBe(0);
    const cleared = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>;
    expect(cleared.milestonePending).toBeNull();
  });

  it('does not claim a pending the popup already cleared before page open', async () => {
    // The popup played first: the record carries no pending when the page
    // boots, so the watcher hint never fires and no claim is even sent.
    seedStats(store, statsRecord({ milestonePending: null }));
    await boot();
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    expect(claimCalls()).toBe(0);
  });

  it('does not play when its claim loses to the popup (claimed:false ack)', async () => {
    seedStats(
      store,
      statsRecord({ lifetimeCount: 37, milestonePending: null, lastMilestoneReached: null }),
    );
    await boot();
    expect(claimCalls()).toBe(0);

    // The popup's claim won at the arbiter in the window between the page's
    // watcher dispatch and the page's own claim: the watcher saw pending
    // set, but by the time the claim lands the record is cleared and the
    // arbiter answers an honest claimed:false. The page must not play.
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(
      (msg: { type?: string }, cb?: (res?: Record<string, unknown>) => void) => {
        if (msg?.type === CQD_STATS_CLAIM_CELEBRATION) {
          cb?.({ ok: true, claimed: false, milestone: null });
        }
      },
    );
    seedStats(
      store,
      statsRecord({ lifetimeCount: 100, milestonePending: 100, lastMilestoneReached: 100 }),
    );
    fireStatsChange();
    await flushTasks();

    expect(claimCalls()).toBe(1);
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    expect(clearMessageCalls()).toBe(0);
  });

  it('does not play or write when the claim never acks (dead MV3 channel)', async () => {
    seedStats(store, statsRecord());
    // A hostile channel: the message goes out, no ack ever comes back.
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(() => undefined);
    const setSpy = (chrome.storage.local.set as any) as ReturnType<typeof vi.fn>;
    const statsWrites = (): number =>
      setSpy.mock.calls.filter(
        (c: unknown[]) => DOWNLOAD_STATS_KEY in (c[0] as Record<string, unknown>),
      ).length;

    await boot();
    // No play before the claim timeout either.
    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    await vi.advanceTimersByTimeAsync(1500);
    await flushTasks(4);

    expect(burstFn).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
    // No local fallback write: the record keeps its pending value. (The
    // boot's own settings migration write touches settings keys only.)
    expect(statsWrites()).toBe(0);
    const after = store.get(DOWNLOAD_STATS_KEY) as Record<string, unknown>;
    expect(after.milestonePending).toBe(100);
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

  it('ignores duplicate storage re-fires of an already-cleared record', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(burstFn).toHaveBeenCalledTimes(1);
    // A duplicate onChanged dispatch for the same settle: the claim already
    // cleared the record, so the hint guard skips — no second claim, no
    // second play. One play per milestone is guaranteed by the arbiter,
    // not by page-local state.
    fireStatsChange();
    await flushTasks();
    expect(burstFn).toHaveBeenCalledTimes(1);
    expect(claimCalls()).toBe(1);
  });

  it('replaces the banner when a second milestone claims while one is up', async () => {
    seedStats(store, statsRecord());
    await boot();
    expect(banner()?.textContent).toContain('Level 3 reached — 100 files!');
    seedStats(
      store,
      statsRecord({ lifetimeCount: 250, milestonePending: 250, lastMilestoneReached: 250 }),
    );
    fireStatsChange();
    await flushTasks();
    const layers = document.querySelectorAll('.cqd-celebration-layer');
    expect(layers).toHaveLength(1);
    expect(banner()?.textContent).toContain('Level 4 reached — 250 files!');
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
