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
  1, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 75000,
  100000, 250000, 500000, 750000, 1000000,
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

/**
 * Owner-reported bug (2026-10-21): the counter behind levels and confetti
 * used to START AT ZERO for every install updating from a pre-1.9.0
 * version — the record did not exist, so a veteran with hundreds of
 * downloads saw level 0 and got "first file!" confetti. A fresh record is
 * now seeded from the legacy analytics counter (LocalStats.success —
 * successful downloads since install) so levels and the ladder begin from
 * the real history.
 *
 * Seeding semantics: history is ACKNOWLEDGED, not re-celebrated. The count
 * starts at the legacy total, lastMilestoneReached marks the highest rung
 * already passed, and milestonePending stays null — the next celebration is
 * the NEXT rung the user actually crosses.
 *
 * Layering: the legacy counter lives in the entrypoints' analytics storage,
 * which pure src/ must not import, so the background registers a provider
 * (setLegacyLifetimeCountProvider) and every chain operation seeds through
 * ensureDownloadStatsSeeded when the record is missing or unusable.
 */
export function seedStatsFromLegacyCount(legacyCount: number): DownloadStats {
  const safeCount =
    Number.isFinite(legacyCount) && legacyCount > 0 ? Math.floor(legacyCount) : 0;
  const stats = createEmptyStats();
  stats.lifetimeCount = safeCount;
  stats.lastMilestoneReached = highestRungAtOrBelow(safeCount);
  return stats;
}

/** Highest ladder value at or below count; null when count is below rung 1. */
function highestRungAtOrBelow(count: number): number | null {
  let highest: number | null = null;
  for (const rung of MILESTONE_LADDER) {
    if (rung > count) break;
    highest = rung;
  }
  return highest;
}

let legacyLifetimeCountProvider: (() => Promise<number>) | null = null;

/**
 * Register the legacy lifetime-count reader. The background service worker
 * calls this once at startup with the analytics storage reader; tests pass
 * their own (or null to fall back to zero).
 */
export function setLegacyLifetimeCountProvider(
  provider: (() => Promise<number>) | null,
): void {
  legacyLifetimeCountProvider = provider;
}

async function readLegacyLifetimeCount(): Promise<number> {
  if (!legacyLifetimeCountProvider) return 0;
  try {
    return await legacyLifetimeCountProvider();
  } catch {
    return 0;
  }
}

/**
 * Load the stats record, seeding it from the legacy counter when it is
 * missing or unusable (first run after the update, storage corruption). A
 * seed with real history is persisted immediately so the popup and every
 * later read — through any context — see the same acknowledged count; a
 * zero legacy count keeps the fresh-install contract (no startup write). Runs on the
 * serialized chain via the chain operations; call it once at service-worker
 * startup too (ensureDownloadStatsSeeded from the background) so the popup
 * sees the real count before the first download settles.
 */
export async function ensureDownloadStatsSeeded(): Promise<DownloadStats> {
  const run = countChain.then(() => loadOrSeedDownloadStats());
  countChain = run.catch(() => undefined);
  return run;
}

/**
 * The unchained load-or-seed. ONLY for callers that already hold a turn of
 * the serialized chain (the chain operations below) — queueing a second
 * turn from inside one deadlocks, since the inner turn waits for the outer.
 */
async function loadOrSeedDownloadStats(): Promise<DownloadStats> {
  const { stats, valid } = await loadDownloadStats();
  if (valid) return stats;
  const legacyCount = await readLegacyLifetimeCount();
  // Nothing to acknowledge: a fresh install keeps the pre-seeding contract
  // (in-memory zero record, first write on the first settle) — no extra
  // storage write for the common case.
  if (!(legacyCount > 0)) return stats;
  const seeded = seedStatsFromLegacyCount(legacyCount);
  await saveDownloadStats(seeded);
  return seeded;
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

/**
 * User level derived from the lifetime count — no extra storage. Level 0 is
 * the fresh-install state (below the first rung); level N means the Nth
 * ladder rung has been reached (1 file → level 1 … 1,000,000 files →
 * level 18). Counts only ever grow, so levels never decrease. Non-finite or
 * negative inputs sanitize to 0: garbage never inflates the level.
 */
export function levelFor(lifetimeCount: number): number {
  if (!Number.isFinite(lifetimeCount) || lifetimeCount < MILESTONE_LADDER[0]) return 0;
  let level = 0;
  for (const rung of MILESTONE_LADDER) {
    if (rung > lifetimeCount) break;
    level += 1;
  }
  return level;
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
    const stats = await loadOrSeedDownloadStats();
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
    const stats = await loadOrSeedDownloadStats();
    if (stats.milestonePending === null) return stats;
    const next = { ...stats, milestonePending: null };
    await saveDownloadStats(next);
    return next;
  });
  countChain = run.catch(() => undefined);
  return run;
}

/**
 * Fix round 1 — atomic celebration claim. Read-and-clear pending in ONE
 * turn of the serialized settle chain: the first surface to claim wins and
 * receives the rung; every later claim answers null. There is no window
 * where two surfaces both read a set pending — the chain serializes the
 * claim against settles and clears alike.
 *
 * Returns the claimed rung, or null when nothing was pending. A false
 * return (chain rejection) must be treated as "not claimed".
 */
export async function claimMilestonePending(): Promise<number | null> {
  const run = countChain.then(async (): Promise<number | null> => {
    const stats = await loadOrSeedDownloadStats();
    if (stats.milestonePending === null) return null;
    const claimed = stats.milestonePending;
    const next = { ...stats, milestonePending: null };
    await saveDownloadStats(next);
    return claimed;
  });
  countChain = run.catch(() => undefined);
  return run;
}

/**
 * Message type a celebration surface (popup OR the Classroom page) sends to
 * claim the pending milestone. The background answers
 * { ok: true, claimed, milestone } after running claimMilestonePending on
 * the serialized chain — the single atomic arbiter of who plays.
 */
export const CQD_STATS_CLAIM_CELEBRATION = 'CQD_STATS_CLAIM_CELEBRATION';

export interface MilestoneClaimResult {
  /** True when the background acked at all (false: no channel or timeout). */
  ok: boolean;
  /** True when this surface's claim won the pending milestone. */
  claimed: boolean;
  /** The claimed rung (valid only when claimed). */
  milestone: number | null;
}

const CLAIM_ACK_TIMEOUT_MS = 1500;

const CLAIM_LOST: MilestoneClaimResult = { ok: false, claimed: false, milestone: null };

/**
 * Surface-side claim: ask the background to atomically claim-and-clear the
 * pending milestone. ONLY a { ok, claimed: true } answer may play — a lost
 * ack (no messaging channel, hostile background, timeout) means NO play and
 * NO local write: playing unclaimed risks a double celebration, and a
 * content-script fallback write would violate the one-writer record rule.
 * A celebration missed on a dead channel replays on the next surface open.
 */
export async function claimMilestoneCelebration(): Promise<MilestoneClaimResult> {
  const chromeRef = globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (msg: unknown, cb: (res?: MilestoneClaimResult) => void) => void;
        lastError?: unknown;
      };
    };
  };
  const sendMessage = chromeRef.chrome?.runtime?.sendMessage;
  if (typeof sendMessage !== 'function') return CLAIM_LOST;
  return new Promise<MilestoneClaimResult>((resolve) => {
    let settled = false;
    const finish = (value: MilestoneClaimResult): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(CLAIM_LOST), CLAIM_ACK_TIMEOUT_MS);
    try {
      sendMessage({ type: CQD_STATS_CLAIM_CELEBRATION }, (res?: MilestoneClaimResult) => {
        void chromeRef.chrome?.runtime?.lastError;
        clearTimeout(timer);
        finish({
          ok: res?.ok === true,
          claimed: res?.ok === true && res?.claimed === true,
          milestone: res?.ok === true && res?.claimed === true ? (res.milestone ?? null) : null,
        });
      });
    } catch {
      clearTimeout(timer);
      finish(CLAIM_LOST);
    }
  });
}

/**
 * Message type the popup sends to clear a milestone pending. Every stats
 * write lives in the background service worker's serialized settle chain —
 * a popup-context load-then-set could revert a settle saving in flight
 * (lost update during batch storms with the popup open).
 *
 * Fix round 1: the celebration surfaces now CLAIM instead (see
 * claimMilestoneCelebration). This clear path remains for callers that
 * already know a milestone played and want the record tidied; its
 * ack-timeout fallback writes the record from the CALLING context, so it
 * must never be called from a content script — gate the fallback off there
 * (localFallback: false). The page never writes the record.
 */
export const CQD_STATS_CLEAR_MILESTONE = 'CQD_STATS_CLEAR_MILESTONE';

const CLEAR_ACK_TIMEOUT_MS = 1500;

/**
 * Popup-side clear: ask the background to clear the pending flag on the
 * serialized chain. Falls back to the local chain only when no messaging
 * channel exists (tests, non-extension contexts) or the background never
 * acks — the record then behaves exactly as before fix round 1. The
 * fallback is a POPUP-context resilience net: callers outside the
 * extension pages must pass { localFallback: false } (a content-script
 * write would race the chain the fallback exists to protect).
 */
export async function requestMilestoneClear(
  opts: { localFallback?: boolean } = {},
): Promise<void> {
  const localFallback = opts.localFallback !== false;
  const chromeRef = globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (msg: unknown, cb: (res?: { ok?: boolean }) => void) => void;
        lastError?: unknown;
      };
    };
  };
  const sendMessage = chromeRef.chrome?.runtime?.sendMessage;
  if (typeof sendMessage !== 'function') {
    if (localFallback) await clearMilestonePending();
    return;
  }
  const acked = await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), CLEAR_ACK_TIMEOUT_MS);
    try {
      sendMessage({ type: CQD_STATS_CLEAR_MILESTONE }, (res?: { ok?: boolean }) => {
        void chromeRef.chrome?.runtime?.lastError;
        clearTimeout(timer);
        finish(res?.ok === true);
      });
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
  if (!acked && localFallback) await clearMilestonePending();
}

/**
 * Subscribe to stats-record changes (storage.onChanged, our key only).
 * The callback re-reads through the checksummed load path — newValue is
 * never trusted raw. Returns the unsubscribe fn.
 */
export function watchDownloadStats(cb: (stats: DownloadStats) => void): () => void {
  const onChanged = (
    globalThis as {
      chrome?: {
        storage?: {
          onChanged?: {
            addListener: (l: unknown) => void;
            removeListener: (l: unknown) => void;
          };
        };
      };
    }
  ).chrome?.storage?.onChanged;
  if (!onChanged) return () => {};
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area !== 'local' || !(DOWNLOAD_STATS_KEY in changes)) return;
    void loadDownloadStats().then(({ stats }) => cb(stats));
  };
  onChanged.addListener(listener);
  return () => onChanged.removeListener(listener);
}

// --- presentation formatting (shared by the toast and the tracker card) ---

const compactFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Compact notation for big counts ("1M"), grouped digits below 10,000
 * ("5,000"), plain digits below that ("37") — the tracker reads naturally
 * at every rung of the ladder.
 */
export function formatMilestoneCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0';
  return count >= 10000 ? compactFormat.format(count) : count.toLocaleString('en-US');
}
