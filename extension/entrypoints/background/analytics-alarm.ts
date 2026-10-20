// filepath: extension/entrypoints/background/analytics-alarm.ts
/**
 * Analytics alarm setup for the periodic flush.
 */

import { Analytics } from '../utils/analytics';
import { IS_FIREFOX, recentDownloads } from './state';

let analyticsAlarmInitialized = false;

/**
 * Set up Chrome alarms for the periodic analytics flush.
 *
 * pu8n (2026-10): the flush alarm runs every 60 minutes (was 5) and the
 * CQD_CHANGELOG_DAILY alarm is gone — the changelog went fully manual
 * (fetchChangelogDetailed never touches the network), so its daily SW wake
 * was a pure no-op costing one service-worker start per install per day.
 * Stale changelog alarms on installed bases are cleared explicitly; the
 * flush alarm replaces by name, so existing installs pick up the new period
 * on the next service-worker start.
 *
 * Remote-config refresh is intentionally NOT scheduled: on the free model the
 * extension never fetches /config (it drove ~95% of the Worker's API traffic
 * and exhausted the free-plan quota). Re-introduce it behind a Pro
 * entitlement gate — see the analytics remote-config module.
 */
export function ensureAnalyticsAlarm(): void {
  if (analyticsAlarmInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  analyticsAlarmInitialized = true;

  try {
    chrome.alarms.create('CQD_ANALYTICS_FLUSH', { periodInMinutes: 60 });

    // Installed bases may still carry the retired daily changelog alarm.
    void chrome.alarms.clear('CQD_CHANGELOG_DAILY');

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'CQD_ANALYTICS_FLUSH') {
        Analytics.flush();
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
