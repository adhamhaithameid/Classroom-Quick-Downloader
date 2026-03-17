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
    const setUninstallURL = vi.fn((_url: string, callback?: () => void) => {
      callback?.();
    });
    const onInstalledAddListener = vi.fn();

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
    (chrome.runtime as unknown as Record<string, unknown>).setUninstallURL = setUninstallURL;
    (chrome.runtime as unknown as Record<string, unknown>).onInstalled = {
      addListener: onInstalledAddListener,
    };

    const mod = await import('../entrypoints/background/index');
    const start = mod.default as unknown as () => void;
    start();

    expect(ensureAnalyticsAlarm).toHaveBeenCalledTimes(1);
    expect(refreshRemoteAnalyticsConfig).toHaveBeenCalledTimes(1);
    expect(updateGlobalIcon).toHaveBeenCalledWith(false);
    expect(setUninstallURL).toHaveBeenCalledTimes(1);
    expect(onInstalledAddListener).toHaveBeenCalledTimes(1);
    const uninstallUrl = String(setUninstallURL.mock.calls[0]?.[0] || '');
    expect(uninstallUrl).toContain('/uninstall?');
    expect(uninstallUrl).toContain('source=extension');
    expect(uninstallUrl).toContain('browser=chrome');
    expect(uninstallUrl).toContain('version=1.3.0-test');
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
  });

  it('sends success on download completion even when filename hook did not finalize the request', async () => {
    vi.resetModules();

    const pending = {
      requestId: 'req-complete',
      startTime: Date.now() - 250,
      originalUrl: 'https://drive.google.com/file/d/abc/view',
      baseUrl: 'https://drive.google.com/uc?export=download&id=abc',
      isDrive: true,
      fileMeta: { ext: 'pdf', name: 'lecture.pdf' },
      attemptedAuthUsers: [],
      fallbackStarted: false,
      isCancelled: false,
      tabId: 12,
      finalized: false,
    };
    const pendingByDownloadId = new Map([[42, pending]]);
    const cleanup = vi.fn();
    const sendStatusToTab = vi.fn();
    const recordDownloadEvent = vi.fn();

    vi.doMock('../entrypoints/background/state', () => ({
      pendingByRequestId: new Map(),
      pendingByDownloadId,
      pendingByUrl: new Map(),
      pendingByBypassTabId: new Map(),
      cancelledByUs: new Set(),
      recentDownloads: new Map(),
      CLEANUP_INTERVAL_MS: 1000,
      IS_FIREFOX: false,
    }));
    vi.doMock('../entrypoints/background/icon-manager', () => ({
      createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
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
      cleanup,
      cleanupOrphanedPendingDownloads: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/analytics-alarm', () => ({
      ensureAnalyticsAlarm: vi.fn(),
      checkAndCloseFileTab: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/message-sender', () => ({
      sendStatusToTab,
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
      openDriveBypassTab: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
      recordDownloadEvent,
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({
      t: (key: string) => key,
    }));

    const downloadChangedListeners: Array<(delta: any) => void> = [];
    chrome.downloads.onChanged.addListener = vi.fn((listener: (delta: any) => void) => {
      downloadChangedListeners.push(listener);
    }) as never;

    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_key: any, cb: (result: any) => void) => {
      cb({ extensionEnabled: true });
    });

    const mod = await import('../entrypoints/background/index');
    const start = mod.default as unknown as () => void;
    start();

    expect(downloadChangedListeners).toHaveLength(1);
    downloadChangedListeners[0]({
      id: 42,
      state: { current: 'complete' },
    });

    expect(sendStatusToTab).toHaveBeenCalledWith(pending, 'success');
    expect(recordDownloadEvent).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      type: 'pdf',
    }));
    expect(cleanup).toHaveBeenCalledWith(pending, 42);
  });

  it('relays student-work resolver publish messages back to the originating tab', async () => {
    vi.resetModules();

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
      createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
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
      ensureAnalyticsAlarm: vi.fn(),
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
      refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
      recordDownloadEvent: vi.fn(),
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({
      t: (key: string) => key,
    }));

    const tabsSendMessage = vi.fn();
    (chrome.tabs as unknown as Record<string, unknown>).sendMessage = tabsSendMessage;

    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_key: any, cb: (result: any) => void) => {
      cb({ extensionEnabled: true });
    });

    const mod = await import('../entrypoints/background/index');
    const start = mod.default as unknown as () => void;
    start();

    const listeners = (chrome.runtime.onMessage.addListener as any)
      .mock.calls
      .map((call: unknown[]) => call[0] as (message: any, sender: any) => unknown);
    expect(listeners.length).toBeGreaterThan(0);

    for (const listener of listeners) {
      listener(
        {
          type: 'CQD_SW_RESOLVE_RESULT_PUBLISH',
          payload: {
            type: 'CQD_SW_RESOLVE_RESULT',
            requestId: 'relay-req-1',
            ok: true,
            resolvedUrl: 'https://drive.google.com/uc?export=download&id=RELAY_1',
            source: 'anchor',
          },
        },
        {
          tab: { id: 55, url: 'https://classroom.google.com/c/C/a/A/submissions' },
          url: 'https://classroom.google.com/g/tg/a/b/c?cqd_sw_req=relay-req-1&cqd_sw_mode=iframe',
        },
      );
    }

    expect(tabsSendMessage).toHaveBeenCalledWith(
      55,
      expect.objectContaining({
        type: 'CQD_SW_RESOLVE_RESULT_RELAY',
        payload: expect.objectContaining({
          requestId: 'relay-req-1',
          ok: true,
        }),
      }),
    );
  });
});
