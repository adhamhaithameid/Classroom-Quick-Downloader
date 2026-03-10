// filepath: extension/entrypoints/background/url-helpers.ts
/**
 * URL manipulation utilities for download handling.
 */

/**
 * Normalize a download URL and detect if it's a Drive URL.
 * Strips authuser params and adds export=download for Drive.
 */
export function normalizeUrl(rawUrl: string): { baseUrl: string; isDrive: boolean } {
  try {
    const url = new URL(rawUrl);
    const isDrive = url.hostname.includes('drive');
    if (!isDrive) return { baseUrl: rawUrl, isDrive: false };
    url.pathname = url.pathname.replace(/^\/u\/\d+(?=\/)/, '');
    url.searchParams.delete('authuser');
    if (url.pathname.includes('/open')) url.pathname = '/uc';
    if (!url.searchParams.has('export')) url.searchParams.set('export', 'download');
    return { baseUrl: url.toString(), isDrive: true };
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
