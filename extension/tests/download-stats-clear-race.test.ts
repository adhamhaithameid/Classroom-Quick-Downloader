// filepath: extension/tests/download-stats-clear-race.test.ts
/**
 * Fix round 1 (Important) — the stats record has ONE writer: the background
 * service worker's serialized settle chain. The popup's milestone clear must
 * ride a CQD_STATS_CLEAR_MILESTONE message into that chain; a clear that
 * load-then-set in the popup context could revert a settle saving in
 * flight (lost update during batch storms with the popup open).
 *
 * Proofs here:
 *  - ordered async storage handlers + an interleave of settle/clear/settle
 *    never produce a stale or descending write;
 *  - requestMilestoneClear sends the message and does not write stats
 *    directly when the background acks;
 *  - the fallback (no messaging channel) still clears locally;
 *  - end-to-end: the REAL background listener handles the message while a
 *    settle is interleaved, and a later settle keeps counting (no revert).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';
import {
  CQD_STATS_CLEAR_MILESTONE,
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
  applyDownloadSettle,
  clearMilestonePending,
  countCompletedDownload,
  createEmptyStats,
  loadDownloadStats,
  requestMilestoneClear,
  saveDownloadStats,
} from '../src/history/download-stats';

type Store = Map<string, unknown>;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('stats clear race (fix round 1, Important)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('interleaved settle/clear/settle with gated storage never loses an update', async () => {
    const store: Store = new Map();
    const gates: Deferred[] = [];
    const setCalls: Array<Record<string, unknown>> = [];
    (chrome.storage.local.get as any) = vi.fn(
      (keys: string[], cb: (r: Record<string, unknown>) => void) => {
        const gate = deferred();
        gates.push(gate);
        void gate.promise.then(() => {
          const out: Record<string, unknown> = {};
          for (const k of keys) if (store.has(k)) out[k] = store.get(k);
          cb(out);
        });
      },
    );
    (chrome.storage.local.set as any) = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
      setCalls.push(kv);
      for (const [k, v] of Object.entries(kv)) store.set(k, v);
      cb?.();
    });

    // Dispatch order: settle (crosses milestone 1), clear, settle. Every
    // storage read is gated; the chain must serialize them regardless.
    const s1 = countCompletedDownload('x');
    const c = clearMilestonePending();
    const s2 = countCompletedDownload('y');

    // Release the gated reads one at a time, in dispatch order: s1 load,
    // clear load, s2 load. Each release drains enough microtasks for the
    // chain to reach its next read.
    const releaseNextGet = async (): Promise<void> => {
      for (let i = 0; i < 200 && gates.length === 0; i++) await Promise.resolve();
      const gate = gates.shift();
      if (!gate) return;
      gate.resolve();
      for (let i = 0; i < 20; i++) await Promise.resolve();
    };
    await releaseNextGet();
    await releaseNextGet();
    await releaseNextGet();
    const [r1, rc, r2] = await Promise.all([s1, c, s2]);

    expect(r1.stats.lifetimeCount).toBe(1);
    expect(r1.crossed).toEqual([1]);
    expect(rc.milestonePending).toBeNull();
    expect(r2.stats.lifetimeCount).toBe(2);

    // Every persisted count is monotonically non-decreasing — a stale write
    // (revert of the count or a dropped ring id) would break this.
    const counts = setCalls
      .filter((kv) => DOWNLOAD_STATS_KEY in kv)
      .map((kv) => (kv[DOWNLOAD_STATS_KEY] as { lifetimeCount: number }).lifetimeCount);
    expect(counts).toEqual([1, 1, 2]);
    const final = store.get(DOWNLOAD_STATS_KEY) as { countedDownloadIds: string[] };
    expect(final.countedDownloadIds).toEqual(expect.arrayContaining(['x', 'y']));
  });

  it('requestMilestoneClear routes through the background message, not a direct write', async () => {
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
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);

    // Simulated background: ack the message and do the chained clear itself.
    const sendMessage = vi.fn(
      (msg: { type?: string }, cb?: (res?: { ok?: boolean }) => void) => {
        expect(msg.type).toBe(CQD_STATS_CLEAR_MILESTONE);
        void clearMilestonePending().then(() => cb?.({ ok: true }));
      },
    );
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = sendMessage;

    const setSpy = chrome.storage.local.set as ReturnType<typeof vi.fn>;
    // The setup save above is the only write before the clear request.
    const writesBefore = setSpy.mock.calls.length;
    await requestMilestoneClear();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    // The popup itself made NO stats write — the one new write is the
    // simulated background's, not a popup-context write.
    expect(setSpy.mock.calls.length - writesBefore).toBe(1);
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBeNull();
  });

  it('falls back to the local chain when no message ack arrives', async () => {
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
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);

    // A channel that never acks (hostile or missing background).
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(() => undefined);

    // Fake timers: the ack timeout only fires when the clock advances.
    const pending = requestMilestoneClear();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(50);
    await pending;

    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBeNull();
  });

  it('works with no messaging channel at all (plain local clear)', async () => {
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
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = undefined;

    await requestMilestoneClear();
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBeNull();
    const { stats } = await loadDownloadStats();
    expect(stats.lifetimeCount).toBe(1);
  });

  it('end-to-end: the real background handles the clear while settles interleave', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    const store: Store = new Map();
    const setCalls: Array<Record<string, unknown>> = [];
    (chrome.storage.local.get as any) = vi.fn(
      (keys: string[], cb: (r: Record<string, unknown>) => void) => {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
        cb(out);
      },
    );
    (chrome.storage.local.set as any) = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
      setCalls.push(kv);
      for (const [k, v] of Object.entries(kv)) store.set(k, v);
      cb?.();
    });
    (chrome.downloads as any).search = vi.fn(
      (_q: unknown, cb: (items?: Array<{ mime?: string; filename?: string; totalBytes?: number; bytesReceived?: number }>) => void) =>
        cb([{ mime: 'application/pdf', filename: 'lecture.pdf', totalBytes: 500, bytesReceived: 500 }]),
    );

    const complete = (id: number) => ({ id, state: { current: 'complete' } });

    // Settle 1: crosses milestone 1, pending set by the background chain.
    h.requestDownload('https://drive.google.com/uc?id=c1', 'c-1');
    h.dispatchDownloadChange(complete(1000));
    await vi.advanceTimersByTimeAsync(50);
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBe(1);

    // The clear rides the REAL listener while the chain is live.
    h.dispatchMessage({ type: CQD_STATS_CLEAR_MILESTONE });
    await vi.advanceTimersByTimeAsync(50);
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBeNull();

    // Settle 2 after the clear: count keeps rising, nothing reverts.
    h.requestDownload('https://drive.google.com/uc?id=c2', 'c-2');
    h.dispatchDownloadChange(complete(1001));
    await vi.advanceTimersByTimeAsync(50);

    const final = store.get(DOWNLOAD_STATS_KEY) as {
      lifetimeCount: number;
      milestonePending: number | null;
      countedDownloadIds: string[];
    };
    expect(final.lifetimeCount).toBe(2);
    expect(final.milestonePending).toBeNull();
    expect(final.countedDownloadIds).toEqual(expect.arrayContaining(['c-1', 'c-2']));

    // Every persisted count is monotone — no stale write ever landed.
    const counts = setCalls
      .filter((kv) => DOWNLOAD_STATS_KEY in kv)
      .map((kv) => (kv[DOWNLOAD_STATS_KEY] as { lifetimeCount: number }).lifetimeCount);
    expect(counts).toEqual([1, 1, 2]);
  });
});
