// filepath: extension/src/student_work/resolver.ts

import {
  DEFAULT_STAGE_TIMEOUT_MS,
  STUDENT_WORK_MODE_PARAM,
  STUDENT_WORK_REQUEST_PARAM,
} from './constants';
import {
  addResolverParams,
  buildDriveDownloadUrl,
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

function resultFromMessage(
  message: StudentWorkResolveResultMessage | null,
): ResolveStudentWorkResult {
  if (!message) return { ok: false, reason: 'resolver_timeout' };
  if (!message.ok || !message.resolvedUrl) {
    return { ok: false, reason: message.reason || 'resolver_failed' };
  }
  return {
    ok: true,
    url: message.resolvedUrl,
    reason: 'resolved',
    source: message.source,
  };
}

async function resolveViaIframe(
  rawUrl: string,
  requestId: string,
  timeoutMs: number,
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
    return resultFromMessage(message);
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

  const directId = extractDriveIdFromClassroomUrl(parsedInput.toString());
  if (directId) {
    return {
      ok: true,
      url: buildDriveDownloadUrl(directId),
      reason: 'resolved',
      source: 'query',
    };
  }

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }

  const requestId = createResolverRequestId();
  const iframeAttempt = await resolveViaIframe(parsedInput.toString(), requestId, stageTimeoutMs, signal);
  if (iframeAttempt.ok) return iframeAttempt;

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }

  return {
    ok: false,
    reason: iframeAttempt.reason,
  };
}
