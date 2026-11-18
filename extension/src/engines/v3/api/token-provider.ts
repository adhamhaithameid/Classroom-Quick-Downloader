import type { ClassroomApiTokenProvider } from './types';

/**
 * Message type for the content-script → background token relay (csaa.7).
 * chrome.identity does not exist in content scripts and the whole v3 engine
 * runs in one, so the provider relays token requests to the background over
 * this message; handleApiTokenRequest (entrypoints/background/api-token.ts)
 * answers them. See extension/tests/v3-api-token-relay.test.ts.
 */
export const API_TOKEN_MESSAGE_TYPE = 'CQD_API_TOKEN';

/** Shape of the relay reply the background sends back. */
interface ApiTokenReply {
  token?: string | null;
}

export class ChromeIdentityTokenProvider implements ClassroomApiTokenProvider {
  async getAccessToken(interactive = false): Promise<string | null> {
    if (typeof chrome === 'undefined') return null;

    // Content scripts never see chrome.identity — relay to the background,
    // which holds the real getAuthToken (csaa.7).
    if (!chrome.identity?.getAuthToken) return relayTokenRequest(interactive);

    return new Promise((resolve) => {
      try {
        chrome.identity.getAuthToken({ interactive }, (result) => {
          const token = typeof result === 'string'
            ? result
            : (typeof result === 'object' && result && 'token' in result
              ? String((result as { token?: string }).token || '')
              : '');

          if (chrome.runtime.lastError || !token) {
            resolve(null);
            return;
          }
          resolve(token);
        });
      } catch {
        resolve(null);
      }
    });
  }
}

/**
 * One-shot relay to the background token handler. Never throws and never
 * prompts from the content script: a missing answer, a lastError, a null
 * token, or an invalidated extension context all resolve null.
 */
function relayTokenRequest(interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: API_TOKEN_MESSAGE_TYPE, interactive },
        (reply?: ApiTokenReply) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(reply?.token ?? null);
        },
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Interactive consent escalation for the classroom-WIDE click (csaa.6 /
 * bug 2.5). A click is an explicit user gesture, so a silent non-interactive
 * miss (no cached token — the only warm-up path is visiting a student-work
 * view) may escalate to ONE interactive consent prompt instead of dying as
 * "Couldn't list files" forever.
 *
 * Scoped strictly to the classroom download controller's inventory client:
 * the student-work discovery paths keep the strictly non-interactive
 * ChromeIdentityTokenProvider (privacy model, docs/engine/api-assist-setup.md
 * — token acquisition never prompts there).
 *
 * Failure contract: a denied (or otherwise empty) interactive attempt THROWS.
 * CourseInventoryService.getInventory catches and resolves null, which the
 * controller renders as its classified "Couldn't list files" state — no
 * crash, no unhandled rejection. Returning null instead would classify the
 * denial as an empty course ("No downloadable files found") AND cache that
 * empty inventory for the 5-minute TTL; throwing keeps the failure uncached.
 */
export class InteractiveConsentTokenProvider implements ClassroomApiTokenProvider {
  private readonly inner: ClassroomApiTokenProvider;

  constructor(inner: ClassroomApiTokenProvider) {
    this.inner = inner;
  }

  async getAccessToken(interactive = false): Promise<string | null> {
    const token = await this.inner.getAccessToken(interactive);
    if (token) return token;
    // Already the escalated attempt — never prompt twice, never loop.
    if (interactive) return null;

    const consented = await this.inner.getAccessToken(true);
    if (!consented) {
      console.warn(
        '[CQD Classroom] Interactive consent denied or unavailable — cannot list classroom files',
      );
      throw new Error('[CQD Classroom] interactive consent denied');
    }
    return consented;
  }
}
