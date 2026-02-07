// filepath: cloudflare-worker/src/types.ts

/**
 * Single stored analytics event in the Durable Object buffer.
 * This matches what the browser extension sends to /track.
 */
export interface StoredEvent {
  status: "success" | "fail" | "cancelled";
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
   * Optional unique ID for idempotency (deduplication).
   */
  id?: string;

  /**
   * Optional sender IP (masked or full) for debugging/abuse tracking.
   */
  ip_address?: string;

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
  totalCancelled?: number;
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
  // NEW: Changelog config
  changelogConfig?: ChangelogConfig;
}

/**
 * Worker Env shape (bindings injected by Cloudflare).
 * This is used by index.ts (not the Durable Object itself).
 */
export interface Env {
  DOWNLOADS_DO: DurableObjectNamespace;
  DO_SHARED_SECRET: string;
  DANGER_PASSWORD: string;
  ORACLE_ENDPOINT: string;
  MAX_BATCH_EVENTS: string;
}

/**
 * Changelog entry for manual updates.
 */
export interface ChangelogEntry {
  id: string; // UUID or timestamp based
  version: string;
  date: string; // ISO date string
  changes: string[]; // List of changes
  isImportant?: boolean; // Highlight in UI?
}

export interface NotificationRule {
  id: string;
  target: string; // "all" or specific version "1.2.3"
  priority: 'normal' | 'minor' | 'major';
  effect: 'none' | 'glow' | 'pulse';
}

/**
 * Configuration for the "Version Pill" in the extension.
 */
export interface ChangelogConfig {
  rules: NotificationRule[];
  lastUpdated?: number;
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
  
  // NEW: Changelog data for dashboard
  changelog: ChangelogEntry[];
  changelogConfig: ChangelogConfig;
}

// ---------------------------------------------------------------------------
// OracleBatch types (sent to Oracle backend)
// ---------------------------------------------------------------------------

/**
 * Aggregated totals for a single time bucket (typically one hour).
 */
export interface BucketTotals {
  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;
}

/**
 * Per-dimension counters for a time bucket.
 */
export interface BucketCounters {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOs: Record<string, number>;
  byExtVersion: Record<string, number>;
  byLanguage: Record<string, number>;
  byCountry: Record<string, number>;
  byErrorType: Record<string, number>;
}

/**
 * One aggregated time bucket (typically one hour).
 */
export interface TimeBucket {
  bucketStart: string; // RFC3339 UTC, e.g. "2025-12-11T03:00:00Z"
  bucketEnd: string;
  totals: BucketTotals;
  counters: BucketCounters;
}

/**
 * Detailed summary for the entire batch.
 * This aggregates all events in the payload into one view.
 */
export interface BatchSummary {
  totals: BucketTotals;
  // Full breakdowns
  browsers: Record<string, number>;
  os: Record<string, number>;
  countries: Record<string, number>;
  languages: Record<string, number>;
  versions: Record<string, number>;
  types: Record<string, number>;
  errorReasons: Record<string, number>;
  
  // Calculated "Top" stats
  topBrowser: string;
  topOs: string;
  topCountry: string;
  topType: string;
}

/**
 * DO state snapshot included in each batch.
 */
export interface DOStateBatch {
  ok: boolean;
  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;
  pendingEvents: number;
  lastEventAt: number | null;
  lastFlushAt: number | null;
  quota?: QuotaDescriptor;
  envSnapshot?: EnvSnapshot;
}

/**
 * The aggregated payload sent to Oracle backend.
 */
export interface OracleBatch {
  batchId: string;
  generatedAt: number; // Unix ms
  timeZone: string;
  
  // The new detailed summary for the whole batch
  summary: BatchSummary;
  
  timeBuckets: TimeBucket[];
  doState: DOStateBatch;
}