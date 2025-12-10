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
  country?: string; // optional country ISO code or name
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
  byCountry: Record<string, number>;
  byErrorType: Record<string, number>; // NEW: breakdown by error_type
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
   * String label for quota level.
   * e.g. "BELOW_LIMITS", "QUOTA_SOFT_LIMIT", "ADMIN_REMOTE_OFF", ...
   */
  quotaLevel: string;

  /**
   * Human-readable label the dashboard shows, e.g. "chill", "busy", "emergency".
   */
  modeLabel: string;

  /**
   * Whether remote analytics should be considered enabled.
   */
  remoteEnabled: boolean;

  /**
   * Suggested batch size for extensions (events per POST).
   */
  batchSizeSuggestion: number;
}

/**
 * Snapshot of environment variables for the dashboard to display.
 */
export interface EnvSnapshot {
  maxBatchEvents: string;
  oracleEndpoint: string;
}

/**
 * Response payload for /stats (DO -> Worker -> dashboard).
 */
export interface StatsResponse {
  ok: boolean;

  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;
  pendingEvents: number;

  lastEventAt: number | null;
  lastFlushAt: number | null;

  counters: Counters;
  retryState: RetryState | null;

  quota: QuotaDescriptor;

  envSnapshot: EnvSnapshot;
}

/**
 * Response payload for /config (used by the extension).
 */
export interface ConfigResponse {
  ok: boolean;
  batchSize: number;
  timeFlushMinutes: {
    low: number;
    mid: number;
    high: number;
  };
  remoteEnabled: boolean;
  quota: QuotaDescriptor;
}

/**
 * Worker Env shape (bindings injected by Cloudflare).
 * This is used by index.ts (not the Durable Object itself).
 */
export interface Env {
  DOWNLOADS_DO: DurableObjectNamespace;
  DO_SHARED_SECRET: string;
  ORACLE_ENDPOINT: string;
  MAX_BATCH_EVENTS: string;
}