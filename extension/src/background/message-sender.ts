// filepath: extension/entrypoints/background/message-sender.ts
/**
 * Utilities for sending messages to content scripts.
 */

import type { PendingDownload, DownloadStatus } from './types';

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
  if (pending.tabId == null) return;

  try {
    chrome.tabs.sendMessage(pending.tabId, {
      type: 'CQD_DOWNLOAD_STATUS',
      requestId: pending.requestId,
      status,
      errorCode,
      userMessage,
    });
  } catch {
    // Tab may have been closed
  }
}
