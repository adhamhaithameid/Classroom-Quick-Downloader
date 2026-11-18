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
  pendingByUrlAdd,
  pendingByRequestId,
  isRegistered,
  cancelledByUs,
} from './state';
import { sanitizeFileName } from '../../src/core/name/sanitize';
import { extractAuthUserFromUrl, extractDriveFileId } from './auth-utils';
import { normalizeUrl, buildUrlWithAuthUser, getFilenameExt } from './url-helpers';
import {
  nextAcquireState,
  type AcquireEffect,
  type AcquireMachineState,
} from '../../src/core/acquire/state-machine';
import { cleanup } from './cleanup';
import { sendStatusToTab } from './message-sender';
import { recordDownloadEvent } from '../utils/analytics';
import { validateDownloadUrl } from '../../src/v2/decision/download-validator';
import { queueRequest } from './queue';
import { recordDownloadHistory } from '../../src/history/history-store';
import { getIconAnimationController } from './icon-animation';

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

/**
 * D4 defense: claim a freshly started browser download for this pending, or
 * — when the registry no longer tracks it (user cancel, TTL reap) — kill the
 * stray so no orphan transfer runs unobserved. Returns the bind result.
 */
function claimOrCancelStray(pending: PendingDownload, downloadId: number): boolean {
  if (bindDownloadId(pending, downloadId)) return true;
  if (isRegistered(pending.requestId)) return false; // id bound elsewhere; not ours to kill
  cancelledByUs.add(downloadId);
  try {
    chrome.downloads.cancel(downloadId, () => { void chrome.runtime.lastError; });
  } catch { /* already gone */ }
  return false;
}

/**
 * Use-case context for terminal analytics events (1ef6.1): the requester's
 * view + engine mode plus the acquisition strategy the flow actually used.
 */
export function eventContextFor(pending: {
  pageType?: string;
  engineMode?: string;
  isDrive: boolean;
}): { pageType?: string; engineMode?: string; strategy: 'drive-auth' | 'direct' } {
  return {
    pageType: pending.pageType,
    engineMode: pending.engineMode,
    strategy: pending.isDrive ? 'drive-auth' : 'direct',
  };
}

export const DOWNLOAD_START_TIMEOUT_MESSAGE =
  'The download could not be started — the source never responded. Try again.';

/** 0h4d.1.2: capture the declared size once, for progress + 1.5 verification. */
function captureTotalBytes(pending: PendingDownload, downloadId: number): void {
  try {
    chrome.downloads.search({ id: downloadId }, (items) => {
      void chrome.runtime.lastError;
      const item = items?.[0];
      if (item && typeof item.totalBytes === 'number' && item.totalBytes > 0) {
        pending.totalBytes = item.totalBytes;
      }
    });
  } catch {
    // Search unavailable — progress stays unknown; downloads still work.
  }
}

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
    ...eventContextFor(pending),
    type: pending.fileMeta?.ext || 'unknown',
    status: 'fail',
    duration_ms: Date.now() - pending.startTime,
    bypass_used: false,
    retries: pending.retryCount ?? 0,
    error_type: 'DOWNLOAD_START_TIMEOUT',
  });
  sendStatusToTab(pending, 'error', DOWNLOAD_START_TIMEOUT_MESSAGE, 'DOWNLOAD_START_TIMEOUT');
  void recordDownloadHistory(pending, 'failed', 'DOWNLOAD_START_TIMEOUT');
  getIconAnimationController()?.notifySettled('fail');
  respondOnce?.({ started: false, userMessage: DOWNLOAD_START_TIMEOUT_MESSAGE });
  cleanup(pending);
}

export function startDownloadWithTimeout(
  url: string,
  pending: PendingDownload,
  handleStart: StartHandler,
  onTimeout: () => void,
): void {
  // #878 (oso5): the URL bucket must cover every URL the download can arrive
  // under, authuser-rotated attempt URLs included. Otherwise the filename
  // suggestion misses during the bind race and Chrome falls back to its bare
  // `download` stem (the download1, download2… junk the user reported).
  // Re-registering the baseUrl is a no-op: buckets are Sets of pendings.
  pendingByUrlAdd(url, pending);
  let settled = false;
  const timer = setTimeout(() => {
    // No settled re-check here: both settle paths (callback, sync throw)
    // clearTimeout first, and a fired timer cannot be un-fired — the guard
    // would be unreachable armor. The callback's startTimedOut check below
    // is what actually neutralizes the post-timeout callback.
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
        // D4: a cancel that landed while the browser was deciding must not
        // leave the late-starting download running untracked. The settle is
        // the race path's cleanup — no handleStart, no double-settle.
        if (pending.isCancelled) {
          if (downloadId) {
            try {
              chrome.downloads.cancel(downloadId, () => { void chrome.runtime.lastError; });
            } catch { /* already gone */ }
          } else {
            void chrome.runtime.lastError;
          }
          cleanup(pending, downloadId);
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
    void recordDownloadHistory(pending, 'failed', 'INVALID_URL');
    getIconAnimationController()?.notifySettled('fail');
    respondOnce?.({ started: false, userMessage: 'Download blocked: invalid URL.' });
    return;
  }

  startDownloadWithTimeout(
    pending.baseUrl,
    pending,
    (downloadId, hadError) => {
      if (hadError) {
        recordDownloadEvent({
          ...eventContextFor(pending),
          type: pending.fileMeta?.ext || 'unknown',
          status: 'fail',
          duration_ms: Date.now() - pending.startTime,
          bypass_used: false,
          retries: pending.retryCount ?? 0,
          error_type: 'BROWSER_START_FAIL_DIRECT',
        });
        void recordDownloadHistory(pending, 'failed', 'BROWSER_START_FAIL_DIRECT');
        getIconAnimationController()?.notifySettled('fail');
        cleanup(pending);
        respondOnce?.({ started: false, userMessage: 'Browser blocked download.' });
        return;
      }
      if (!claimOrCancelStray(pending, downloadId as number)) return;
      captureTotalBytes(pending, downloadId as number);
      respondOnce?.({ started: true, requestId: pending.requestId, downloadId });
    },
    () => handleStartTimeout(pending, respondOnce),
  );
}

/**
 * The pure acquire machine decides the account sweep (pwug slice 1, the
 * no-dead-ends corpus's Phase-3 differential contract): 'auth-attempt-failed'
 * keeps today's rotate-to-next-account semantics for every caller — richer
 * per-cause semantics (transient-failed retry bounds) are later slices. The
 * registry flags mirror the machine's decision; the URL builders and the
 * index.ts retry path read them.
 */
function machineFor(pending: PendingDownload): AcquireMachineState {
  return {
    phase: 'drive-auth',
    requestId: pending.requestId,
    file: { fileId: extractDriveFileId(pending.baseUrl) ?? '', url: pending.baseUrl },
    nameHint: {
      preferredStem: pending.fileMeta?.name ?? 'classroom_download',
      ext: pending.fileMeta?.ext ?? '',
      source: 'title',
    },
    isDrive: true,
    attemptedAuthUsers: pending.attemptedAuthUsers,
    authUser: pending.currentAuthUser,
  };
}

/**
 * Try the next auth user for a Drive download.
 * Cycles through authuser=0..9 to find one with access.
 */
export function startNextDriveAttempt(pending: PendingDownload): void {
  pending.htmlSeen = false;

  const { state: swept, effects } = nextAcquireState(machineFor(pending), {
    type: 'auth-attempt-failed',
  });
  pending.attemptedAuthUsers = swept.attemptedAuthUsers;
  const settle = effects.find(
    (e): e is Extract<AcquireEffect, { type: 'settle' }> => e.type === 'settle',
  );
  const begin = effects.find(
    (e): e is Extract<AcquireEffect, { type: 'begin-strategy' }> => e.type === 'begin-strategy',
  );
  const nextAuth = begin?.authUser;

  if (settle?.outcome.status === 'auth-exhausted' || nextAuth == null) {
    // Terminal after every signed-in account was tried: the next honest step
    // is for the user to confirm access directly in Drive.
    sendStatusToTab(
      pending,
      'error',
      'Access denied for all your accounts. Open the file directly in Drive to confirm access.',
      'AUTH_ALL_FAILED',
    );
    recordDownloadEvent({
      ...eventContextFor(pending),
      type: pending.fileMeta?.ext || 'unknown',
      status: 'fail',
      duration_ms: Date.now() - pending.startTime,
      bypass_used: false,
      retries: pending.retryCount ?? 0,
      error_type: 'AUTH_ALL_FAILED',
    });
    void recordDownloadHistory(pending, 'failed', 'AUTH_ALL_FAILED');
    getIconAnimationController()?.notifySettled('fail');
    cleanup(pending);
    return;
  }

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
      // D4 defense: a late sweep callback for an untracked pending must not
      // orphan the download.
      if (!claimOrCancelStray(pending, downloadId as number)) return;
      captureTotalBytes(pending, downloadId as number);
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
 * Drive starter shared by handleDownloadRequest and restartPending: the
 * first attempt URL, the security gate, and the one-shot start retry.
 * `respondOnce` is undefined for restarts (no response channel after a
 * worker restart — the tab is settled by the status funnel instead).
 */
function startDriveFlow(pending: PendingDownload, respondOnce?: (payload: any) => void): void {
  const firstUrl =
    typeof pending.currentAuthUser === 'number'
      ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
      : pending.baseUrl;

  // Security gate: validate URL before downloading
  const validation = validateDownloadUrl(firstUrl);
  if (!validation.valid) {
    console.error(`[CQD Security] Blocked initial Drive download: ${validation.reason} — ${firstUrl}`);
    sendStatusToTab(pending, 'error', 'Download blocked: invalid URL.', 'INVALID_URL');
    respondOnce?.({ started: false, userMessage: 'Download blocked: invalid URL.' });
    cleanup(pending);
    return;
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
            ...eventContextFor(pending),
            type: pending.fileMeta?.ext || 'unknown',
            status: 'fail',
            duration_ms: Date.now() - pending.startTime,
            bypass_used: false,
            retries: pending.retryCount ?? 0,
            error_type: 'BROWSER_START_FAIL',
          });
          void recordDownloadHistory(pending, 'failed', 'BROWSER_START_FAIL');
          getIconAnimationController()?.notifySettled('fail');
          // Zero-tab contract: no bypass-tab fallback. Surface the honest
          // failure with guidance about the usual cause.
          respondOnce?.({
            started: false,
            userMessage: 'Browser blocked the download — check site permissions and try again.',
          });
          sendStatusToTab(pending, 'error', 'Browser blocked the download — check site permissions and try again.', 'BROWSER_START_FAIL');
          cleanup(pending);
          return;
        }
            if (!claimOrCancelStray(pending, id as number)) return;
            respondOnce?.({ started: true, requestId: pending.requestId, downloadId: id });
      },
      () => handleStartTimeout(pending, respondOnce),
    );
  };
  attemptDriveStart();
}

/**
 * D6: resume a pending that was persisted but never started before the
 * worker died (it was queued). Re-registers it and re-enters the same queue
 * every fresh request uses, so concurrency and the QUEUED status stay
 * uniform. There is no response channel after a restart; the tab hears
 * QUEUED and the eventual terminal via sendStatusToTab.
 */
export function restartPending(pending: PendingDownload): void {
  registerPending(pending);
  const start = pending.isDrive
    ? () => startDriveFlow(pending)
    : () => startSingleAttempt(pending);
  queueRequest(pending.requestId, start, () => {
    sendStatusToTab(pending, 'trying', 'Waiting in queue…', 'QUEUED');
  });
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

  // D7: one in-flight transfer per Drive file. A second request for the same
  // Drive file (matched by file id, so authuser variants count too) gets an
  // honest refusal instead of a second parallel byte-stream of the same
  // bytes. Non-Drive same-URL concurrency stays supported by design
  // (pendingByUrl buckets; see background-download-handler tests). The guard
  // clears the moment the first request settles (cleanup unregisters it).
  const requestedFileId = isDrive ? extractDriveFileId(baseUrl) : undefined;
  if (requestedFileId) {
    for (const active of pendingByRequestId.values()) {
      if (extractDriveFileId(active.baseUrl) === requestedFileId) {
        sendResponse?.({ started: false, userMessage: 'That file is already downloading.' });
        return true;
      }
    }
  }

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
    // Use-case context (1ef6.1): carried from the requester for the
    // terminal analytics events. Sanitized again at record time.
    pageType: typeof message.pageType === 'string' ? message.pageType : undefined,
    engineMode: typeof message.engineMode === 'string' ? message.engineMode : undefined,
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
  // Queue (0h4d.1.2): the branch body is a deferred starter — the queue
  // admits it when a slot frees, keeping chrome.downloads.download calls
  // within QUEUE_CONCURRENCY. Cancelled requests never reach the queue.
  const start = (): void => {
    if (isDrive) {
      startDriveFlow(pending, respondOnce);
    } else {
      startSingleAttempt(pending, respondOnce);
    }
  };

  // Cancelled requests never reach the queue (a queued starter whose pending
  // is gone would deadlock a slot).
  if (pending.isCancelled) {
    cleanup(pending);
    return true;
  }

  queueRequest(requestId, start, () => {
    sendStatusToTab(pending, 'trying', 'Waiting in queue…', 'QUEUED');
  });
  return true;
}

// Re-export utilities needed by other modules
export { getFilenameExt, buildUrlWithAuthUser };
