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
