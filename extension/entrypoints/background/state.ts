// filepath: extension/entrypoints/background/state.ts
/**
 * Global state management for pending downloads.
 * Centralized here to avoid circular dependencies.
 */

import type { PendingDownload } from './types';

// --- PENDING DOWNLOAD TRACKING MAPS ---

/** Map request ID to pending download */
export const pendingByRequestId = new Map<string, PendingDownload>();

/** Map browser download ID to pending download */
export const pendingByDownloadId = new Map<number, PendingDownload>();

/** Map URL to the set of pending downloads registered under it (supports concurrent same-URL downloads) */
export const pendingByUrl = new Map<string, Set<PendingDownload>>();

/** Register a pending download under a URL. */
export function pendingByUrlAdd(url: string, pending: PendingDownload): void {
  let bucket = pendingByUrl.get(url);
  if (!bucket) {
    bucket = new Set();
    pendingByUrl.set(url, bucket);
  }
  bucket.add(pending);
}

/** Remove a pending download from every URL bucket it occupies. Deletes empty buckets. */
export function pendingByUrlRemove(pending: PendingDownload): void {
  for (const [url, bucket] of pendingByUrl.entries()) {
    if (bucket.delete(pending) && bucket.size === 0) {
      pendingByUrl.delete(url);
    }
  }
}

/** Look up a pending download by URL. Prefers entries not yet assigned a browser download ID. */
export function pendingByUrlGet(url: string): PendingDownload | undefined {
  const bucket = pendingByUrl.get(url);
  if (!bucket || bucket.size === 0) return undefined;
  for (const p of bucket) {
    if (p.currentDownloadId == null) return p;
  }
  return bucket.values().next().value as PendingDownload;
}

/** Map bypass tab ID to pending download */
export const pendingByBypassTabId = new Map<number, PendingDownload>();

// --- AUXILIARY STATE ---

/** Set of download IDs we cancelled (to ignore interrupted events) */
export const cancelledByUs = new Set<number>();

/** Recent downloads for Firefox file:// tab auto-close */
export const recentDownloads = new Map<string, number>();

// --- CONSTANTS ---

/** Authuser values to cycle through for multi-account support */
export const AUTHUSER_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Regex to match Google Classroom URLs */
export const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

/** TTL for orphaned pending downloads (10 minutes) */
export const PENDING_DOWNLOAD_TTL_MS = 10 * 60 * 1000;

/** Interval for cleanup checks (5 minutes) */
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// --- BROWSER DETECTION ---

/**
 * Detect if running in Firefox browser.
 */
function isFirefox(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox/i.test(navigator.userAgent);
}

/** Cached browser detection result */
export const IS_FIREFOX = isFirefox();
