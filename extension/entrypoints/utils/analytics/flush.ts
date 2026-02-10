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

function resolveMaxEventsPerRequest(cfg: AnalyticsConfig): number {
  const max = Number.isFinite(cfg.maxEventsPerRequest)
    ? Math.max(1, Math.floor(cfg.maxEventsPerRequest as number))
    : DEFAULT_MAX_EVENTS_PER_REQUEST;
  return max || DEFAULT_MAX_EVENTS_PER_REQUEST;
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

  try {
    const resp = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, clientBatchId }),
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
    return { success: false, error: String(err) };
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

  stats.total++;
  stats.byType[event.file_type] = (stats.byType[event.file_type] ?? 0) + 1;

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

  const oldestEventTime = sendable.length > 0
    ? sendable.reduce((min, ev) => {
      const ts = typeof ev.timestamp === 'number' ? ev.timestamp : min;
      return ts < min ? ts : min;
    }, sendable[0]?.timestamp ?? Date.now())
    : null;
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
  let batchSize = resolveBatchSize(cfg, sendable.length);
  if (decision.isUrgent) {
    batchSize = Math.min(sendable.length, maxPerRequest);
  }
  const toSend = sendable.slice(0, batchSize);
  const toSendIds = new Set<string>(toSend.map((ev) => ev.id ?? ''));

  // Send batch
  const clientBatchId = generateEventId();
  let result = await sendBatchToCloudflare(toSend, clientBatchId);
  if (result.success && !isAckValidForBatch(result, clientBatchId)) {
    result = { success: false, error: 'ack_mismatch' };
  }

  if (result.success) {
    const ackInfoProvided =
      Array.isArray(result.acceptedIds) ||
      Array.isArray(result.duplicateIds) ||
      Array.isArray(result.invalidIds);
    let remainingQueue = queue;
    if (ackInfoProvided) {
      const removal = buildAckRemovalSet(result);
      remainingQueue = remainingQueue.filter((ev) => !removal.has(ev.id ?? ''));
      remainingQueue = applyCommitSeqs(remainingQueue, result.acceptedSeqs);
    } else {
      remainingQueue = remainingQueue.filter((ev) => !toSendIds.has(ev.id ?? ''));
    }

    if (typeof result.committedSeq === 'number') {
      meta.lastCommittedSeq = Math.max(meta.lastCommittedSeq ?? 0, result.committedSeq);
      remainingQueue = pruneCommittedEvents(remainingQueue, meta.lastCommittedSeq);
    }

    // Success - remove sent events (ack-based)
    meta.lastFlushAt = nowMs;
    meta.nextRetryAt = null;
    meta.backoffIndex = 0;
    if (decision.dailyDue && remainingQueue.length === 0) {
      meta.lastDailyFlushUtcDate = getUtcDateString(nowMs);
    }
    await saveMeta(meta);
    await saveQueue(remainingQueue);
  } else {
    // Failure - increment retry counts and apply backoff
    const maxRetry = Number.isFinite(cfg.maxRetry) ? cfg.maxRetry : 0;
    const updatedQueue = queue.map((ev) => {
      if (!toSendIds.has(ev.id ?? '')) return ev;
      return { ...ev, retryCount: (ev.retryCount ?? 0) + 1 };
    });
    const cappedQueue = updatedQueue.filter((ev) => {
      if (!toSendIds.has(ev.id ?? '')) return true;
      return (ev.retryCount ?? 0) <= maxRetry;
    });

    const backoffSeconds = BACKOFF_STEPS_SECONDS[
      Math.min(meta.backoffIndex, BACKOFF_STEPS_SECONDS.length - 1)
    ];
    meta.nextRetryAt = nowMs + backoffSeconds * 1000;
    meta.backoffIndex++;

    await saveMeta(meta);
    await saveQueue(cappedQueue);
  }

}

// Test-only exports for deterministic branch coverage of private helpers.
export const __flushTestInternals = {
  getRandomInt,
  resolveMaxEventsPerRequest,
  getFlushDecision,
};
