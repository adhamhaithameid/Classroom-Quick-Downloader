import { beforeEach, describe, expect, it, vi } from 'vitest';

// D11 — registry-faithful state mock shared by every loadBackground variant:
// the authoritative map plus indexes maintained only through registry fns.
// (The authority pre-check is exercised in background-state.test.ts; these
// suites preset unregistered pendings to drive listener logic.)
function makeStateModule(options: {
  isFirefox?: boolean;
  cleanupInterval?: number;
  urlBuckets?: Array<[string, any[]]>;
  pendingByRequestId?: Map<string, any>;
  pendingByDownloadId?: Map<number, any>;
  pendingByBypassTabId?: Map<number, any>;
  cancelledByUs?: Set<number>;
} = {}) {
  const pendingByRequestId = options.pendingByRequestId ?? new Map<string, any>();
  const pendingByDownloadId = options.pendingByDownloadId ?? new Map<number, any>();
  const pendingByUrl = new Map<string, Set<any>>();
  for (const [url, pendings] of options.urlBuckets ?? []) {
    pendingByUrl.set(url, new Set(pendings));
  }
  const pendingByBypassTabId = options.pendingByBypassTabId ?? new Map<number, any>();
  const indexUrl = (url: string, p: any) => {
    let bucket = pendingByUrl.get(url);
    if (!bucket) { bucket = new Set(); pendingByUrl.set(url, bucket); }
    bucket.add(p);
  };
  return {
    setPendingExpiredHook: vi.fn(),
    pendingByRequestId,
    pendingByDownloadId,
    pendingByUrl,
    pendingByBypassTabId,
    registerPending: (p: any) => {
      pendingByRequestId.set(p.requestId, p);
      indexUrl(p.baseUrl, p);
    },
    registerPendingUrl: (p: any, url: string) => indexUrl(url, p),
    bindDownloadId: (p: any, downloadId: number) => {
      p.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, p);
      return true;
    },
    unbindDownloadId: (downloadId: number) => { pendingByDownloadId.delete(downloadId); },
    getPendingByRequestId: (id: string) => pendingByRequestId.get(id),
    getPendingByDownloadId: (id: number) => pendingByDownloadId.get(id),
    getPendingByBypassTabId: (id: number) => pendingByBypassTabId.get(id),
    getUnclaimedPendingByUrl: (url: string) => {
      const bucket = pendingByUrl.get(url);
      if (!bucket || bucket.size === 0) return undefined;
      for (const p of bucket) { if (p.currentDownloadId == null) return p; }
      return undefined;
    },
    cancelledByUs: options.cancelledByUs ?? new Set<number>(),
    recentDownloads: new Map(),
    CLEANUP_INTERVAL_MS: options.cleanupInterval ?? 1000,
    IS_FIREFOX: options.isFirefox ?? false,
  };
}

describe('background/index', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  // W3: initializeUninstallUrl now loads stats asynchronously and the startup
  // flush chains one refresh, so the uninstall URL is set from microtasks.
  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  }

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

    vi.doMock('../entrypoints/background/state', () => makeStateModule({ isFirefox: false }));
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
      setDownloadStatusListener: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      // W3: the background chains .then on the startup flush, so the mock must
      // resolve like the real Analytics.flush() promise.
      Analytics: { flush: vi.fn(async () => {}) },
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
    await flushAsyncWork();

    expect(ensureAnalyticsAlarm).toHaveBeenCalledTimes(1);
    expect(refreshRemoteAnalyticsConfig).toHaveBeenCalledTimes(1);
    expect(updateGlobalIcon).toHaveBeenCalledWith(false);
    // W3: the URL is set once directly and once after the startup flush
    // resolves (post-flush stats refresh); the last setUninstallURL call wins.
    expect(setUninstallURL).toHaveBeenCalled();
    expect(onInstalledAddListener).toHaveBeenCalledTimes(1);
    const lastCallIndex = setUninstallURL.mock.calls.length - 1;
    const uninstallUrl = String(setUninstallURL.mock.calls[lastCallIndex]?.[0] || '');
    expect(uninstallUrl).toContain('/uninstall?');
    expect(uninstallUrl).toContain('source=extension');
    expect(uninstallUrl).toContain('browser=chrome');
    expect(uninstallUrl).toContain('version=1.3.0-test');
    // Stats params: storage mock returns no stats, so zeros.
    expect(uninstallUrl).toContain('d=0');
    expect(uninstallUrl).toContain('a=0');
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

    vi.doMock('../entrypoints/background/state', () => makeStateModule({ pendingByDownloadId }));
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
      setDownloadStatusListener: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      // W3: the background chains .then on the startup flush, so the mock must
      // resolve like the real Analytics.flush() promise.
      Analytics: { flush: vi.fn(async () => {}) },
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

  it('returns false for unknown message types and unexpected senders', async () => {
    vi.resetModules();
    vi.doMock('../entrypoints/background/state', () => makeStateModule({ isFirefox: false }));
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
      setDownloadStatusListener: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      // W3: the background chains .then on the startup flush, so the mock must
      // resolve like the real Analytics.flush() promise.
      Analytics: { flush: vi.fn(async () => {}) },
      refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
      recordDownloadEvent: vi.fn(),
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({
      t: (key: string) => key,
    }));
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
      expect(listener({ type: 'CQD_UPDATE_ICON' }, { id: 'some-other-extension' })).toBe(false);
      const result = listener({ type: 'UNKNOWN_MESSAGE_TYPE' }, { id: chrome.runtime.id, tab: { id: 1 } });
      expect(result === false || result === undefined).toBe(true);
      const nullResult = listener(null, { id: chrome.runtime.id, tab: { id: 1 } });
      expect(nullResult === false || nullResult === undefined).toBe(true);
    }
  });

  it('relays student-work resolver publish messages back to the originating tab', async () => {
    vi.resetModules();

    vi.doMock('../entrypoints/background/state', () => makeStateModule({ isFirefox: false }));
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
      setDownloadStatusListener: vi.fn(),
    }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt: vi.fn(),
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      // W3: the background chains .then on the startup flush, so the mock must
      // resolve like the real Analytics.flush() promise.
      Analytics: { flush: vi.fn(async () => {}) },
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
          id: chrome.runtime.id,
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

  // ─────────────────────────────────────────────────────────────────────────
  // Shared helpers for handler-level tests
  // ─────────────────────────────────────────────────────────────────────────

  type AnyPending = {
    requestId: string;
    startTime: number;
    originalUrl: string;
    baseUrl: string;
    isDrive: boolean;
    fileMeta?: { name?: string; ext?: string; kind?: string };
    finalExtension?: string;
    tabId?: number;
    attemptedAuthUsers: number[];
    currentAuthUser?: number;
    currentDownloadId?: number;
    fallbackStarted?: boolean;
    htmlSeen?: boolean;
    confirmed403?: boolean;
    finalized?: boolean;
    isCancelled?: boolean;
  };

  function makeBgPending(overrides: Partial<AnyPending> = {}): AnyPending {
    return {
      requestId: 'req-bg-test',
      startTime: Date.now() - 200,
      originalUrl: 'https://example.com/file.pdf',
      baseUrl: 'https://example.com/file.pdf',
      isDrive: false,
      fileMeta: { ext: 'pdf', name: 'file.pdf' },
      tabId: 5,
      attemptedAuthUsers: [],
      fallbackStarted: false,
      isCancelled: false,
      finalized: false,
      ...overrides,
    };
  }

  async function loadBackground(options: {
    isFirefox?: boolean;
    pendingByRequestId?: Map<string, AnyPending>;
    pendingByDownloadId?: Map<number, AnyPending>;
    pendingByBypassTabId?: Map<number, AnyPending>;
    cancelledByUs?: Set<number>;
    urlBuckets?: Array<[string, AnyPending[]]>;
    extractDriveFileId?: (url: string) => string | null;
  } = {}) {
    vi.resetModules();

    const stateModule = makeStateModule({
      isFirefox: options.isFirefox,
      cleanupInterval: 60_000,
      urlBuckets: options.urlBuckets,
      pendingByRequestId: options.pendingByRequestId,
      pendingByDownloadId: options.pendingByDownloadId,
      pendingByBypassTabId: options.pendingByBypassTabId,
      cancelledByUs: options.cancelledByUs,
    });

    const cleanup = vi.fn();
    const sendStatusToTab = vi.fn();
    const recordDownloadEvent = vi.fn();
    const startNextDriveAttempt = vi.fn();
    const extractDriveFileId = options.extractDriveFileId
      ? vi.fn(options.extractDriveFileId)
      : vi.fn(() => null);

    vi.doMock('../entrypoints/background/state', () => stateModule);
    vi.doMock('../entrypoints/background/icon-manager', () => ({
      createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
      isClassroomUrl: () => false,
      setActionIcon: vi.fn(),
      GRAY_ICON_PATHS: {},
    }));
    vi.doMock('../entrypoints/background/auth-utils', () => ({ extractDriveFileId }));
    vi.doMock('../entrypoints/background/url-helpers', () => ({
      getFilenameExt: (f: string) => f?.split('.').pop()?.toLowerCase() ?? '',
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
    vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab, setDownloadStatusListener: vi.fn() }));
    vi.doMock('../entrypoints/background/download-handler', () => ({
      handleDownloadRequest: vi.fn(() => true),
      startNextDriveAttempt,
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      // W3: the background chains .then on the startup flush, so the mock must
      // resolve like the real Analytics.flush() promise.
      Analytics: { flush: vi.fn(async () => {}) },
      refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
      recordDownloadEvent,
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({ t: (k: string) => k }));

    const onDeterminingFilenameListeners: Array<(item: any, suggest: any) => void> = [];
    const onCreatedListeners: Array<(item: any) => void> = [];
    const downloadChangedListeners: Array<(delta: any) => void> = [];
    const onMessageListeners: Array<(msg: any, sender: any, resp?: any) => any> = [];

    (chrome.downloads as any).onDeterminingFilename = {
      addListener: vi.fn((l: any) => onDeterminingFilenameListeners.push(l)),
    };
    (chrome.downloads as any).onCreated = {
      addListener: vi.fn((l: any) => onCreatedListeners.push(l)),
    };
    chrome.downloads.onChanged.addListener = vi.fn((l: any) => downloadChangedListeners.push(l)) as never;
    chrome.runtime.onMessage.addListener = vi.fn((l: any) => onMessageListeners.push(l)) as never;
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_k: any, cb: any) => cb({ extensionEnabled: true }));

    const mod = await import('../entrypoints/background/index');
    (mod.default as unknown as () => void)();

    return {
      stateModule,
      cleanup,
      sendStatusToTab,
      recordDownloadEvent,
      startNextDriveAttempt,
      onDeterminingFilenameListeners,
      onCreatedListeners,
      downloadChangedListeners,
      onMessageListeners,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // onDeterminingFilename (Chrome / Edge)
  // ─────────────────────────────────────────────────────────────────────────

  describe('onDeterminingFilename (Chrome/Edge)', () => {
    it('suggests filename from fileMeta when found via download ID', async () => {
      const pending = makeBgPending({ fileMeta: { name: 'lecture.pdf', ext: 'pdf' } });
      const { onDeterminingFilenameListeners } = await loadBackground({
        isFirefox: false,
        pendingByDownloadId: new Map([[42, pending]]),
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 42, url: 'https://example.com/file.pdf', mime: 'application/pdf', filename: 'lecture.pdf', finalUrl: '' },
        suggest,
      );

      expect(suggest).toHaveBeenCalledWith({ filename: 'lecture.pdf', conflictAction: 'uniquify' });
    });

    it('suggests fallback filename when fileMeta.name is absent', async () => {
      const pending = makeBgPending({ fileMeta: { ext: 'pdf' } });
      const { onDeterminingFilenameListeners } = await loadBackground({
        isFirefox: false,
        pendingByDownloadId: new Map([[99, pending]]),
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 99, url: 'https://example.com/file.pdf', mime: 'application/pdf', filename: 'file.pdf', finalUrl: '' },
        suggest,
      );

      expect(suggest).toHaveBeenCalledWith({ filename: 'classroom_download', conflictAction: 'uniquify' });
    });

    it('falls back to URL map when download ID not yet in pendingByDownloadId, then assigns it', async () => {
      const pending = makeBgPending({ fileMeta: { name: 'notes.pdf', ext: 'pdf' } });
      const { onDeterminingFilenameListeners, stateModule } = await loadBackground({
        isFirefox: false,
        urlBuckets: [['https://example.com/notes.pdf', [pending]]],
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 77, url: 'https://example.com/notes.pdf', mime: 'application/pdf', filename: 'notes.pdf', finalUrl: '' },
        suggest,
      );

      expect(pending.currentDownloadId).toBe(77);
      expect(stateModule.pendingByDownloadId.get(77)).toBe(pending);
      expect(suggest).toHaveBeenCalledWith({ filename: 'notes.pdf', conflictAction: 'uniquify' });
    });

    it('uses item.finalUrl as secondary URL lookup when item.url has no match', async () => {
      const pending = makeBgPending({ fileMeta: { name: 'doc.pdf', ext: 'pdf' } });
      const { onDeterminingFilenameListeners, stateModule } = await loadBackground({
        isFirefox: false,
        urlBuckets: [['https://redirected.example.com/doc.pdf', [pending]]],
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        {
          id: 55,
          url: 'https://original.example.com/doc.pdf',
          mime: 'application/pdf',
          filename: 'doc.pdf',
          finalUrl: 'https://redirected.example.com/doc.pdf',
        },
        suggest,
      );

      expect(pending.currentDownloadId).toBe(55);
      expect(stateModule.pendingByDownloadId.get(55)).toBe(pending);
      expect(suggest).toHaveBeenCalledWith({ filename: 'doc.pdf', conflictAction: 'uniquify' });
    });

    it('cancels HTML responses and retries the next account without any tab (zero-tab contract)', async () => {
      const pending = makeBgPending({
        isDrive: true,
        baseUrl: 'https://drive.usercontent.google.com/download?id=abc&export=download&confirm=t',
        fileMeta: { ext: 'pdf' },
      });
      const { onDeterminingFilenameListeners, startNextDriveAttempt: nextAttempt, sendStatusToTab } = await loadBackground({
        isFirefox: false,
        pendingByDownloadId: new Map([[42, pending]]),
      });

      chrome.downloads.cancel = vi.fn((_id: number, cb?: () => void) => cb?.()) as never;
      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 42, url: 'https://drive.usercontent.google.com/download?id=abc', mime: 'text/html', filename: 'viewer.html', finalUrl: 'https://drive.usercontent.google.com/download?id=abc' },
        suggest,
      );

      expect(chrome.downloads.cancel).toHaveBeenCalledWith(42, expect.any(Function));
      expect(nextAttempt).toHaveBeenCalledWith(pending);
      expect(sendStatusToTab).toHaveBeenCalledWith(pending, 'trying', expect.any(String), 'AUTH_LOOP');
      expect(suggest).not.toHaveBeenCalled();
    });

    it('does NOT cancel HTML download when user explicitly requested HTML content', async () => {
      const pending = makeBgPending({ isDrive: false, fileMeta: { kind: 'html', ext: 'html' } });
      const { onDeterminingFilenameListeners } = await loadBackground({
        isFirefox: false,
        pendingByDownloadId: new Map([[10, pending]]),
      });

      chrome.downloads.cancel = vi.fn() as never;
      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 10, url: 'https://example.com/page.html', mime: 'text/html', filename: 'page.html', finalUrl: '' },
        suggest,
      );

      expect(chrome.downloads.cancel).not.toHaveBeenCalled();
      expect(suggest).toHaveBeenCalled();
    });

    it('calls suggest with no args for unknown download IDs', async () => {
      const { onDeterminingFilenameListeners } = await loadBackground({ isFirefox: false });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 999, url: 'https://unknown.com/file.bin', mime: 'application/octet-stream', filename: 'file.bin', finalUrl: '' },
        suggest,
      );

      expect(suggest).toHaveBeenCalledWith();
    });

    it('routes URL fallback to unassigned pending when two concurrent downloads share a URL', async () => {
      const pendingA = makeBgPending({ requestId: 'req-a', fileMeta: { name: 'a.pdf', ext: 'pdf' } });
      const pendingB = makeBgPending({ requestId: 'req-b', fileMeta: { name: 'b.pdf', ext: 'pdf' }, currentDownloadId: 101 });
      const { onDeterminingFilenameListeners, stateModule } = await loadBackground({
        isFirefox: false,
        urlBuckets: [['https://example.com/shared.pdf', [pendingA, pendingB]]],
        pendingByDownloadId: new Map([[101, pendingB]]),
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 200, url: 'https://example.com/shared.pdf', mime: 'application/pdf', filename: 'shared.pdf', finalUrl: '' },
        suggest,
      );

      // Routes to pendingA (no download ID yet), not pendingB (already has 101)
      expect(pendingA.currentDownloadId).toBe(200);
      expect(stateModule.pendingByDownloadId.get(200)).toBe(pendingA);
      expect(pendingB.currentDownloadId).toBe(101);
    });

    it('does not overwrite currentDownloadId if URL fallback returns already-assigned pending', async () => {
      // Simulate a pending that somehow slips through with an existing ID (defensive guard check)
      const pending = makeBgPending({ currentDownloadId: 50, fileMeta: { name: 'x.pdf', ext: 'pdf' } });
      // pendingByDownloadId has 50→pending but NOT 99→pending
      const { onDeterminingFilenameListeners } = await loadBackground({
        isFirefox: false,
        pendingByDownloadId: new Map([[50, pending]]),
        // No URL buckets — pendingByUrlGet will return undefined
      });

      const suggest = vi.fn();
      onDeterminingFilenameListeners[0](
        { id: 99, url: 'https://example.com/file.pdf', mime: 'application/pdf', filename: 'x.pdf', finalUrl: '' },
        suggest,
      );

      // No match → suggest() called with no args
      expect(suggest).toHaveBeenCalledWith();
      expect(pending.currentDownloadId).toBe(50); // unchanged
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // onCreated (Firefox)
  // ─────────────────────────────────────────────────────────────────────────

  describe('onCreated (Firefox)', () => {
    it('finds pending by download ID directly and marks as finalized', async () => {
      const pending = makeBgPending({ isDrive: false });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        pendingByDownloadId: new Map([[77, pending]]),
      });

      onCreatedListeners[0]({ id: 77, url: 'https://example.com/file.pdf', filename: 'file.pdf' });

      // Correlate-only (Firefox honesty): success waits for onChanged complete.
      expect(sendStatusToTab).not.toHaveBeenCalled();
      expect(pending.finalized).toBeFalsy();
      expect(pending.currentDownloadId).toBe(77);
    });

    it('does not send success twice when pending is already finalized', async () => {
      const pending = makeBgPending({ finalized: true });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        pendingByDownloadId: new Map([[77, pending]]),
      });

      onCreatedListeners[0]({ id: 77, url: 'https://example.com/file.pdf', filename: 'file.pdf' });

      expect(sendStatusToTab).not.toHaveBeenCalled();
    });

    it('finds pending via Drive file ID match in the URL bucket (bypass-tab map removed)', async () => {
      const pending = makeBgPending({
        isDrive: true,
        baseUrl: 'https://drive.usercontent.google.com/download?id=FILE1&export=download&confirm=t',
        originalUrl: 'https://drive.usercontent.google.com/download?id=FILE1&export=download&confirm=t',
      });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        urlBuckets: [['https://drive.usercontent.google.com/download?id=FILE1&export=download&confirm=t', [pending]]],
        extractDriveFileId: (url: string) => (url.includes('FILE1') ? 'FILE1' : null),
      });

      onCreatedListeners[0]({ id: 55, url: 'https://drive.usercontent.google.com/download?id=FILE1&export=download&confirm=t', filename: 'file.pdf' });

      expect(pending.currentDownloadId).toBe(55);
      // Correlate-only: success waits for onChanged complete (Firefox honesty).
      expect(sendStatusToTab).not.toHaveBeenCalled();
    });

    it('finds pending via Drive file ID match in pendingByUrl bucket (Set iteration)', async () => {
      const pending = makeBgPending({
        isDrive: true,
        baseUrl: 'https://drive.google.com/uc?id=FILE2',
        originalUrl: 'https://drive.google.com/uc?id=FILE2',
      });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        urlBuckets: [['https://drive.google.com/uc?id=FILE2', [pending]]],
        extractDriveFileId: (url: string) => (url.includes('FILE2') ? 'FILE2' : null),
      });

      onCreatedListeners[0]({ id: 66, url: 'https://drive.google.com/uc?id=FILE2', filename: 'file.pdf' });

      expect(pending.currentDownloadId).toBe(66);
      // Correlate-only (Firefox honesty): success waits for onChanged complete.
      expect(sendStatusToTab).not.toHaveBeenCalled();
    });

    it('falls back to exact URL match via pendingByUrlGet when Drive file ID is null', async () => {
      const pending = makeBgPending({ isDrive: false });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        urlBuckets: [['https://example.com/direct.pdf', [pending]]],
        extractDriveFileId: () => null,
      });

      onCreatedListeners[0]({ id: 44, url: 'https://example.com/direct.pdf', filename: 'direct.pdf' });

      expect(pending.currentDownloadId).toBe(44);
      // Correlate-only (Firefox honesty): success waits for onChanged complete.
      expect(sendStatusToTab).not.toHaveBeenCalled();
    });

    it('finds pending via request ID map when URL and bypass tab maps have no match', async () => {
      const pending = makeBgPending({
        isDrive: true,
        baseUrl: 'https://drive.google.com/uc?id=FILE3',
        originalUrl: 'https://drive.google.com/uc?id=FILE3',
      });
      const { onCreatedListeners, sendStatusToTab } = await loadBackground({
        isFirefox: true,
        pendingByRequestId: new Map([['req-bg-test', pending]]),
        extractDriveFileId: (url: string) => (url.includes('FILE3') ? 'FILE3' : null),
      });

      onCreatedListeners[0]({ id: 33, url: 'https://drive.google.com/uc?id=FILE3', filename: 'file.pdf' });

      expect(pending.currentDownloadId).toBe(33);
      // Correlate-only (Firefox honesty): success waits for onChanged complete.
      expect(sendStatusToTab).not.toHaveBeenCalled();
    });

    it('correctly picks unassigned pending from a shared-URL bucket', async () => {
      const pendingA = makeBgPending({ requestId: 'req-a', isDrive: false });
      const pendingB = makeBgPending({ requestId: 'req-b', isDrive: false, currentDownloadId: 10 });
      const { onCreatedListeners } = await loadBackground({
        isFirefox: true,
        urlBuckets: [['https://example.com/shared.pdf', [pendingA, pendingB]]],
        extractDriveFileId: () => null,
      });

      onCreatedListeners[0]({ id: 20, url: 'https://example.com/shared.pdf', filename: 'shared.pdf' });

      expect(pendingA.currentDownloadId).toBe(20);
      expect(pendingB.currentDownloadId).toBe(10); // unchanged
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CQD_CANCEL_DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────

  describe('CQD_CANCEL_DOWNLOAD', () => {
    it('cancels browser download, erases it, records analytics, and cleans up', async () => {
      const pending = makeBgPending({ currentDownloadId: 42 });
      const { onMessageListeners, cleanup: cleanupSpy, recordDownloadEvent } = await loadBackground({
        pendingByRequestId: new Map([['req-bg-test', pending]]),
      });

      chrome.downloads.cancel = vi.fn((_id: number, cb?: () => void) => cb?.()) as never;
      chrome.downloads.erase = vi.fn((_filter: object, cb?: () => void) => cb?.()) as never;

      const sender = { id: chrome.runtime.id, tab: { id: 5 } };
      for (const listener of onMessageListeners) {
        listener({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'req-bg-test' }, sender);
      }

      expect(chrome.downloads.cancel).toHaveBeenCalledWith(42, expect.any(Function));
      expect(chrome.downloads.erase).toHaveBeenCalledWith({ id: 42 }, expect.any(Function));
      expect(recordDownloadEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
      expect(cleanupSpy).toHaveBeenCalledWith(pending);
    });

    it('cleans up without calling cancel when download has not yet started', async () => {
      const pending = makeBgPending({ currentDownloadId: undefined });
      const { onMessageListeners, cleanup: cleanupSpy } = await loadBackground({
        pendingByRequestId: new Map([['req-bg-test', pending]]),
      });

      chrome.downloads.cancel = vi.fn() as never;

      const sender = { id: chrome.runtime.id, tab: { id: 5 } };
      for (const listener of onMessageListeners) {
        listener({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'req-bg-test' }, sender);
      }

      expect(chrome.downloads.cancel).not.toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalledWith(pending);
    });

    it('ignores cancellation for unknown requestId', async () => {
      const { onMessageListeners, cleanup: cleanupSpy } = await loadBackground();

      const sender = { id: chrome.runtime.id, tab: { id: 5 } };
      for (const listener of onMessageListeners) {
        listener({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'does-not-exist' }, sender);
      }

      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('sets isCancelled on the pending before calling cancel', async () => {
      const pending = makeBgPending({ currentDownloadId: 88 });
      const { onMessageListeners } = await loadBackground({
        pendingByRequestId: new Map([['req-bg-test', pending]]),
      });

      chrome.downloads.cancel = vi.fn() as never;
      chrome.downloads.erase = vi.fn() as never;

      const sender = { id: chrome.runtime.id, tab: { id: 5 } };
      for (const listener of onMessageListeners) {
        listener({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'req-bg-test' }, sender);
      }

      expect(pending.isCancelled).toBe(true);
    });
  });

  // Bypass tab message handlers were removed with the zero-tab flow:
  // CQD_BYPASS_SUCCESS / CQD_403_SEEN / CQD_QUERY_BYPASS_CONSENT /
  // CQD_REGISTER_BYPASS_URL no longer exist. The forbidden-failure behavior
  // they used to carry lives in tests/background-bypass-flow.test.ts.
});
