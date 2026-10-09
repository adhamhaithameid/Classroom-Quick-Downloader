// filepath: extension/tests/download-stats.test.ts
/**
 * 1.9.0 confetti, commit 1 — the lifetime download counter. Contract:
 * one increment per download id (onChanged can re-fire, MV3 restarts happen),
 * milestone crossings detected in the same transaction, batch crossings
 * record only the highest rung, and a cleared pending never resurrects.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COUNTED_IDS_CAP,
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
  MILESTONE_LADDER,
  applyDownloadSettle,
  clearMilestonePending,
  countCompletedDownload,
  createEmptyStats,
  levelFor,
  loadDownloadStats,
  milestonesCrossed,
  nextMilestone,
  sanitizeStats,
  saveDownloadStats,
} from '../src/history/download-stats';
import { computeChecksum } from '../src/history/history-store';

type Store = Map<string, unknown>;

/** In-memory chrome.storage.local backed by a real map (persistence honest). */
function installMemoryStore(initial?: Store): Store {
  const store: Store = initial ?? new Map();
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

function seedStoreWith(stats: ReturnType<typeof createEmptyStats>): Store {
  return new Map<string, unknown>([
    [DOWNLOAD_STATS_KEY, stats],
    [DOWNLOAD_STATS_INTEGRITY_KEY, computeChecksum(JSON.stringify(stats))],
  ]);
}

describe('milestone ladder helpers', () => {
  it('exposes the owner-approved ladder', () => {
    expect(MILESTONE_LADDER).toEqual([
      1, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 75000,
      100000, 250000, 500000, 750000, 1000000,
    ]);
  });

  it('nextMilestone walks upward and returns null past the final rung', () => {
    expect(nextMilestone(0)).toBe(1);
    expect(nextMilestone(37)).toBe(50);
    expect(nextMilestone(100)).toBe(250);
    expect(nextMilestone(1_000_000)).toBeNull();
  });

  it('milestonesCrossed scans the (prev, next] window', () => {
    expect(milestonesCrossed(0, 1)).toEqual([1]);
    expect(milestonesCrossed(99, 100)).toEqual([100]);
    expect(milestonesCrossed(100, 101)).toEqual([]);
    expect(milestonesCrossed(40, 260)).toEqual([50, 100, 250]);
    expect(milestonesCrossed(5, 5)).toEqual([]);
  });
});

describe('user levels derived from the ladder (levels feature)', () => {
  it('starts at level 0 below the first rung', () => {
    expect(levelFor(0)).toBe(0);
  });

  it('maps each exact rung to its level (Nth rung = level N)', () => {
    MILESTONE_LADDER.forEach((rung, index) => {
      expect(levelFor(rung)).toBe(index + 1);
    });
    expect(levelFor(1)).toBe(1);
    expect(levelFor(1_000_000)).toBe(18);
  });

  it('stays at the lower level between rungs', () => {
    expect(levelFor(2)).toBe(1);
    expect(levelFor(49)).toBe(1);
    expect(levelFor(63)).toBe(2);
    expect(levelFor(999)).toBe(5);
    expect(levelFor(999_999)).toBe(17);
  });

  it('never passes level 18 past the final rung', () => {
    expect(levelFor(1_000_001)).toBe(18);
    expect(levelFor(12_345_678)).toBe(18);
  });

  it('treats non-finite and negative counts as level 0 (garbage never inflates)', () => {
    expect(levelFor(-5)).toBe(0);
    expect(levelFor(Number.NaN)).toBe(0);
    expect(levelFor(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('lifetime download counter (1.9.0 commit 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installMemoryStore();
  });

  it('increments once per download id — replays are no-ops', () => {
    let stats = createEmptyStats();
    stats = applyDownloadSettle(stats, 'req-1').stats;
    expect(stats.lifetimeCount).toBe(1);
    const replay = applyDownloadSettle(stats, 'req-1');
    expect(replay.changed).toBe(false);
    expect(replay.crossed).toEqual([]);
    expect(replay.stats.lifetimeCount).toBe(1);
    stats = replay.stats;
    stats = applyDownloadSettle(stats, 'req-2').stats;
    expect(stats.lifetimeCount).toBe(2);
  });

  it('blank or missing ids never count', () => {
    let stats = createEmptyStats();
    stats = applyDownloadSettle(stats, '').stats;
    expect(stats.lifetimeCount).toBe(0);
    expect(stats.countedDownloadIds).toEqual([]);
  });

  it('detects exact-boundary hits and keeps highest-crossed pending', () => {
    let stats = createEmptyStats();
    stats = applyDownloadSettle(stats, 'a').stats; // 0→1 crosses 1
    expect(stats.milestonePending).toBe(1);
    expect(stats.lastMilestoneReached).toBe(1);

    // 49→50 crosses 50 only.
    while (stats.lifetimeCount < 49) stats = applyDownloadSettle(stats, `pre-${stats.lifetimeCount}`).stats;
    const boundary = applyDownloadSettle(stats, 'b');
    expect(boundary.crossed).toEqual([50]);
    expect(boundary.stats.milestonePending).toBe(50);
  });

  it('a batch crossing several rungs records ONLY the highest as pending', () => {
    let stats = createEmptyStats();
    // Drive to 48, then fold a compacted jump of 52 (48→100? no: 48→52 count
    // is one settle = +1; simulate the jump by seeding the count directly —
    // compaction can hand the recorder a big batch, one settle each, but the
    // pure fold covers the window scan for any (prev, next]).
    stats = { ...stats, lifetimeCount: 48 };
    for (let i = 0; i < 52; i++) {
      stats = applyDownloadSettle(stats, `batch-${i}`).stats;
    }
    expect(stats.lifetimeCount).toBe(100);
    expect(stats.lastMilestoneReached).toBe(100);
    // Highest pending — not 1, not 50.
    expect(stats.milestonePending).toBe(100);
  });

  it('survives an MV3 restart: persisted ring blocks re-count after reload', async () => {
    const store = installMemoryStore();
    await countCompletedDownload('req-1');
    await countCompletedDownload('req-2');
    expect((store.get(DOWNLOAD_STATS_KEY) as { lifetimeCount: number }).lifetimeCount).toBe(2);

    // "Restart": fresh module-level read from the same storage.
    const { stats, valid } = await loadDownloadStats();
    expect(valid).toBe(true);
    expect(stats.lifetimeCount).toBe(2);
    const again = applyDownloadSettle(stats, 'req-1');
    expect(again.changed).toBe(false);
    expect(again.stats.lifetimeCount).toBe(2);
  });

  it('no double celebration: cleared pending stays cleared on re-fire', async () => {
    installMemoryStore();
    const first = await countCompletedDownload('req-1');
    expect(first.crossed).toEqual([1]);
    expect(first.stats.milestonePending).toBe(1);

    // Popup played; pending cleared.
    const cleared = await clearMilestonePending();
    expect(cleared.milestonePending).toBeNull();

    // The same download re-fires (onChanged duplicate).
    const replay = await countCompletedDownload('req-1');
    expect(replay.changed).toBe(false);
    expect(replay.crossed).toEqual([]);
    expect(replay.stats.milestonePending).toBeNull();

    // A new non-milestone download does not resurrect it either.
    const next = await countCompletedDownload('req-2');
    expect(next.crossed).toEqual([]);
    expect(next.stats.milestonePending).toBeNull();
  });

  it('a higher crossing supersedes an unplayed lower pending', () => {
    let stats = createEmptyStats();
    stats = applyDownloadSettle(stats, 'first').stats; // pending 1
    // Cross 50 and 100 before the popup played rung 1: highest wins.
    stats = { ...stats, lifetimeCount: 99 };
    stats = applyDownloadSettle(stats, 'big').stats;
    expect(stats.milestonePending).toBe(100);
    expect(stats.lastMilestoneReached).toBe(100);
  });

  it('countCompletedDownload serializes concurrent settles (no lost increments)', async () => {
    installMemoryStore();
    const settles = Array.from({ length: 25 }, (_, i) => countCompletedDownload(`par-${i}`));
    const results = await Promise.all(settles);
    const { stats } = await loadDownloadStats();
    expect(stats.lifetimeCount).toBe(25);
    expect(results.every((r) => r.changed)).toBe(true);
  });

  it('keeps the counted-id ring bounded at COUNTED_IDS_CAP', () => {
    let stats = createEmptyStats();
    for (let i = 0; i < COUNTED_IDS_CAP + 25; i++) {
      stats = applyDownloadSettle(stats, `id-${i}`).stats;
    }
    expect(stats.lifetimeCount).toBe(COUNTED_IDS_CAP + 25);
    expect(stats.countedDownloadIds).toHaveLength(COUNTED_IDS_CAP);
    // Newest ids survive the trim.
    expect(stats.countedDownloadIds.includes(`id-${COUNTED_IDS_CAP + 24}`)).toBe(true);
    expect(stats.countedDownloadIds.includes('id-0')).toBe(false);
  });

  it('round-trips through storage with the checksum and rejects tampering', async () => {
    const store = installMemoryStore();
    const stats = createEmptyStats();
    await saveDownloadStats(applyDownloadSettle(stats, 'req-1').stats);
    expect(store.get(DOWNLOAD_STATS_INTEGRITY_KEY)).toBe(
      computeChecksum(JSON.stringify(store.get(DOWNLOAD_STATS_KEY))),
    );
    const ok = await loadDownloadStats();
    expect(ok.valid).toBe(true);
    expect(ok.stats.lifetimeCount).toBe(1);

    // Tamper with the payload: integrity fails, record sanitizes to empty.
    store.set(DOWNLOAD_STATS_KEY, { ...stats, lifetimeCount: 999 });
    const bad = await loadDownloadStats();
    expect(bad.valid).toBe(false);
    expect(bad.stats.lifetimeCount).toBe(0);
  });

  it('sanitizeStats coerces partial payloads and trims the id ring', () => {
    const partial = sanitizeStats({ lifetimeCount: 10.7, countedDownloadIds: ['x', 5, null] });
    expect(partial).toMatchObject({
      schemaVersion: 1,
      lifetimeCount: 10,
      lastMilestoneReached: null,
      milestonePending: null,
      countedDownloadIds: ['x'],
    });
    expect(sanitizeStats('junk')).toBeNull();
    expect(sanitizeStats(null)).toBeNull();
    expect(sanitizeStats({ countedDownloadIds: [] })).toBeNull(); // no lifetimeCount
  });
});
