// filepath: entrypoints/content/flags.ts

export const ENABLE_KEY = 'cqdEnabled';

type WhenEnabledOn = () => void;
type WhenEnabledOff = () => void;

/**
 * Reads the extension-wide "enabled" flag from chrome.storage.local
 * and calls:
 *
 *   - onEnabled()  if the flag is ON (or missing)
 *   - onDisabled() if the flag is present and false
 *
 * onDisabled is optional; if omitted, nothing happens when the global
 * flag is OFF.
 *
 * This is a one-shot check, not a live subscription.
 * Safe to call from any content script (Classroom, Drive, popup, etc.).
 */
export function whenExtensionEnabled(
  onEnabled: WhenEnabledOn,
  onDisabled?: WhenEnabledOff,
): void {
  // If chrome API is not available (tests / non-extension env), assume enabled.
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    try {
      onEnabled();
    } catch {
      // ignore
    }
    return;
  }

  try {
    chrome.storage.local.get({ [ENABLE_KEY]: true }, (result) => {
      if (chrome.runtime?.lastError) {
        // On storage error, fail-open (treat as enabled) so UX keeps working.
        try {
          onEnabled();
        } catch {
          // ignore
        }
        return;
      }

      const enabled = result[ENABLE_KEY] !== false;

      if (enabled) {
        try {
          onEnabled();
        } catch {
          // ignore
        }
      } else if (onDisabled) {
        try {
          onDisabled();
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // Extremely defensive: if storage access itself throws, treat as enabled.
    try {
      onEnabled();
    } catch {
      // ignore
    }
  }
}