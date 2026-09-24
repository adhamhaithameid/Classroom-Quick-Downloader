// filepath: extension/entrypoints/background/state.ts
/**
 * Global state management for pending downloads.
 * Centralized here to avoid circular dependencies.
 *
 * D11 — ONE AUTHORITATIVE MAP. `pendingByRequestId` (keyed by the correlation
 * id) is the single source of truth for which downloads are in flight. The
 * other maps (`pendingByDownloadId`, `pendingByUrl`) are indexes OVER that
 * truth, maintained exclusively through the registry functions below — no
 * module may mutate them directly. Every bind checks the authoritative map
 * first, so a late callback can never resurrect a zombie index entry for a
 * pending the TTL sweep already reaped, and a download id can never be
 * correlated to two pendings at once (the pendingByUrl race).
 */

import type { PendingDownload } from './types';

// --- STALL DEADLINE (no-dead-ends) -------------------------------------
// Every registered pending gets a hard deadline: if nothing has settled it
// by then, the user's button must NOT sit in "trying" until the silent TTL
// reap. The hook is injected by index.ts (registry stays dependency-free).
export const PENDING_DEADLINE_MS = 150_000;
type PendingExpiredHook = (pending: PendingDownload) => void;
let pendingExpiredHook: PendingExpiredHook | null = null;
const deadlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setPendingExpiredHook(hook: PendingExpiredHook | null): void {
  pendingExpiredHook = hook;
}

function scheduleDeadline(pending: PendingDownload): void {
  if (typeof setTimeout !== 'function') return;
  const timer = setTimeout(() => {
    deadlineTimers.delete(pending.requestId);
    if (pendingByRequestId.get(pending.requestId) !== pending) return;
    pendingExpiredHook?.(pending);
  }, PENDING_DEADLINE_MS);
  deadlineTimers.set(pending.requestId, timer);
}

function clearDeadline(requestId: string): void {
  const timer = deadlineTimers.get(requestId);
  if (timer != null) {
    clearTimeout(timer);
    deadlineTimers.delete(requestId);
  }
}

// --- AUTHORITATIVE REGISTRY ---

/** Map request ID to pending download. The authoritative registry. */
export const pendingByRequestId = new Map<string, PendingDownload>();

// --- INDEXES OVER THE REGISTRY (read-only outside this module) ---

/** Index: browser download ID to pending download */
export const pendingByDownloadId = new Map<number, PendingDownload>();

/** Index: URL to the set of pending downloads registered under it (supports concurrent same-URL downloads) */
export const pendingByUrl = new Map<string, Set<PendingDownload>>();

// --- REGISTRY LISTENER (optional observer, e.g. persistence mirror) ----
// The registry stays dependency-free: a listener is injected (by index.ts)
// and is notified AFTER each successful registry mutation. Listener errors
// are swallowed — an observer must never break download bookkeeping.
export type RegistryListener = {
  onRegister?: (pending: PendingDownload) => void;
  onUnregister?: (requestId: string) => void;
  onBind?: (pending: PendingDownload) => void;
};
let registryListener: RegistryListener | null = null;

export function setRegistryListener(listener: RegistryListener | null): void {
  registryListener = listener;
}

function notify(event: 'onRegister' | 'onUnregister' | 'onBind', arg: PendingDownload | string): void {
  if (!registryListener) return;
  try {
    if (event === 'onUnregister') registryListener.onUnregister?.(arg as string);
    else if (event === 'onBind') registryListener.onBind?.(arg as PendingDownload);
    else registryListener.onRegister?.(arg as PendingDownload);
  } catch {
    // Observer failures are never download-flow failures.
  }
}

// --- REGISTRY FUNCTIONS ---

/**
 * Register a pending download: authoritative entry plus its base URL index.
 * The single replacement for the old `pendingByRequestId.set(...)` +
 * `pendingByUrlAdd(...)` pair, so the two can never disagree.
 */
export function registerPending(pending: PendingDownload): void {
  pendingByRequestId.set(pending.requestId, pending);
  indexUrl(pending.baseUrl, pending);
  scheduleDeadline(pending);
  notify('onRegister', pending);
}

/** Does the authoritative registry still track this requestId? */
export function isRegistered(requestId: string): boolean {
  return pendingByRequestId.has(requestId);
}

function indexUrl(url: string, pending: PendingDownload): void {
  let bucket = pendingByUrl.get(url);
  if (!bucket) {
    bucket = new Set();
    pendingByUrl.set(url, bucket);
  }
  bucket.add(pending);
}

/**
 * Correlate a browser download ID to a pending download.
 *
 * Returns false (and mutates nothing) when the pending is no longer in the
 * authoritative registry — a late download callback after TTL cleanup — or
 * when the id is already bound to a different pending. Both are the races
 * the four-map model allowed; neither may resurrect stale state.
 */
export function bindDownloadId(pending: PendingDownload, downloadId: number): boolean {
  if (pendingByRequestId.get(pending.requestId) !== pending) return false;
  const existing = pendingByDownloadId.get(downloadId);
  if (existing !== undefined && existing !== pending) return false;

  pending.currentDownloadId = downloadId;
  pendingByDownloadId.set(downloadId, pending);
  notify('onBind', pending);
  return true;
}

/**
 * Drop a single download-id binding without unregistering the pending
 * (used when we cancel a download ourselves but keep the flow alive).
 */
export function unbindDownloadId(downloadId: number): void {
  pendingByDownloadId.delete(downloadId);
}

/**
 * Remove a pending download from the authoritative registry and from every
 * index it occupies. Indexes are rebuilt from the pending's own correlation
 * keys, so cleanup cannot leave a bucket or an id behind.
 */
export function unregisterPending(pending: PendingDownload): void {
  clearDeadline(pending.requestId);
  if (pendingByRequestId.get(pending.requestId) === pending) {
    pendingByRequestId.delete(pending.requestId);
  }
  for (const [id, p] of pendingByDownloadId) {
    if (p === pending || p.requestId === pending.requestId) {
      pendingByDownloadId.delete(id);
    }
  }
  pendingByUrlRemove(pending);
  notify('onUnregister', pending.requestId);
}

// --- LOOKUPS ---

export function getPendingByRequestId(requestId: string): PendingDownload | undefined {
  return pendingByRequestId.get(requestId);
}

export function getPendingByDownloadId(downloadId: number): PendingDownload | undefined {
  return pendingByDownloadId.get(downloadId);
}

/**
 * Look up an unclaimed pending download by URL — an entry with no browser
 * download id yet. Returns undefined when every entry is already claimed:
 * those are findable via getPendingByDownloadId and must not be re-claimed
 * for an unrelated download.
 */
export function getUnclaimedPendingByUrl(url: string): PendingDownload | undefined {
  const bucket = pendingByUrl.get(url);
  if (!bucket || bucket.size === 0) return undefined;
  for (const p of bucket) {
    if (p.currentDownloadId == null) return p;
  }
  return undefined;
}

// --- BACK-COMPAT ALIASES (registry-backed) ---

/** Register a pending download under a URL. */
export function pendingByUrlAdd(url: string, pending: PendingDownload): void {
  indexUrl(url, pending);
}

/** Remove a pending download from every URL bucket it occupies. Deletes empty buckets. */
export function pendingByUrlRemove(pending: PendingDownload): void {
  for (const [url, bucket] of pendingByUrl.entries()) {
    if (bucket.delete(pending) && bucket.size === 0) {
      pendingByUrl.delete(url);
    }
  }
}

/** Alias of getUnclaimedPendingByUrl. */
export function pendingByUrlGet(url: string): PendingDownload | undefined {
  return getUnclaimedPendingByUrl(url);
}

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
