// filepath: extension/entrypoints/background/analytics-alarm.ts
/**
 * Analytics alarm setup for periodic flush and config refresh.
 */

import { Analytics, refreshRemoteAnalyticsConfig } from '../utils/analytics';
import { IS_FIREFOX, recentDownloads } from './state';

let analyticsAlarmInitialized = false;

/**
 * Set up Chrome alarms for periodic analytics operations.
 * - Flush events every 5 minutes
 * - Refresh remote config every 3 hours
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
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Restricted window: 11:55 PM (23:55) to 12:05 AM (00:05)
        const isRestrictedTime = 
          (hours === 23 && minutes >= 55) || 
          (hours === 0 && minutes <= 5);

        if (!isRestrictedTime) {
          Analytics.flush();
        }
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
