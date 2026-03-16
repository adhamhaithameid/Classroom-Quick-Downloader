// filepath: extension/entrypoints/student_work_resolver_bridge.content.ts

import {
  STUDENT_WORK_AUTOCLOSE_PARAM,
  STUDENT_WORK_MODE_PARAM,
  STUDENT_WORK_REQUEST_PARAM,
} from '../src/student_work/constants';
import { publishResolveResult } from '../src/student_work/channel';
import { extractResolvedDownloadUrl } from '../src/student_work/extractor';
import { isStudentWorkViewerPath } from '../src/student_work/url-classifier';

const BRIDGE_SCAN_INTERVAL_MS = 250;
const BRIDGE_TIMEOUT_MS = 10_000;

function publishFailure(requestId: string, reason: string): void {
  publishResolveResult({
    type: 'CQD_SW_RESOLVE_RESULT',
    requestId,
    ok: false,
    reason,
  });
}

function publishSuccess(
  requestId: string,
  resolvedUrl: string,
  source: string,
): void {
  publishResolveResult({
    type: 'CQD_SW_RESOLVE_RESULT',
    requestId,
    ok: true,
    resolvedUrl,
    source,
  });
}

function shouldAutoClose(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(STUDENT_WORK_AUTOCLOSE_PARAM) === '1';
  } catch {
    return false;
  }
}

function maybeCloseWindow(): void {
  if (!shouldAutoClose()) return;
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      // Ignore close failures.
    }
  }, 200);
}

function resolveRequestId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(STUDENT_WORK_REQUEST_PARAM);
    if (!value || value.trim().length === 0) return null;
    return value.trim();
  } catch {
    return null;
  }
}

function isExpectedViewerRoute(): boolean {
  return isStudentWorkViewerPath(window.location.pathname);
}

export function startBridge(): void {
  const requestId = resolveRequestId();
  if (!requestId) return;
  if (!isExpectedViewerRoute()) return;

  const mode = (() => {
    try {
      return new URLSearchParams(window.location.search).get(STUDENT_WORK_MODE_PARAM);
    } catch {
      return null;
    }
  })();
  if (mode !== 'iframe' && mode !== 'popup') return;

  const deadline = Date.now() + BRIDGE_TIMEOUT_MS;

  const tick = () => {
    const result = extractResolvedDownloadUrl(document, window.location.href);
    if (result) {
      publishSuccess(requestId, result.url, result.source);
      maybeCloseWindow();
      return true;
    }
    if (Date.now() >= deadline) {
      publishFailure(requestId, 'no_drive_url_found');
      maybeCloseWindow();
      return true;
    }
    return false;
  };

  if (tick()) return;

  const intervalId = window.setInterval(() => {
    if (tick()) {
      window.clearInterval(intervalId);
    }
  }, BRIDGE_SCAN_INTERVAL_MS);
}

export default defineContentScript({
  matches: [
    'https://classroom.google.com/g/tg/*',
    'https://classroom.google.com/u/*/g/tg/*',
  ],
  runAt: 'document_idle',
  main() {
    startBridge();
  },
});
