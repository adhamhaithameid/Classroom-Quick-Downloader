// filepath: cloudflare-worker/src/downloads_do/constants.ts
/**
 * Constants and defaults for the Durable Object analytics buffer.
 */

import type { Counters, RetryState } from '../types';

// --- State defaults ---

export const DEFAULT_COUNTERS: Counters = {
  byStatus: {},
  byType: {},
  byBrowser: {},
  byOs: {},
  byExtVersion: {},
  byLanguage: {},
  byCountry: {},
  byErrorType: {},
};

export const DEFAULT_RETRY_STATE: RetryState = {
  consecutiveFailures: 0,
};

// --- Quota limits ---

/** Soft limit: Start suggesting smaller batches */
export const QUOTA_SOFT_LIMIT = 50_000;

/** Normal limit: Standard operation range */
export const QUOTA_NORMAL_LIMIT = 60_000;

/** Hard normal limit: Slightly elevated, reduce batch sizes */
export const QUOTA_HARD_NORMAL_LIMIT = 70_000;

/** Hard limit: Significant load, aggressive batching */
export const QUOTA_HARD_LIMIT = 80_000;

/** Very hard limit: Emergency mode, minimal analytics */
export const QUOTA_VERY_HARD_LIMIT = 90_000;

// --- Storage ---

/** Key used to store analytics state in DO storage */
export const STORAGE_KEY = 'analytics_state';

// --- Default config values ---

/** Default batch size for extension events */
export const DEFAULT_BATCH_SIZE = 50;

/** Default max daily requests per extension */
export const DEFAULT_MAX_DAILY_REQUESTS = 50;

/** Default max retry attempts */
export const DEFAULT_MAX_RETRY = 5;

/** Default max events per POST request */
export const DEFAULT_MAX_EVENTS_PER_REQUEST = 5000;

/** Default max events in buffer */
export const DEFAULT_MAX_BUFFER_SIZE = 50000;

/** Default flush mode */
export const DEFAULT_FLUSH_MODE: 'next_day' | 'time_based' = 'next_day';

/** Default time-based flush intervals */
export const DEFAULT_TIME_FLUSH_MINUTES = {
  low: 60,    // queue < 15 events
  mid: 30,    // 15-35 events
  high: 15,   // 35+ events
};

/** Default cancel hold delay in ms */
export const DEFAULT_CANCEL_HOLD_DELAY_MS = 1000;
