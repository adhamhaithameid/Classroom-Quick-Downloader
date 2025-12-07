// filepath: cloudflare-worker/src/types.ts

export interface Env {
  // Durable Object namespace binding (from wrangler.toml)
  DOWNLOADS_DO: DurableObjectNamespace;

  // Optional: endpoint for Oracle backend (Step 2 – can stay empty for now)
  ORACLE_ENDPOINT: string;

  // Optional: shared secret between DO and Oracle backend
  DO_SHARED_SECRET: string;

  // Maximum events in buffer before attempting a flush to Oracle
  MAX_BATCH_EVENTS?: string;
}

// Shape of a single analytics event as sent from the extension.
export interface AnalyticsEvent {
  status: 'success' | 'fail';
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

// Aggregated counters we keep server-side in the Durable Object.
export interface Counters {
  totalEvents: number;
  totalDownloads: number;
  success: number;
  fail: number;
  byFileType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOS: Record<string, number>;
  byLanguage: Record<string, number>;
  bySpeed: {
    fast: number;
    medium: number;
    slow: number;
  };
  bypassCount: number;
  lastEventAt: number | null;
}

// Stored pending events we might flush to Oracle later.
export interface PendingState {
  events: AnalyticsEvent[];
}

// Minimal retry state for future exponential backoff (Step 2).
export interface RetryState {
  attempts: number;
  nextAttemptAt: number | null;
  lastError?: string;
}