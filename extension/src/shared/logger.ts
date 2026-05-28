/**
 * Centralized logging utility for the extension.
 * Replaces direct console.log usage to improve code health and
 * suppress verbose logging in production environments.
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env?.DEV !== false) {
      console.debug(...args);
    }
  },
  log: (...args: unknown[]) => {
    if (import.meta.env?.DEV !== false) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  }
};
