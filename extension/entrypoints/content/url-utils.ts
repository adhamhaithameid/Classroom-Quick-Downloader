// filepath: extension/entrypoints/content/url-utils.ts
/**
 * URL extraction and manipulation utilities for Drive downloads.
 */

import { DRIVE_URL_PATTERNS, DRIVE_ANCHOR_SELECTOR } from './state';

/**
 * Get authuser from current page URL.
 */
export function getAuthUser(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has('authuser')) return params.get('authuser');
  if (params.has('u')) return params.get('u');
  const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
  if (pathMatch) return pathMatch[1];
  return null;
}

/**
 * Check if anchor href is a Drive URL.
 */
export function extractDriveUrlFromAnchor(anchor: HTMLAnchorElement): string | null {
  const href = anchor.href;
  if (!href) return null;
  return DRIVE_URL_PATTERNS.some((re) => re.test(href)) ? href : null;
}

/**
 * Find a Drive URL from element or its children/parents.
 */
export function findDriveUrl(element: HTMLElement): string | null {
  const nearAnchor =
    element.querySelector<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR) ||
    (element.closest(DRIVE_ANCHOR_SELECTOR) as HTMLAnchorElement | null);

  if (nearAnchor) {
    const href = extractDriveUrlFromAnchor(nearAnchor);
    if (href) return href;
  }

  const driveId =
    element.getAttribute('data-drive-id') || element.getAttribute('data-id');
  if (driveId) {
    return toDownloadUrl(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`
    );
  }
  return null;
}

/**
 * Convert a Drive URL to a direct download URL.
 */
export function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;
  const authUser = getAuthUser();

  try {
    const parsed = new URL(originalUrl, location.href);
    
    const appendAuth = (u: string): string => {
      if (!authUser) return u;
      const newU = new URL(u);
      if (!newU.searchParams.has('authuser')) {
        newU.searchParams.set('authuser', authUser);
      }
      return newU.toString();
    };

    if (parsed.hostname === 'drive.google.com') {
      if (parsed.pathname.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);
        const id = parsed.searchParams.get('id');
        if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
        return appendAuth(originalUrl);
      }
      
      const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return appendAuth(`https://drive.google.com/uc?export=download&id=${fileMatch[1]}`);
      }
      
      if (parsed.pathname === '/open' || parsed.pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        if (authUser) parsed.searchParams.set('authuser', authUser);
        return parsed.toString();
      }
    }
    
    if (parsed.hostname === 'classroom.google.com' && parsed.pathname.startsWith('/drive')) {
      const id = parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
    }

    // Google Docs/Sheets/Slides/Drawings viewer URLs
    // Pattern: docs.google.com/{type}/d/{fileId}/...
    if (parsed.hostname === 'docs.google.com') {
      const docsMatch = parsed.pathname.match(/^\/(document|spreadsheets|presentation|drawings)\/d\/([^/]+)/);
      if (docsMatch) {
        return appendAuth(`https://drive.google.com/uc?export=download&id=${docsMatch[2]}`);
      }
    }
    
    return appendAuth(originalUrl);
  } catch {
    return originalUrl;
  }
}
