// filepath: extension/entrypoints/utils/analytics/flush.ts
/**
 * Analytics flush logic - sending batches to Cloudflare Worker.
 */

import type { AnalyticsEvent, AnalyticsConfig, AnalyticsMeta, FlushResult } from './types';
import { TRACK_URL, BACKOFF_STEPS_SECONDS, DEFAULT_CONFIG } from './constants';
import {
  loadQueue,
  saveQueue,
  loadConfig,
  loadMeta,
  saveMeta,
  loadStats,
  saveStats,
} from './storage';
import { checkAndIncrementRateLimit } from './rate-limiter';
import { bucketDuration, generateEventId } from './detection';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const OVERFLOW_QUEUE_THRESHOLD = 500;
const OVERFLOW_BATCH_SIZE = 500;
const DEFAULT_MAX_EVENTS_PER_REQUEST = 5000;
const MAX_DAILY_WINDOW_MINUTES = 24 * 60;
const WEEKLY_JITTER_MINUTES = 120;
const MAX_WEEKLY_POSTS_PER_TICK = 10;
// Conservative ceiling for chrome.runtime.setUninstallURL; keep the URL well
// under browser limits by dropping the optional stats params first.
const MAX_UNINSTALL_URL_LENGTH = 500;

/**
 * Coerce a stat counter into a compact non-negative integer string.
 * undefined/NaN → '0'; negatives → '0'; floats → floored.
 */
export function normalizeCountParam(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return String(Math.max(0, Math.floor(value)));
}

/**
 * Compact download totals for the uninstall URL: `d` (successful+failed
 * downloads) and `a` (attempts). Pure — no chrome access, so the browser
 * passes its loaded stats in.
 */
export function buildUninstallStatsParams(stats: { total?: number; attempts?: number }): URLSearchParams {
  const params = new URLSearchParams();
  params.set('d', normalizeCountParam(stats?.total));
  params.set('a', normalizeCountParam(stats?.attempts));
  return params;
}

export interface UninstallUrlOptions {
  source: string;
  browser: string;
  version: string;
  stats?: { total?: number; attempts?: number };
}

/**
 * Assemble the full uninstall URL. If the final URL exceeds
 * MAX_UNINSTALL_URL_LENGTH, the optional d/a stats params are dropped and the
 * URL is retried — source/browser/version always survive.
 */
export function buildUninstallUrl(base: string, opts: UninstallUrlOptions): string {
  const url = new URL(base);
  url.searchParams.set('source', opts.source);
  url.searchParams.set('browser', opts.browser);
  url.searchParams.set('version', opts.version);

  const statsParams = buildUninstallStatsParams(opts.stats ?? {});
  for (const [key, value] of statsParams.entries()) {
    url.searchParams.set(key, value);
  }

  if (url.toString().length > MAX_UNINSTALL_URL_LENGTH) {
    url.searchParams.delete('d');
    url.searchParams.delete('a');
  }
  return url.toString();
}

function getRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % maxExclusive;
  } catch {
    return Math.floor(Math.random() * maxExclusive);
  }
}

export function getSafeUtcNowMs(meta: AnalyticsMeta): { nowMs: number; meta: AnalyticsMeta; changed: boolean } {
  const serverOffset = typeof meta.serverTimeOffsetMs === 'number' && Number.isFinite(meta.serverTimeOffsetMs)
    ? meta.serverTimeOffsetMs
    : 0;
  const rawNow = Date.now();
  const now = Number.isFinite(rawNow) ? rawNow + serverOffset : rawNow;
  let updated = meta;
  let changed = false;
  if (Number.isFinite(now)) {
    const perf = typeof performance !== 'undefined' && Number.isFinite(performance.now())
      ? performance.now()
      : null;
    updated = {
      ...meta,
      lastKnownUtcMs: now,
      lastPerfMs: perf ?? meta.lastPerfMs ?? null,
    };
    changed = true;
    return { nowMs: now, meta: updated, changed };
  }

  const perfNow = typeof performance !== 'undefined' && Number.isFinite(performance.now())
    ? performance.now()
    : null;
  if (meta.lastKnownUtcMs != null && meta.lastPerfMs != null && perfNow != null) {
    const delta = perfNow - meta.lastPerfMs;
    const fallbackNow = meta.lastKnownUtcMs + delta;
    updated = {
      ...meta,
      lastKnownUtcMs: fallbackNow,
      lastPerfMs: perfNow,
    };
    changed = true;
    return { nowMs: fallbackNow, meta: updated, changed };
  }

  if (perfNow != null && typeof performance !== 'undefined' && Number.isFinite(performance.timeOrigin)) {
    const fallbackNow = performance.timeOrigin + perfNow + serverOffset;
    updated = {
      ...meta,
      lastKnownUtcMs: fallbackNow,
      lastPerfMs: perfNow,
    };
    return { nowMs: fallbackNow, meta: updated, changed: true };
  }

  return { nowMs: meta.lastKnownUtcMs ?? 0, meta, changed: false };
}

function getUtcDateString(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function getDailyFlushScheduleUtcMs(
  nowMs: number,
  meta: AnalyticsMeta,
  cfg: AnalyticsConfig
): { scheduleMs: number; meta: AnalyticsMeta; changed: boolean } {
  const now = new Date(nowMs);
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startHour = Math.min(
    23,
    Math.max(0, Math.floor(cfg.dailyFlushWindowStartUtc ?? DEFAULT_CONFIG.dailyFlushWindowStartUtc))
  );
  const windowMinutes = Math.min(
    MAX_DAILY_WINDOW_MINUTES,
    Math.max(1, Math.floor(cfg.dailyFlushWindowMinutes ?? DEFAULT_CONFIG.dailyFlushWindowMinutes))
  );
  const startMs = dayStartMs + startHour * 60 * 60 * 1000;

  let offset = meta.dailyFlushOffsetMinutes;
  let changed = false;
  if (offset == null || offset < 0 || offset >= windowMinutes) {
    offset = getRandomInt(windowMinutes);
    changed = true;
  }

  if (changed) {
    return {
      scheduleMs: startMs + offset * 60 * 1000,
      meta: { ...meta, dailyFlushOffsetMinutes: offset },
      changed,
    };
  }

  return { scheduleMs: startMs + offset * 60 * 1000, meta, changed: false };
}

/**
 * Resolve the current weekly slot: the most recent LOCAL midnight (the service
 * worker runs in the user's local timezone), a local YYYY-MM-DD slot key, and a
 * per-slot jitter offset (0-119 minutes) persisted in meta so the due time is
 * stable across ticks within one slot.
 */
export function getWeeklySlotInfo(
  nowMs: number,
  meta: AnalyticsMeta
): { slotKey: string; slotStartMs: number; dueAtMs: number; meta: AnalyticsMeta; metaChanged: boolean } {
  const now = new Date(nowMs);
  const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slotStartMs = slotStart.getTime();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const slotKey = `${slotStart.getFullYear()}-${pad(slotStart.getMonth() + 1)}-${pad(slotStart.getDate())}`;

  let offset = meta.weeklyOffsetMinutes;
  let updatedMeta = meta;
  let metaChanged = false;
  if (meta.weeklyOffsetSlotKey !== slotKey || offset == null || offset < 0 || offset >= WEEKLY_JITTER_MINUTES) {
    offset = getRandomInt(WEEKLY_JITTER_MINUTES);
    updatedMeta = { ...meta, weeklyOffsetSlotKey: slotKey, weeklyOffsetMinutes: offset };
    metaChanged = true;
  }

  return {
    slotKey,
    slotStartMs,
    dueAtMs: slotStartMs + offset * 60 * 1000,
    meta: updatedMeta,
    metaChanged,
  };
}

/**
 * Weekly due gate: due once the jittered local time has passed within the
 * current slot and the slot key has not been recorded as flushed yet.
 * Remote-enabled and backoff gates stay with the caller (internalFlush).
 */
export function getWeeklyDue(
  nowMs: number,
  meta: AnalyticsMeta,
  cfg: AnalyticsConfig
): { due: boolean; urgent: true; slotKey: string; meta: AnalyticsMeta; metaChanged: boolean } {
  const slot = getWeeklySlotInfo(nowMs, meta);
  const due = nowMs >= slot.dueAtMs && slot.meta.lastWeeklyFlushSlotKey !== slot.slotKey;
  return {
    due,
    urgent: true,
    slotKey: slot.slotKey,
    meta: slot.meta,
    metaChanged: slot.metaChanged,
  };
}

function resolveMaxEventsPerRequest(cfg: AnalyticsConfig): number {
  const max = Number.isFinite(cfg.maxEventsPerRequest)
    ? Math.max(1, Math.floor(cfg.maxEventsPerRequest as number))
    : DEFAULT_MAX_EVENTS_PER_REQUEST;
  return max;
}

export function resolveBatchSize(cfg: AnalyticsConfig, queueLength: number): number {
  const base = Math.max(1, Math.floor(cfg.batchSize || 1));
  const maxPerRequest = resolveMaxEventsPerRequest(cfg);

  if (queueLength >= OVERFLOW_QUEUE_THRESHOLD) {
    const burstSize = Math.max(base, OVERFLOW_BATCH_SIZE);
    return Math.min(queueLength, maxPerRequest, burstSize);
  }

  return Math.min(queueLength, maxPerRequest, base);
}

type FlushDecision = {
  shouldFlush: boolean;
  isUrgent: boolean;
  dailyDue: boolean;
  weeklySlotKey?: string;
  nowMs: number;
  meta: AnalyticsMeta;
  metaChanged: boolean;
};

/**
 * Send a batch of events to Cloudflare Worker.
 */
export async function sendBatchToCloudflare(
  events: AnalyticsEvent[],
  clientBatchId?: string
): Promise<FlushResult> {
  if (!TRACK_URL || events.length === 0) {
    return { success: false, error: 'No URL or empty batch' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, clientBatchId }),
      signal: controller.signal,
    });

    if (resp.status === 429) {
      return { success: false, rateLimited: true, error: 'Rate limited' };
    }

    if (resp.status >= 500) {
      return { success: false, serverOverloaded: true, error: `Server error: ${resp.status}` };
    }

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const json = await resp.json();
    return {
      success: json.ok === true,
      accepted: json.accepted,
      acceptedIds: Array.isArray(json.acceptedIds) ? json.acceptedIds : undefined,
      duplicateIds: Array.isArray(json.duplicateIds) ? json.duplicateIds : undefined,
      invalidIds: Array.isArray(json.invalidIds) ? json.invalidIds : undefined,
      acceptedSeqs: Array.isArray(json.acceptedSeqs) ? json.acceptedSeqs : undefined,
      committedSeq: typeof json.committedSeq === 'number' ? json.committedSeq : undefined,
      clientBatchId: typeof json.clientBatchId === 'string' ? json.clientBatchId : undefined,
      ackId: typeof json.ackId === 'string' ? json.ackId : undefined,
      receivedAt: typeof json.receivedAt === 'number' ? json.receivedAt : undefined,
      error: json.error,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAckRemovalSet(result: FlushResult): Set<string> {
  const removal = new Set<string>();
  const addAll = (items?: string[]) => {
    if (Array.isArray(items)) {
      for (const id of items) removal.add(id);
    }
  };
  // Always drop invalid and duplicate events (DO already rejected/has them).
  addAll(result.duplicateIds);
  addAll(result.invalidIds);
  return removal;
}

export function isAckValidForBatch(result: FlushResult, clientBatchId?: string): boolean {
  if (!clientBatchId) return true;
  if (!result.clientBatchId || result.clientBatchId !== clientBatchId) {
    return false;
  }
  if (!result.ackId || typeof result.ackId !== 'string' || result.ackId.length < 6) {
    return false;
  }
  return true;
}

export function applyRetryCap(events: AnalyticsEvent[], maxRetry: number): AnalyticsEvent[] {
  const cap = Math.max(0, Math.floor(maxRetry));
  return events.filter((ev) => (ev.retryCount ?? 0) <= cap);
}

export function applyCommitSeqs(
  queue: AnalyticsEvent[],
  acceptedSeqs?: Array<[string, number]>
): AnalyticsEvent[] {
  if (!Array.isArray(acceptedSeqs) || acceptedSeqs.length === 0) return queue;
  const map = new Map<string, number>(acceptedSeqs.map(([id, seq]) => [id, seq]));
  return queue.map((ev) => {
    if (!ev.id) return ev;
    const seq = map.get(ev.id);
    if (seq == null) return ev;
    return { ...ev, commitSeq: seq };
  });
}

export function pruneCommittedEvents(
  queue: AnalyticsEvent[],
  committedSeq?: number | null
): AnalyticsEvent[] {
  if (typeof committedSeq !== 'number') return queue;
  return queue.filter((ev) => {
    if (typeof ev.commitSeq !== 'number') return true;
    return ev.commitSeq > committedSeq;
  });
}

/**
 * Check if we should flush now based on time and queue size (UTC-based).
 * Handles daily jittered window and 24h-oldest flush.
 */
function getFlushDecision(
  cfg: AnalyticsConfig,
  meta: AnalyticsMeta,
  queueLength: number,
  oldestEventTime: number | null
): FlushDecision {
  // Weekly mode: every other trigger (daily window, 24h staleness, batch size,
  // time-based intervals) is disabled. The only trigger is the jittered weekly
  // slot. An empty queue at the boundary advances the slot key without a request.
  if (cfg.flushMode === 'weekly') {
    const time = getSafeUtcNowMs(meta);
    const weekly = getWeeklyDue(time.nowMs, time.meta, cfg);
    let updatedMeta = weekly.meta;
    let metaChanged = time.changed || weekly.metaChanged;
    let shouldFlush = weekly.due;
    if (weekly.due && queueLength === 0) {
      updatedMeta = { ...updatedMeta, lastWeeklyFlushSlotKey: weekly.slotKey };
      metaChanged = true;
      shouldFlush = false;
    }
    return {
      shouldFlush,
      isUrgent: weekly.due,
      dailyDue: false,
      weeklySlotKey: weekly.slotKey,
      nowMs: time.nowMs,
      meta: updatedMeta,
      metaChanged,
    };
  }

  if (queueLength === 0) {
    return {
      shouldFlush: false,
      isUrgent: false,
      dailyDue: false,
      nowMs: Date.now(),
      meta,
      metaChanged: false,
    };
  }

  const time = getSafeUtcNowMs(meta);
  let updatedMeta = time.meta;
  let metaChanged = time.changed;
  const nowMs = time.nowMs;

  const schedule = getDailyFlushScheduleUtcMs(nowMs, updatedMeta, cfg);
  updatedMeta = schedule.meta;
  metaChanged = metaChanged || schedule.changed;

  const todayUtc = getUtcDateString(nowMs);
  const dailyDue = updatedMeta.lastDailyFlushUtcDate !== todayUtc && nowMs >= schedule.scheduleMs;

  // Flush if events are stale (>= 24h)
  const ageDue = oldestEventTime !== null
    ? (nowMs - oldestEventTime) >= ONE_DAY_MS
    : false;

  // Batch size threshold from config
  const countDue = queueLength >= cfg.batchSize;

  // Time-based mode thresholds
  let timeBasedDue = false;
  if (cfg.flushMode === 'time_based') {
    const thresholdMinutes = queueLength < 15
      ? cfg.lowUsageFlushMinutes
      : queueLength < 35
        ? cfg.midUsageFlushMinutes
        : cfg.highUsageFlushMinutes;

    const referenceTime = meta.lastFlushAt ?? oldestEventTime;
    if (referenceTime !== null) {
      const elapsedMinutes = (nowMs - referenceTime) / 60000;
      if (elapsedMinutes >= thresholdMinutes) {
        timeBasedDue = true;
      }
    }
  }

  const shouldFlush = dailyDue || ageDue || countDue || timeBasedDue;
  const isUrgent = dailyDue || ageDue || queueLength >= OVERFLOW_QUEUE_THRESHOLD;

  return {
    shouldFlush,
    isUrgent,
    dailyDue,
    nowMs,
    meta: updatedMeta,
    metaChanged,
  };
}

/**
 * Update local stats with an event.
 */
export async function updateLocalStats(event: AnalyticsEvent): Promise<void> {
  const stats = await loadStats();

  const isCountedDownload = event.status === 'success' || event.status === 'fail';
  if (isCountedDownload) {
    stats.total++;
    stats.byType[event.file_type] = (stats.byType[event.file_type] ?? 0) + 1;
  }

  if (event.status === 'success') {
    stats.success = (stats.success ?? 0) + 1;
  } else if (event.status === 'fail') {
    stats.fail = (stats.fail ?? 0) + 1;
    if (event.error_type) {
      stats.failByErrorType = stats.failByErrorType ?? {};
      stats.failByErrorType[event.error_type] = (stats.failByErrorType[event.error_type] ?? 0) + 1;
    }
  } else if (event.status === 'cancelled') {
    stats.cancelled = (stats.cancelled ?? 0) + 1;
  }

  stats.attempts = (stats.attempts ?? 0) + 1;

  const speed = bucketDuration(event.duration_ms);
  stats.bySpeed = stats.bySpeed ?? { fast: 0, medium: 0, slow: 0 };
  stats.bySpeed[speed]++;

  if (event.bypass_used) {
    stats.bypassCount = (stats.bypassCount ?? 0) + 1;
  }

  stats.byLanguage = stats.byLanguage ?? {};
  stats.byLanguage[event.language] = (stats.byLanguage[event.language] ?? 0) + 1;

  stats.lastUpdated = Date.now();

  await saveStats(stats);
}

/**
 * Internal flush with backoff and retry logic.
 */
export async function internalFlush(): Promise<void> {
  const cfg = await loadConfig();
  let meta = await loadMeta();
  const loaded = await loadQueue();
  let queue = loaded.queue;
  if (!loaded.valid) {
    console.warn('[CQD Analytics] Queue integrity check failed; re-saving queue to restore checksum');
    await saveQueue(queue);
  }

  queue = pruneCommittedEvents(queue, meta.lastCommittedSeq);
  if (queue.length === 0) {
    await saveQueue(queue);
    // Weekly mode: an empty queue at the slot boundary still advances the slot
    // key (no request), decided by getFlushDecision.
    if (cfg.flushMode === 'weekly') {
      const emptyDecision = getFlushDecision(cfg, meta, 0, null);
      if (emptyDecision.metaChanged) {
        await saveMeta(emptyDecision.meta);
      }
    }
    return;
  }

  // Normalize queue events (ensure IDs exist for idempotency)
  queue = queue.map((event) => {
    if (!event.id) {
      return { ...event, id: generateEventId() };
    }
    return event;
  });

  const sendable = queue.filter((ev) => typeof ev.commitSeq !== 'number');
  if (sendable.length === 0) {
    await saveQueue(queue);
    return;
  }

  const oldestEventTime = sendable.reduce((min, ev) => {
    const ts = typeof ev.timestamp === 'number' ? ev.timestamp : min;
    return ts < min ? ts : min;
  }, sendable[0]?.timestamp ?? Date.now());
  const decision = getFlushDecision(cfg, meta, sendable.length, oldestEventTime);
  meta = decision.meta;
  const nowMs = decision.nowMs;
  const metaDirty = decision.metaChanged;

  // Check backoff
  if (meta.nextRetryAt && nowMs < meta.nextRetryAt) {
    if (metaDirty) {
      await saveMeta(meta);
    }
    return;
  }

  // Check if remote is enabled
  if (!cfg.remoteEnabled) {
    if (metaDirty) {
      await saveMeta(meta);
    }
    return;
  }

  if (!decision.shouldFlush) {
    if (metaDirty) {
      await saveMeta(meta);
    }
    return;
  }

  // Rate limit check (skip when urgent)
  if (!decision.isUrgent) {
    const rateCheck = await checkAndIncrementRateLimit(cfg.maxDailyRequests);
    if (!rateCheck.allowed) {
      if (metaDirty) {
        await saveMeta(meta);
      }
      return;
    }
  }

  const maxPerRequest = resolveMaxEventsPerRequest(cfg);
  // Weekly mode drains the whole queue in urgent-sized batches, capped at
  // MAX_WEEKLY_POSTS_PER_TICK POSTs per tick; other modes send a single batch.
  const isWeekly = cfg.flushMode === 'weekly';
  const maxPostsThisTick = isWeekly ? MAX_WEEKLY_POSTS_PER_TICK : 1;
  let workingQueue = queue;
  let remaining = sendable;
  let failed = false;
  let posts = 0;

  while (remaining.length > 0 && posts < maxPostsThisTick) {
    let batchSize = resolveBatchSize(cfg, remaining.length);
    if (decision.isUrgent) {
      batchSize = Math.min(remaining.length, maxPerRequest);
    }
    const toSend = remaining.slice(0, batchSize);
    // Queue events are normalized with IDs before sending.
    const toSendIds = new Set<string>(toSend.map((ev) => ev.id as string));

    // Send batch
    const clientBatchId = generateEventId();
    let result = await sendBatchToCloudflare(toSend, clientBatchId);
    if (result.success && !isAckValidForBatch(result, clientBatchId)) {
      result = { success: false, error: 'ack_mismatch' };
    }
    posts += 1;

    if (!result.success) {
      failed = true;
      // Failure - increment retry counts and apply backoff
      const maxRetry = Number.isFinite(cfg.maxRetry) ? cfg.maxRetry : 0;
      const updatedQueue = workingQueue.map((ev) => {
        if (!toSendIds.has(ev.id as string)) return ev;
        return { ...ev, retryCount: (ev.retryCount ?? 0) + 1 };
      });
      const cappedQueue = updatedQueue.filter((ev) => {
        if (!toSendIds.has(ev.id as string)) return true;
        return (ev.retryCount as number) <= maxRetry;
      });

      const backoffSeconds = BACKOFF_STEPS_SECONDS[
        Math.min(meta.backoffIndex, BACKOFF_STEPS_SECONDS.length - 1)
      ];
      meta.nextRetryAt = nowMs + backoffSeconds * 1000;
      meta.backoffIndex++;

      await saveMeta(meta);
      await saveQueue(cappedQueue);
      break;
    }

    const ackInfoProvided =
      Array.isArray(result.acceptedIds) ||
      Array.isArray(result.duplicateIds) ||
      Array.isArray(result.invalidIds);
    if (ackInfoProvided) {
      const removal = buildAckRemovalSet(result);
      workingQueue = workingQueue.filter((ev) => !removal.has(ev.id as string));
      workingQueue = applyCommitSeqs(workingQueue, result.acceptedSeqs);
    } else {
      workingQueue = workingQueue.filter((ev) => !toSendIds.has(ev.id as string));
    }

    if (typeof result.committedSeq === 'number') {
      meta.lastCommittedSeq = Math.max(meta.lastCommittedSeq ?? 0, result.committedSeq);
      workingQueue = pruneCommittedEvents(workingQueue, meta.lastCommittedSeq);
    }

    remaining = remaining.filter((ev) => !toSendIds.has(ev.id as string));
  }

  if (!failed) {
    // Success - remove sent events (ack-based)
    meta.lastFlushAt = nowMs;
    meta.nextRetryAt = null;
    meta.backoffIndex = 0;
    if (decision.dailyDue && workingQueue.length === 0) {
      meta.lastDailyFlushUtcDate = getUtcDateString(nowMs);
    }
    // Weekly slot key advances ONLY when the queue fully drained.
    if (isWeekly && decision.weeklySlotKey && remaining.length === 0) {
      meta.lastWeeklyFlushSlotKey = decision.weeklySlotKey;
    }
    await saveMeta(meta);
    await saveQueue(workingQueue);
  }

}

// Test-only exports for deterministic branch coverage of private helpers.
export const __flushTestInternals = {
  getRandomInt,
  resolveMaxEventsPerRequest,
  getFlushDecision,
};
