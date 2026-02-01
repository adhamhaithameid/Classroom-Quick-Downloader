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

/** Map URL to pending download (for matching responses) */
export const pendingByUrl = new Map<string, PendingDownload>();

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
