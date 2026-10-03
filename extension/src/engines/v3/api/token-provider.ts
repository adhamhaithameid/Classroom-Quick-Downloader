import type { ClassroomApiTokenProvider } from './types';

export class ChromeIdentityTokenProvider implements ClassroomApiTokenProvider {
  async getAccessToken(interactive = false): Promise<string | null> {
    if (typeof chrome === 'undefined' || !chrome.identity?.getAuthToken) return null;

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
