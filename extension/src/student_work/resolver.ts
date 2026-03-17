// filepath: extension/src/student_work/resolver.ts

import {
  DEFAULT_STAGE_TIMEOUT_MS,
  STUDENT_WORK_HINT_EXT_PARAM,
  STUDENT_WORK_HINT_NAME_PARAM,
  STUDENT_WORK_MODE_PARAM,
  STUDENT_WORK_REQUEST_PARAM,
} from './constants';
import {
  readPublishedStudentWorkApiSnapshot,
  type PublishedStudentWorkApiAttachment,
} from '../engines/v3/api/runtime-bridge';
import {
  addResolverParams,
  buildDriveDownloadUrl,
  extractAuthUserFromClassroomPath,
  extractDriveIdFromClassroomUrl,
  isStudentWorkAttachmentUrl,
} from './url-classifier';
import {
  createResolverRequestId,
  waitForResolveResult,
  type StudentWorkResolveResultMessage,
} from './channel';

export interface ResolveStudentWorkOptions {
  stageTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface ResolveStudentWorkResult {
  ok: boolean;
  url?: string;
  reason: string;
  source?: string;
}

interface ResolverHints {
  name: string | null;
  ext: string | null;
}

function resultFromMessage(
  message: StudentWorkResolveResultMessage | null,
  authUserHint: string | null,
): ResolveStudentWorkResult {
  if (!message) return { ok: false, reason: 'resolver_timeout' };
  if (!message.ok || !message.resolvedUrl) {
    return { ok: false, reason: message.reason || 'resolver_failed' };
  }
  const normalized = normalizeResolvedUrl(message.resolvedUrl, authUserHint);
  if (!normalized) return { ok: false, reason: 'invalid_resolved_url' };
  return {
    ok: true,
    url: normalized,
    reason: 'resolved',
    source: message.source,
  };
}

function normalizeAuthUser(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeHintToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function resolveHints(rawUrl: string): ResolverHints {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const name = parsed.searchParams.get(STUDENT_WORK_HINT_NAME_PARAM) || '';
    const ext = parsed.searchParams.get(STUDENT_WORK_HINT_EXT_PARAM) || '';
    return {
      name: name.trim().length > 0 ? normalizeHintToken(name) : null,
      ext: ext.trim().length > 0 ? normalizeHintToken(ext) : null,
    };
  } catch {
    return { name: null, ext: null };
  }
}

function resolveAuthUserHint(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const fromSourceQuery = normalizeAuthUser(
      parsed.searchParams.get('authuser') || parsed.searchParams.get('u'),
    );
    if (fromSourceQuery) return fromSourceQuery;
    const fromSourcePath = extractAuthUserFromClassroomPath(parsed.pathname);
    if (fromSourcePath) return fromSourcePath;
  } catch {
    // Ignore source URL parsing failures.
  }

  try {
    const current = new URL(window.location.href);
    const fromCurrentQuery = normalizeAuthUser(
      current.searchParams.get('authuser') || current.searchParams.get('u'),
    );
    if (fromCurrentQuery) return fromCurrentQuery;
    return extractAuthUserFromClassroomPath(current.pathname);
  } catch {
    return null;
  }
}

function normalizeResolvedUrl(rawUrl: string, authUserHint: string | null): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (parsed.protocol !== 'https:') return null;

    if (parsed.hostname === 'classroom.google.com') {
      const id = parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id) return buildDriveDownloadUrl(id, authUserHint);
      return parsed.toString();
    }

    if (parsed.hostname === 'docs.google.com') {
      const normalizedPath = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
      const docsMatch = normalizedPath.match(/^\/(?:document|presentation|drawings|spreadsheets)\/d\/([^/]+)/);
      if (docsMatch?.[1]) {
        return buildDriveDownloadUrl(docsMatch[1], authUserHint);
      }
      return parsed.toString();
    }

    if (parsed.hostname === 'drive.google.com' && authUserHint && !parsed.searchParams.has('authuser')) {
      parsed.searchParams.set('authuser', authUserHint);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function scoreAttachmentByHints(
  attachment: PublishedStudentWorkApiAttachment,
  hints: ResolverHints,
): number {
  if (!hints.name && !hints.ext) return 0;
  let score = 0;
  const title = attachment.normalizedTitle || normalizeHintToken(attachment.title || '');
  const downloadUrl = normalizeHintToken(attachment.downloadUrl || '');
  const haystack = `${title} ${downloadUrl}`;

  if (hints.name) {
    if (haystack.includes(hints.name)) score += 6;
    const stem = hints.name.replace(/\.[a-z0-9]{2,10}$/i, '').trim();
    if (stem.length >= 3 && haystack.includes(stem)) score += 3;
  }

  if (hints.ext) {
    if (attachment.normalizedExt === hints.ext) score += 2;
    if (haystack.includes(`.${hints.ext}`)) score += 1;
  }

  return score;
}

function resolveFromPublishedApiSnapshot(
  rawUrl: string,
  authUserHint: string | null,
): ResolveStudentWorkResult | null {
  const snapshot = readPublishedStudentWorkApiSnapshot();
  if (!snapshot || snapshot.attachments.length === 0) return null;

  const hints = resolveHints(rawUrl);
  let chosen: PublishedStudentWorkApiAttachment | null = null;
  let bestScore = -1;

  for (const attachment of snapshot.attachments) {
    const score = scoreAttachmentByHints(attachment, hints);
    if (score > bestScore) {
      bestScore = score;
      chosen = attachment;
    }
  }

  if ((hints.name || hints.ext) && (!chosen || bestScore <= 0)) {
    return null;
  }
  if (!hints.name && !hints.ext) {
    if (snapshot.attachments.length !== 1) return null;
    chosen = snapshot.attachments[0];
  }
  if (!chosen) return null;

  const normalized = normalizeResolvedUrl(chosen.downloadUrl, authUserHint);
  if (!normalized) return null;

  return {
    ok: true,
    url: normalized,
    reason: 'resolved',
    source: 'api_snapshot',
  };
}

async function resolveViaIframe(
  rawUrl: string,
  requestId: string,
  timeoutMs: number,
  authUserHint: string | null,
  signal?: AbortSignal,
): Promise<ResolveStudentWorkResult> {
  if (typeof document === 'undefined') return { ok: false, reason: 'document_unavailable' };

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';

  const resolverUrl = addResolverParams(rawUrl, {
    [STUDENT_WORK_REQUEST_PARAM]: requestId,
    [STUDENT_WORK_MODE_PARAM]: 'iframe',
  });

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      // Ignore cleanup failures.
    }
  };

  try {
    iframe.src = resolverUrl;
    document.documentElement.appendChild(iframe);
    const message = await waitForResolveResult(requestId, timeoutMs, signal);
    return resultFromMessage(message, authUserHint);
  } finally {
    cleanup();
  }
}


export async function resolveStudentWorkUrl(
  rawUrl: string,
  options: ResolveStudentWorkOptions = {},
): Promise<ResolveStudentWorkResult> {
  const stageTimeoutMs = options.stageTimeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  const signal = options.signal;

  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, reason: 'empty_url' };
  }

  let parsedInput: URL;
  try {
    parsedInput = new URL(rawUrl, window.location.href);
  } catch {
    return { ok: false, reason: 'malformed_url' };
  }

  if (parsedInput.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_scheme' };
  }

  if (!isStudentWorkAttachmentUrl(parsedInput.toString())) {
    return { ok: true, url: parsedInput.toString(), reason: 'already_direct', source: 'input' };
  }

  const authUserHint = resolveAuthUserHint(rawUrl);

  const directId = extractDriveIdFromClassroomUrl(parsedInput.toString());
  if (directId) {
    return {
      ok: true,
      url: buildDriveDownloadUrl(directId, authUserHint),
      reason: 'resolved',
      source: 'query',
    };
  }

  const apiAttempt = resolveFromPublishedApiSnapshot(parsedInput.toString(), authUserHint);
  if (apiAttempt) {
    return apiAttempt;
  }

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }

  const requestId = createResolverRequestId();
  const iframeAttempt = await resolveViaIframe(
    parsedInput.toString(),
    requestId,
    stageTimeoutMs,
    authUserHint,
    signal,
  );
  if (iframeAttempt.ok) {
    if (iframeAttempt.url) {
      const normalized = normalizeResolvedUrl(iframeAttempt.url, authUserHint);
      if (!normalized) return { ok: false, reason: 'invalid_resolved_url' };
      return { ...iframeAttempt, url: normalized };
    }
    return iframeAttempt;
  }

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }

  return {
    ok: false,
    reason: iframeAttempt.reason,
  };
}
