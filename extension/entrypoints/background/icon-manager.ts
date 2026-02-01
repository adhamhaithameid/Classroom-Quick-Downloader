// filepath: extension/entrypoints/background/icon-manager.ts
/**
 * Extension icon management for tab-specific colorization.
 * Handles switching between colored (Classroom) and gray (other) icons.
 */

import { CLASSROOM_URL_PATTERN } from './state';

// --- ICON PATH CONSTANTS ---

export const COLOR_ICON_PATHS: Record<number, string> = {
  16: 'icon/16.png',
  32: 'icon/32.png',
  48: 'icon/48.png',
  96: 'icon/96.png',
  128: 'icon/128.png',
};

export const GRAY_ICON_PATHS: Record<number, string> = {
  16: 'icon/16-gray.png',
  32: 'icon/32-gray.png',
  48: 'icon/48-gray.png',
  96: 'icon/96-gray.png',
  128: 'icon/128-gray.png',
};

/**
 * Check if a URL is a Google Classroom page.
 */
export function isClassroomUrl(url?: string | null): boolean {
  if (!url) return false;
  return CLASSROOM_URL_PATTERN.test(url);
}

/**
 * Set the extension icon for a specific tab.
 * @param tabId - Tab to update icon for
 * @param classroom - Whether to show colored (true) or gray (false) icon
 */
export function setActionIcon(tabId: number, classroom: boolean): void {
  if (typeof chrome === 'undefined') return;
  const path = classroom ? COLOR_ICON_PATHS : GRAY_ICON_PATHS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionApi = (chrome as any).action || (chrome as any).browserAction;
  if (!actionApi?.setIcon) return;
  try {
    actionApi.setIcon({ tabId, path });
  } catch {
    // Ignore errors for non-existent tabs
  }
}

/**
 * Update icon for a tab based on its URL.
 */
export function updateIconForTab(tabId: number, url?: string | null): void {
  setActionIcon(tabId, isClassroomUrl(url));
}

/**
 * Create icon update functions scoped to extension state.
 * Returns closures that track global enabled state.
 */
export function createIconUpdaters() {
  let isExtensionEnabled = true;

  const updateTabIcon = (tabId: number, url?: string): void => {
    if (!isExtensionEnabled) {
      setActionIcon(tabId, false);
      return;
    }
    setActionIcon(tabId, isClassroomUrl(url));
  };

  const updateGlobalIcon = (enabled: boolean): void => {
    isExtensionEnabled = enabled;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionApi = (chrome as any).action || (chrome as any).browserAction;
    if (actionApi?.setIcon) {
      actionApi.setIcon({ path: GRAY_ICON_PATHS });
    }

    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) updateTabIcon(tab.id, tab.url);
      }
    });
  };

  const getEnabledState = () => isExtensionEnabled;
  const setEnabledState = (enabled: boolean) => {
    isExtensionEnabled = enabled;
  };

  return { updateTabIcon, updateGlobalIcon, getEnabledState, setEnabledState };
}
