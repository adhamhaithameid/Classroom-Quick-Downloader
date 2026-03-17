// filepath: extension/src/student_work/extractor.ts

import {
  buildDriveDownloadUrl,
  extractAuthUserFromClassroomPath,
  extractDriveIdFromClassroomUrl,
} from './url-classifier';
import { STUDENT_WORK_HINT_EXT_PARAM, STUDENT_WORK_HINT_NAME_PARAM } from './constants';

export interface ExtractResolvedUrlResult {
  url: string;
  source: 'anchor' | 'resource' | 'script' | 'query' | 'current_url';
}

// regexes again... just copy pasted these tbh
const DRIVE_LINK_RE = /^https:\/\/drive\.google\.com\/(?:u\/\d+\/)?(?:file\/d\/|open\?|uc\?)/i;
const CLASSROOM_DRIVE_RE = /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?drive(?:\/|\?|$)/i;
const DOCS_LINK_RE = /^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?(?:document|presentation|drawings|spreadsheets)\/d\//i;
const DOCS_FILE_LINK_RE = /^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?file\/d\//i;

interface ResolverHints {
  name: string | null;
  ext: string | null;
}

interface ExtractionCandidate {
  result: ExtractResolvedUrlResult;
  score: number;
}

function resolveStudentWorkUserHint(currentHref: string): string | null {
  try {
    const parsed = new URL(currentHref, window.location.href);
    const fromQuery = parsed.searchParams.get('u') || parsed.searchParams.get('userId');
    if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();

    const rawHash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const fromHash = hashParams.get('u') || hashParams.get('userId');
      if (fromHash && fromHash.trim().length > 0) return fromHash.trim();
    }
  } catch {
    // Ignore malformed href hints.
  }
  return null;
}

function decodeHintToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{6,}$/.test(trimmed)) return trimmed;

  const normalizedBase64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = normalizedBase64 + '='.repeat((4 - (normalizedBase64.length % 4)) % 4);
  const manualDecode = (): string | null => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;

    for (const char of paddedBase64) {
      if (char === '=') break;
      const idx = alphabet.indexOf(char);
      if (idx < 0) return null;
      buffer = (buffer << 6) | idx;
      bits += 6;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return null;
    }
  };

  try {
    const decoded = (typeof atob === 'function' ? atob(paddedBase64) : manualDecode())?.trim() || '';
    if (/^\d{6,}$/.test(decoded)) return decoded;
  } catch {
    const decoded = manualDecode()?.trim() || '';
    if (/^\d{6,}$/.test(decoded)) return decoded;
  }
  return null;
}

function resolveSubmissionHintCandidates(currentHref: string): string[] {
  const rawHint = resolveStudentWorkUserHint(currentHref);
  if (!rawHint) return [];
  const out = new Set<string>();
  const trimmed = rawHint.trim();
  if (trimmed) out.add(trimmed);
  const decoded = decodeHintToken(trimmed);
  if (decoded) out.add(decoded);
  return Array.from(out);
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
      const docsFileMatch = normalizedPath.match(/^\/file\/d\/([^/]+)/);
      if (docsFileMatch) {
        return buildDriveDownloadUrl(docsFileMatch[1], authUser);
      }
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

function scoreStringAgainstHints(haystackRaw: string, hints: ResolverHints): number {
  if (!hints.name && !hints.ext) return 0;
  const haystack = normalizeHintToken(haystackRaw);
  let score = 0;
  if (hints.name && haystack.includes(hints.name)) score += 6;
  if (hints.ext && haystack.includes(`.${hints.ext}`)) score += 2;
  return score;
}

// scraping the DOM to find links, pls google don't change your HTML class names
function extractFromAnchors(
  doc: Document,
  hints: ResolverHints,
  strictHintResolution: boolean,
): ExtractResolvedUrlResult | null {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const candidates: ExtractionCandidate[] = [];

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

  if (!hints.name && !hints.ext) {
    if (!strictHintResolution) return candidates[0].result;
    return candidates.length === 1 ? candidates[0].result : null;
  }

  let bestScore = -1;
  for (const candidate of candidates) {
    if (candidate.score > bestScore) bestScore = candidate.score;
  }
  if (bestScore <= 0) {
    if (strictHintResolution) return null;
    return candidates.length === 1 ? candidates[0].result : null;
  }

  const topMatches = candidates.filter((candidate) => candidate.score === bestScore);
  if (topMatches.length !== 1) return null;

  return topMatches[0].result;
}

// we are scraping script tags now 😔
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

function unescapeScriptUrl(rawUrl: string): string {
  return rawUrl
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/');
}

function extractFromSubmissionHintedScripts(
  doc: Document,
  hints: ResolverHints,
  submissionHints: string[],
): ExtractResolvedUrlResult | null {
  if (submissionHints.length === 0) return null;

  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script'));
  const candidates: Array<ExtractionCandidate & { distance: number }> = [];
  const seen = new Map<string, number>();
  const broadUrlPattern = /https:(?:\/\/|\\\/\\\/)[^\s"'<>]+/g;

  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text || !text.includes('AF_initDataCallback')) continue;

    for (const submissionHint of submissionHints) {
      const marker = `"${submissionHint}"`;
      let idx = text.indexOf(marker);
      if (idx < 0) idx = text.indexOf(submissionHint);

      while (idx >= 0) {
        const start = Math.max(0, idx - 140);
        const end = Math.min(text.length, idx + 2600);
        const windowText = text.slice(start, end);
        broadUrlPattern.lastIndex = 0;
        let match = broadUrlPattern.exec(windowText);

        while (match) {
          const rawMatch = match[0];
          const cleanedUrl = unescapeScriptUrl(rawMatch).replace(/[)\],}]+$/g, '');
          if (!DRIVE_LINK_RE.test(cleanedUrl) &&
            !CLASSROOM_DRIVE_RE.test(cleanedUrl) &&
            !DOCS_LINK_RE.test(cleanedUrl) &&
            !DOCS_FILE_LINK_RE.test(cleanedUrl)) {
            match = broadUrlPattern.exec(windowText);
            continue;
          }

          const normalized = normalizeCandidateUrl(cleanedUrl);
          if (!normalized) {
            match = broadUrlPattern.exec(windowText);
            continue;
          }

          const globalOffset = start + match.index;
          const distance = Math.abs(globalOffset - idx);
          const previousDistance = seen.get(normalized);
          if (previousDistance != null && previousDistance <= distance) {
            match = broadUrlPattern.exec(windowText);
            continue;
          }
          seen.set(normalized, distance);

          for (let i = candidates.length - 1; i >= 0; i -= 1) {
            if (candidates[i].result.url === normalized) {
              candidates.splice(i, 1);
            }
          }

          let score = scoreStringAgainstHints(`${cleanedUrl} ${normalized}`, hints);
          if (/docs\.google\.com\/file\/d\//i.test(cleanedUrl) && /\/grading/i.test(cleanedUrl)) {
            score += 1;
          }

          candidates.push({
            result: { url: normalized, source: 'script' },
            score,
            distance,
          });

          match = broadUrlPattern.exec(windowText);
        }

        idx = text.indexOf(marker, idx + marker.length);
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].result;

  if (hints.name || hints.ext) {
    let bestScore = -1;
    for (const candidate of candidates) {
      if (candidate.score > bestScore) bestScore = candidate.score;
    }
    if (bestScore > 0) {
      const topMatches = candidates.filter((candidate) => candidate.score === bestScore);
      if (topMatches.length === 1) return topMatches[0].result;
    }
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let secondBestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.distance < bestDistance) {
      secondBestDistance = bestDistance;
      bestDistance = candidate.distance;
    } else if (candidate.distance < secondBestDistance) {
      secondBestDistance = candidate.distance;
    }
  }
  const closest = candidates.filter((candidate) => candidate.distance === bestDistance);
  if (closest.length === 1) {
    // Guard against ties that are effectively adjacent in the same payload block.
    if (!Number.isFinite(secondBestDistance) || secondBestDistance - bestDistance >= 32) {
      return closest[0].result;
    }
  }

  return null;
}

// reading performance entries to find file URLs?? kinda big brain ngl
function extractFromPerformanceResources(
  hints: ResolverHints,
  strictHintResolution: boolean,
): ExtractResolvedUrlResult | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return null;
  }

  const resourceEntries = performance.getEntriesByType('resource');
  const candidates: ExtractionCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of resourceEntries) {
    const name = typeof (entry as { name?: unknown }).name === 'string'
      ? String((entry as { name?: string }).name || '')
      : '';
    if (!name) continue;
    if (!DRIVE_LINK_RE.test(name) &&
      !CLASSROOM_DRIVE_RE.test(name) &&
      !DOCS_LINK_RE.test(name) &&
      !DOCS_FILE_LINK_RE.test(name)) {
      continue;
    }

    const normalized = normalizeCandidateUrl(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      result: { url: normalized, source: 'resource' },
      score: scoreStringAgainstHints(name, hints),
    });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].result;

  if (hints.name || hints.ext) {
    let bestScore = -1;
    for (const candidate of candidates) {
      if (candidate.score > bestScore) bestScore = candidate.score;
    }

    if (bestScore > 0) {
      const topMatches = candidates.filter((candidate) => candidate.score === bestScore);
      if (topMatches.length === 1) return topMatches[0].result;
    }
  }

  if (strictHintResolution) return null;
  return candidates[0].result;
}

export function extractResolvedDownloadUrl(
  doc: Document,
  currentHref: string,
): ExtractResolvedUrlResult | null {
  const hints = resolveHintsFromHref(currentHref);
  const strictHintResolution = resolveStudentWorkUserHint(currentHref) !== null;
  const submissionHints = strictHintResolution
    ? resolveSubmissionHintCandidates(currentHref)
    : [];
  const fromAnchors = extractFromAnchors(doc, hints, strictHintResolution);
  if (fromAnchors) return fromAnchors;

  const fromResources = extractFromPerformanceResources(hints, strictHintResolution);
  if (fromResources) return fromResources;

  if (strictHintResolution) {
    const fromSubmissionScript = extractFromSubmissionHintedScripts(doc, hints, submissionHints);
    if (fromSubmissionScript) return fromSubmissionScript;

    // User-hinted routes can transiently expose generic IDs in scripts/query
    // before the per-student anchor is ready. Skip generic fallbacks here.
    return null;
  }

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
