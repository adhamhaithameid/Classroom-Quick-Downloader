// filepath: extension/entrypoints/utils/analytics/flush.ts
/**
 * Analytics flush logic - sending batches to Cloudflare Worker.
 */

import type { AnalyticsEvent, AnalyticsConfig, AnalyticsMeta, FlushResult } from './types';
import { TRACK_URL, BACKOFF_STEPS_SECONDS } from './constants';
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
const DAILY_FLUSH_UTC_START_HOUR = 1;
const DAILY_FLUSH_WINDOW_HOURS = 2;
const DAILY_FLUSH_WINDOW_MINUTES = DAILY_FLUSH_WINDOW_HOURS * 60;
const OVERFLOW_QUEUE_THRESHOLD = 500;
const OVERFLOW_BATCH_SIZE = 500;
const DEFAULT_MAX_EVENTS_PER_REQUEST = 5000;

/**
 * Produces an integer starting at 0 up to, but not including, the provided upper bound.
 *
 * @param maxExclusive - Upper exclusive bound for the generated integer. If less than or equal to 0, the function returns 0.
 * @returns An integer in the range [0, maxExclusive).
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

/**
 * Compute a best-effort current UTC timestamp in milliseconds and update timing fields in `meta` when higher-fidelity sources are available.
 *
 * @param meta - Analytics meta containing previously observed `lastKnownUtcMs` and `lastPerfMs`; may be returned with updated timing fields
 * @returns An object with:
 *  - `nowMs`: the resolved UTC time in milliseconds,
 *  - `meta`: the (possibly updated) meta object with refreshed `lastKnownUtcMs` and `lastPerfMs`,
 *  - `changed`: `true` if `meta` was modified, `false` otherwise.
 */
export function getSafeUtcNowMs(meta: AnalyticsMeta): { nowMs: number; meta: AnalyticsMeta; changed: boolean } {
  const now = Date.now();
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
    const fallbackNow = performance.timeOrigin + perfNow;
    updated = {
      ...meta,
      lastKnownUtcMs: fallbackNow,
      lastPerfMs: perfNow,
    };
    return { nowMs: fallbackNow, meta: updated, changed: true };
  }

  return { nowMs: meta.lastKnownUtcMs ?? 0, meta, changed: false };
}

/**
 * Produces the UTC date part (YYYY-MM-DD) for a given timestamp.
 *
 * @param nowMs - Milliseconds since the Unix epoch
 * @returns The UTC date as a `YYYY-MM-DD` string
 */
function getUtcDateString(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Compute the UTC timestamp for today's scheduled daily flush and ensure a valid per-day offset exists in `meta`.
 *
 * @param nowMs - Current time in milliseconds since the Unix epoch (UTC reference for "today")
 * @param meta - Analytics metadata which may contain `dailyFlushOffsetMinutes`; this object may be returned updated
 * @returns An object with:
 *  - `scheduleMs`: the UTC-milliseconds timestamp for today's flush (day start + configured start hour + offset minutes),
 *  - `meta`: the original or updated `meta` (if `dailyFlushOffsetMinutes` was missing or out of range, it is set to a minute offset within the daily window),
 *  - `changed`: `true` if `meta` was modified, `false` otherwise
 */
export function getDailyFlushScheduleUtcMs(
  nowMs: number,
  meta: AnalyticsMeta
): { scheduleMs: number; meta: AnalyticsMeta; changed: boolean } {
  const now = new Date(nowMs);
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startMs = dayStartMs + DAILY_FLUSH_UTC_START_HOUR * 60 * 60 * 1000;
  const windowMinutes = DAILY_FLUSH_WINDOW_MINUTES;

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
 * Determine the per-request event limit to use for batching.
 *
 * @param cfg - Analytics configuration which may include `maxEventsPerRequest`
 * @returns The maximum number of events to include in a single request (at least 1). If `cfg.maxEventsPerRequest` is a finite number it is floored and clamped to a minimum of 1; otherwise a default value is returned.
 */
function resolveMaxEventsPerRequest(cfg: AnalyticsConfig): number {
  const max = Number.isFinite(cfg.maxEventsPerRequest)
    ? Math.max(1, Math.floor(cfg.maxEventsPerRequest as number))
    : DEFAULT_MAX_EVENTS_PER_REQUEST;
  return max || DEFAULT_MAX_EVENTS_PER_REQUEST;
}

/**
 * Compute the number of events to include in the next send batch.
 *
 * Considers the configured batch size, the resolved per-request maximum, the current queue length, and overflow behavior.
 *
 * @param cfg - Analytics configuration that may specify `batchSize` and per-request limits
 * @param queueLength - Current number of queued events
 * @returns The batch size to use (at least 1), bounded by `queueLength`, the resolved max events per request, and overflow rules
 */
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
 * Send a batch of analytics events to the configured Cloudflare tracking endpoint.
 *
 * @param events - The analytics events to send in a single batch.
 * @returns An object describing the flush outcome:
 *  - `success`: `true` if the remote worker acknowledged the batch, `false` otherwise.
 *  - `accepted`: number of events the worker accepted (when provided).
 *  - `acceptedIds`: array of accepted event ids when provided by the worker.
 *  - `duplicateIds`: array of event ids the worker marked as duplicates when provided.
 *  - `invalidIds`: array of event ids the worker marked as invalid when provided.
 *  - `rateLimited`: `true` if the remote responded with HTTP 429.
 *  - `serverOverloaded`: `true` if the remote responded with a 5xx status.
 *  - `error`: an error message when the request failed or the response indicated an error.
 */
export async function sendBatchToCloudflare(events: AnalyticsEvent[]): Promise<FlushResult> {
  if (!TRACK_URL || events.length === 0) {
    return { success: false, error: 'No URL or empty batch' };
  }

  try {
    const resp = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
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
      error: json.error,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Determine whether an analytics flush should occur now.
 *
 * Evaluates multiple triggers (daily scheduled window with jitter, any event older than 24 hours,
 * queue-size threshold, and optional time-based thresholds that vary by queue depth) and returns
 * decision flags plus the current UTC time and any updated metadata.
 *
 * @param cfg - Analytics configuration used to evaluate thresholds and modes
 * @param meta - Mutable analytics metadata that may be updated (daily offset, last-flush timestamps)
 * @param queueLength - Number of events currently queued
 * @param oldestEventTime - Timestamp (ms) of the oldest queued event, or `null` if unknown
 * @returns A FlushDecision describing:
 *  - `shouldFlush`: `true` if any flush trigger is met, `false` otherwise.
 *  - `isUrgent`: `true` when the flush is urgent (daily due, age due, or queue at overflow).
 *  - `dailyDue`: `true` if the configured daily flush window has been reached.
 *  - `nowMs`: current UTC timestamp in milliseconds used for the decision.
 *  - `meta`: the possibly-updated metadata object.
 *  - `metaChanged`: `true` if `meta` was modified as part of the decision.
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

  const schedule = getDailyFlushScheduleUtcMs(nowMs, updatedMeta);
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
 * Flushes queued analytics events to the remote tracking endpoint, applying batching, rate limits, daily-flush scheduling, and retry/backoff.
 *
 * Persists updates to local metadata and the event queue: on success it removes acknowledged events and resets backoff state; on failure it increments retry counts, schedules the next retry with exponential backoff, and requeues failed events. The function will abort early without sending if the remote is disabled, a backoff window is active, or rate limits prevent a non-urgent request. Each event is ensured to have an id for idempotent delivery, and a completed daily flush will update the last-daily-flush timestamp.
 */
export async function internalFlush(): Promise<void> {
  const cfg = await loadConfig();
  let meta = await loadMeta();
  let queue = await loadQueue();

  if (queue.length === 0) return;

  const oldestEventTime = queue[0]?.timestamp ?? null;
  const decision = getFlushDecision(cfg, meta, queue.length, oldestEventTime);
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

  // Normalize queue events (ensure IDs exist for idempotency)
  queue = queue.map((event) => {
    if (!event.id) {
      return { ...event, id: generateEventId() };
    }
    return event;
  });

  const maxPerRequest = resolveMaxEventsPerRequest(cfg);
  let batchSize = resolveBatchSize(cfg, queue.length);
  if (decision.isUrgent) {
    batchSize = Math.min(queue.length, maxPerRequest);
  }
  const toSend = queue.slice(0, batchSize);
  const toKeep = queue.slice(batchSize);

  // Send batch
  const result = await sendBatchToCloudflare(toSend);

  if (result.success) {
    const ackInfoProvided =
      Array.isArray(result.acceptedIds) ||
      Array.isArray(result.duplicateIds) ||
      Array.isArray(result.invalidIds);
    const acceptedIds = new Set<string>([
      ...(result.acceptedIds ?? []),
      ...(result.duplicateIds ?? []),
    ]);
    const remainingQueue = ackInfoProvided
      ? queue.filter((ev) => !acceptedIds.has(ev.id ?? ''))
      : toKeep;

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
    const retriedEvents = toSend.map((e) => ({
      ...e,
      retryCount: (e.retryCount ?? 0) + 1,
    }));

    const backoffSeconds = BACKOFF_STEPS_SECONDS[
      Math.min(meta.backoffIndex, BACKOFF_STEPS_SECONDS.length - 1)
    ];
    meta.nextRetryAt = nowMs + backoffSeconds * 1000;
    meta.backoffIndex++;

    await saveMeta(meta);
    await saveQueue([...retriedEvents, ...toKeep]);
  }

}