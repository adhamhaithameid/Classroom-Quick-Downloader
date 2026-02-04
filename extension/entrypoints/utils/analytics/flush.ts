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
import { bucketDuration } from './detection';

/**
 * Send a batch of events to Cloudflare Worker.
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
      error: json.error,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Check if we should flush now based on time and queue size.
 * Handles 1:00 AM consolidated flush for 'next_day' mode.
 */
export function shouldFlushNowForTimeAndSize(
  cfg: AnalyticsConfig,
  _meta: AnalyticsMeta,
  queueLength: number,
  oldestEventTime: number | null
): boolean {
  if (queueLength === 0) return false;

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 1:00 AM flush window (00:55 - 01:10)
  if ((hour === 0 && minute >= 55) || (hour === 1 && minute <= 10)) {
    return true;
  }

  // 1. Flush if queue size reaches 50 (User Request)
  if (queueLength >= 50) {
    return true;
  }
  
  // 2. Flush if events are stale (> 1 day old) (User Request)
  if (oldestEventTime !== null) {
    const ageMs = now.getTime() - oldestEventTime;
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (ageMs > oneDayMs) {
      return true;
    }
  }

  // Batch size threshold from config (fallback)
  if (queueLength >= cfg.batchSize) {
    return true;
  }

  // Time-based mode thresholds
  if (cfg.flushMode === 'time_based') {
    const thresholdMinutes = queueLength < 15
      ? cfg.lowUsageFlushMinutes
      : queueLength < 35
        ? cfg.midUsageFlushMinutes
        : cfg.highUsageFlushMinutes;
    
    // Simplification: if we have waited long enough since last flush?
    // This part is incomplete in original code, but we keep the structure.
  }

  return false;
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
  const queue = await loadQueue();

  if (queue.length === 0) return;

  // Check backoff
  if (meta.nextRetryAt && Date.now() < meta.nextRetryAt) {
    return;
  }

  // Check if remote is enabled
  if (!cfg.remoteEnabled) {
    return;
  }

  // Check if we should flush
  // Get time of oldest event if any
  const oldestEventTime = queue.length > 0 && queue[0].timestamp ? queue[0].timestamp : null;

  if (!shouldFlushNowForTimeAndSize(cfg, meta, queue.length, oldestEventTime)) {
    return;
  }

  // Rate limit check
  const rateCheck = await checkAndIncrementRateLimit();
  if (!rateCheck.allowed) {
    return;
  }

  // Get batch up to max retry count
  const maxRetry = cfg.maxRetry;
  const toSend: AnalyticsEvent[] = [];
  const toKeep: AnalyticsEvent[] = [];

  for (const event of queue) {
    if ((event.retryCount ?? 0) > maxRetry) {
      // Poison pill - drop it (too many retries)
      continue;
    }
    if (toSend.length < cfg.batchSize) {
      toSend.push(event);
    } else {
      toKeep.push(event);
    }
  }

  if (toSend.length === 0) {
    await saveQueue(toKeep);
    return;
  }

  // Send batch
  const result = await sendBatchToCloudflare(toSend);

  if (result.success) {
    // Success - remove sent events
    meta.lastFlushAt = Date.now();
    meta.nextRetryAt = null;
    meta.backoffIndex = 0;
    await saveMeta(meta);
    await saveQueue(toKeep);
  } else {
    // Failure - increment retry counts and apply backoff
    const retriedEvents = toSend.map((e) => ({
      ...e,
      retryCount: (e.retryCount ?? 0) + 1,
    }));

    const backoffSeconds = BACKOFF_STEPS_SECONDS[
      Math.min(meta.backoffIndex, BACKOFF_STEPS_SECONDS.length - 1)
    ];
    meta.nextRetryAt = Date.now() + backoffSeconds * 1000;
    meta.backoffIndex++;

    await saveMeta(meta);
    await saveQueue([...retriedEvents, ...toKeep]);
  }
}
