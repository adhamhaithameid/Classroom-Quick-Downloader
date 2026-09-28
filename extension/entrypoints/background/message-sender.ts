// filepath: extension/entrypoints/background/message-sender.ts
/**
 * Utilities for sending messages to content scripts.
 */

import type { PendingDownload, DownloadStatus } from './types';

/**
 * S6/G2: observer for every status the machine emits, regardless of tab
 * presence. The bridge download service registers the single listener so
 * bridge-originated downloads (no originating tab) still settle. Fires after
 * the duplicate-success guard, so 'success' is observed exactly once.
 */
export type DownloadStatusListener = (
  pending: PendingDownload,
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string,
) => void;

let downloadStatusListener: DownloadStatusListener | null = null;

export function setDownloadStatusListener(listener: DownloadStatusListener | null): void {
  downloadStatusListener = listener;
}

/**
 * Send download status update to the originating tab.
 */
export function sendStatusToTab(
  pending: PendingDownload,
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string
): void {
  // Don't send duplicate success messages
  if (pending.finalized && status === 'success') return;
  if (status === 'success') pending.finalized = true;

  // Bridge observation happens before the tabId guard: bridge-originated
  // downloads have no tab, but their requester still must be settled.
  try {
    downloadStatusListener?.(pending, status, userMessage, errorCode);
  } catch {
    // A broken observer must never break the status funnel.
  }

  if (pending.tabId == null) return;

  try {
    chrome.tabs.sendMessage(pending.tabId, {
      type: 'CQD_DOWNLOAD_STATUS',
      requestId: pending.requestId,
      status,
      errorCode,
      userMessage,
    }, () => { void chrome.runtime.lastError; });
  } catch {
    // Tab may have been closed
  }
}
