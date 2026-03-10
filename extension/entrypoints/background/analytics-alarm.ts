// filepath: extension/entrypoints/background/analytics-alarm.ts
/**
 * Analytics alarm setup for periodic flush and config refresh.
 */

import { Analytics, refreshRemoteAnalyticsConfig } from '../utils/analytics';
import { fetchChangelogDetailed } from '../utils/changelog';
import { IS_FIREFOX, recentDownloads } from './state';

let analyticsAlarmInitialized = false;

/**
 * Set up Chrome alarms for periodic analytics operations.
 * - Flush events every 5 minutes
 * - Refresh remote config every 3 hours
 * - Refresh changelog once/day at 6pm UTC
 */
export function ensureAnalyticsAlarm(): void {
  if (analyticsAlarmInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  analyticsAlarmInitialized = true;

  try {
    chrome.alarms.create('CQD_ANALYTICS_FLUSH', { periodInMinutes: 5 });
    chrome.alarms.create('CQD_ANALYTICS_CONFIG', { periodInMinutes: 180 });

    // Changelog: once/day at 6pm UTC
    const now = new Date();
    const next6pmUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      18, 0, 0, 0
    ));
    // If 6pm UTC has already passed today, schedule for tomorrow
    if (next6pmUtc.getTime() <= now.getTime()) {
      next6pmUtc.setUTCDate(next6pmUtc.getUTCDate() + 1);
    }
    chrome.alarms.create('CQD_CHANGELOG_DAILY', {
      when: next6pmUtc.getTime(),
      periodInMinutes: 1440, // 24 hours
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'CQD_ANALYTICS_FLUSH') {
        Analytics.flush();
      } else if (alarm.name === 'CQD_ANALYTICS_CONFIG') {
        refreshRemoteAnalyticsConfig().catch(() => {});
      } else if (alarm.name === 'CQD_CHANGELOG_DAILY') {
        fetchChangelogDetailed(true).catch(() => {});
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
