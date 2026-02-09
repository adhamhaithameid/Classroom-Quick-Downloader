// filepath: extension/entrypoints/utils/analytics/index.ts
/**
 * Main analytics module - public API and high-level helpers.
 * Re-exports types and provides the Analytics singleton.
 */

import type { AnalyticsEvent, RecordDownloadEventInput, AnalyticsConfig } from './types';
import { DEFAULT_CONFIG, CONFIG_URL } from './constants';
import { detectBrowser, detectOS, detectLanguage, getExtensionVersion, generateEventId } from './detection';
import { loadQueue, saveQueue, loadConfig, saveConfig, loadStats, loadMeta, saveMeta } from './storage';
import { internalFlush, updateLocalStats, getSafeUtcNowMs } from './flush';

// Re-export types
export type {
  AnalyticsEvent,
  LocalStats,
  AnalyticsConfig,
  AnalyticsMeta,
  RecordDownloadEventInput,
  DownloadSource,
} from './types';

// --- Operation Queue (prevents race conditions) ---

let opChain: Promise<void> = Promise.resolve();

function enqueueOp(op: () => Promise<void>): void {
  opChain = opChain.then(op).catch(() => {
    // Analytics operation error - silently ignored
  });
}

/**
 * Record an analytics event by enriching it with runtime metadata, updating local stats, persisting it to the local queue, and triggering a flush when thresholds are met.
 *
 * @param event - The event payload provided by callers; fields `timestamp`, `ext_version`, `browser`, `os`, `language`, `retryCount`, and `id` are omitted and will be populated by this function.
 */

async function internalTrack(
  event: Omit<AnalyticsEvent, 'timestamp' | 'ext_version' | 'browser' | 'os' | 'language' | 'retryCount' | 'id'>
): Promise<void> {
  const meta = await loadMeta();
  const safeTime = getSafeUtcNowMs(meta);
  if (safeTime.changed) {
    await saveMeta(safeTime.meta);
  }

  const fullEvent: AnalyticsEvent = {
    ...event,
    timestamp: safeTime.nowMs || Date.now(),
    ext_version: getExtensionVersion(),
    browser: detectBrowser(),
    os: await detectOS(),
    language: detectLanguage(),
    id: generateEventId(),
    retryCount: 0,
  };

  // Update local stats
  await updateLocalStats(fullEvent);

  // Add to queue
  const queue = await loadQueue();
  queue.push(fullEvent);
  await saveQueue(queue);

  // Check if we should flush
  const config = await loadConfig();
  if (queue.length >= config.batchSize) {
    await internalFlush();
  }
}

// --- Public API ---

export const Analytics = {
  /**
   * Fire-and-forget tracking. Download logic & UI don't wait for this.
   */
  track(
    event: Omit<AnalyticsEvent, 'timestamp' | 'ext_version' | 'browser' | 'os' | 'language' | 'retryCount'>
  ): void {
    enqueueOp(() => internalTrack(event));
  },

  /**
   * Best-effort flush. Called by chrome.alarms from background.
   */
  flush(): void {
    enqueueOp(() => internalFlush());
  },

  /**
   * Get current local stats.
   */
  async getStats() {
    return loadStats();
  },
};

// --- High-level Helper ---

/**
 * Record a download event with simplified input.
 */
export function recordDownloadEvent(input: RecordDownloadEventInput): void {
  Analytics.track({
    status: input.status,
    file_type: input.type || 'unknown',
    duration_ms: input.duration_ms ?? 0,
    bypass_used: input.bypass_used ?? false,
    error_type: input.error_type,
    source: input.source,
  });
}

// --- Remote Config ---

/**
 * Refreshes analytics configuration from the remote CONFIG_URL and persists any updates.
 *
 * Loads the current local config, fetches remote configuration from CONFIG_URL (if set),
 * and merges provided remote fields into the local config before saving. Recognized remote
 * fields include `batchSize`, `maxDailyRequests`, `maxRetry`, `flushMode`, `remoteEnabled`,
 * `cancelHoldDelayMs`, and `maxEventsPerRequest`. If `timeFlushMinutes` is present it updates
 * the per-usage flush thresholds (`lowUsageFlushMinutes`, `midUsageFlushMinutes`,
 * `highUsageFlushMinutes`) from `timeFlushMinutes.low|mid|high` when provided. Missing remote
 * fields preserve the current local values.
 *
 * The function is best-effort: if CONFIG_URL is not defined, the fetch response is not OK,
 * the remote payload is not valid, or any error occurs during refresh, no changes are made
 * and the function completes silently.
 */
export async function refreshRemoteAnalyticsConfig(): Promise<void> {
  if (!CONFIG_URL) return;

  try {
    const resp = await fetch(CONFIG_URL);
    if (!resp.ok) return;

    const json = await resp.json();
    if (!json.ok) return;

    const current = await loadConfig();
    const updated: AnalyticsConfig = {
      ...current,
      batchSize: json.batchSize ?? current.batchSize,
      maxDailyRequests: json.maxDailyRequests ?? current.maxDailyRequests,
      maxRetry: json.maxRetry ?? current.maxRetry,
      flushMode: json.flushMode ?? current.flushMode,
      remoteEnabled: json.remoteEnabled ?? current.remoteEnabled,
      cancelHoldDelayMs: json.cancelHoldDelayMs ?? current.cancelHoldDelayMs,
      maxEventsPerRequest: json.maxEventsPerRequest ?? current.maxEventsPerRequest,
    };

    if (json.timeFlushMinutes) {
      updated.lowUsageFlushMinutes = json.timeFlushMinutes.low ?? current.lowUsageFlushMinutes;
      updated.midUsageFlushMinutes = json.timeFlushMinutes.mid ?? current.midUsageFlushMinutes;
      updated.highUsageFlushMinutes = json.timeFlushMinutes.high ?? current.highUsageFlushMinutes;
    }

    await saveConfig(updated);
  } catch (err) {
    // Failed to refresh config - silently ignored
  }
}

/**
 * Get the cancel hold delay from config.
 */
export async function getCancelHoldDelayMs(): Promise<number> {
  const config = await loadConfig();
  return config.cancelHoldDelayMs;
}