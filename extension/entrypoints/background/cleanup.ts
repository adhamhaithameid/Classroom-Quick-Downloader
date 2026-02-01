// filepath: extension/entrypoints/background/cleanup.ts
/**
 * Cleanup utilities for preventing memory leaks.
 * Handles periodic cleanup of orphaned pending downloads.
 */

import type { PendingDownload } from './types';
import {
  pendingByRequestId,
  pendingByDownloadId,
  pendingByUrl,
  pendingByBypassTabId,
  cancelledByUs,
  recentDownloads,
  PENDING_DOWNLOAD_TTL_MS,
} from './state';

/**
 * Clean up all tracking maps for a completed/cancelled download.
 */
export function cleanup(pending: PendingDownload, downloadId?: number): void {
  pendingByRequestId.delete(pending.requestId);
  if (downloadId != null) {
    pendingByDownloadId.delete(downloadId);
    cancelledByUs.delete(downloadId);
  }
  for (const [url, p] of pendingByUrl.entries()) {
    if (p.requestId === pending.requestId) pendingByUrl.delete(url);
  }
  for (const [tabId, p] of pendingByBypassTabId.entries()) {
    if (p.requestId === pending.requestId) {
      pendingByBypassTabId.delete(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {
        // Tab may already be closed
      }
    }
  }
}

/**
 * Periodic cleanup of orphaned pending downloads to prevent memory leaks.
 * Entries older than PENDING_DOWNLOAD_TTL_MS are considered stale and removed.
 */
export function cleanupOrphanedPendingDownloads(): void {
  const now = Date.now();
  const staleThreshold = now - PENDING_DOWNLOAD_TTL_MS;

  for (const [requestId, pending] of pendingByRequestId.entries()) {
    if (pending.startTime < staleThreshold) {
      console.log(`[CQD] Cleaning up stale pending download: ${requestId}`);
      cleanup(pending);
    }
  }

  // Also clean recentDownloads older than TTL
  for (const [filename, timestamp] of recentDownloads.entries()) {
    if (timestamp < staleThreshold) {
      recentDownloads.delete(filename);
    }
  }

  // Clean cancelledByUs set (limit size to prevent unbounded growth)
  if (cancelledByUs.size > 100) {
    const entries = Array.from(cancelledByUs);
    entries.slice(0, entries.length - 50).forEach((id) => cancelledByUs.delete(id));
  }
}
