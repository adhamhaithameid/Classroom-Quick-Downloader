// filepath: extension/entrypoints/background/download-handler.ts
/**
 * Core download handling logic for Drive and direct downloads.
 * Handles auth rotation, bypass tabs, and retry logic.
 */

import type { PendingDownload } from './types';
import {
  pendingByRequestId,
  pendingByDownloadId,
  pendingByUrl,
  pendingByBypassTabId,
  AUTHUSER_CANDIDATES,
  IS_FIREFOX,
} from './state';
import { extractAuthUserFromUrl } from './auth-utils';
import { normalizeUrl, buildUrlWithAuthUser, getFilenameExt } from './url-helpers';
import { cleanup } from './cleanup';
import { sendStatusToTab } from './message-sender';
import { recordDownloadEvent } from '../utils/analytics';
import { validateDownloadUrl } from '../../src/v2/decision/download-validator';

/**
 * Start a single (non-Drive) download attempt.
 */
export function startSingleAttempt(
  pending: PendingDownload,
  respondOnce?: (payload: any) => void
): void {
  // Security gate: validate URL before downloading
  const validation = validateDownloadUrl(pending.baseUrl);
  if (!validation.valid) {
    console.error(`[CQD Security] Blocked download: ${validation.reason} — ${pending.baseUrl}`);
    cleanup(pending);
    respondOnce?.({ started: false, userMessage: 'Download blocked: invalid URL.' });
    return;
  }

  chrome.downloads.download(
    { url: pending.baseUrl, saveAs: false, conflictAction: 'uniquify' },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        recordDownloadEvent({
          type: pending.fileMeta?.ext || 'unknown',
          status: 'fail',
          duration_ms: Date.now() - pending.startTime,
          bypass_used: false,
          error_type: 'BROWSER_START_FAIL_DIRECT',
        });
        cleanup(pending);
        respondOnce?.({ started: false, userMessage: 'Browser blocked download.' });
        return;
      }
      pending.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, pending);
      respondOnce?.({ started: true, requestId: pending.requestId, downloadId });
    }
  );
}

/**
 * Open a bypass tab for Drive download (virus scan bypass).
 */
export function openDriveBypassTab(pending: PendingDownload, url: string): void {
  chrome.tabs.create({ url, active: false }, (tab) => {
    if (tab?.id != null) {
      pendingByBypassTabId.set(tab.id, pending);
    }
  });
}

/**
 * Try the next auth user for a Drive download.
 * Cycles through authuser=0..9 to find one with access.
 */
export function startNextDriveAttempt(pending: PendingDownload): void {
  pending.htmlSeen = false;
  pending.fallbackStarted = false;
  pending.confirmed403 = false;

  const nextAuth = AUTHUSER_CANDIDATES.find(
    (n) => !pending.attemptedAuthUsers.includes(n)
  );

  if (nextAuth == null) {
    sendStatusToTab(pending, 'error', 'Access denied for all accounts.', 'AUTH_ALL_FAILED');
    recordDownloadEvent({
      type: pending.fileMeta?.ext || 'unknown',
      status: 'fail',
      duration_ms: Date.now() - pending.startTime,
      bypass_used: true,
      error_type: 'AUTH_ALL_FAILED',
    });
    cleanup(pending);
    return;
  }

  pending.attemptedAuthUsers.push(nextAuth);
  pending.currentAuthUser = nextAuth;

  if (IS_FIREFOX) {
    // Firefox: Open bypass tab with next auth
    const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);
    openDriveBypassTab(pending, attemptUrl);
  } else {
    // Chrome: Try native download
    const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);

    // Security gate: validate URL before downloading
    const validation = validateDownloadUrl(attemptUrl);
    if (!validation.valid) {
      console.error(`[CQD Security] Blocked Drive download: ${validation.reason} — ${attemptUrl}`);
      startNextDriveAttempt(pending);
      return;
    }

    chrome.downloads.download(
      { url: attemptUrl, saveAs: false, conflictAction: 'uniquify' },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          startNextDriveAttempt(pending);
          return;
        }
        pending.currentDownloadId = downloadId;
        pendingByDownloadId.set(downloadId, pending);
      }
    );
  }
}

/**
 * Handle incoming CQD_DOWNLOAD message.
 * Creates pending download entry and initiates download.
 */
export function handleDownloadRequest(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const rawUrl = message.url as string | undefined;
  const fileMeta = message.fileMeta;
  const requestId = message.requestId || `req-${Date.now()}`;

  if (!rawUrl) {
    sendResponse?.({ started: false, userMessage: 'No valid link found.' });
    return true;
  }

  const { baseUrl, isDrive } = normalizeUrl(rawUrl);
  const initialAuthUser = isDrive ? extractAuthUserFromUrl(rawUrl) : undefined;

  const pending: PendingDownload = {
    requestId,
    startTime: Date.now(),
    originalUrl: rawUrl,
    baseUrl,
    isDrive,
    fileMeta,
    tabId: sender.tab?.id,
    attemptedAuthUsers: [],
    fallbackStarted: false,
    isCancelled: false,
  };

  if (typeof initialAuthUser === 'number') {
    pending.initialAuthUser = initialAuthUser;
    pending.attemptedAuthUsers.push(initialAuthUser);
    pending.currentAuthUser = initialAuthUser;
  }

  pendingByRequestId.set(requestId, pending);
  pendingByUrl.set(baseUrl, pending);

  let responseSent = false;
  const respondOnce = (payload: any) => {
    if (responseSent) return;
    responseSent = true;
    sendResponse?.(payload);
  };

  // Firefox: Always use bypass tab for Drive
  if (IS_FIREFOX && isDrive) {
    if (pending.isCancelled) {
      cleanup(pending);
      return true;
    }

    const bypassUrl =
      typeof pending.currentAuthUser === 'number'
        ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
        : pending.baseUrl;
    pending.fallbackStarted = true;
    openDriveBypassTab(pending, bypassUrl);
    respondOnce({ started: true, requestId, userMessage: 'Opening Drive tab…' });
    return true;
  }

  // Chrome/Edge: Try native download first
  if (isDrive) {
    if (pending.isCancelled) {
      cleanup(pending);
      return true;
    }

    const firstUrl =
      typeof pending.currentAuthUser === 'number'
        ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
        : pending.baseUrl;

    // Security gate: validate URL before downloading
    const validation = validateDownloadUrl(firstUrl);
    if (!validation.valid) {
      console.error(`[CQD Security] Blocked initial Drive download: ${validation.reason} — ${firstUrl}`);
      respondOnce({ started: false, userMessage: 'Download blocked: invalid URL.' });
      cleanup(pending);
      return true;
    }

    chrome.downloads.download(
      { url: firstUrl, saveAs: false, conflictAction: 'uniquify' },
      (id) => {
        // Race condition check
        if (pending.isCancelled) {
          if (id) chrome.downloads.cancel(id);
          cleanup(pending, id);
          return;
        }

        if (chrome.runtime.lastError || !id) {
          recordDownloadEvent({
            type: pending.fileMeta?.ext || 'unknown',
            status: 'fail',
            duration_ms: Date.now() - pending.startTime,
            bypass_used: true,
            error_type: 'BROWSER_START_FAIL',
          });
          if (!pending.fallbackStarted) {
            pending.fallbackStarted = true;
            openDriveBypassTab(pending, pending.baseUrl);
            respondOnce({
              started: true,
              requestId,
              userMessage: 'Browser blocked. Trying Drive tab…',
            });
          } else {
            respondOnce({ started: false, userMessage: 'Browser blocked download.' });
          }
          return;
        }
        pending.currentDownloadId = id;
        pendingByDownloadId.set(id, pending);
        respondOnce({ started: true, requestId, downloadId: id });
      }
    );
  } else {
    if (pending.isCancelled) {
      cleanup(pending);
      return true;
    }
    startSingleAttempt(pending, respondOnce);
  }

  return true;
}

// Re-export utilities needed by other modules
export { getFilenameExt, buildUrlWithAuthUser };
