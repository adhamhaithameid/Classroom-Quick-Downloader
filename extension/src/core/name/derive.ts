// filepath: extension/src/core/name/derive.ts
/**
 * ============================================================================
 * DERIVE — derive a filename when the DOM offered none (S7)
 * ============================================================================
 */

/**
 * Derive a filename from a URL's last path segment. Returns null when the
 * URL is invalid or the segment carries no extension — a caller must not
 * present an extension-less guess as a filename.
 */
export function deriveFileNameFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    if (pathName && pathName.includes('.')) return pathName;
    return null;
  } catch {
    return null;
  }
}
