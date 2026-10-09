/**
 * ============================================================================
 * LIFETIME DOWNLOAD STATS — cumulative counter + milestone ladder
 * (1.9.0 confetti feature, commit 1)
 * ============================================================================
 *
 * Checksummed like the history store (src/history/history-store.ts): corrupt
 * payloads sanitize to a fresh zeroed record — never crash, never block a
 * download settle. NOT a settings flat key: one record, one integrity key.
 *
 * Privacy posture: the count is LOCAL-only (chrome.storage.local). Nothing
 * here transmits; the dormant reporter (commit 4) reads installId +
 * lifetimeCount but is gated off by a constant that defaults to false.
 *
 * Idempotency: chrome.downloads.onChanged can fire 'complete' more than once
 * per download, and an MV3 service worker can restart between fires. The
 * record keeps a bounded ring of counted download ids (same dedupe key the
 * history store uses — the pending requestId), so one download increments the
 * lifetime count exactly once, across restarts.
 *
 * Milestones: on any settle the ladder is scanned for values in
 * (previousCount, newCount]. Crossing several in one batch (98→101 or a
 * large compacted jump) records ONLY the highest crossed milestone as
 * milestonePending — one celebration, not a barrage. The popup clears
 * milestonePending after playing (commit 2); clears never resurrect because
 * idempotency blocks re-counting the same download.
 */

import { computeChecksum } from './history-store';

export const DOWNLOAD_STATS_KEY = 'cqd_download_stats_v1';
export const DOWNLOAD_STATS_INTEGRITY_KEY = 'cqd_download_stats_integrity_v1';

/** Owner-approved ladder — do not reorder or extend without a decision. */
export const MILESTONE_LADDER: readonly number[] = [
  1, 50, 100, 250, 500, 1000, 5000, 10000, 50000, 100000, 250000, 500000, 1000000,
];

/**
 * Bounded ring of recently counted download ids. 500 mirrors HISTORY_CAP: an
 * MV3 restart replays at most recent onChanged events, and a replay older
 * than the window cannot inflate the count (the id would have to recur after
 * 500 newer settles).
 */
export const COUNTED_IDS_CAP = 500;

export interface DownloadStats {
  schemaVersion: 1;
  /** Stable per-install id (created once, lives with the record). */
  installId: string;
  lifetimeCount: number;
  /** Highest milestone ever crossed (celebrated or not). */
  lastMilestoneReached: number | null;
  /** Highest crossed milestone the popup has not celebrated yet. */
  milestonePending: number | null;
  countedDownloadIds: string[];
}

export interface SettleResult {
  stats: DownloadStats;
  /** Milestones crossed by this settle; empty for idempotent replays. */
  crossed: number[];
  /** False when the settle was a replay (no state change). */
  changed: boolean;
}

export function createEmptyStats(): DownloadStats {
  return {
    schemaVersion: 1,
    installId: makeInstallId(),
    lifetimeCount: 0,
    lastMilestoneReached: null,
    milestonePending: null,
    countedDownloadIds: [],
  };
}

function makeInstallId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (typeof c?.randomUUID === 'function') return c.randomUUID();
  } catch {
    // fall through to the manual id
  }
  return `cqd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Smallest ladder value strictly above count; null after the final rung. */
export function nextMilestone(count: number): number | null {
  for (const m of MILESTONE_LADDER) {
    if (m > count) return m;
  }
  return null;
}

/** Ladder values in the half-open window (prev, next]. */
export function milestonesCrossed(prev: number, next: number): number[] {
  if (!(next > prev)) return [];
  return MILESTONE_LADDER.filter((m) => m > prev && m <= next);
}

/**
 * Pure transaction: fold one completed download into the stats. Safe to call
 * on every 'complete' fire — the counted-id ring makes replays no-ops.
 */
export function applyDownloadSettle(
  stats: DownloadStats,
  downloadId: string,
): SettleResult {
  if (!downloadId || stats.countedDownloadIds.includes(downloadId)) {
    return { stats, crossed: [], changed: false };
  }
  const prevCount = stats.lifetimeCount;
  const newCount = prevCount + 1;
  const crossed = milestonesCrossed(prevCount, newCount);
  const highest = crossed.length > 0 ? crossed[crossed.length - 1] : null;
  const countedIds = [...stats.countedDownloadIds, downloadId];
  const next: DownloadStats = {
    ...stats,
    lifetimeCount: newCount,
    lastMilestoneReached: highest ?? stats.lastMilestoneReached,
    // One pending celebration, the highest rung crossed (a not-yet-played
    // lower pending is superseded by the higher one).
    milestonePending: highest ?? stats.milestonePending,
    countedDownloadIds:
      countedIds.length > COUNTED_IDS_CAP
        ? countedIds.slice(countedIds.length - COUNTED_IDS_CAP)
        : countedIds,
  };
  return { stats: next, crossed, changed: true };
}

// --- storage (same callback-shape guards as history-store.ts) ---

function storage(): chrome.storage.LocalStorageArea | undefined {
  return (globalThis as { chrome?: { storage?: { local?: chrome.storage.LocalStorageArea } } })
    .chrome?.storage?.local;
}

function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  const s = storage();
  return new Promise((resolve) => {
    if (!s) return resolve({});
    try {
      s.get(keys, (res) => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve((res ?? {}) as Record<string, unknown>);
      });
    } catch {
      resolve({});
    }
  });
}

function storageSet(kv: Record<string, unknown>): Promise<void> {
  const s = storage();
  return new Promise((resolve) => {
    if (!s) return resolve();
    try {
      s.set(kv, () => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/** Coerce an unknown stored payload into DownloadStats; null when unusable. */
export function sanitizeStats(raw: unknown): DownloadStats | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.lifetimeCount !== 'number' || !Number.isFinite(r.lifetimeCount)) return null;
  const ids = Array.isArray(r.countedDownloadIds)
    ? r.countedDownloadIds.filter((id): id is string => typeof id === 'string')
    : [];
  const milestone = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    schemaVersion: 1,
    installId: typeof r.installId === 'string' && r.installId ? r.installId : makeInstallId(),
    lifetimeCount: Math.max(0, Math.floor(r.lifetimeCount)),
    lastMilestoneReached: milestone(r.lastMilestoneReached),
    milestonePending: milestone(r.milestonePending),
    countedDownloadIds: ids.slice(Math.max(0, ids.length - COUNTED_IDS_CAP)),
  };
}

export async function loadDownloadStats(): Promise<{
  stats: DownloadStats;
  valid: boolean;
}> {
  const raw = await storageGet([DOWNLOAD_STATS_KEY, DOWNLOAD_STATS_INTEGRITY_KEY]);
  const checksum = raw[DOWNLOAD_STATS_INTEGRITY_KEY];
  if (raw[DOWNLOAD_STATS_KEY] === undefined) {
    return { stats: createEmptyStats(), valid: false };
  }
  const serialized = JSON.stringify(raw[DOWNLOAD_STATS_KEY]);
  if (checksum !== computeChecksum(serialized)) {
    return { stats: createEmptyStats(), valid: false };
  }
  const stats = sanitizeStats(raw[DOWNLOAD_STATS_KEY]);
  return stats
    ? { stats, valid: true }
    : { stats: createEmptyStats(), valid: false };
}

export async function saveDownloadStats(stats: DownloadStats): Promise<void> {
  await storageSet({
    [DOWNLOAD_STATS_KEY]: stats,
    [DOWNLOAD_STATS_INTEGRITY_KEY]: computeChecksum(JSON.stringify(stats)),
  });
}

// --- serialized orchestrators (one load→fold→save at a time; concurrent
// settles in a batch queue behind each other so no increment is lost) ---

let countChain: Promise<unknown> = Promise.resolve();

export async function countCompletedDownload(
  downloadId: string,
): Promise<SettleResult & { stats: DownloadStats }> {
  const run = countChain.then(async (): Promise<SettleResult & { stats: DownloadStats }> => {
    const { stats } = await loadDownloadStats();
    const result = applyDownloadSettle(stats, downloadId);
    if (result.changed) await saveDownloadStats(result.stats);
    return { ...result, stats: result.stats };
  });
  // Keep the chain alive even when a caller rejects: swallow here, return
  // the original promise to the caller.
  countChain = run.catch(() => undefined);
  return run;
}

export async function clearMilestonePending(): Promise<DownloadStats> {
  const run = countChain.then(async (): Promise<DownloadStats> => {
    const { stats } = await loadDownloadStats();
    if (stats.milestonePending === null) return stats;
    const next = { ...stats, milestonePending: null };
    await saveDownloadStats(next);
    return next;
  });
  countChain = run.catch(() => undefined);
  return run;
}
