// filepath: extension/entrypoints/background/cleanup.ts
/**
 * Cleanup utilities for preventing memory leaks.
 * Handles periodic cleanup of orphaned pending downloads.
 */

import type { PendingDownload } from './types';
import {
  unregisterPending,
  unbindDownloadId,
  pendingByBypassTabId,
  pendingByRequestId,
  cancelledByUs,
  recentDownloads,
  PENDING_DOWNLOAD_TTL_MS,
} from './state';

/**
 * Clean up all tracking for a completed/cancelled download.
 *
 * D11: `unregisterPending` is the one mutator — it removes the authoritative
 * entry and every index it occupies (URL buckets, download ids, bypass tabs),
 * so indexes can no longer outlive the truth. The TTL sweep's fallback to the
 * pending's own recorded download id is preserved.
 */
export function cleanup(pending: PendingDownload, downloadId?: number): void {
  const bypassTabIds: number[] = [];
  for (const [tabId, p] of pendingByBypassTabId.entries()) {
    if (p.requestId === pending.requestId) bypassTabIds.push(tabId);
  }

  unregisterPending(pending);

  const effectiveDownloadId = downloadId ?? pending.currentDownloadId;
  if (effectiveDownloadId != null) {
    cancelledByUs.delete(effectiveDownloadId);
    unbindDownloadId(effectiveDownloadId);
  }

  for (const tabId of bypassTabIds) {
    try {
      chrome.tabs.remove(tabId);
    } catch {
      // Tab may already be closed
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
