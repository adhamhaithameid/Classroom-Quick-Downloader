export const STORAGE_KEY_ENABLED = 'extensionEnabled';

export const getGlobalEnabled = async (): Promise<boolean> => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY_ENABLED);
    // Default to true if not set
    return res[STORAGE_KEY_ENABLED] !== false;
  } catch (error) {
    console.warn('Failed to get global enabled state:', error);
    return true;
  }
};

export const setGlobalEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabled });
  } catch (error) {
    console.warn('Failed to set global enabled state:', error);
  }
};
