// filepath: extension/tests/download-stats-legacy-seed.test.ts
/**
 * Owner-reported bug (2026-10-21): the lifetime counter behind levels and
 * confetti started at ZERO for every install updating from a pre-1.9.0
 * version — the stats record did not exist yet, so loadDownloadStats()
 * handed back a fresh zeroed record. A veteran with hundreds of downloads
 * saw level 0 and got "first file!" confetti on the next download.
 *
 * The fix seeds a MISSING (or unusable) record from the legacy analytics
 * counter (LocalStats.success — successful downloads since install) and
 * sets lastMilestoneReached to the highest rung already passed, with NO
 * pending celebration: history is acknowledged, not re-celebrated. An
 * existing valid record is never touched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyDownloadSettle,
  claimMilestonePending,
  countCompletedDownload,
  ensureDownloadStatsSeeded,
  levelFor,
  loadDownloadStats,
  saveDownloadStats,
  seedStatsFromLegacyCount,
  setLegacyLifetimeCountProvider,
} from '../src/history/download-stats';
import { loadStats } from '../entrypoints/utils/analytics/storage';
import { STORAGE_KEYS } from '../entrypoints/utils/analytics/constants';

/** In-memory stand-in for chrome.storage.local (the global setup mock is
 *  get/set-only with no state). Insertion order matches the write order, so
 *  the integrity checksum round-trips exactly like the shipped record. */
const statsStore = new Map<string, unknown>();

function installMemoryStorage(): void {
  (chrome.storage.local as { get: unknown }).get = vi.fn(
    (keys: string | string[], callback: (res: Record<string, unknown>) => void) => {
      const wanted = Array.isArray(keys) ? keys : [keys];
      const res: Record<string, unknown> = {};
      for (const key of wanted) {
        if (statsStore.has(key)) res[key] = statsStore.get(key);
      }
      callback(res);
    },
  );
  (chrome.storage.local as { set: unknown }).set = vi.fn(
    (items: Record<string, unknown>, callback?: () => void) => {
      for (const [key, value] of Object.entries(items)) statsStore.set(key, value);
      callback?.();
    },
  );
}

async function clearStatsStorage(): Promise<void> {
  statsStore.clear();
}

describe('seedStatsFromLegacyCount (pure)', () => {
  it('starts the lifetime count at the legacy total and marks the rungs already passed', () => {
    const stats = seedStatsFromLegacyCount(523);
    expect(stats.lifetimeCount).toBe(523);
    // Rungs ≤ 523: 1, 50, 100, 250, 500 → level 5, last reached 500.
    expect(stats.lastMilestoneReached).toBe(500);
    expect(levelFor(stats.lifetimeCount)).toBe(5);
    // History is acknowledged, not re-celebrated.
    expect(stats.milestonePending).toBeNull();
    expect(stats.countedDownloadIds).toEqual([]);
    expect(stats.installId).toBeTruthy();
  });

  it('a legacy count below the first rung is level 0 with no milestone', () => {
    const stats = seedStatsFromLegacyCount(0);
    expect(stats.lifetimeCount).toBe(0);
    expect(stats.lastMilestoneReached).toBeNull();
    expect(levelFor(0)).toBe(0);
  });

  it('sanitizes garbage to a zeroed seed', () => {
    expect(seedStatsFromLegacyCount(-7).lifetimeCount).toBe(0);
    expect(seedStatsFromLegacyCount(Number.NaN).lifetimeCount).toBe(0);
    expect(seedStatsFromLegacyCount(Number.POSITIVE_INFINITY).lifetimeCount).toBe(0);
    expect(seedStatsFromLegacyCount(12.9).lifetimeCount).toBe(12);
  });

  it('a seeded veteran does not re-cross old rungs on the next download', () => {
    const seeded = seedStatsFromLegacyCount(523);
    const settle = applyDownloadSettle(seeded, 'dl-1');
    expect(settle.changed).toBe(true);
    expect(settle.stats.lifetimeCount).toBe(524);
    expect(settle.crossed).toEqual([]);
    expect(settle.stats.milestonePending).toBeNull();
  });

  it('a seeded veteran still celebrates the NEXT rung when it arrives', () => {
    const seeded = seedStatsFromLegacyCount(999);
    const settle = applyDownloadSettle(seeded, 'dl-1');
    expect(settle.crossed).toEqual([1000]);
    expect(settle.stats.milestonePending).toBe(1000);
  });
});

describe('ensureDownloadStatsSeeded (serialized chain)', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    setLegacyLifetimeCountProvider(null);
    installMemoryStorage();
    await clearStatsStorage();
  });

  it('seeds a missing record from the provider and persists it with a valid checksum', async () => {
    setLegacyLifetimeCountProvider(async () => 523);

    const seeded = await ensureDownloadStatsSeeded();
    expect(seeded.lifetimeCount).toBe(523);

    const reloaded = await loadDownloadStats();
    expect(reloaded.valid).toBe(true);
    expect(reloaded.stats.lifetimeCount).toBe(523);
    expect(reloaded.stats.lastMilestoneReached).toBe(500);
    expect(reloaded.stats.milestonePending).toBeNull();
  });

  it('never touches an existing valid record, whatever the provider says', async () => {
    await saveDownloadStats({ ...seedStatsFromLegacyCount(7), installId: 'keep-me' });
    setLegacyLifetimeCountProvider(async () => 9999);

    const stats = await ensureDownloadStatsSeeded();
    expect(stats.lifetimeCount).toBe(7);
    expect(stats.installId).toBe('keep-me');
  });

  it('a fresh install (no provider) keeps the in-memory zero record and writes nothing', async () => {
    const stats = await ensureDownloadStatsSeeded();
    expect(stats.lifetimeCount).toBe(0);
    // Pre-seeding contract preserved: the first write happens on the first
    // settle, not at startup.
    expect((await loadDownloadStats()).valid).toBe(false);
  });

  it('falls back to the fresh-install contract when the provider throws', async () => {
    setLegacyLifetimeCountProvider(async () => {
      throw new Error('analytics storage unavailable');
    });
    const stats = await ensureDownloadStatsSeeded();
    expect(stats.lifetimeCount).toBe(0);
    expect((await loadDownloadStats()).valid).toBe(false);
  });

  it('the first settle on a veteran install counts from the seed, not from zero', async () => {
    setLegacyLifetimeCountProvider(async () => 523);

    const result = await countCompletedDownload('dl-1');
    expect(result.stats.lifetimeCount).toBe(524);
    expect(result.crossed).toEqual([]);
    expect(levelFor(result.stats.lifetimeCount)).toBe(5);
  });

  it('a claim right after seeding finds nothing to celebrate', async () => {
    setLegacyLifetimeCountProvider(async () => 523);
    expect(await claimMilestonePending()).toBeNull();
  });

  it('integration: the real analytics reader over the real local_stats key seeds the record', async () => {
    // This is the exact wiring from entrypoints/background/index.ts: the
    // provider reads LocalStats.success out of the analytics storage. The
    // whole path is real here — the legacy key, normalizeStats, the seed,
    // and the integrity-checked persistence.
    setLegacyLifetimeCountProvider(async () => (await loadStats()).success ?? 0);
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        { [STORAGE_KEYS.STATS]: { success: 523, total: 600, fail: 40, attempts: 650 } },
        () => resolve(),
      );
    });

    const seeded = await ensureDownloadStatsSeeded();
    expect(seeded.lifetimeCount).toBe(523);
    expect(seeded.lastMilestoneReached).toBe(500);
    expect(levelFor(seeded.lifetimeCount)).toBe(5);
  });
});
