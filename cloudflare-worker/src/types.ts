// filepath: cloudflare-worker/src/types.ts

export interface Counters {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOs: Record<string, number>;
  byExtVersion: Record<string, number>;
  byLanguage: Record<string, number>;
}

export interface RetryState {
  lastError?: string;
  lastFlushAttemptAt?: number;
  consecutiveFailures: number;
  nextRetryAt?: number;
}

/**
 * Quota descriptor used by /stats and /config.
 * This is how the DO tells the extension and dashboard
 * "how close we are to Cloudflare daily limits" and what
 * batching to use.
 */
export interface QuotaDescriptor {
  /** Approximate number of analytics requests (e.g. /track) today. */
  requestsToday: number;
  /**
   * Internal level code based on thresholds:
   * "BELOW_LIMITS", "QUOTA_VERY_SOFT_LIMIT", "QUOTA_SOFT_LIMIT",
   * "QUOTA_VERY_NORMAL_LIMIT", "QUOTA_NORMAL_LIMIT",
   * "QUOTA_HARD_NORMAL_LIMIT", "QUOTA_HARD_LIMIT",
   * "QUOTA_VERY_HARD_LIMIT".
   */
  quotaLevel: string;
  /**
   * Human-friendly label, e.g. "chill", "kinda busy", "emergency".
   * Used directly in the dashboard UI.
   */
  modeLabel: string;
  /**
   * Whether the Worker wants extensions to continue sending
   * analytics remotely. At QUOTA_VERY_HARD_LIMIT this becomes false
   * so extensions should keep everything local (no hard stop).
   */
  remoteEnabled: boolean;
  /**
   * Suggested batch size for the extension (events per POST).
   * The extension will eventually fetch this via /config.
   */
  batchSizeSuggestion: number;
}

export interface StatsResponse {
  ok: boolean;

  totalEvents: number;
  totalDownloads: number;
  pendingEvents: number;
  lastEventAt: number | null;
  lastFlushAt: number | null;

  counters: Counters;

  retryState: RetryState | null;

  /**
   * Optional quota information. Old versions of the Worker
   * may not return it, so UI should handle `undefined`.
   */
  quota?: QuotaDescriptor;
}

/**
 * Config returned by GET /config for the extension.
 * This is NOT used yet by the current extension code, but
 * will be consumed in a later step.
 */
export interface ConfigResponse {
  ok: boolean;
  batchSize: number;
  timeFlushMinutes: {
    /** flush delay when user activity is very low (< 15 downloads) */
    low: number;
    /** flush delay for moderate activity (15–35 downloads) */
    mid: number;
    /** flush delay for higher activity (35–50 downloads) */
    high: number;
  };
  remoteEnabled: boolean;
  quota: QuotaDescriptor;
}

/**
 * Event shape as the DO currently stores it.
 * Kept here for type reuse; not changed in this step.
 */
export interface StoredEvent {
  status: "success" | "fail";
  file_type: string;
  browser: string;
  os: string;
  ext_version: string;
  duration_ms: number;
  bypass_used: boolean;
  error_type?: string;
  language: string;
  timestamp: number;
}