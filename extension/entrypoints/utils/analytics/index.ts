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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sanitizeField(value: string, maxLen: number, pattern?: RegExp, fallback = 'unknown'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return fallback;
  if (trimmed.length > maxLen) return fallback;
  if (pattern && !pattern.test(trimmed)) return fallback;
  return trimmed;
}

const FIELD_PATTERNS = {
  type: /^[a-z0-9._-]+$/,
  browser: /^[a-z0-9._-]+$/,
  os: /^[a-z0-9._-]+$/,
  language: /^[a-z0-9-]+$/,
  error: /^[a-z0-9._-]+$/,
  source: /^[a-z0-9._-]+$/,
};

// --- Internal Track ---

async function internalTrack(
  event: Omit<AnalyticsEvent, 'timestamp' | 'ext_version' | 'browser' | 'os' | 'language' | 'retryCount' | 'id'>
): Promise<void> {
  const meta = await loadMeta();
  const safeTime = getSafeUtcNowMs(meta);
  if (safeTime.changed) {
    await saveMeta(safeTime.meta);
  }

  const fileType = sanitizeField(event.file_type || 'unknown', 24, FIELD_PATTERNS.type);
  const browser = sanitizeField(detectBrowser(), 24, FIELD_PATTERNS.browser);
  const os = sanitizeField(await detectOS(), 24, FIELD_PATTERNS.os);
  const language = sanitizeField(detectLanguage(), 10, FIELD_PATTERNS.language);
  const errorType = event.error_type
    ? sanitizeField(event.error_type, 32, FIELD_PATTERNS.error)
    : undefined;
  const source = event.source ? sanitizeField(event.source, 32, FIELD_PATTERNS.source) : undefined;

  const fullEvent: AnalyticsEvent = {
    ...event,
    timestamp: safeTime.nowMs || Date.now(),
    ext_version: getExtensionVersion(),
    browser,
    os,
    language,
    file_type: fileType,
    error_type: errorType,
    source,
    id: generateEventId(safeTime.nowMs || Date.now()),
    retryCount: 0,
  };

  // Update local stats
  await updateLocalStats(fullEvent);

  // Add to queue
  const { queue, valid } = await loadQueue();
  if (!valid) {
    console.warn('[CQD Analytics] Queue integrity check failed; persisting new checksum after append');
  }
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
 * Fetch and update config from Cloudflare Worker.
 */
export async function refreshRemoteAnalyticsConfig(): Promise<void> {
  if (!CONFIG_URL) return;

  try {
    const resp = await fetch(CONFIG_URL);
    if (!resp.ok) return;

    const json = await resp.json();
    if (!json.ok) return;

    const current = await loadConfig();
    const meta = await loadMeta();
    const updates: Partial<AnalyticsConfig> = {};

    if (isFiniteNumber(json.batchSize)) {
      updates.batchSize = clampInt(json.batchSize, 1, 1000);
    }
    if (isFiniteNumber(json.maxDailyRequests)) {
      updates.maxDailyRequests = clampInt(json.maxDailyRequests, 1, 1000);
    }
    if (isFiniteNumber(json.maxRetry)) {
      updates.maxRetry = clampInt(json.maxRetry, 0, 20);
    }
    if (json.flushMode === 'next_day' || json.flushMode === 'time_based') {
      updates.flushMode = json.flushMode;
    }
    if (typeof json.remoteEnabled === 'boolean') {
      updates.remoteEnabled = json.remoteEnabled;
    }
    if (isFiniteNumber(json.cancelHoldDelayMs)) {
      updates.cancelHoldDelayMs = clampInt(json.cancelHoldDelayMs, 0, 10000);
    }
    if (isFiniteNumber(json.maxEventsPerRequest)) {
      updates.maxEventsPerRequest = clampInt(json.maxEventsPerRequest, 1, 50_000);
    }
    if (isFiniteNumber(json.dailyFlushWindowStartUtc)) {
      updates.dailyFlushWindowStartUtc = clampInt(json.dailyFlushWindowStartUtc, 0, 23);
    }
    if (isFiniteNumber(json.dailyFlushWindowMinutes)) {
      updates.dailyFlushWindowMinutes = clampInt(json.dailyFlushWindowMinutes, 1, 24 * 60);
    }

    if (json.timeFlushMinutes && typeof json.timeFlushMinutes === 'object') {
      const tfm = json.timeFlushMinutes as Record<string, unknown>;
      if (isFiniteNumber(tfm.low)) {
        updates.lowUsageFlushMinutes = clampInt(tfm.low, 1, 10080);
      }
      if (isFiniteNumber(tfm.mid)) {
        updates.midUsageFlushMinutes = clampInt(tfm.mid, 1, 10080);
      }
      if (isFiniteNumber(tfm.high)) {
        updates.highUsageFlushMinutes = clampInt(tfm.high, 1, 10080);
      }
    }

    let nextMeta = meta;
    let metaChanged = false;
    if (isFiniteNumber(json.serverTimeUtc)) {
      const offset = json.serverTimeUtc - Date.now();
      nextMeta = { ...nextMeta, serverTimeOffsetMs: offset };
      metaChanged = true;
    }

    if (isFiniteNumber(json.committedSeq)) {
      const nextCommitted = Math.max(nextMeta.lastCommittedSeq ?? 0, Math.floor(json.committedSeq));
      nextMeta = { ...nextMeta, lastCommittedSeq: nextCommitted };
      metaChanged = true;
    }

    if (metaChanged) {
      await saveMeta(nextMeta);
    }

    await saveConfig({ ...current, ...updates });
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
