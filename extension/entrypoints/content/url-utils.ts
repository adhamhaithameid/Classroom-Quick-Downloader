// filepath: extension/entrypoints/content/url-utils.ts
/**
 * URL extraction and manipulation utilities for Drive downloads.
 */

import { DRIVE_URL_PATTERNS, DRIVE_ANCHOR_SELECTOR } from './state';

const DOWNLOADABLE_DOCS_PATH = /^\/(document|presentation|drawings)\/d\/[^/]+/;

function isSupportedDocsUrl(parsed: URL, normalizedPath: string): boolean {
  if (parsed.hostname !== 'docs.google.com') return false;
  return DOWNLOADABLE_DOCS_PATH.test(normalizedPath);
}

/**
 * Get authuser from current page URL.
 */
// parsing the url for user ids. what could go wrong??
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
  try {
    const parsed = new URL(href, location.href);
    const normalizedPath = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');

    if (parsed.hostname === 'docs.google.com' && !isSupportedDocsUrl(parsed, normalizedPath)) {
      return null;
    }
  } catch {
    return null;
  }

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
// recursive function warning! 🚨 hope there's a base case
export function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;
  const authUser = getAuthUser();

  try {
    const parsed = new URL(originalUrl, location.href);
    const normalizedPath = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
    
    const appendAuth = (u: string): string => {
      if (!authUser) return u;
      const newU = new URL(u);
      if (!newU.searchParams.has('authuser')) {
        newU.searchParams.set('authuser', authUser);
      }
      return newU.toString();
    };

    if (parsed.hostname === 'drive.google.com') {
      if (normalizedPath.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);
        const id = parsed.searchParams.get('id');
        if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
        return appendAuth(originalUrl);
      }
      
      const fileMatch = normalizedPath.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return appendAuth(`https://drive.google.com/uc?export=download&id=${fileMatch[1]}`);
      }
      
      if (normalizedPath === '/open' || normalizedPath === '/uc') {
        const normalizedUrl = new URL(parsed.toString());
        normalizedUrl.pathname = normalizedPath;
        normalizedUrl.searchParams.set('export', 'download');
        if (authUser) normalizedUrl.searchParams.set('authuser', authUser);
        return normalizedUrl.toString();
      }
    }
    
    if (parsed.hostname === 'classroom.google.com' && normalizedPath.startsWith('/drive')) {
      const id = parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
    }

    // Google Docs/Sheets/Slides/Drawings viewer URLs
    // Pattern: docs.google.com/{type}/d/{fileId}/...
    if (parsed.hostname === 'docs.google.com') {
      const docsMatch = normalizedPath.match(/^\/(document|presentation|drawings)\/d\/([^/]+)/);
      if (docsMatch) {
        return appendAuth(`https://drive.google.com/uc?export=download&id=${docsMatch[2]}`);
      }
    }
    
    return appendAuth(originalUrl);
  } catch {
    return originalUrl;
  }
}
