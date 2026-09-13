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
  bindDownloadId,
  unbindDownloadId,
  getPendingByRequestId,
  getPendingByDownloadId,
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
   * A forbidden-family failure (403/HTML response) for a Drive pending:
   * cycle to the next signed-in account — but terminate immediately when the
   * previous attempt failed with the SAME reason. Google ignores per-account
   * selection on download requests for many setups, so identical failures
   * mean cycling is futile; two identical attempts are enough to know.
   * Finalized pendings (success already reported) are never resurrected.
   */
  function handleForbiddenFailure(pending: PendingDownloadLike, reason: string): void {
    if (pending.finalized) return;
    if (pending.lastForbiddenReason === reason) {
      terminateAuthFailure(pending);
      return;
    }
    pending.lastForbiddenReason = reason;
    if (!pending.htmlSeen) {
      pending.htmlSeen = true;
      sendStatusToTab(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
    }
    startNextDriveAttempt(pending);
  }

  function terminateAuthFailure(pending: PendingDownloadLike): void {
    sendStatusToTab(
      pending,
      'error',
      'Access denied for all your accounts. Open the file directly in Drive to confirm access.',
      'AUTH_ALL_FAILED',
    );
    recordDownloadEvent({
      type: pending.fileMeta?.ext || 'unknown',
      status: 'fail',
      duration_ms: Date.now() - pending.startTime,
      bypass_used: false,
      error_type: 'AUTH_ALL_FAILED',
    });
    cleanup(pending);
  }

  type PendingDownloadLike = NonNullable<ReturnType<typeof getPendingByDownloadId>>;

  // 1) Messages from drive_bypass.content.ts — removed: the zero-tab flow
  // never opens bypass tabs, so BYPASS_SUCCESS / 403_SEEN / consent queries
  // no longer exist.

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
          // An HTML response instead of the file is a forbidden/interstitial
          // page — a forbidden-family failure. Zero-tab contract: no bypass
          // tab; retry the next account (or terminal, via the early-exit).
          handleForbiddenFailure(pending, 'HTML_RESPONSE');
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

      if (!pending) return;

      // Firefox has no onDeterminingFilename: an HTML "download" is Drive's
      // interstitial or an error page, not the file. Cancel + erase it and
      // treat it as a forbidden-family failure (zero-tab contract).
      const mime = (item.mime || '').toLowerCase();
      const looksLikeHtml =
        mime.includes('html') ||
        getFilenameExt(item.filename) === 'html' ||
        getFilenameExt(item.filename) === 'htm';
      if (looksLikeHtml && pending.isDrive) {
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          const _ = chrome.runtime.lastError;
          chrome.downloads.erase({ id: item.id }, () => {
            const _2 = chrome.runtime.lastError;
          });
          unbindDownloadId(item.id);
          handleForbiddenFailure(pending!, 'HTML_RESPONSE');
        });
        return;
      }

      bindDownloadId(pending, item.id);
      const ext = getFilenameExt(item.filename);
      if (ext) pending.finalExtension = ext;
      if (!pending.finalized) {
        sendStatusToTab(pending, 'success');
        pending.finalized = true;
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
        handleForbiddenFailure(pending, errorType);
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
