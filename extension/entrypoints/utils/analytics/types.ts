// filepath: extension/entrypoints/utils/analytics/types.ts
/**
 * Analytics type definitions.
 */

export interface AnalyticsEvent {
  status: 'success' | 'fail' | 'cancelled';
  file_type: string;
  browser: string;
  os: string;
  ext_version: string;
  duration_ms: number;
  bypass_used: boolean;
  error_type?: string;
  language: string;
  timestamp: number;
  id?: string;
  source?: string;
  retryCount?: number;
}

export interface LocalStats {
  total: number;
  byType: Record<string, number>;
  success?: number;
  fail?: number;
  cancelled?: number;
  attempts?: number;
  bySpeed?: {
    fast: number;
    medium: number;
    slow: number;
  };
  bypassCount?: number;
  failByErrorType?: Record<string, number>;
  byLanguage?: Record<string, number>;
  lastUpdated?: number;
}

export interface AnalyticsConfig {
  batchSize: number;
  maxDailyRequests: number;
  maxRetry: number;
  flushMode: 'next_day' | 'time_based';
  lowUsageFlushMinutes: number;
  midUsageFlushMinutes: number;
  highUsageFlushMinutes: number;
  remoteEnabled: boolean;
  cancelHoldDelayMs: number;
  /**
   * Max events allowed per request (worker-side limit).
   * Defaults to 5000 if not provided by remote config.
   */
  maxEventsPerRequest?: number;
}

export interface AnalyticsMeta {
  lastFlushAt: number | null;
  nextRetryAt: number | null;
  backoffIndex: number;
  lastDailyFlushUtcDate?: string | null;
  dailyFlushOffsetMinutes?: number | null;
  lastKnownUtcMs?: number | null;
  lastPerfMs?: number | null;
}

export interface RateLimitState {
  date: string;
  count: number;
}

export interface WorkerResponse {
  ok: boolean;
  error?: string;
  message?: string;
  accepted?: number;
  acceptedIds?: string[];
  duplicateIds?: string[];
  invalidIds?: string[];
}

export interface FlushResult {
  success: boolean;
  rateLimited?: boolean;
  serverOverloaded?: boolean;
  accepted?: number;
  acceptedIds?: string[];
  duplicateIds?: string[];
  invalidIds?: string[];
  error?: string;
}

export type DownloadSource = 'single' | 'download_all' | 'keyboard';

export interface RecordDownloadEventInput {
  type: string;
  status: 'success' | 'fail' | 'cancelled';
  source?: DownloadSource;
  duration_ms?: number;
  bypass_used?: boolean;
  error_type?: string;
}
