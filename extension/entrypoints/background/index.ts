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
  pendingByUrl,
  pendingByBypassTabId,
  registerPendingUrl,
  bindDownloadId,
  unbindDownloadId,
  unbindBypassTabId,
  getPendingByRequestId,
  getPendingByDownloadId,
  getPendingByBypassTabId,
  getUnclaimedPendingByUrl,
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
import {
  STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
  STUDENT_WORK_RESOLVE_RELAY_TYPE,
} from '../../src/student_work/constants';

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

interface StudentWorkResolveResultPayload {
  type: 'CQD_SW_RESOLVE_RESULT';
  requestId: string;
  ok: boolean;
  resolvedUrl?: string;
  reason?: string;
  source?: string;
}

interface StudentWorkResolvePublishMessage {
  type: typeof STUDENT_WORK_RESOLVE_PUBLISH_TYPE;
  payload: StudentWorkResolveResultPayload;
}

const STUDENT_WORK_VIEWER_URL_RE = /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?g\/tg\//;

function isStudentWorkResolvePublishMessage(value: unknown): value is StudentWorkResolvePublishMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  if (msg.type !== STUDENT_WORK_RESOLVE_PUBLISH_TYPE) return false;
  if (!msg.payload || typeof msg.payload !== 'object') return false;

  const payload = msg.payload as Record<string, unknown>;
  if (payload.type !== 'CQD_SW_RESOLVE_RESULT') return false;
  if (typeof payload.requestId !== 'string') return false;
  if (typeof payload.ok !== 'boolean') return false;
  if (payload.resolvedUrl != null && typeof payload.resolvedUrl !== 'string') return false;
  if (payload.reason != null && typeof payload.reason !== 'string') return false;
  if (payload.source != null && typeof payload.source !== 'string') return false;
  return true;
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
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.type === 'CQD_UPDATE_ICON' && sender.tab?.id != null) {
      updateTabIcon(sender.tab.id, sender.tab.url);
      return false;
    }
  });

  // 0b) Student Work resolver bridge relay (runtime-authenticated, tab-scoped)
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!isStudentWorkResolvePublishMessage(message)) return false;
    if (sender.tab?.id == null) return false;

    const senderUrl = sender.url || sender.tab.url || '';
    if (!STUDENT_WORK_VIEWER_URL_RE.test(senderUrl)) return false;

    try {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: STUDENT_WORK_RESOLVE_RELAY_TYPE,
        payload: message.payload,
      });
    } catch {
      // Ignore send failures when tab/frame is gone.
    }
    return false;
  });

  /**
   * Try the next signed-in Google account for a Drive pending: one 'trying'
   * status per attempt, then hand off to startNextDriveAttempt, which picks
   * the per-browser adapter and terminals with AUTH_ALL_FAILED when
   * exhausted. Guarded: a finalized pending (success already reported) is
   * never resurrected by a late failure message from a still-bound bypass tab.
   */
  function cycleNextDriveAccount(pending: NonNullable<ReturnType<typeof getPendingByBypassTabId>>): void {
    if (pending.finalized) return;
    if (!pending.htmlSeen) {
      pending.htmlSeen = true;
      sendStatusToTab(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
    }
    startNextDriveAttempt(pending);
  }

  // 1) Messages from drive_bypass.content.ts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!message || !sender.tab || sender.tab.id == null) return false;

    const tabId = sender.tab.id;
    const pending = getPendingByBypassTabId(tabId);

    // Consent gate for drive_bypass: only tabs the extension itself opened
    // (openDriveBypassTab) may auto-click through Drive interstitials.
    // Answered BEFORE the CQD_* drop-guard below, because unregistered tabs
    // are exactly the ones this check exists for.
    if (message.type === 'CQD_QUERY_BYPASS_CONSENT') {
      sendResponse({ allowed: getPendingByBypassTabId(tabId) !== undefined });
      return;
    }

    if (!pending && typeof message.type === 'string' && message.type.startsWith('CQD_')) {
      return;
    }

    if (message.type === 'CQD_BYPASS_SUCCESS') {
      if (pending) {
        pending.fallbackStarted = true;
        sendStatusToTab(pending, 'success');
        pending.finalized = true;
      }
      unbindBypassTabId(tabId);
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
      unbindBypassTabId(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {}

      // #537/#547: account cycling is browser-agnostic. startNextDriveAttempt
      // picks the adapter per browser (Firefox opens the next bypass tab,
      // Chromium re-downloads), so both get the full authuser sweep before the
      // terminal AUTH_ALL_FAILED — Firefox never terminal-fails on the first 403.
      cycleNextDriveAccount(pending);
      return;
    }

    if (message.type === 'CQD_REGISTER_BYPASS_URL' && pending && typeof message.url === 'string') {
      registerPendingUrl(pending, message.url);
      return;
    }
  });

  // 2) onDeterminingFilename (Chrome only)
  if (!IS_FIREFOX && chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      let pending = getPendingByDownloadId(item.id);
      if (!pending) {
        pending = getUnclaimedPendingByUrl(item.url) ?? getUnclaimedPendingByUrl(item.finalUrl || item.url);
        if (pending) {
          bindDownloadId(pending, item.id);
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
          const _ = chrome.runtime.lastError;
          unbindDownloadId(item.id);
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
      let pending = getPendingByDownloadId(item.id);

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
          // Check URL map (each URL may have multiple pending downloads)
          if (!pending) {
            outer: for (const [url, bucket] of pendingByUrl.entries()) {
              const urlFileId = extractDriveFileId(url);
              for (const p of bucket) {
                const pendingFileId =
                  urlFileId ||
                  extractDriveFileId(p.baseUrl) ||
                  extractDriveFileId(p.originalUrl);
                if (pendingFileId === downloadFileId) {
                  pending = p;
                  break outer;
                }
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
        // Fallback: URL map exact match (prefer entry without a download ID yet)
        if (!pending) {
          pending = getUnclaimedPendingByUrl(item.url);
        }
      }

      if (pending) {
        bindDownloadId(pending, item.id);
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
    const pending = getPendingByDownloadId(delta.id);
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
        unbindDownloadId(delta.id);
        return;
      }
      const errorType = delta.error?.current || 'UNKNOWN_INTERRUPT';

      // #537/#547 ("files start but fail"): a 403-class interrupt mid-stream
      // means the current account lacks access — retry under the next signed-in
      // account before giving up. Bounded by the authuser candidate sweep in
      // startNextDriveAttempt; success was already reported (finalized) and
      // self-cancelled downloads never reach this branch.
      const forbiddenFamily =
        errorType === 'SERVER_FORBIDDEN' || errorType === 'ACCESS_DENIED';
      if (pending.isDrive && forbiddenFamily) {
        unbindDownloadId(delta.id);
        cycleNextDriveAccount(pending);
        return;
      }

      const duration = Date.now() - pending.startTime;
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
    if (sender.id !== chrome.runtime.id) return false;
    if (!message || message.type !== 'CQD_DOWNLOAD') return false;
    return handleDownloadRequest(message, sender, sendResponse);
  });

  // 5) CQD_CANCEL_DOWNLOAD handler
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!message || message.type !== 'CQD_CANCEL_DOWNLOAD') return false;

    const requestId = message.requestId as string | undefined;
    if (!requestId) return false;

    const pending = getPendingByRequestId(requestId);
    if (!pending) return false;

    pending.isCancelled = true;

    if (pending.currentDownloadId != null) {
      const downloadId = pending.currentDownloadId;
      cancelledByUs.add(downloadId);
      try {
        chrome.downloads.cancel(downloadId, () => {
          const _ = chrome.runtime.lastError;
          chrome.downloads.erase({ id: downloadId }, () => { const _2 = chrome.runtime.lastError; });
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
        unbindBypassTabId(tabId);
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
