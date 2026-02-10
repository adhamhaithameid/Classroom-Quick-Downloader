import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('background/index', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('wires listeners and initializes analytics alarm on startup', async () => {
    vi.resetModules();

    const updateTabIcon = vi.fn();
    const updateGlobalIcon = vi.fn();
    const ensureAnalyticsAlarm = vi.fn();
    const refreshRemoteAnalyticsConfig = vi.fn(async () => {});

    vi.doMock('../entrypoints/background/state', () => ({
      pendingByRequestId: new Map(),
      pendingByDownloadId: new Map(),
      pendingByUrl: new Map(),
      pendingByBypassTabId: new Map(),
      cancelledByUs: new Set(),
      recentDownloads: new Map(),
      CLEANUP_INTERVAL_MS: 1000,
      IS_FIREFOX: false,
    }));
    vi.doMock('../entrypoints/background/icon-manager', () => ({
      createIconUpdaters: () => ({ updateTabIcon, updateGlobalIcon }),
      isClassroomUrl: () => true,
      setActionIcon: vi.fn(),
      GRAY_ICON_PATHS: {},
    }));
    vi.doMock('../entrypoints/background/auth-utils', () => ({
      extractDriveFileId: () => null,
    }));
    vi.doMock('../entrypoints/background/url-helpers', () => ({
      getFilenameExt: () => 'pdf',
      buildUrlWithAuthUser: (url: string) => url,
    }));
    vi.doMock('../entrypoints/background/cleanup', () => ({
      cleanup: vi.fn(),
      cleanupOrphanedPendingDownloads: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/analytics-alarm', () => ({
      ensureAnalyticsAlarm,
      checkAndCloseFileTab: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/message-sender', () => ({
      sendStatusToTab: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
      openDriveBypassTab: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      refreshRemoteAnalyticsConfig,
      recordDownloadEvent: vi.fn(),
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({
      t: (key: string) => key,
    }));

    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_key: any, cb: (result: any) => void) => {
      cb({ extensionEnabled: false });
    });

    const mod = await import('../entrypoints/background/index');
    const start = mod.default as unknown as () => void;
    start();

    expect(ensureAnalyticsAlarm).toHaveBeenCalledTimes(1);
    expect(refreshRemoteAnalyticsConfig).toHaveBeenCalledTimes(1);
    expect(updateGlobalIcon).toHaveBeenCalledWith(false);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
  });
});
