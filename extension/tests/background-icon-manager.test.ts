import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLOR_ICON_PATHS,
  GRAY_ICON_PATHS,
  createIconUpdaters,
  isClassroomUrl,
  setActionIcon,
  updateIconForTab,
} from '../entrypoints/background/icon-manager';

describe('background icon manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chrome.tabs = {
      query: vi.fn(),
    } as never;
  });

  it('detects classroom URLs correctly', () => {
    expect(isClassroomUrl('https://classroom.google.com/u/0/h')).toBe(true);
    expect(isClassroomUrl('https://example.com')).toBe(false);
    expect(isClassroomUrl('')).toBe(false);
    expect(isClassroomUrl(null)).toBe(false);
  });

  it('sets action icon using color and gray path maps', () => {
    const setIcon = vi.fn();
    (chrome as any).action = { setIcon };
    setActionIcon(1, true);
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 1, path: COLOR_ICON_PATHS });
    setActionIcon(1, false);
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 1, path: GRAY_ICON_PATHS });
  });

  it('handles missing setIcon API and tab failures gracefully', () => {
    (chrome as any).action = {};
    expect(() => setActionIcon(1, true)).not.toThrow();
    (chrome as any).action = {
      setIcon: vi.fn(() => {
        throw new Error('no tab');
      }),
    };
    expect(() => setActionIcon(99, false)).not.toThrow();
  });

  it('updates icon for tab based on URL state', () => {
    const setIcon = vi.fn();
    (chrome as any).action = { setIcon };
    updateIconForTab(5, 'https://classroom.google.com/c/abc');
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 5, path: COLOR_ICON_PATHS });
    updateIconForTab(5, 'https://example.com');
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 5, path: GRAY_ICON_PATHS });
  });

  it('createIconUpdaters propagates enabled state and refreshes existing tabs', () => {
    const setIcon = vi.fn();
    (chrome as any).action = { setIcon };
    (chrome.tabs.query as any).mockImplementation((_query: unknown, cb: (tabs: Array<{ id?: number; url?: string }>) => void) => {
      cb([
        { id: 10, url: 'https://classroom.google.com/u/0/h' },
        { id: 11, url: 'https://example.com' },
      ]);
    });
    const updaters = createIconUpdaters();
    expect(updaters.getEnabledState()).toBe(true);
    updaters.updateGlobalIcon(true);
    expect(setIcon).toHaveBeenCalledWith({ path: GRAY_ICON_PATHS });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 10, path: COLOR_ICON_PATHS });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 11, path: GRAY_ICON_PATHS });

    updaters.setEnabledState(false);
    updaters.updateTabIcon(12, 'https://classroom.google.com/u/0/h');
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 12, path: GRAY_ICON_PATHS });
  });
});

