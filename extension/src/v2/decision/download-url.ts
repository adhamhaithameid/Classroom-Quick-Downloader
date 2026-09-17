// filepath: extension/src/v2/decision/download-url.ts
/**
 * ============================================================================
 * DOWNLOAD URL (v2) — the DOM-facing half of the URL mapping (z57 S1)
 * ============================================================================
 *
 * V2's seam for converting a discovered anchor href into the direct download
 * URL. The pure rule lives in src/core/acquire/download-url.ts (core may not
 * touch window); this module supplies the one impure input — the page's
 * multi-account authuser — from window.location, mirroring V1's
 * entrypoints/content/url-utils.ts getAuthUser() OUTCOME without importing
 * the entrypoint stack.
 */

import { toDownloadUrlFrom } from '../../core/acquire/download-url';

/**
 * Read the multi-account index from the current page URL: ?authuser=, ?u=,
 * or a /u/{n}/ path segment. Null when the page is the default account.
 */
export function getPageAuthUser(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('authuser')) return params.get('authuser');
    if (params.has('u')) return params.get('u');
    const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
    if (pathMatch) return pathMatch[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert a discovered file URL into the direct download URL using the
 * current page's authuser. Pure-rule wrapper — see core/acquire/download-url.
 */
export function resolveDownloadUrl(originalUrl: string): string {
  let authUser: string | null = null;
  try {
    authUser = getPageAuthUser();
  } catch {
    authUser = null;
  }
  return toDownloadUrlFrom(originalUrl, authUser);
}
