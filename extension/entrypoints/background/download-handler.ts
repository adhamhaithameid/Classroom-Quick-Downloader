// filepath: extension/entrypoints/background/download-handler.ts
/**
 * Core download handling logic for Drive and direct downloads.
 * Handles auth rotation (authuser cycling on the usercontent byte-serving
 * endpoint) and retry logic. Tab-free: no bypass windows, ever.
 */

import type { FileMetaMsg, PendingDownload } from './types';
import {
  registerPending,
  bindDownloadId,
  AUTHUSER_CANDIDATES,
} from './state';
import { sanitizeFileName } from '../../src/core/name/sanitize';
import { extractAuthUserFromUrl } from './auth-utils';
import { normalizeUrl, buildUrlWithAuthUser, getFilenameExt } from './url-helpers';
import { cleanup } from './cleanup';
import { sendStatusToTab } from './message-sender';
import { recordDownloadEvent } from '../utils/analytics';
import { validateDownloadUrl } from '../../src/v2/decision/download-validator';

/**
 * S2 (audit docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md): the
 * chrome.downloads.download callback never fires when the target host accepts
 * the connection but stalls, which used to leave the CQD_DOWNLOAD response
 * dangling until the 150s stall deadline reaped the pending. Every start now
 * races the callback against DOWNLOAD_START_TIMEOUT_MS and settles honestly;
 * a late callback after the timeout cancels the stray download and never
 * resurrects the settled flow.
 */
export const DOWNLOAD_START_TIMEOUT_MS = 15_000;

type StartHandler = (downloadId: number | undefined, hadError: boolean) => void;

export const DOWNLOAD_START_TIMEOUT_MESSAGE =
  'The download could not be started — the source never responded. Try again.';

/**
 * Shared S2 timeout settle: analytics + honest status + optional sendResponse
 * + cleanup. One body, four call sites (startSingleAttempt, attemptDriveStart,
 * startNextDriveAttempt, index.ts retrySameAttempt) so the copies cannot drift.
 */
export function handleStartTimeout(
  pending: PendingDownload,
  respondOnce?: (payload: any) => void,
): void {
  recordDownloadEvent({
    type: pending.fileMeta?.ext || 'unknown',
    status: 'fail',
    duration_ms: Date.now() - pending.startTime,
    bypass_used: false,
    error_type: 'DOWNLOAD_START_TIMEOUT',
  });
  sendStatusToTab(pending, 'error', DOWNLOAD_START_TIMEOUT_MESSAGE, 'DOWNLOAD_START_TIMEOUT');
  respondOnce?.({ started: false, userMessage: DOWNLOAD_START_TIMEOUT_MESSAGE });
  cleanup(pending);
}

export function startDownloadWithTimeout(
  url: string,
  pending: PendingDownload,
  handleStart: StartHandler,
  onTimeout: () => void,
): void {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    pending.startTimedOut = true;
    if (pending.isCancelled) return;
    onTimeout();
  }, DOWNLOAD_START_TIMEOUT_MS);
  try {
    chrome.downloads.download(
      { url, saveAs: false, conflictAction: 'uniquify' },
      (downloadId) => {
        clearTimeout(timer);
        if (pending.startTimedOut) {
          // Timeout already settled the flow. Kill the stray download if it
          // eventually started; never double-settle or resurrect.
          if (downloadId) {
            try {
              chrome.downloads.cancel(downloadId, () => { void chrome.runtime.lastError; });
            } catch { /* already gone */ }
          } else {
            void chrome.runtime.lastError;
          }
          return;
        }
        settled = true;
        handleStart(downloadId, !!chrome.runtime.lastError || !downloadId);
      },
    );
  } catch {
    clearTimeout(timer);
    if (!settled) {
      settled = true;
      handleStart(undefined, true);
    }
  }
}

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
    sendStatusToTab(pending, 'error', 'Download blocked: invalid URL.', 'INVALID_URL');
    respondOnce?.({ started: false, userMessage: 'Download blocked: invalid URL.' });
    return;
  }

  startDownloadWithTimeout(
    pending.baseUrl,
    pending,
    (downloadId, hadError) => {
      if (hadError) {
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
      bindDownloadId(pending, downloadId as number);
      respondOnce?.({ started: true, requestId: pending.requestId, downloadId });
    },
    () => handleStartTimeout(pending, respondOnce),
  );
}

/**
 * Try the next auth user for a Drive download.
 * Cycles through authuser=0..9 to find one with access.
 */
export function startNextDriveAttempt(pending: PendingDownload): void {
  pending.htmlSeen = false;

  const nextAuth = AUTHUSER_CANDIDATES.find(
    (n) => !pending.attemptedAuthUsers.includes(n)
  );

  if (nextAuth == null) {
    // Terminal after every signed-in account was tried: the next honest step
    // is for the user to confirm access directly in Drive.
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
    return;
  }

  pending.attemptedAuthUsers.push(nextAuth);
  pending.currentAuthUser = nextAuth;

  // Both browsers download natively: the usercontent byte-serving endpoint
  // needs no interstitial click-through, so the old Firefox bypass-tab-only
  // flow (and its visible windows) is gone. Account selection rides on the
  // authuser param of the attempt URL.
  const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);

  // Security gate: validate URL before downloading
  const validation = validateDownloadUrl(attemptUrl);
  if (!validation.valid) {
    console.error(`[CQD Security] Blocked Drive download: ${validation.reason} — ${attemptUrl}`);
    startNextDriveAttempt(pending);
    return;
  }

  startDownloadWithTimeout(
    attemptUrl,
    pending,
    (downloadId, hadError) => {
      if (hadError) {
        startNextDriveAttempt(pending);
        return;
      }
      bindDownloadId(pending, downloadId as number);
    },
    () => handleStartTimeout(pending),
  );
}

/**
 * S1 boundary (audit docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md): page-
 * controlled fileMeta.name is path-hardened at the single chokepoint every
 * download request crosses (the CQD_DOWNLOAD listener AND the bridge both
 * converge on handleDownloadRequest). Never rely on the browser sink alone.
 */
export function sanitizeDownloadName(
  fileMeta: FileMetaMsg | undefined,
): FileMetaMsg | undefined {
  if (!fileMeta?.name) return fileMeta;
  const name = sanitizeFileName(fileMeta.name);
  if (name === fileMeta.name) return fileMeta;
  return { ...fileMeta, name };
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
  const fileMeta = sanitizeDownloadName(message.fileMeta);
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
    isCancelled: false,
  };

  if (typeof initialAuthUser === 'number') {
    pending.initialAuthUser = initialAuthUser;
    pending.attemptedAuthUsers.push(initialAuthUser);
    pending.currentAuthUser = initialAuthUser;
  }

  registerPending(pending);

  let responseSent = false;
  const respondOnce = (payload: any) => {
    if (responseSent) return;
    responseSent = true;
    sendResponse?.(payload);
  };

  // Both browsers: try the native download first. The usercontent
  // byte-serving endpoint serves file bytes directly (no interstitial), so
  // the old Firefox bypass-tab-only flow — the visible-window regression —
  // is gone. HTML/403 responses are caught downstream by the filename
  // interceptor (Chromium) or the onCreated mime guard (Firefox).
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
      sendStatusToTab(pending, 'error', 'Download blocked: invalid URL.', 'INVALID_URL');
      respondOnce({ started: false, userMessage: 'Download blocked: invalid URL.' });
      cleanup(pending);
      return true;
    }

    const attemptDriveStart = (): void => {
      startDownloadWithTimeout(
        firstUrl,
        pending,
        (id, hadError) => {
          // Race condition check
          if (pending.isCancelled) {
            if (id) chrome.downloads.cancel(id, () => { const _ = chrome.runtime.lastError; });
            cleanup(pending, id);
            return;
          }

          if (hadError) {
            // No-dead-ends: the browser can transiently refuse a start.
            // Retry ONCE after a short beat, then settle with guidance.
            if (!pending.startRetried && !pending.isCancelled) {
              pending.startRetried = true;
              sendStatusToTab(pending, 'trying', 'Retrying…', 'START_RETRY');
              setTimeout(attemptDriveStart, 1_000);
              return;
            }
            recordDownloadEvent({
              type: pending.fileMeta?.ext || 'unknown',
              status: 'fail',
              duration_ms: Date.now() - pending.startTime,
              bypass_used: false,
              error_type: 'BROWSER_START_FAIL',
            });
            // Zero-tab contract: no bypass-tab fallback. Surface the honest
            // failure with guidance about the usual cause.
            respondOnce({
              started: false,
              userMessage: 'Browser blocked the download — check site permissions and try again.',
            });
            sendStatusToTab(pending, 'error', 'Browser blocked the download — check site permissions and try again.', 'BROWSER_START_FAIL');
            cleanup(pending);
            return;
          }
          bindDownloadId(pending, id as number);
          respondOnce({ started: true, requestId, downloadId: id });
        },
        () => handleStartTimeout(pending, respondOnce),
      );
    };
    attemptDriveStart();
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
