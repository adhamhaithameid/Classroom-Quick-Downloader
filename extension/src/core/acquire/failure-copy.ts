/**
 * ============================================================================
 * FAILURE COPY — the one errorCode → user-facing-copy registry
 * (bead 0h4d.1.4, plan docs/superpowers/plans/2026-09-28-failure-reasons-ui.md)
 * ============================================================================
 *
 * Pure data (core-eligible under ADR-0007: no imports, no randomness). Every
 * classified failure the flow can settle on has an entry — tests/failure-
 * copy.test.ts fails on a taxonomy class without one, so a new class cannot
 * ship generic copy. The background composes userMessage from here; the
 * content funnel (message-handler) already renders it on the button.
 */

export interface FailureCopy {
  /** What happened, in one clause. */
  title: string;
  /** What the user should do next — a verb, never a stack trace. */
  action: string;
}

export const FAILURE_COPY: Record<string, FailureCopy> = {
  // ── chrome.downloads permanent interrupt classes ────────────────────────
  FILE_FAILED: {
    title: 'The file could not be saved.',
    action: 'Try downloading it again.',
  },
  STORAGE_FULL: {
    title: 'Your disk is full.',
    action: 'Free up some space and try again.',
  },
  CRASH: {
    title: 'The browser crashed during the download.',
    action: 'Try again.',
  },
  SERVER_BAD_CONTENT: {
    title: 'The file is no longer available at its source.',
    action: 'Ask the teacher to re-upload it.',
  },
  FILE_VIRUS_INFECTED: {
    title: 'The file is infected and was blocked by your browser.',
    action: 'Contact your teacher.',
  },
  FILE_BLOCKED: {
    title: 'Your browser blocked this file type for security reasons.',
    action: 'Download it from Drive directly.',
  },

  // ── chrome.downloads transient classes (shown when retries are exhausted) ─
  NETWORK_FAILED: {
    title: 'The network dropped during the download.',
    action: 'Check your connection and try again.',
  },
  SERVER_FAILED: {
    title: 'The server failed during the download.',
    action: 'Try again in a moment.',
  },
  NETWORK_TIMED_OUT: {
    title: 'The connection timed out during the download.',
    action: 'Check your connection and try again.',
  },

  // ── flow-level classes ───────────────────────────────────────────────────
  INVALID_URL: {
    title: 'This link is not a downloadable file.',
    action: 'Open it in Drive and download it from there.',
  },
  BROWSER_START_FAIL: {
    title: 'The browser blocked the download.',
    action: 'Check site permissions and try again.',
  },
  BROWSER_START_FAIL_DIRECT: {
    title: 'The browser blocked the download.',
    action: 'Check site permissions and try again.',
  },
  DOWNLOAD_START_TIMEOUT: {
    title: 'The download could not be started — the source never responded.',
    action: 'Try again.',
  },
  AUTH_ALL_FAILED: {
    title: 'Access was denied for all your Google accounts.',
    action: 'Open the file directly in Drive to confirm you can access it.',
  },
  SIZE_MISMATCH: {
    title: 'The download arrived incomplete and retrying did not fix it.',
    action: 'Try again.',
  },
  AUTH_CHECK: {
    title: 'Classroom sign-in is required.',
    action: 'Sign in to Classroom and try again.',
  },
};

/** Resolve copy for an errorCode; undefined for unknown codes (callers fall back). */
export function failureCopyFor(errorCode?: string): FailureCopy | undefined {
  if (!errorCode) return undefined;
  return FAILURE_COPY[errorCode];
}

/**
 * The user-facing sentence: title + action. Never contains the raw code.
 */
export function composeFailureMessage(errorCode?: string): string {
  const copy = failureCopyFor(errorCode);
  if (!copy) return '';
  return `${copy.title} ${copy.action}`;
}
