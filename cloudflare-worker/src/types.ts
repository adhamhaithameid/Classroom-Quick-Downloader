// filepath: cloudflare-worker/src/types.ts

/**
 * Single stored analytics event in the Durable Object buffer.
 * This matches what the browser extension sends to /track.
 */
export interface StoredEvent {
  status: "success" | "fail";
  file_type: string;
  browser: string;
  os: string;
  ext_version: string;
  duration_ms: number;
  bypass_used: boolean;
  language: string;
  timestamp: number;

  /**
   * Optional error code / reason for fails.
   * Example: "BROWSER_START_FAIL", "AUTH_ALL_FAILED", etc.
   */
  error_type?: string;

  /**
   * Optional tag: where this came from (download_all, single, etc.).
   */
  source?: string;
}

/**
 * Aggregated counters for stats.
 */
export interface Counters {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOs: Record<string, number>;
  byExtVersion: Record<string, number>;
  byLanguage: Record<string, number>;
}

/**
 * Retry/backoff state for Oracle flushing.
 */
export interface RetryState {
  consecutiveFailures: number;
  lastError?: string;
  lastFlushAttemptAt?: number; // timestamp (ms)
  nextRetryAt?: number;        // timestamp (ms)
}

/**
 * Quota / mode descriptor computed from daily request count.
 */
export interface QuotaDescriptor {
  /**
   * Approx. number of requests hitting the Worker today (UTC).
   */
  requestsToday: number;

  /**
   * String label for quota level, e.g. "BELOW_LIMITS", "QUOTA_SOFT_LIMIT",
   * "QUOTA_VERY_HARD_LIMIT", "ADMIN_REMOTE_OFF", etc.
   */
  quotaLevel: string;

  /**
   * Human-readable label the dashboard shows, e.g. "chill", "busy", "emergency".
   */
  modeLabel: string;

  /**
   * Whether remote analytics should be considered enabled.
   * If false, extensions should keep everything local.
   */
  remoteEnabled: boolean;

  /**
   * Suggested batch size for extensions (events per POST).
   */
  batchSizeSuggestion: number;
}

/**
 * Response payload for /stats (DO → Worker → dashboard).
 */
export interface StatsResponse {
  ok: boolean;

  totalEvents: number;
  totalDownloads: number;
  pendingEvents: number;

  lastEventAt: number | null;
  lastFlushAt: number | null;

  counters: Counters;
  retryState: RetryState | null;

  quota: QuotaDescriptor;
}

/**
 * Response payload for /config (used later by the extension).
 */
export interface ConfigResponse {
  ok: boolean;

  /**
   * Suggested batch size (events per POST).
   */
  batchSize: number;

  /**
   * Suggested flush intervals (minutes) for different quota regimes.
   */
  timeFlushMinutes: {
    low: number;
    mid: number;
    high: number;
  };

  /**
   * Whether remote analytics is currently allowed.
   */
  remoteEnabled: boolean;

  /**
   * Quota descriptor for extra context.
   */
  quota: QuotaDescriptor;
}

/**
 * Worker Env shape (for the main Worker entrypoint).
 * This is what `fetch(request, env: Env)` sees.
 *
 * The same interface can also be used by the Durable Object constructor
 * if you want a single unified Env type.
 */
export interface Env {
  /**
   * Durable Object namespace for DownloadsDurable.
   */
  DOWNLOADS_DO: DurableObjectNamespace;

  /**
   * Shared secret used for:
   * - Admin dashboard login (password)
   * - Admin DO endpoints (X-Admin-Secret / X-DO-SECRET)
   */
  DO_SHARED_SECRET: string;

  /**
   * Oracle backend endpoint used by the Durable Object flush logic.
   */
  ORACLE_ENDPOINT: string;

  /**
   * Max number of events to flush in one Oracle POST.
   * Typically something like "500".
   */
  MAX_BATCH_EVENTS: string;
}