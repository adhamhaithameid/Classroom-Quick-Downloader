// filepath: extension/entrypoints/utils/analytics/constants.ts
/**
 * Analytics constants and defaults.
 */

import type { AnalyticsConfig, AnalyticsMeta } from './types';

// --- Storage Keys ---

export const STORAGE_KEYS = {
  QUEUE: 'pending_events',
  STATS: 'local_stats',
  CONFIG: 'cqd_analytics_config_v1',
  META: 'cqd_analytics_meta_v1',
  RATE_LIMIT: 'cqd_rate_limit_v1',
  INTEGRITY: 'cqd_integrity_v1',
  QUEUE_MIGRATED: 'cqd_queue_migrated_v1',
} as const;

// --- Default Values ---

export const CONFIG_VERSION = 2;
const BATCH_SIZE = 50;
const MAX_RETRY = 5;
const REMOTE_ENABLED = true;
const MAX_EVENTS_PER_REQUEST = 5000;
const DAILY_FLUSH_WINDOW_START_UTC = 1;
const DAILY_FLUSH_WINDOW_MINUTES = 120;

export const DEFAULT_CONFIG: AnalyticsConfig = {
  configVersion: CONFIG_VERSION,
  batchSize: BATCH_SIZE,
  maxDailyRequests: 50,
  maxRetry: MAX_RETRY,
  flushMode: 'next_day',
  lowUsageFlushMinutes: 1440,
  midUsageFlushMinutes: 1440,
  highUsageFlushMinutes: 1440,
  remoteEnabled: REMOTE_ENABLED,
  cancelHoldDelayMs: 1000,
  dailyFlushWindowStartUtc: DAILY_FLUSH_WINDOW_START_UTC,
  dailyFlushWindowMinutes: DAILY_FLUSH_WINDOW_MINUTES,
  maxEventsPerRequest: MAX_EVENTS_PER_REQUEST,
};

export const DEFAULT_META: AnalyticsMeta = {
  lastFlushAt: null,
  nextRetryAt: null,
  backoffIndex: 0,
  lastDailyFlushUtcDate: null,
  dailyFlushOffsetMinutes: null,
  lastKnownUtcMs: null,
  lastPerfMs: null,
  serverTimeOffsetMs: null,
  lastCommittedSeq: null,
};

// --- Backoff Steps (seconds) ---

export const BACKOFF_STEPS_SECONDS = [
  60,      // 1 min
  300,     // 5 min
  900,     // 15 min
  1800,    // 30 min
  3600,    // 1 hour
  10_800,  // 3 hours
  21_600,  // 6 hours
  43_200,  // 12 hours
  86_400,  // 1 day
];

// --- Worker URLs ---

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string || '';
export const WORKER_BASE_URL = WORKER_URL.replace(/\/+track$/, '');
export const CONFIG_URL = WORKER_BASE_URL ? `${WORKER_BASE_URL}/config` : '';
export const CHANGELOG_URL = WORKER_BASE_URL ? `${WORKER_BASE_URL}/changelog` : '';
const DEFAULT_WEBSITE_BASE_URL = 'https://classroom-quick-downloader-website.pages.dev';
const WEBSITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string) || DEFAULT_WEBSITE_BASE_URL;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export const WEBSITE_BASE_URL = normalizeBaseUrl(WEBSITE_URL) || DEFAULT_WEBSITE_BASE_URL;
export const CHANGELOG_SITE_URL = `${WEBSITE_BASE_URL}/changelog`;
export const TRACK_URL = WORKER_URL;

// --- Rate Limits ---

export const MAX_DAILY_REQUESTS = 50;
