// filepath: extension/entrypoints/background/api-token.ts
/**
 * ============================================================================
 * API TOKEN RELAY HANDLER (csaa.7) — background half of CQD_API_TOKEN
 * ============================================================================
 *
 * chrome.identity does not exist in content scripts, and the whole v3 engine
 * runs in one (docs/engine/api-assist-setup.md privacy model). The provider
 * (src/engines/v3/api/token-provider.ts) relays token requests to this
 * handler; the background context owns the real getAuthToken call.
 *
 * Sender contract (pinned by tests/v3-api-token-relay.test.ts):
 *   - only messages of type CQD_API_TOKEN are answered,
 *   - only a sender whose own URL (the frame URL — a foreign frame inside a
 *     Classroom tab does NOT inherit the tab's origin) is a
 *     classroom.google.com page gets a token,
 *   - the reply is always `{ token }`: the token string, or `{ token: null }`
 *     on any failure (no getAuthToken, denied, lastError, throw).
 *
 * The listener registration lives in ./index.ts following the existing
 * onMessage wiring pattern.
 */
import { API_TOKEN_MESSAGE_TYPE } from '../../src/engines/v3/api/token-provider';

/** The only host a token request may come from. */
const CLASSROOM_HOST = 'classroom.google.com';

interface ApiTokenRequestMessage {
  type?: unknown;
  interactive?: unknown;
}

function isClassroomPageSender(sender: unknown): sender is { url: string } {
  const url = (sender as { url?: unknown } | null | undefined)?.url;
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === CLASSROOM_HOST;
  } catch {
    return false;
  }
}

/**
 * Answers an API token request from a Classroom content script.
 * Listener-style: returns true when sendResponse will be called
 * (asynchronously), false when the message is not for this handler.
 */
export function handleApiTokenRequest(
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
): boolean {
  const request = message as ApiTokenRequestMessage | null | undefined;
  if (!request || request.type !== API_TOKEN_MESSAGE_TYPE) return false;
  if (!isClassroomPageSender(sender)) return false;

  // Strict boolean true only — anything else stays non-interactive, matching
  // the provider's default (token acquisition never prompts; the one
  // interactive escalation is the classroom-WIDE click, csaa.6).
  const interactive = request.interactive === true;

  const getAuthToken = chrome.identity?.getAuthToken;
  if (!getAuthToken) {
    sendResponse({ token: null });
    return true;
  }

  try {
    getAuthToken({ interactive }, (result) => {
      const token = typeof result === 'string'
        ? result
        : (typeof result === 'object' && result && 'token' in result
          ? String((result as { token?: string }).token || '')
          : '');

      if (chrome.runtime.lastError || !token) {
        sendResponse({ token: null });
        return;
      }
      sendResponse({ token });
    });
  } catch {
    sendResponse({ token: null });
  }
  return true;
}
