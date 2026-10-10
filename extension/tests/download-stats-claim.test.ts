// filepath: extension/tests/download-stats-claim.test.ts
/**
 * Celebration fix round — the background is the single atomic arbiter of
 * who plays a milestone. claimMilestonePending runs read-and-clear in ONE
 * turn of the serialized settle chain, so exactly one claimant wins a
 * pending value no matter how many surfaces (popup, Classroom page) ask at
 * once. Proofs here:
 *  - two concurrent claims + a concurrent clear: exactly one consumer wins,
 *    the record ends pending-null, and the count never reverts;
 *  - a claim racing a settle: the watcher fires only after the settle
 *    write, so claim-after-settle wins and claim-before-settle loses;
 *  - the real background listener answers { ok, claimed, milestone } and
 *    keeps the MV3 response channel open (return true);
 *  - claimMilestoneCelebration never writes locally: no channel and no ack
 *    both answer CLAIM_LOST with the record untouched;
 *  - requestMilestoneClear({ localFallback: false }) leaves the record
 *    untouched when no ack arrives (the content-script gate).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';
import {
  CQD_STATS_CLAIM_CELEBRATION,
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
  applyDownloadSettle,
  claimMilestoneCelebration,
  claimMilestonePending,
  clearMilestonePending,
  createEmptyStats,
  loadDownloadStats,
  requestMilestoneClear,
  saveDownloadStats,
} from '../src/history/download-stats';
import { computeChecksum } from '../src/history/history-store';

type Store = Map<string, unknown>;

describe('celebration claim protocol (fix round)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('two concurrent claims plus a concurrent clear produce exactly one winner', async () => {
    const store = installMemoryStore();
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);

    // Popup claim, page claim, and a plain clear all race for the same
    // pending rung. The chain serializes them; the pending value can be
    // consumed exactly once across the three.
    const [pageClaim, popupClaim, cleared] = await Promise.all([
      claimMilestonePending(),
      claimMilestonePending(),
      clearMilestonePending(),
    ]);

    const winners = [pageClaim, popupClaim].filter((m) => m !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toBe(1);
    // Whoever ran first consumed the rung: the later consumers see none.
    const { stats } = await loadDownloadStats();
    expect(stats.milestonePending).toBeNull();
    expect(stats.lifetimeCount).toBe(1);
    expect(stats.countedDownloadIds).toEqual(['req-1']);
    expect(cleared.milestonePending).toBeNull();
  });

  it('a claim racing a settle: after the settle write the claim wins, before it loses', async () => {
    const store = installMemoryStore();

    // Claim dispatched BEFORE the settle: nothing is pending yet, the claim
    // loses (the watcher will fire on the settle's write and claim then).
    const early = await claimMilestonePending();
    expect(early).toBeNull();

    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);
    const late = await claimMilestonePending();
    expect(late).toBe(1);
    const { stats } = await loadDownloadStats();
    expect(stats.milestonePending).toBeNull();
    expect(stats.lifetimeCount).toBe(1);
  });

  it('the real background handler claims once, then answers claimed:false, returning true', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
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
    (chrome.downloads as any).search = vi.fn(
      (_q: unknown, cb: (items?: Array<{ mime?: string; filename?: string }>) => void) =>
        cb([{ mime: 'application/pdf', filename: 'lecture.pdf' }]),
    );

    // A settle crosses milestone 1; the pending lands through the chain.
    h.requestDownload('https://drive.google.com/uc?id=c1', 'c-1');
    h.dispatchDownloadChange({ id: 1000, state: { current: 'complete' } });
    await vi.advanceTimersByTimeAsync(50);
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number }).milestonePending).toBe(
      1,
    );

    // Page claim first: wins, ack carries the rung, MV3 channel stays open.
    const firstResponse = vi.fn();
    const listeners = (chrome.runtime.onMessage.addListener as any).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    const returns = listeners.map(
      (listener: (m: unknown, s: unknown, r: (v: unknown) => void) => unknown) =>
        listener({ type: CQD_STATS_CLAIM_CELEBRATION }, { id: (chrome.runtime as { id?: string }).id }, firstResponse),
    );
    expect(returns).toContain(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(firstResponse).toHaveBeenCalledWith({ ok: true, claimed: true, milestone: 1 });
    expect((store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number | null }).milestonePending)
      .toBeNull();

    // Popup claim second, for the same value: honest loss, no second play.
    const secondResponse = vi.fn();
    for (const listener of listeners) {
      listener({ type: CQD_STATS_CLAIM_CELEBRATION }, { id: (chrome.runtime as { id?: string }).id }, secondResponse);
    }
    await vi.advanceTimersByTimeAsync(50);
    expect(secondResponse).toHaveBeenCalledWith({ ok: true, claimed: false, milestone: null });

    // The count survives the claims untouched.
    const final = store.get(DOWNLOAD_STATS_KEY) as { lifetimeCount: number };
    expect(final.lifetimeCount).toBe(1);
  });

  it('claimMilestoneCelebration without a messaging channel answers CLAIM_LOST and never writes', async () => {
    const store = installMemoryStore();
    const stats = applyDownloadSettle(createEmptyStats(), 'req-1').stats;
    await saveDownloadStats(stats);
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = undefined;
    const setSpy = chrome.storage.local.set as ReturnType<typeof vi.fn>;
    const writesBefore = setSpy.mock.calls.length;

    const claim = await claimMilestoneCelebration();

    expect(claim).toEqual({ ok: false, claimed: false, milestone: null });
    // No local fallback write: the record is byte-identical.
    expect(setSpy.mock.calls.length - writesBefore).toBe(0);
    const after = store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number };
    expect(after.milestonePending).toBe(1);
  });

  it('claimMilestoneCelebration with a silent background times out to CLAIM_LOST and never writes', async () => {
    const store = installMemoryStore();
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(() => undefined);
    const setSpy = chrome.storage.local.set as ReturnType<typeof vi.fn>;
    const writesBefore = setSpy.mock.calls.length;

    const pending = claimMilestoneCelebration();
    await vi.advanceTimersByTimeAsync(1500);
    const claim = await pending;

    expect(claim).toEqual({ ok: false, claimed: false, milestone: null });
    expect(setSpy.mock.calls.length - writesBefore).toBe(0);
    const after = store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number };
    expect(after.milestonePending).toBe(1);
  });

  it('claimMilestoneCelebration parses the ack and reports an honest loss', async () => {
    installMemoryStore();
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(
      (msg: { type?: string }, cb?: (res?: unknown) => void) => {
        expect(msg.type).toBe(CQD_STATS_CLAIM_CELEBRATION);
        cb?.({ ok: true, claimed: false, milestone: null });
      },
    );
    const claim = await claimMilestoneCelebration();
    expect(claim).toEqual({ ok: true, claimed: false, milestone: null });
  });

  it('requestMilestoneClear({ localFallback: false }) never writes when no ack arrives', async () => {
    const store = installMemoryStore();
    await saveDownloadStats(applyDownloadSettle(createEmptyStats(), 'req-1').stats);
    (chrome.runtime as { sendMessage?: unknown }).sendMessage = vi.fn(() => undefined);
    const setSpy = chrome.storage.local.set as ReturnType<typeof vi.fn>;
    const writesBefore = setSpy.mock.calls.length;

    const pending = requestMilestoneClear({ localFallback: false });
    await vi.advanceTimersByTimeAsync(1500);
    await pending;

    // The gate holds: no popup-context write, pending intact.
    expect(setSpy.mock.calls.length - writesBefore).toBe(0);
    const after = store.get(DOWNLOAD_STATS_KEY) as { milestonePending: number };
    expect(after.milestonePending).toBe(1);
    // Integrity key still matches the untouched record.
    expect(store.get(DOWNLOAD_STATS_INTEGRITY_KEY)).toBe(computeChecksum(JSON.stringify(after)));
  });
});
