// filepath: extension/entrypoints/background/index.ts
/**
 * Main background script entry point.
 * Wires together all modules and sets up Chrome API listeners.
 *
 * This is the unified background script that works across browsers.
 * Firefox and Chrome/Edge have slightly different download handling
 * (Firefox uses bypass tabs exclusively for Drive).
 */

import {
  pendingByRequestId,
  pendingByDownloadId,
  pendingByUrl,
  pendingByBypassTabId,
  cancelledByUs,
  recentDownloads,
  CLEANUP_INTERVAL_MS,
  IS_FIREFOX,
} from './state';
import { createIconUpdaters, isClassroomUrl, setActionIcon, GRAY_ICON_PATHS } from './icon-manager';
import { extractDriveFileId } from './auth-utils';
import { getFilenameExt, buildUrlWithAuthUser } from './url-helpers';
import { cleanup, cleanupOrphanedPendingDownloads } from './cleanup';
import { ensureAnalyticsAlarm, checkAndCloseFileTab } from './analytics-alarm';
import { sendStatusToTab } from './message-sender';
import {
  handleDownloadRequest,
  startNextDriveAttempt,
  openDriveBypassTab,
} from './download-handler';
import { refreshRemoteAnalyticsConfig, recordDownloadEvent } from '../utils/analytics';
import { UNINSTALL_SITE_URL } from '../utils/analytics/constants';
import { t } from '../content/i18n';

// =====================================================
// MAIN ENTRYPOINT
// =====================================================

function detectRuntimeBrowser(): 'chrome' | 'firefox' | 'edge' {
  if (IS_FIREFOX) return 'firefox';
  if (typeof navigator !== 'undefined' && /Edg\//i.test(navigator.userAgent)) {
    return 'edge';
  }
  return 'chrome';
}

function initializeUninstallUrl(): void {
  const setUninstallURL = chrome?.runtime?.setUninstallURL;
  if (typeof setUninstallURL !== 'function') return;

  const extensionVersion = chrome.runtime?.getManifest?.().version || 'unknown';
  const uninstallUrl = new URL(UNINSTALL_SITE_URL);
  uninstallUrl.searchParams.set('source', 'extension');
  uninstallUrl.searchParams.set('browser', detectRuntimeBrowser());
  uninstallUrl.searchParams.set('version', extensionVersion);

  try {
    setUninstallURL(uninstallUrl.toString(), () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // Ignore uninstall URL initialization failures in unsupported runtimes.
  }
}

export default defineBackground(() => {
  // Initialize analytics alarms
  ensureAnalyticsAlarm();
  refreshRemoteAnalyticsConfig().catch(() => {});
  initializeUninstallUrl();
  chrome.runtime.onInstalled?.addListener(() => {
    initializeUninstallUrl();
  });

  // Memory leak prevention: periodic cleanup
  setInterval(cleanupOrphanedPendingDownloads, CLEANUP_INTERVAL_MS);
  setTimeout(cleanupOrphanedPendingDownloads, 60 * 1000);

  // Create icon update closures
  const { updateTabIcon, updateGlobalIcon } = createIconUpdaters();

  // Initial extension state check
  chrome.storage.local.get('extensionEnabled', (res) => {
    const enabled = res.extensionEnabled !== false;
    updateGlobalIcon(enabled);
  });

  // Listen for global toggle changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionEnabled) {
      updateGlobalIcon(changes.extensionEnabled.newValue !== false);
    }
  });

  // Tab updates: switch icon based on URL
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete' || changeInfo.url) {
      updateTabIcon(tabId, tab.url);
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      updateTabIcon(activeInfo.tabId, tab.url);
    });
  });

  // -------------------------------------------------------
  // Message Listeners
  // -------------------------------------------------------

  // 0) Icon update from content scripts
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'CQD_UPDATE_ICON' && sender.tab?.id != null) {
      updateTabIcon(sender.tab.id, sender.tab.url);
      return false;
    }
  });

  // 1) Messages from drive_bypass.content.ts
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || !sender.tab || sender.tab.id == null) return false;

    const tabId = sender.tab.id;
    const pending = pendingByBypassTabId.get(tabId);

    if (!pending && typeof message.type === 'string' && message.type.startsWith('CQD_')) {
      return;
    }

    if (message.type === 'CQD_BYPASS_SUCCESS') {
      if (pending) {
        pending.fallbackStarted = true;
        sendStatusToTab(pending, 'success');
        pending.finalized = true;
      }
      pendingByBypassTabId.delete(tabId);
      setTimeout(() => {
        try {
          chrome.tabs.remove(tabId);
        } catch {}
      }, 5000);
      return;
    }

    if (message.type === 'CQD_403_SEEN' && pending) {
      pending.confirmed403 = true;
      pending.fallbackStarted = true;
      pendingByBypassTabId.delete(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {}

      if (IS_FIREFOX) {
        sendStatusToTab(pending, 'error', 'Access denied. Try opening the file directly.', 'ACCESS_DENIED');
        recordDownloadEvent({
          type: pending.fileMeta?.ext || 'unknown',
          status: 'fail',
          duration_ms: Date.now() - pending.startTime,
          bypass_used: true,
          error_type: 'ACCESS_DENIED_FIREFOX',
        });
        cleanup(pending);
      } else {
        if (!pending.htmlSeen) {
          pending.htmlSeen = true;
          sendStatusToTab(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
        }
        startNextDriveAttempt(pending);
      }
      return;
    }

    if (message.type === 'CQD_REGISTER_BYPASS_URL' && pending && typeof message.url === 'string') {
      pendingByUrl.set(message.url, pending);
      return;
    }
  });

  // 2) onDeterminingFilename (Chrome only)
  if (!IS_FIREFOX && chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      let pending = pendingByDownloadId.get(item.id);
      if (!pending) {
        pending = pendingByUrl.get(item.url) ?? pendingByUrl.get(item.finalUrl || item.url);
        if (pending) {
          pending.currentDownloadId = item.id;
          pendingByDownloadId.set(item.id, pending);
        }
      }
      if (!pending) {
        suggest();
        return;
      }

      const actualMime = (item.mime || '').toLowerCase();
      const actualExt = getFilenameExt(item.filename);
      if (actualExt) pending.finalExtension = actualExt;

      const expectedKind = pending.fileMeta?.kind;
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const looksLikeHtml =
        actualMime.includes('html') || actualExt === 'html' || actualExt === 'htm';
      const userWantedHtml =
        expectedKind === 'html' || expectedExt === 'html' || expectedExt === 'htm';

      if (looksLikeHtml && !userWantedHtml && pending.isDrive) {
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          pendingByDownloadId.delete(item.id);
          if (!pending.htmlSeen) {
            pending.htmlSeen = true;
            sendStatusToTab(
              pending,
              'trying',
              'Google Drive needs an extra confirmation…',
              'HTML_INTERCEPT'
            );
          }
          if (pending.confirmed403) {
            startNextDriveAttempt(pending);
            return;
          }
          if (!pending.fallbackStarted) {
            pending.fallbackStarted = true;
            openDriveBypassTab(pending, item.finalUrl || item.url || pending.baseUrl);
          }
        });
        return;
      }

      sendStatusToTab(pending, 'success');
      if (pending.fileMeta?.name) {
        suggest({ filename: pending.fileMeta.name, conflictAction: 'uniquify' });
      } else {
        suggest({ filename: 'classroom_download', conflictAction: 'uniquify' });
      }
    });
  }

  // 2b) onCreated (Firefox)
  if (IS_FIREFOX && chrome.downloads && chrome.downloads.onCreated) {
    chrome.downloads.onCreated.addListener((item) => {
      let pending = pendingByDownloadId.get(item.id);

      if (!pending && item.url) {
        const downloadFileId = extractDriveFileId(item.url);
        if (downloadFileId) {
          // Check bypass tabs
          for (const [tabId, p] of pendingByBypassTabId.entries()) {
            const pendingFileId =
              extractDriveFileId(p.baseUrl) || extractDriveFileId(p.originalUrl);
            if (pendingFileId === downloadFileId) {
              pending = p;
              break;
            }
          }
          // Check URL map
          if (!pending) {
            for (const [url, p] of pendingByUrl.entries()) {
              const pendingFileId =
                extractDriveFileId(url) ||
                extractDriveFileId(p.baseUrl) ||
                extractDriveFileId(p.originalUrl);
              if (pendingFileId === downloadFileId) {
                pending = p;
                break;
              }
            }
          }
          // Check request ID map
          if (!pending) {
            for (const [reqId, p] of pendingByRequestId.entries()) {
              const pendingFileId =
                extractDriveFileId(p.baseUrl) || extractDriveFileId(p.originalUrl);
              if (pendingFileId === downloadFileId) {
                pending = p;
                break;
              }
            }
          }
        }
        // Fallback: URL map exact match
        if (!pending) {
          pending = pendingByUrl.get(item.url);
        }
      }

      if (pending) {
        pending.currentDownloadId = item.id;
        pendingByDownloadId.set(item.id, pending);
        const ext = getFilenameExt(item.filename);
        if (ext) pending.finalExtension = ext;
        if (!pending.finalized) {
          sendStatusToTab(pending, 'success');
          pending.finalized = true;
        }
      }
    });
  }

  // 3) onChanged: Analytics trigger
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    if (delta.state && delta.state.current === 'complete') {
      const duration = Date.now() - pending.startTime;
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';
      sendStatusToTab(pending, 'success');
      recordDownloadEvent({
        type: ext,
        status: 'success',
        duration_ms: duration,
        bypass_used: !!pending.fallbackStarted,
      });
      if (pending.fileMeta?.name) recentDownloads.set(pending.fileMeta.name, Date.now());
      cleanup(pending, delta.id);
      return;
    }

    if (delta.state && delta.state.current === 'interrupted') {
      if (cancelledByUs.has(delta.id)) {
        cancelledByUs.delete(delta.id);
        pendingByDownloadId.delete(delta.id);
        return;
      }
      const duration = Date.now() - pending.startTime;
      const errorType = delta.error?.current || 'UNKNOWN_INTERRUPT';
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';
      recordDownloadEvent({
        type: ext,
        status: 'fail',
        duration_ms: duration,
        bypass_used: !!pending.fallbackStarted,
        error_type: errorType,
      });
      sendStatusToTab(pending, 'error', t('downloadInterrupted'));
      cleanup(pending, delta.id);
    }
  });

  // 4) CQD_DOWNLOAD handler
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') return false;
    return handleDownloadRequest(message, sender, sendResponse);
  });

  // 5) CQD_CANCEL_DOWNLOAD handler
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'CQD_CANCEL_DOWNLOAD') return false;

    const requestId = message.requestId as string | undefined;
    if (!requestId) return false;

    const pending = pendingByRequestId.get(requestId);
    if (!pending) return false;

    pending.isCancelled = true;

    if (pending.currentDownloadId != null) {
      const downloadId = pending.currentDownloadId;
      cancelledByUs.add(downloadId);
      try {
        chrome.downloads.cancel(downloadId, () => {
          chrome.downloads.erase({ id: downloadId }, () => {});
        });
      } catch {}
    } else {
      // Cancelled before download ID assigned
    }

    for (const [tabId, p] of pendingByBypassTabId.entries()) {
      if (p.requestId === requestId) {
        try {
          chrome.tabs.remove(tabId);
        } catch {}
        pendingByBypassTabId.delete(tabId);
        break;
      }
    }

    recordDownloadEvent({
      type: pending.fileMeta?.ext || 'unknown',
      status: 'cancelled',
      duration_ms: Date.now() - pending.startTime,
      bypass_used: pending.fallbackStarted || false,
    });

    cleanup(pending);
    return false;
  });
});
