import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

/**
 * S9/#537+#547 — full-lifecycle Drive download flow tests at the
 * message-flow/state-machine seam (the S9 BrowserPort-level harness).
 *
 * Unlike background-index.test.ts (which mocks download-handler behind its
 * function seam) and background-download-handler.test.ts (which tests single
 * attempts), these tests drive the REAL index.ts listeners together with the
 * REAL download-handler auth-cycling state machine, with only the browser
 * host (chrome.downloads/tabs) and the registry mocked. IS_FIREFOX toggles
 * the Firefox bypass-tab adapter vs the Chromium download-manager adapter —
 * exactly the split the zen (#537) and Brave (#547) reports exercise.
 *
 * Product contract under test (from the bug reports "files start but fail"):
 *   - A 403 / forbidden-family failure must cycle through the signed-in
 *     accounts (authuser candidates) on BOTH browsers before surfacing a
 *     terminal error.
 *   - Terminal failure is AUTH_ALL_FAILED after every candidate was tried.
 *   - Success (CQD_BYPASS_SUCCESS) mid-cycle stops the loop.
 *   - Non-auth interrupts (network etc.) and self-cancelled downloads must
 *     NOT trigger pointless account cycling.
 */

const DRIVE_BASE = 'https://drive.google.com/uc?export=download&id=FILE123';
const ORIGINAL_URL = 'https://drive.google.com/file/d/FILE123/view';

type FlowOptions = {
  isFirefox?: boolean;
  authCandidates?: number[];
  cancelledByUs?: Set<number>;
};

function makeFlowState(options: FlowOptions = {}) {
  const pendingByRequestId = new Map<string, PendingDownload>();
  const pendingByDownloadId = new Map<number, PendingDownload>();
  const pendingByUrl = new Map<string, Set<PendingDownload>>();
  const pendingByBypassTabId = new Map<number, PendingDownload>();
  const indexUrl = (url: string, p: PendingDownload) => {
    let bucket = pendingByUrl.get(url);
    if (!bucket) {
      bucket = new Set();
      pendingByUrl.set(url, bucket);
    }
    bucket.add(p);
  };
  return {
    pendingByRequestId,
    pendingByDownloadId,
    pendingByUrl,
    pendingByBypassTabId,
    AUTHUSER_CANDIDATES: options.authCandidates ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    IS_FIREFOX: options.isFirefox ?? false,
    CLASSROOM_URL_PATTERN: /^https:\/\/classroom\.google\.com\//,
    PENDING_DOWNLOAD_TTL_MS: 10 * 60 * 1000,
    CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
    cancelledByUs: options.cancelledByUs ?? new Set<number>(),
    recentDownloads: new Map<string, number>(),
    registerPending: (p: PendingDownload) => {
      pendingByRequestId.set(p.requestId, p);
      indexUrl(p.baseUrl, p);
    },
    registerPendingUrl: (p: PendingDownload, url: string) => {
      if (pendingByRequestId.get(p.requestId) !== p) return;
      indexUrl(url, p);
    },
    bindDownloadId: (p: PendingDownload, downloadId: number) => {
      if (pendingByRequestId.get(p.requestId) !== p) return false;
      const existing = pendingByDownloadId.get(downloadId);
      if (existing !== undefined && existing !== p) return false;
      p.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, p);
      return true;
    },
    unbindDownloadId: (downloadId: number) => {
      pendingByDownloadId.delete(downloadId);
    },
    bindBypassTabId: (p: PendingDownload, tabId: number) => {
      if (pendingByRequestId.get(p.requestId) !== p) return false;
      pendingByBypassTabId.set(tabId, p);
      return true;
    },
    unbindBypassTabId: (tabId: number) => {
      pendingByBypassTabId.delete(tabId);
    },
    unregisterPending: (p: PendingDownload) => {
      if (pendingByRequestId.get(p.requestId) === p) pendingByRequestId.delete(p.requestId);
      for (const [id, v] of pendingByDownloadId) {
        if (v === p || v.requestId === p.requestId) pendingByDownloadId.delete(id);
      }
      for (const [tabId, v] of pendingByBypassTabId) {
        if (v === p || v.requestId === p.requestId) pendingByBypassTabId.delete(tabId);
      }
      for (const [url, bucket] of pendingByUrl.entries()) {
        if (bucket.delete(p) && bucket.size === 0) pendingByUrl.delete(url);
      }
    },
    isRegistered: (requestId: string) => pendingByRequestId.has(requestId),
    getPendingByRequestId: (id: string) => pendingByRequestId.get(id),
    getPendingByDownloadId: (id: number) => pendingByDownloadId.get(id),
    getPendingByBypassTabId: (tabId: number) => pendingByBypassTabId.get(tabId),
    getUnclaimedPendingByUrl: (url: string) => {
      const bucket = pendingByUrl.get(url);
      if (!bucket || bucket.size === 0) return undefined;
      for (const p of bucket) {
        if (p.currentDownloadId == null) return p;
      }
      return undefined;
    },
  };
}

async function loadFlow(options: FlowOptions = {}) {
  vi.resetModules();

  const stateModule = makeFlowState(options);

  const cleanupSpy = vi.fn();
  const sendStatusSpy = vi.fn();
  const recordSpy = vi.fn();

  vi.doMock('../entrypoints/background/state', () => stateModule);
  vi.doMock('../entrypoints/background/icon-manager', () => ({
    createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
    isClassroomUrl: () => true,
    setActionIcon: vi.fn(),
    GRAY_ICON_PATHS: {},
  }));
  vi.doMock('../entrypoints/background/auth-utils', () => ({
    extractDriveFileId: vi.fn(() => null),
    extractAuthUserFromUrl: vi.fn(() => undefined),
  }));
  vi.doMock('../entrypoints/background/url-helpers', () => ({
    getFilenameExt: (f: string) => f?.split('.').pop()?.toLowerCase() ?? '',
    normalizeUrl: vi.fn(() => ({ baseUrl: DRIVE_BASE, isDrive: true })),
    buildUrlWithAuthUser: vi.fn(
      (baseUrl: string, authuser: number) =>
        `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}authuser=${authuser}`,
    ),
  }));
  vi.doMock('../entrypoints/background/cleanup', () => ({
    // Faithful mock: real cleanup unregisters the pending; keep that so
    // registry assertions observe the same post-state as production.
    cleanup: (...args: any[]) => {
      stateModule.unregisterPending(args[0]);
      cleanupSpy(...args);
    },
    cleanupOrphanedPendingDownloads: vi.fn(),
  }));
  vi.doMock('../entrypoints/background/analytics-alarm', () => ({
    ensureAnalyticsAlarm: vi.fn(),
    checkAndCloseFileTab: vi.fn(),
  }));
  vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab: sendStatusSpy }));
  vi.doMock('../entrypoints/utils/analytics', () => ({
    refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
    recordDownloadEvent: recordSpy,
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({ t: (k: string) => k }));
  vi.doMock('../../src/v2/decision/download-validator', () => ({
    validateDownloadUrl: vi.fn(() => ({ valid: true })),
  }));

  // --- Browser host mocks (the BrowserPort seam) ---
  let nextTabId = 100;
  let nextDownloadId = 1000;
  const tabCreations: Array<{ url: string; active?: boolean }> = [];
  const downloadCalls: Array<{ url: string }> = [];

  chrome.tabs.create = vi.fn((opts: any, cb?: (tab: any) => void) => {
    const id = nextTabId++;
    tabCreations.push({ url: opts?.url, active: opts?.active });
    cb?.({ id, ...opts });
    return { id } as never;
  }) as never;
  chrome.tabs.remove = vi.fn((_tabId: number, cb?: () => void) => {
    cb?.();
  }) as never;
  chrome.downloads.download = vi.fn((opts: any, cb?: (id?: number) => void) => {
    downloadCalls.push({ url: opts?.url });
    const id = nextDownloadId++;
    cb?.(id);
    return id as never;
  }) as never;

  const onMessageListeners: Array<(msg: any, sender: any, resp?: any) => any> = [];
  const downloadChangedListeners: Array<(delta: any) => void> = [];
  chrome.runtime.onMessage.addListener = vi.fn((l: any) => {
    onMessageListeners.push(l);
  }) as never;
  chrome.downloads.onChanged.addListener = vi.fn((l: any) => {
    downloadChangedListeners.push(l);
  }) as never;
  (chrome.downloads as any).onDeterminingFilename = {
    addListener: vi.fn(),
  };
  (chrome.downloads as any).onCreated = {
    addListener: vi.fn(),
  };
  vi.spyOn(chrome.storage.local, 'get').mockImplementation((_k: any, cb: any) =>
    cb({ extensionEnabled: true }),
  );
  (chrome.runtime as any).lastError = undefined;

  const mod = await import('../entrypoints/background/index');
  (mod.default as unknown as () => void)();

  const dispatchMessage = (message: any, sender: any = { tab: { id: 5 } }) => {
    let lastReturn: any;
    for (const listener of onMessageListeners) {
      lastReturn = listener(message, sender, vi.fn());
    }
    return lastReturn;
  };

  const dispatchDownloadChange = (delta: any) => {
    for (const listener of downloadChangedListeners) listener(delta);
  };

  /** Fire CQD_403_SEEN from a bypass tab id. */
  const report403 = (tabId: number) =>
    dispatchMessage({ type: 'CQD_403_SEEN' }, { tab: { id: tabId } });

  const reportBypassSuccess = (tabId: number) =>
    dispatchMessage({ type: 'CQD_BYPASS_SUCCESS' }, { tab: { id: tabId } });

  const requestDownload = () =>
    dispatchMessage({
      type: 'CQD_DOWNLOAD',
      url: ORIGINAL_URL,
      requestId: 'req-flow',
      fileMeta: { name: 'lecture.pdf', ext: 'pdf' },
    });

  const bypassTabIds = () => [...stateModule.pendingByBypassTabId.keys()].sort((a, b) => a - b);

  return {
    stateModule,
    cleanupSpy,
    sendStatusSpy,
    recordSpy,
    tabCreations,
    downloadCalls,
    requestDownload,
    report403,
    reportBypassSuccess,
    dispatchDownloadChange,
    bypassTabIds,
  };
}

const tryingStatusCall = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.find((c) => c[1] === 'trying' && c[3] === 'AUTH_LOOP');
const errorStatusCall = (spy: ReturnType<typeof vi.fn>, errorType: string) =>
  spy.mock.calls.find((c) => c[1] === 'error' && c[3] === errorType);

describe('S9 bypass flow — Firefox/zen (#537): 403 must cycle accounts, not terminal-fail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('CQD_403_SEEN opens the next-account bypass tab and keeps the pending alive', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    expect(flow.tabCreations).toHaveLength(1);

    flow.report403(100);

    expect(flow.tabCreations).toHaveLength(2);
    expect(flow.tabCreations[1].url).toContain('authuser=0');
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
    expect(flow.cleanupSpy).not.toHaveBeenCalled();
    expect(flow.stateModule.isRegistered('req-flow')).toBe(true);
  });

  it('terminals with AUTH_ALL_FAILED only after every signed-in account was tried', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();

    // Exactly one bypass tab is bound at a time: each 403 unbinds the old tab
    // and the retry binds the next one (ids 100, 101, ...).
    const totalTabs = 1 + flow.stateModule.AUTHUSER_CANDIDATES.length;
    let currentTab = 100;
    for (let i = 0; i < totalTabs; i++) {
      expect(flow.tabCreations).toHaveLength(i + 1);
      flow.report403(currentTab);
      currentTab += 1;
    }

    expect(flow.tabCreations).toHaveLength(totalTabs);
    expect(flow.tabCreations[totalTabs - 1].url).toContain('authuser=9');
    expect(errorStatusCall(flow.sendStatusSpy, 'AUTH_ALL_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(flow.stateModule.isRegistered('req-flow')).toBe(false);
  });

  it('CQD_BYPASS_SUCCESS mid-cycle reports success and stops the loop', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    flow.report403(100); // → attempt authuser=0 (tab 101)
    flow.reportBypassSuccess(101);

    expect(flow.sendStatusSpy).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-flow' }),
      'success',
    );
    const tabsAfterSuccess = flow.tabCreations.length;

    // A late 403 from an already-unbound tab must not resurrect the loop.
    flow.report403(101);
    expect(flow.tabCreations).toHaveLength(tabsAfterSuccess);
  });

  it('a forbidden interrupt on the bypass-tab download retries via the next-account tab', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    // The bypass tab's native download got a browser id (onCreated path).
    const pending = flow.stateModule.getPendingByRequestId('req-flow');
    flow.stateModule.bindDownloadId(pending!, 777);

    flow.dispatchDownloadChange({
      id: 777,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(0); // Firefox never native-downloads Drive
    expect(flow.tabCreations).toHaveLength(2);
    expect(flow.tabCreations[1].url).toContain('authuser=0');
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
  });
});

describe('S9 bypass flow — Chromium/Brave (#547): forbidden interrupts must cycle accounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('a SERVER_FORBIDDEN interrupt retries the download under the next account', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    expect(flow.downloadCalls).toHaveLength(1);
    expect(flow.downloadCalls[0].url).toBe(DRIVE_BASE);

    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(2);
    expect(flow.downloadCalls[1].url).toContain('authuser=0');
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
    expect(flow.cleanupSpy).not.toHaveBeenCalled();
    expect(flow.stateModule.isRegistered('req-flow')).toBe(true);
  });

  it('terminals with AUTH_ALL_FAILED after every account was tried via interrupts', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    const totalAttempts = 1 + flow.stateModule.AUTHUSER_CANDIDATES.length;
    for (let i = 0; i < totalAttempts; i++) {
      expect(flow.downloadCalls).toHaveLength(i + 1);
      flow.dispatchDownloadChange({
        id: 1000 + i,
        state: { current: 'interrupted' },
        error: { current: 'SERVER_FORBIDDEN' },
      });
    }

    expect(flow.downloadCalls).toHaveLength(totalAttempts);
    expect(flow.downloadCalls[totalAttempts - 1].url).toContain('authuser=9');
    expect(errorStatusCall(flow.sendStatusSpy, 'AUTH_ALL_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(flow.stateModule.isRegistered('req-flow')).toBe(false);
  });

  it('does not cycle accounts for non-auth interrupts (NETWORK_FAILED)', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'NETWORK_FAILED' },
    });

    expect(flow.downloadCalls).toHaveLength(1);
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeFalsy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('does not cycle for interrupts it caused itself (cancelledByUs)', async () => {
    const flow = await loadFlow({ isFirefox: false, cancelledByUs: new Set([1000]) });

    flow.requestDownload();
    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(1);
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeFalsy();
    expect(flow.cleanupSpy).not.toHaveBeenCalled();
  });

  it('does not cycle after success was already reported (finalized)', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    const pending = flow.stateModule.getPendingByRequestId('req-flow');
    pending!.finalized = true;

    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(1);
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeFalsy();
  });
});
