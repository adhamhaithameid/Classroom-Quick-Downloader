// filepath: extension/entrypoints/background/url-helpers.ts
/**
 * URL manipulation utilities for download handling.
 */

import { buildDriveDownloadUrl } from '../../src/shared/drive-endpoint';

/**
 * Normalize a download URL and detect if it's a Drive URL.
 *
 * Every Drive URL resolves to the byte-serving endpoint
 * drive.usercontent.google.com/download?...&confirm=t — the destination
 * Drive's own interstitial "Download anyway" link points at. Downloading it
 * directly serves the file bytes with the ambient session: no interstitial
 * hop, no error-page hop, and therefore no reason for a bypass tab (the
 * visible "403 Access Forbidden" window regression).
 */
export function normalizeUrl(rawUrl: string): { baseUrl: string; isDrive: boolean } {
  try {
    const url = new URL(rawUrl);
    const isDrive = url.hostname.includes('drive');
    if (!isDrive) return { baseUrl: rawUrl, isDrive: false };

    if (url.hostname === 'drive.usercontent.google.com') {
      url.searchParams.set('export', 'download');
      url.searchParams.set('confirm', 't');
      return { baseUrl: url.toString(), isDrive: true };
    }

    const id =
      url.searchParams.get('id') ??
      url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ??
      url.pathname.match(/\/d\/([^/]+)/)?.[1];
    if (id) {
      return { baseUrl: buildDriveDownloadUrl(id), isDrive: true };
    }
    return { baseUrl: rawUrl, isDrive: true };
  } catch {
    return { baseUrl: rawUrl, isDrive: false };
  }
}

/**
 * Build URL with specific authuser parameter.
 */
export function buildUrlWithAuthUser(baseUrl: string, authuser: number): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('authuser', String(authuser));
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Extract file extension from filename.
 */
export function getFilenameExt(filename?: string): string | undefined {
  if (!filename) return undefined;
  const m = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : undefined;
}
