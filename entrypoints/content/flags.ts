// filepath: entrypoints/content/flags.ts

export const ENABLE_KEY = 'cqdEnabled';

/**
 * Reads the extension-wide "enabled" flag from chrome.storage.local
 * and invokes the callback only if the extension is ON.
 *
 * - Defaults to ON if storage is unavailable or errors.
 * - Safe to call from any content script (Classroom, Drive, etc.).
 */
export function whenExtensionEnabled(callback: () => void): void {
  // If chrome API is not available for some reason, assume enabled.
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    callback();
    return;
  }

  chrome.storage.local.get({ [ENABLE_KEY]: true }, (result) => {
    if (chrome.runtime?.lastError) {
      // On storage error, fail open (treat as enabled) so the extension keeps working.
      callback();
      return;
    }

    const enabled = result[ENABLE_KEY] !== false;
    if (enabled) callback();
  });
}
