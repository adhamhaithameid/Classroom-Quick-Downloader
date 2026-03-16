// filepath: extension/src/student_work/extractor.ts

import { buildDriveDownloadUrl, extractDriveIdFromClassroomUrl } from './url-classifier';

export interface ExtractResolvedUrlResult {
  url: string;
  source: 'anchor' | 'script' | 'query' | 'current_url';
}

const DRIVE_LINK_RE = /^https:\/\/drive\.google\.com\/(?:u\/\d+\/)?(?:file\/d\/|open\?|uc\?)/i;
const CLASSROOM_DRIVE_RE = /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?drive(?:\/|\?|$)/i;
const DOCS_LINK_RE = /^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?(?:document|presentation|drawings|spreadsheets)\/d\//i;

function getAuthUserFromCurrentUrl(): string | null {
  try {
    const parsed = new URL(window.location.href);
    return parsed.searchParams.get('authuser');
  } catch {
    return null;
  }
}

function normalizeCandidateUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const authUser = getAuthUserFromCurrentUrl();

    if (parsed.hostname === 'classroom.google.com') {
      const idFromQuery = parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (idFromQuery) {
        return buildDriveDownloadUrl(idFromQuery, authUser);
      }
    }

    if (parsed.hostname === 'drive.google.com') {
      const normalizedPath = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
      const fileMatch = normalizedPath.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return buildDriveDownloadUrl(fileMatch[1], authUser);
      }
      if (normalizedPath === '/open' || normalizedPath === '/uc') {
        const id = parsed.searchParams.get('id');
        if (id) return buildDriveDownloadUrl(id, authUser);
      }
      return parsed.toString();
    }

    if (parsed.hostname === 'docs.google.com') {
      const normalizedPath = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
      const docsMatch = normalizedPath.match(/^\/(?:document|presentation|drawings|spreadsheets)\/d\/([^/]+)/);
      if (docsMatch) {
        return buildDriveDownloadUrl(docsMatch[1], authUser);
      }
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function extractFromAnchors(doc: Document): ExtractResolvedUrlResult | null {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) {
    const href = anchor.href;
    if (!href) continue;
    if (!DRIVE_LINK_RE.test(href) && !CLASSROOM_DRIVE_RE.test(href) && !DOCS_LINK_RE.test(href)) {
      continue;
    }
    const normalized = normalizeCandidateUrl(href);
    if (normalized) {
      return { url: normalized, source: 'anchor' };
    }
  }
  return null;
}

function extractFromScripts(doc: Document): ExtractResolvedUrlResult | null {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script'));

  const directDriveLink = /(https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{10,}[^\s"'<>]*)/;
  const driveIdField = /["'](?:driveFileId|fileId|resourceId|id)["']\s*:\s*["']([A-Za-z0-9_-]{10,})["']/;

  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text) continue;

    const directMatch = text.match(directDriveLink);
    if (directMatch?.[1]) {
      const normalized = normalizeCandidateUrl(directMatch[1]);
      if (normalized) return { url: normalized, source: 'script' };
    }

    const idMatch = text.match(driveIdField);
    if (idMatch?.[1]) {
      return { url: buildDriveDownloadUrl(idMatch[1], getAuthUserFromCurrentUrl()), source: 'script' };
    }
  }

  return null;
}

export function extractResolvedDownloadUrl(
  doc: Document,
  currentHref: string,
): ExtractResolvedUrlResult | null {
  const fromAnchors = extractFromAnchors(doc);
  if (fromAnchors) return fromAnchors;

  const fromScripts = extractFromScripts(doc);
  if (fromScripts) return fromScripts;

  const idFromQuery = extractDriveIdFromClassroomUrl(currentHref);
  if (idFromQuery) {
    return {
      url: buildDriveDownloadUrl(idFromQuery, getAuthUserFromCurrentUrl()),
      source: 'query',
    };
  }

  const normalizedCurrent = normalizeCandidateUrl(currentHref);
  if (normalizedCurrent && /^https:\/\/drive\.google\.com\//.test(normalizedCurrent)) {
    return {
      url: normalizedCurrent,
      source: 'current_url',
    };
  }

  return null;
}
