// filepath: extension/entrypoints/utils/analytics.ts
/**
 * Analytics module - Re-exports from modularized structure.
 * This file maintains backward compatibility while delegating to
 * the new modular analytics implementation.
 */

// Re-export everything from the modular analytics module
export {
  Analytics,
  recordDownloadEvent,
  refreshRemoteAnalyticsConfig,
  getCancelHoldDelayMs,
} from './analytics/index';

// Re-export types for consumers
export type {
  AnalyticsEvent,
  LocalStats,
  AnalyticsConfig,
  AnalyticsMeta,
  RecordDownloadEventInput,
  DownloadSource,
} from './analytics/types';