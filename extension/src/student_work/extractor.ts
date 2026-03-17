// filepath: extension/src/student_work/extractor.ts

import {
  buildDriveDownloadUrl,
  extractAuthUserFromClassroomPath,
  extractDriveIdFromClassroomUrl,
} from './url-classifier';
import { STUDENT_WORK_HINT_EXT_PARAM, STUDENT_WORK_HINT_NAME_PARAM } from './constants';

export interface ExtractResolvedUrlResult {
  url: string;
  source: 'anchor' | 'script' | 'query' | 'current_url';
}

const DRIVE_LINK_RE = /^https:\/\/drive\.google\.com\/(?:u\/\d+\/)?(?:file\/d\/|open\?|uc\?)/i;
const CLASSROOM_DRIVE_RE = /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?drive(?:\/|\?|$)/i;
const DOCS_LINK_RE = /^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?(?:document|presentation|drawings|spreadsheets)\/d\//i;

interface ResolverHints {
  name: string | null;
  ext: string | null;
}

function normalizeHintToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function resolveHintsFromHref(currentHref: string): ResolverHints {
  try {
    const parsed = new URL(currentHref, window.location.href);
    const rawName = parsed.searchParams.get(STUDENT_WORK_HINT_NAME_PARAM) || '';
    const rawExt = parsed.searchParams.get(STUDENT_WORK_HINT_EXT_PARAM) || '';
    return {
      name: rawName.trim().length > 0 ? normalizeHintToken(rawName) : null,
      ext: rawExt.trim().length > 0 ? normalizeHintToken(rawExt) : null,
    };
  } catch {
    return { name: null, ext: null };
  }
}

function scoreAnchorAgainstHints(anchor: HTMLAnchorElement, hints: ResolverHints): number {
  if (!hints.name && !hints.ext) return 0;

  const haystack = normalizeHintToken([
    anchor.href || '',
    anchor.textContent || '',
    anchor.getAttribute('aria-label') || '',
    anchor.getAttribute('title') || '',
    anchor.getAttribute('data-tooltip') || '',
  ].join(' '));

  let score = 0;

  if (hints.name) {
    if (haystack.includes(hints.name)) score += 6;

    const stem = hints.name.replace(/\.[a-z0-9]{2,10}$/i, '').trim();
    if (stem.length >= 3 && haystack.includes(stem)) score += 3;
  }

  if (hints.ext) {
    if (haystack.includes(`.${hints.ext}`)) score += 2;
    if (haystack.includes(` ${hints.ext}`)) score += 1;
  }

  return score;
}

function getAuthUserFromCurrentUrl(): string | null {
  try {
    const parsed = new URL(window.location.href);
    const queryAuthUser = parsed.searchParams.get('authuser') || parsed.searchParams.get('u');
    if (queryAuthUser && queryAuthUser.trim().length > 0) return queryAuthUser.trim();
    return extractAuthUserFromClassroomPath(parsed.pathname);
  } catch {
    return null;
  }
}

function normalizeCandidateUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const authUser = (() => {
      const queryAuthUser = parsed.searchParams.get('authuser') || parsed.searchParams.get('u');
      if (queryAuthUser && queryAuthUser.trim().length > 0) return queryAuthUser.trim();
      const pathAuthUser = extractAuthUserFromClassroomPath(parsed.pathname);
      if (pathAuthUser) return pathAuthUser;
      return getAuthUserFromCurrentUrl();
    })();

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

function extractFromAnchors(
  doc: Document,
  hints: ResolverHints,
): ExtractResolvedUrlResult | null {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const candidates: Array<{ result: ExtractResolvedUrlResult; score: number }> = [];

  for (const anchor of anchors) {
    const href = anchor.href;
    if (!href) continue;
    if (!DRIVE_LINK_RE.test(href) && !CLASSROOM_DRIVE_RE.test(href) && !DOCS_LINK_RE.test(href)) {
      continue;
    }
    const normalized = normalizeCandidateUrl(href);
    if (normalized) {
      candidates.push({
        result: { url: normalized, source: 'anchor' },
        score: scoreAnchorAgainstHints(anchor, hints),
      });
    }
  }

  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    if (candidates[i].score > best.score) {
      best = candidates[i];
    }
  }

  if (best.score > 0) return best.result;
  return candidates[0].result;
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
  const hints = resolveHintsFromHref(currentHref);
  const fromAnchors = extractFromAnchors(doc, hints);
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
