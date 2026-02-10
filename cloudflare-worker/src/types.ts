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

  /**
   * Optional rollup count (compacted offline events).
   * When present, represents multiple events aggregated into this entry.
   */
  count?: number;

  /**
   * Optional rollup marker for compacted events.
   */
  rollup?: boolean;

  /**
   * Internal monotonic sequence assigned by the DO for commit tracking.
   */
  seq?: number;
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
   * Reason remote analytics is enabled/disabled.
   */
  remoteEnabledReason?: string;

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
  
  // Request tracking
  requestsToday: number;
  requestDate: string | null;
  uniqueRequestsToday: number;
  uniqueIpsToday: number; // Backwards compatibility
  // CAP INDICATOR: true when unique counts are approximated (10,000+ capped)
  isApproximated: boolean;
  
  // Remote config for dashboard display
  remoteConfig: {
    batchSize: number;
    maxDailyRequests: number;
    maxRetry: number;
    maxEventsPerRequest: number;
    maxBufferSize: number;
    flushMode: string;
    timeFlushMinutes: { low: number; mid: number; high: number };
    dailyFlushWindowStartUtc?: number;
    dailyFlushWindowMinutes?: number;
    configVersion?: number;
    cancelHoldDelayMs?: number;
    allowLegacyEvents?: boolean;
    healthThresholds?: {
      warnPendingBatches: number;
      criticalPendingBatches: number;
      warnFailures: number;
      criticalFailures: number;
      warnStaleMs: number;
      criticalStaleMs: number;
      warnBufferUtil: number;
      criticalBufferUtil: number;
    };
    healthNotifyIntervalsMs?: {
      warn: number;
      critical: number;
    };
    remoteEnabledReason?: string;
    hardRemoteOff: boolean;
  };
  
  // Buffer utilization
  bufferStatus: {
    currentSize: number;
    maxSize: number;
    utilizationPercent: string;
  };
  
  nextAlarmAt: string | null;
  
  // Changelog data for dashboard
  changelog: ChangelogEntry[];
  changelogConfig: ChangelogConfig;

  // End-to-end delivery metrics chain
  deliveryMetrics?: {
    totals: {
      accepted: number;
      stored: number;
      forwarded: number;
      committed: number;
    };
    recent: Array<{
      deliveryId: string;
      batchId: string;
      accepted: number;
      stored: number;
      forwarded: number;
      committed: number;
      status: "pending" | "forwarded" | "committed";
      createdAt: number;
      updatedAt: number;
    }>;
  };
  deliveryHealth?: {
    acceptedMinusCommitted: number;
    forwardedMinusCommitted: number;
  };

  // Structured failure sink summary
  failureSink?: {
    totalRollups: number;
    unsentRollups: number;
    recent: Array<{
      key: string;
      source: "cloudflare-do";
      stage: string;
      errorCode: string;
      errorDetail: string;
      sampleCount: number;
      unsentCount: number;
      firstTs: number;
      lastTs: number;
    }>;
  };
}

/**
 * Response payload for /config (used by the extension).
 */
export interface ConfigResponse {
  ok: boolean;
  configVersion?: number;
  batchSize: number;
  maxDailyRequests: number;
  maxRetry: number;
  maxEventsPerRequest: number;
  flushMode: string;
  timeFlushMinutes: {
    low: number;
    mid: number;
    high: number;
  };
  dailyFlushWindowStartUtc?: number;
  dailyFlushWindowMinutes?: number;
  remoteEnabled: boolean;
  remoteEnabledReason?: string;
  cancelHoldDelayMs?: number;
  allowLegacyEvents?: boolean;
  healthThresholds?: {
    warnPendingBatches: number;
    criticalPendingBatches: number;
    warnFailures: number;
    criticalFailures: number;
    warnStaleMs: number;
    criticalStaleMs: number;
    warnBufferUtil: number;
    criticalBufferUtil: number;
  };
  healthNotifyIntervalsMs?: {
    warn: number;
    critical: number;
  };
  serverTimeUtc?: number;
  committedSeq?: number;
  quota: QuotaDescriptor;
  // Changelog config
  changelogConfig?: ChangelogConfig;
}

export interface PipelineHealthResponse {
  ok: boolean;
  status: "ok" | "warn" | "critical";
  reasons: string[];
  now: number;
  bufferSize: number;
  maxBufferSize: number;
  bufferUtilization: number;
  pendingBatches: number;
  oldestPendingAgeMs: number | null;
  consecutiveFailures: number;
  lastFlushAt: number | null;
  lastEventAt: number | null;
  committedSeq: number;
  lastHealthNotifyAt: number | null;
  thresholds: {
    warnPendingBatches: number;
    criticalPendingBatches: number;
    warnFailures: number;
    criticalFailures: number;
    warnStaleMs: number;
    criticalStaleMs: number;
    warnBufferUtil: number;
    criticalBufferUtil: number;
  };
}

/**
 * Worker Env shape (bindings injected by Cloudflare).
 * This is used by index.ts (not the Durable Object itself).
 */
export interface Env {
  DOWNLOADS_DO: DurableObjectNamespace;
  DO_SHARED_SECRET: string;
  DASHBOARD_PASSWORD?: string;
  DANGER_PASSWORD: string;
  ORACLE_ENDPOINT: string;
  MAX_BATCH_EVENTS: string;
  ALERT_WEBHOOK_URL?: string;
  /**
   * Optional: Set to "true" to allow HTTP cookies on non-loopback hosts.
   * Use for LAN development only. Production should never set this.
   */
  ALLOW_INSECURE_COOKIES?: string;
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

// Duplicate interfaces removed for type safety - see definitions above

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

export interface BatchDeliverySnapshot {
  deliveryId: string;
  acceptedCount: number;
  storedCount: number;
  forwardedCount: number;
  committedCount: number;
  createdAt: number;
  minSeq?: number | null;
  maxSeq?: number | null;
}

export interface BatchFailureLogEntry {
  key: string;
  source: "cloudflare-do";
  stage: string;
  errorCode: string;
  errorDetail: string;
  sampleCount: number;
  tsUtc: number;
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
  delivery?: BatchDeliverySnapshot;
  failureLogs?: BatchFailureLogEntry[];
  
  // LEAN INGESTION: Unique IPs for Geo Map persistence
  // Raw events are intentionally excluded to reduce payload size
  uniqueIps: string[];
}
