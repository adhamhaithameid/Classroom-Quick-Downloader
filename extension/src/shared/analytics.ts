// filepath: extension/src/shared/analytics.ts
/**
 * Analytics module - Re-exports from the canonical entrypoints location.
 */

// Re-export everything from the entrypoints analytics module
export {
  Analytics,
  recordDownloadEvent,
  refreshRemoteAnalyticsConfig,
  getCancelHoldDelayMs,
} from '../../entrypoints/utils/analytics/index';

// Re-export types for consumers
export type {
  AnalyticsEvent,
  LocalStats,
  AnalyticsConfig,
  AnalyticsMeta,
  RecordDownloadEventInput,
  DownloadSource,
} from '../../entrypoints/utils/analytics/types';