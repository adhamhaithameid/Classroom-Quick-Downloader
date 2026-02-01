// filepath: extension/entrypoints/utils/firefox-debug.ts

/**
 * Firefox-specific debugging utilities.
 * Helps diagnose Firefox-only issues in the extension.
 */

/**
 * Detect if the current browser is Firefox.
 */
export function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && 
         /Firefox/i.test(navigator.userAgent);
}

/**
 * Log a debug message only when running in Firefox.
 */
export function logFirefox(category: string, message: string, data?: unknown): void {
  if (!isFirefox()) return;
  
  const prefix = `[CQD:Firefox:${category}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Log a warning message only when running in Firefox.
 */
export function warnFirefox(category: string, message: string, data?: unknown): void {
  if (!isFirefox()) return;
  
  const prefix = `[CQD:Firefox:${category}]`;
  if (data !== undefined) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

/**
 * Check if Firefox's Promise-based messaging API is available.
 * Returns true if sendMessage returns a Promise (Firefox behavior).
 */
export function hasPromiseBasedMessaging(): boolean {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return false;
  }
  
  // In Firefox, sendMessage can return a Promise even in MV2
  // We detect this by checking the browser's user agent
  return isFirefox();
}
