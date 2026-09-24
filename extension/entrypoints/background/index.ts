// filepath: extension/entrypoints/background/index.ts
/**
 * Main background script entry point.
 * Wires together all modules and sets up Chrome API listeners.
 *
 * This is the unified background script that works across browsers.
 * The download flow is tab-free: Drive downloads target the usercontent
 * byte-serving endpoint natively on every browser; browser differences are
 * limited to the filename hooks (onDeterminingFilename vs onCreated).
 */

import {
  pendingByRequestId,
  pendingByUrl,
  bindDownloadId,
  unbindDownloadId,
  getPendingByRequestId,
  getPendingByDownloadId,
  getUnclaimedPendingByUrl,
  setPendingExpiredHook,
  isRegistered,
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
  startSingleAttempt,
  startDownloadWithTimeout,
} from './download-handler';
import { Analytics, refreshRemoteAnalyticsConfig, recordDownloadEvent } from '../utils/analytics';
import { installRuntimeErrorReporting } from '../utils/analytics/runtime-errors';
import { buildUninstallUrl } from '../utils/analytics/flush';
import { loadStats } from '../utils/analytics/storage';
import { createWorkerRuntimeBridge } from '../../src/adapters/bridge/runtime-bridge';
import { startBridgeDownloadService } from './bridge-download-service';
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

/**
 * W3: the uninstall URL now carries compact download totals (d/a) alongside
 * source/browser/version, so they survive uninstall via the website's
 * uninstall page. URL assembly (including the 500-char cap that drops d/a
 * first) lives in the pure buildUninstallUrl; this stays a thin chrome caller.
 */
async function initializeUninstallUrl(): Promise<void> {
  const setUninstallURL = chrome?.runtime?.setUninstallURL;
  if (typeof setUninstallURL !== 'function') return;

  try {
    const extensionVersion = chrome.runtime?.getManifest?.().version || 'unknown';
    const stats = await loadStats();
    const uninstallUrl = buildUninstallUrl(UNINSTALL_SITE_URL, {
      source: 'extension',
      browser: detectRuntimeBrowser(),
      version: extensionVersion,
      stats: { total: stats.total, attempts: stats.attempts },
    });

    setUninstallURL(uninstallUrl, () => {
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
  // Report unhandled background errors as runtime_error analytics events
  // (rate-capped, signature-only; see utils/analytics/runtime-errors.ts).
  installRuntimeErrorReporting();
  refreshRemoteAnalyticsConfig().catch(() => {});
  // Startup catch-up: the flush decision gates everything, so this is safe and
  // idempotent (no-op unless a trigger is due, e.g. weekly slot catch-up).
  // W3: once the flush resolves, rebuild the uninstall URL so it carries the
  // post-flush local stats (last setUninstallURL call wins).
  Analytics.flush()
    .then(() => initializeUninstallUrl())
    .catch(() => {});
  void initializeUninstallUrl();
  chrome.runtime.onInstalled?.addListener(() => {
    void initializeUninstallUrl();
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
   * No-dead-ends: retry the SAME attempt (same URL, same account) once for
   * transient server/network failures. Used by the onChanged taxonomy.
   */
  function retrySameAttempt(pending: PendingDownloadLike): void {
    if (pending.isDrive) {
      const url =
        typeof pending.currentAuthUser === 'number'
          ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
          : pending.baseUrl;
      // S2: same start-timeout contract as the primary attempt paths.
      startDownloadWithTimeout(
        url,
        pending,
        (downloadId, hadError) => {
          if (hadError || downloadId == null) {
            sendStatusToTab(pending, 'error', t('downloadInterrupted'), 'RETRY_START_FAIL');
            cleanup(pending);
            return;
          }
          bindDownloadId(pending, downloadId);
        },
        () => {
          sendStatusToTab(
            pending,
            'error',
            'The download could not be started — the source never responded. Try again.',
            'DOWNLOAD_START_TIMEOUT',
          );
          cleanup(pending);
        },
      );
    } else {
      startSingleAttempt(pending);
    }
  }

  /**
   * Stall deadline: a pending that never settles must not leave the user's
   * button in "trying" until the silent TTL reap. The registry fires this
   * hook after PENDING_DEADLINE_MS.
   */
  setPendingExpiredHook((pending) => {
    if (pending.currentDownloadId != null) {
      try {
        chrome.downloads.cancel(pending.currentDownloadId, () => {
          const _ = chrome.runtime.lastError;
        });
      } catch {
        // Already gone.
      }
    }
    sendStatusToTab(pending, 'error', 'This download timed out. Try again.', 'TIMEOUT');
    cleanup(pending);
  });

  /**
   * A forbidden-family failure (403/HTML response) for a Drive pending:
   * cycle to the next signed-in account. Failure reasons are indistinguishable
   * across accounts — a later account may hold access even when earlier ones
   * got 403s — so the sweep always runs to its 10-account bound (invisible to
   * the user, a few seconds) before the honest terminal. Finalized pendings
   * (success already reported) are never resurrected.
   */
  function handleForbiddenFailure(pending: PendingDownloadLike): void {
    if (pending.finalized) return;
    if (!pending.htmlSeen) {
      pending.htmlSeen = true;
      sendStatusToTab(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
    }
    startNextDriveAttempt(pending);
  }

  type PendingDownloadLike = NonNullable<ReturnType<typeof getPendingByDownloadId>>;

  // 0) Bridge download service (S6/G2): serves CQD_BRIDGE_REQUEST messages
  //    from the page bus over the worker runtime bridge. Inert until the page
  //    side sends one; the legacy message flow is untouched.
  startBridgeDownloadService(createWorkerRuntimeBridge());

  // 1) onDeterminingFilename (Chrome only)
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

      if (looksLikeHtml && !userWantedHtml) {
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          const _ = chrome.runtime.lastError;
          unbindDownloadId(item.id);
          if (pending.isDrive) {
            // An HTML response instead of the file is a forbidden/interstitial
            // page — a forbidden-family failure. Zero-tab contract: no bypass
            // tab; retry under the next signed-in account until the sweep
            // exhausts, then the honest terminal.
            handleForbiddenFailure(pending);
          } else {
            // Non-Drive HTML (sign-in page, error page): never save garbage.
            sendStatusToTab(
              pending,
              'error',
              'This link requires signing in — open it in a browser tab and try again.',
              'HTML_RESPONSE',
            );
            cleanup(pending, item.id);
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

  // 2) onCreated (Firefox)
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
      const p = pending;

      // Firefox has no onDeterminingFilename: an HTML "download" is Drive's
      // interstitial or an error page, not the file. Cancel + erase it and
      // treat it as a forbidden-family failure (zero-tab contract).
      const mime = (item.mime || '').toLowerCase();
      const looksLikeHtml =
        mime.includes('html') ||
        getFilenameExt(item.filename) === 'html' ||
        getFilenameExt(item.filename) === 'htm';
      if (looksLikeHtml) {
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          const _ = chrome.runtime.lastError;
          chrome.downloads.erase({ id: item.id }, () => {
            const _2 = chrome.runtime.lastError;
          });
          unbindDownloadId(item.id);
          if (p.isDrive) {
            handleForbiddenFailure(p);
          } else {
            // Non-Drive HTML: never save garbage (Firefox branch).
            sendStatusToTab(
              p,
              'error',
              'This link requires signing in — open it in a browser tab and try again.',
              'HTML_RESPONSE',
            );
            cleanup(p, item.id);
          }
        });
        return;
      }

      // Correlate only: success is reported by the onChanged 'complete'
      // event, like Chromium — a download that has merely STARTED is not a
      // download that finished (Firefox-honesty fix).
      bindDownloadId(pending, item.id);
      const ext = getFilenameExt(item.filename);
      if (ext) pending.finalExtension = ext;
    });
  }

  // 3) onChanged: settle + analytics
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = getPendingByDownloadId(delta.id);
    if (!pending) return;

    if (delta.state && delta.state.current === 'complete') {
      // No-dead-ends: verify what actually landed. Chromium does NOT always
      // fire onDeterminingFilename (a text/html response with no
      // Content-Disposition completes silently), so read the finished
      // DownloadItem: an HTML "download" of a Drive file is an error page —
      // erase it and walk the forbidden path instead of reporting a fake
      // success.
      const reportSuccess = (finalFilename?: string): void => {
        const duration = Date.now() - pending.startTime;
        const ext =
          pending.finalExtension ||
          (finalFilename ? getFilenameExt(finalFilename) : undefined) ||
          pending.fileMeta?.ext ||
          'unknown';
        sendStatusToTab(pending, 'success');
        recordDownloadEvent({
          type: ext,
          status: 'success',
          duration_ms: duration,
          bypass_used: false,
        });
        if (pending.fileMeta?.name) recentDownloads.set(pending.fileMeta.name, Date.now());
        cleanup(pending, delta.id);
      };
      try {
        chrome.downloads.search({ id: delta.id }, (items) => {
          const _ = chrome.runtime.lastError;
          const item = items?.[0];
          const itemMime = (item?.mime || '').toLowerCase();
          if (pending.isDrive && !pending.finalized && itemMime.includes('html')) {
            cancelledByUs.add(delta.id);
            chrome.downloads.cancel(delta.id, () => {
              const _e = chrome.runtime.lastError;
              chrome.downloads.erase({ id: delta.id }, () => {
                const _e2 = chrome.runtime.lastError;
              });
              unbindDownloadId(delta.id);
              handleForbiddenFailure(pending);
            });
            return;
          }
          reportSuccess(item?.filename);
        });
      } catch {
        // Search unavailable — report the completion without verification.
        reportSuccess(undefined);
      }
      return;
    }

    if (delta.state && delta.state.current === 'interrupted') {
      if (cancelledByUs.has(delta.id)) {
        cancelledByUs.delete(delta.id);
        unbindDownloadId(delta.id);
        return;
      }
      const errorType = delta.error?.current || 'UNKNOWN_INTERRUPT';

      if (pending.finalized) {
        // Success was already reported (Firefox onCreated correlation path);
        // the pending must still settle NOW, event-driven — not linger to the
        // TTL sweep.
        cleanup(pending, delta.id);
        return;
      }

      // USER_CANCELED from the browser's own download shelf is the USER's
      // cancellation — report it as cancelled, never as an error.
      if (errorType === 'USER_CANCELED') {
        sendStatusToTab(pending, 'cancelled');
        cleanup(pending, delta.id);
        return;
      }

      const forbiddenFamily =
        errorType === 'SERVER_FORBIDDEN' || errorType === 'ACCESS_DENIED';
      if (pending.isDrive && forbiddenFamily) {
        unbindDownloadId(delta.id);
        handleForbiddenFailure(pending);
        return;
      }

      // No-dead-ends taxonomy: transient server/network failures get ONE
      // in-place retry (same URL, same account) before the honest terminal;
      // permanent failures fail fast with a message that names the cause.
      const TRANSIENT = new Set(['NETWORK_FAILED', 'SERVER_FAILED', 'NETWORK_TIMED_OUT']);
      const PERMANENT_MESSAGE: Record<string, string> = {
        FILE_FAILED: 'The file could not be saved. Try downloading it again.',
        STORAGE_FULL: 'Your disk is full — free up some space and try again.',
        CRASH: 'The browser crashed during the download. Try again.',
        SERVER_BAD_CONTENT: 'The file is no longer available at its source.',
        FILE_VIRUS_INFECTED: 'The file is infected and was blocked by your browser.',
        FILE_BLOCKED: 'Your browser blocked this file type for security reasons.',
      };
      if (TRANSIENT.has(errorType) && !pending.transientRetried) {
        pending.transientRetried = true;
        unbindDownloadId(delta.id);
        setTimeout(() => {
          if (!isRegistered(pending.requestId) || pending.finalized) return;
          retrySameAttempt(pending);
        }, 2_000);
        sendStatusToTab(pending, 'trying', 'Retrying…', 'TRANSIENT_RETRY');
        return;
      }

      const duration = Date.now() - pending.startTime;
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';
      recordDownloadEvent({
        type: ext,
        status: 'fail',
        duration_ms: duration,
        bypass_used: false,
        error_type: errorType,
      });
      const guidance = PERMANENT_MESSAGE[errorType];
      sendStatusToTab(pending, 'error', guidance ?? t('downloadInterrupted'), errorType);
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
      bypass_used: false,
    });

    cleanup(pending);
    return false;
  });
});
