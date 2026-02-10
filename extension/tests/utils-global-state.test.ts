import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlobalEnabled, setGlobalEnabled, STORAGE_KEY_ENABLED } from '../entrypoints/utils/global-state';

describe('global state utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to enabled when key is missing', async () => {
    chrome.storage.local.get = vi.fn(async () => ({})) as never;
    expect(await getGlobalEnabled()).toBe(true);
  });

  it('returns false when storage key is false', async () => {
    chrome.storage.local.get = vi.fn(async () => ({ [STORAGE_KEY_ENABLED]: false })) as never;
    expect(await getGlobalEnabled()).toBe(false);
  });

  it('gracefully handles storage get errors', async () => {
    chrome.storage.local.get = vi.fn(async () => {
      throw new Error('storage down');
    }) as never;
    expect(await getGlobalEnabled()).toBe(true);
  });

  it('persists global enabled value and swallows set errors', async () => {
    const setSpy = vi.fn(async () => {});
    chrome.storage.local.set = setSpy as never;
    await setGlobalEnabled(false);
    expect(setSpy).toHaveBeenCalledWith({ [STORAGE_KEY_ENABLED]: false });

    chrome.storage.local.set = vi.fn(async () => {
      throw new Error('quota');
    }) as never;
    await expect(setGlobalEnabled(true)).resolves.toBeUndefined();
  });
});

