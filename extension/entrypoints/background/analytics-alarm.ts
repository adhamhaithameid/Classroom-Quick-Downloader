// filepath: extension/entrypoints/background/analytics-alarm.ts
/**
 * Analytics alarm setup for periodic flush and config refresh.
 */

import { Analytics, refreshRemoteAnalyticsConfig } from '../utils/analytics';
import { IS_FIREFOX, recentDownloads } from './state';

let analyticsAlarmInitialized = false;

/**
 * Ensure periodic analytics-related Chrome alarms are created and listened for.
 *
 * No-ops if already initialized or if the Chrome alarms API is unavailable. Creates two alarms:
 * - `CQD_ANALYTICS_FLUSH` (every 5 minutes) — triggers `Analytics.flush()`.
 * - `CQD_ANALYTICS_CONFIG` (every 180 minutes) — triggers `refreshRemoteAnalyticsConfig()`; promise rejections are ignored.
 *
 * Errors thrown during alarm setup are swallowed to allow execution in contexts where alarms are unavailable.
 */
export function ensureAnalyticsAlarm(): void {
  if (analyticsAlarmInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  analyticsAlarmInitialized = true;

  try {
    chrome.alarms.create('CQD_ANALYTICS_FLUSH', { periodInMinutes: 5 });
    chrome.alarms.create('CQD_ANALYTICS_CONFIG', { periodInMinutes: 180 });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'CQD_ANALYTICS_FLUSH') {
        Analytics.flush();
      } else if (alarm.name === 'CQD_ANALYTICS_CONFIG') {
        refreshRemoteAnalyticsConfig().catch(() => {});
      }
    });
  } catch {
    // Alarms may not be available in all contexts
  }
}

/**
 * Firefox: Check and close file:// tabs that opened after download.
 * This handles the Firefox behavior of opening downloaded files in a new tab.
 */
export function checkAndCloseFileTab(tabId: number, url?: string): void {
  if (!IS_FIREFOX || !url || !url.startsWith('file://')) return;

  const filename = decodeURIComponent(url.split('/').pop() || '');
  const completionTime = recentDownloads.get(filename);

  if (completionTime && Date.now() - completionTime < 10000) {
    try {
      chrome.tabs.remove(tabId);
      recentDownloads.delete(filename);
    } catch {
      // Tab may already be closed
    }
  }
}