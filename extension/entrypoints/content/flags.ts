// filepath: entrypoints/content/flags.ts

export const ENABLE_KEY = 'extensionEnabled';

type StateCallback = () => void;

/**
 * Subscribes to the global extension enabled state.
 * - Checks initial state and calls onEnabled() or onDisabled().
 * - Listens for changes and calls the appropriate callback.
 * - Returns a cleanup function to remove the listener.
 */
export function subscribeToGlobalState(
  onEnabled: StateCallback,
  onDisabled?: StateCallback
): () => void {
  // If no chrome API, assume enabled (dev/test env)
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    try { onEnabled(); } catch {}
    return () => {};
  }

  const handleState = (isEnabled: boolean) => {
    try {
      if (isEnabled) {
        onEnabled();
      } else {
        onDisabled?.();
      }
    } catch (e) {
      console.warn('[CQD] Error in state callback', e);
    }
  };

  // 1. Initial Check
  chrome.storage.local.get(ENABLE_KEY, (result: { [key: string]: any }) => {
    // If error, fail-open (true)
    const isEnabled = chrome.runtime.lastError ? true : (result[ENABLE_KEY] !== false);
    handleState(isEnabled);
  });

  // 2. Change Listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listener = (changes: any, area: string) => {
    if (area === 'local' && changes[ENABLE_KEY]) {
      const newValue = changes[ENABLE_KEY].newValue !== false;
      handleState(newValue);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Legacy one-shot check, updated to use new key.
 * Prefer subscribeToGlobalState for dynamic toggling.
 */
export function whenExtensionEnabled(
  onEnabled: StateCallback,
  onDisabled?: StateCallback,
): void {
  subscribeToGlobalState(onEnabled, onDisabled);
}