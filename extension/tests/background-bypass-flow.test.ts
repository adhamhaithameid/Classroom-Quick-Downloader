import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

/**
 * S9 zero-tab Drive flow — the #manual-403 regression contract.
 *
 * The legacy flow opened bypass tabs (a visible "403 Access Forbidden"
 * window that Google error pages never let report back, so it hung until the
 * TTL). The contract is now: downloads target the usercontent byte-serving
 * endpoint, chrome.tabs.create is NEVER called — not on success, not on
 * failure, not while cycling accounts — and every failure settles the pending
 * through event-driven terminal states, never through timers.
 *
 * IS_FIREFOX toggles only the host differences that remain: Firefox has no
 * onDeterminingFilename (HTML responses are caught via the onCreated mime
 * guard instead) and correlates downloads through onCreated.
 */

const DRIVE_BASE = 'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t';
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
    setPendingExpiredHook: vi.fn(),
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
    // Faithful mock: real cleanup unregisters the pending and closes any bound
    // bypass tabs; keep the registry part so assertions observe production state.
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
  vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab: sendStatusSpy, setDownloadStatusListener: vi.fn() }));
  vi.doMock('../entrypoints/utils/analytics', () => ({
    refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
    recordDownloadEvent: recordSpy,
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({ t: (k: string) => k }));
  vi.doMock('../../src/v2/decision/download-validator', () => ({
    validateDownloadUrl: vi.fn(() => ({ valid: true })),
  }));

  // --- Browser host mocks (the BrowserPort seam). tabs.create is mocked so
  // the zero-tab contract can assert it is NEVER called. ---
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
  // Own cancel/erase stubs: the setup.ts globals were created before the
  // per-test restoreAllMocks, so their callback implementation can't be relied on.
  chrome.downloads.cancel = vi.fn((_id: number, cb?: () => void) => {
    cb?.();
  }) as never;
  chrome.downloads.erase = vi.fn((_filter: object, cb?: () => void) => {
    cb?.();
  }) as never;

  const onMessageListeners: Array<(msg: any, sender: any, resp?: any) => any> = [];
  const downloadChangedListeners: Array<(delta: any) => void> = [];
  const onCreatedListeners: Array<(item: any) => void> = [];
  const onDeterminingFilenameListeners: Array<(item: any, suggest: any) => void> = [];
  chrome.runtime.onMessage.addListener = vi.fn((l: any) => {
    onMessageListeners.push(l);
  }) as never;
  chrome.downloads.onChanged.addListener = vi.fn((l: any) => {
    downloadChangedListeners.push(l);
  }) as never;
  (chrome.downloads as any).onCreated = {
    addListener: vi.fn((l: any) => onCreatedListeners.push(l)),
  };
  (chrome.downloads as any).onDeterminingFilename = {
    addListener: vi.fn((l: any) => onDeterminingFilenameListeners.push(l)),
  };
  vi.spyOn(chrome.storage.local, 'get').mockImplementation((_k: any, cb: any) =>
    cb({ extensionEnabled: true }),
  );
  (chrome.runtime as any).lastError = undefined;

  const mod = await import('../entrypoints/background/index');
  (mod.default as unknown as () => void)();

  const dispatchMessage = (message: any, sender: any = { tab: { id: 5 } }) => {
    for (const listener of onMessageListeners) {
      listener(message, sender, vi.fn());
    }
  };

  const dispatchDownloadChange = (delta: any) => {
    for (const listener of downloadChangedListeners) listener(delta);
  };

  const dispatchDownloadCreated = (item: any) => {
    for (const listener of onCreatedListeners) listener(item);
  };

  const dispatchDeterminingFilename = (item: any, suggest?: any) => {
    for (const listener of onDeterminingFilenameListeners) listener(item, suggest ?? vi.fn());
  };

  const requestDownload = () =>
    dispatchMessage({
      type: 'CQD_DOWNLOAD',
      url: ORIGINAL_URL,
      requestId: 'req-flow',
      fileMeta: { name: 'lecture.pdf', ext: 'pdf' },
    });

  return {
    stateModule,
    cleanupSpy,
    sendStatusSpy,
    recordSpy,
    tabCreations,
    downloadCalls,
    requestDownload,
    dispatchDownloadChange,
    dispatchDownloadCreated,
    dispatchDeterminingFilename,
  };
}

const tryingStatusCall = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.find((c) => c[1] === 'trying' && c[3] === 'AUTH_LOOP');
const errorStatusCall = (spy: ReturnType<typeof vi.fn>, errorType: string) =>
  spy.mock.calls.find((c) => c[1] === 'error' && c[3] === errorType);
const expectZeroTabs = (flow: Awaited<ReturnType<typeof loadFlow>>) =>
  expect(flow.tabCreations).toHaveLength(0);

describe('S9 zero-tab Drive flow — Chromium (#manual-403 regression)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('downloads natively and never creates a tab', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();

    expect(flow.downloadCalls).toHaveLength(1);
    expect(flow.downloadCalls[0].url).toBe(DRIVE_BASE);
    expectZeroTabs(flow);
  });

  it('a SERVER_FORBIDDEN interrupt cycles accounts with no tabs', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(2);
    expect(flow.downloadCalls[1].url).toContain('authuser=0');
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
    expect(flow.cleanupSpy).not.toHaveBeenCalled();
    expectZeroTabs(flow);
  });

  it('identical forbidden reasons still sweep every account (a later account may hold access)', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    // Forbidden interrupt reasons are indistinguishable across accounts —
    // account 3 may have access even when 0–2 got 403s — so the sweep runs
    // to its 10-account bound before the honest terminal.
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
    expect(errorStatusCall(flow.sendStatusSpy, 'AUTH_ALL_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(flow.stateModule.isRegistered('req-flow')).toBe(false);
    expectZeroTabs(flow);
  });

  it('distinct forbidden failures still sweep all accounts before terminal', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    const totalAttempts = 1 + flow.stateModule.AUTHUSER_CANDIDATES.length;
    for (let i = 0; i < totalAttempts; i++) {
      expect(flow.downloadCalls).toHaveLength(i + 1);
      flow.dispatchDownloadChange({
        id: 1000 + i,
        state: { current: 'interrupted' },
        error: { current: i % 2 === 0 ? 'SERVER_FORBIDDEN' : 'ACCESS_DENIED' },
      });
    }

    expect(flow.downloadCalls).toHaveLength(totalAttempts);
    expect(flow.downloadCalls[totalAttempts - 1].url).toContain('authuser=9');
    expect(errorStatusCall(flow.sendStatusSpy, 'AUTH_ALL_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(flow.stateModule.isRegistered('req-flow')).toBe(false);
    expectZeroTabs(flow);
  });

  it('HTML-intercepted downloads cancel and retry the next account without any tab', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    flow.dispatchDeterminingFilename({
      id: 1000,
      url: DRIVE_BASE,
      finalUrl: DRIVE_BASE,
      filename: 'sign-in.html',
      mime: 'text/html',
    });

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(1000, expect.any(Function));
    expect(flow.downloadCalls).toHaveLength(2); // next-account retry, no tab
    expectZeroTabs(flow);
  });

  it('does not cycle accounts for non-auth interrupts (NETWORK_FAILED)', async () => {
    const flow = await loadFlow({ isFirefox: false });

    flow.requestDownload();
    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'NETWORK_FAILED' },
    });

    // Transient: one in-place retry (2s backoff), then terminal — no account
    // cycling.
    expect(flow.downloadCalls).toHaveLength(1);
    vi.advanceTimersByTime(2_000); // retry fires
    expect(flow.downloadCalls).toHaveLength(2);
    flow.dispatchDownloadChange({
      id: 1001,
      state: { current: 'interrupted' },
      error: { current: 'NETWORK_FAILED' },
    });
    expect(errorStatusCall(flow.sendStatusSpy, 'NETWORK_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expectZeroTabs(flow);
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
    expectZeroTabs(flow);
  });

  it('does not cycle after success was already reported (finalized) and settles immediately', async () => {
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
    // Event-driven settle: the pending must not linger until the TTL sweep.
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(flow.stateModule.isRegistered('req-flow')).toBe(false);
    expectZeroTabs(flow);
  });
});

describe('S9 zero-tab Drive flow — Firefox/zen (#537): native downloads, no bypass tabs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('downloads natively and never creates a tab (bypass-tab-only flow removed)', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();

    expect(flow.downloadCalls).toHaveLength(1);
    expect(flow.downloadCalls[0].url).toBe(DRIVE_BASE);
    expectZeroTabs(flow);
  });

  it('a forbidden interrupt retries via re-download with no tabs', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    flow.dispatchDownloadChange({
      id: 1000,
      state: { current: 'interrupted' },
      error: { current: 'SERVER_FORBIDDEN' },
    });

    expect(flow.downloadCalls).toHaveLength(2);
    expect(flow.downloadCalls[1].url).toContain('authuser=0');
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
    expectZeroTabs(flow);
  });

  it('identical forbidden reasons sweep every account before terminal', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    const totalAttempts = 1 + flow.stateModule.AUTHUSER_CANDIDATES.length;
    for (let i = 0; i < totalAttempts; i++) {
      flow.dispatchDownloadChange({
        id: 1000 + i,
        state: { current: 'interrupted' },
        error: { current: 'SERVER_FORBIDDEN' },
      });
    }

    expect(flow.downloadCalls).toHaveLength(totalAttempts);
    expect(errorStatusCall(flow.sendStatusSpy, 'AUTH_ALL_FAILED')).toBeTruthy();
    expect(flow.cleanupSpy).toHaveBeenCalledTimes(1);
    expectZeroTabs(flow);
  });

  it('onCreated with an HTML mime cancels and retries the next account (no onDeterminingFilename on Firefox)', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    flow.dispatchDownloadCreated({
      id: 1000,
      url: DRIVE_BASE,
      filename: 'error.html',
      mime: 'text/html',
    });

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(1000, expect.any(Function));
    expect(flow.downloadCalls).toHaveLength(2);
    expect(tryingStatusCall(flow.sendStatusSpy)).toBeTruthy();
    expectZeroTabs(flow);
  });

  it('onCreated with a real file mime correlates; success waits for onChanged complete (Firefox honesty)', async () => {
    const flow = await loadFlow({ isFirefox: true });

    flow.requestDownload();
    // Firefox onCreated: CORRELATION only — starting is not finishing.
    flow.dispatchDownloadCreated({
      id: 1000,
      url: DRIVE_BASE,
      filename: 'lecture.pdf',
      mime: 'application/pdf',
    });

    expect(flow.sendStatusSpy).not.toHaveBeenCalled();
    expect(flow.stateModule.getPendingByDownloadId(1000)?.requestId).toBe('req-flow');

    // The browser finishing the download is what reports success.
    flow.dispatchDownloadChange({ id: 1000, state: { current: 'complete' } });
    expect(flow.sendStatusSpy).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-flow' }),
      'success',
    );
    expectZeroTabs(flow);
  });
});
