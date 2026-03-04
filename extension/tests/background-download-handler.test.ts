import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

type LoadOptions = {
  isFirefox?: boolean;
  supportsDownloadsApi?: boolean;
  normalizeResult?: { baseUrl: string; isDrive: boolean };
  initialAuthUser?: number | undefined;
  authCandidates?: number[];
};

type TestContext = {
  mod: typeof import('../entrypoints/background/download-handler');
  stateModule: {
    pendingByRequestId: Map<string, PendingDownload>;
    pendingByDownloadId: Map<number, PendingDownload>;
    pendingByUrl: Map<string, PendingDownload>;
    pendingByBypassTabId: Map<number, PendingDownload>;
    AUTHUSER_CANDIDATES: number[];
    IS_FIREFOX: boolean;
    SUPPORTS_DOWNLOADS_API: boolean;
  };
  cleanupSpy: ReturnType<typeof vi.fn>;
  sendStatusSpy: ReturnType<typeof vi.fn>;
  recordSpy: ReturnType<typeof vi.fn>;
  normalizeUrlSpy: ReturnType<typeof vi.fn>;
  buildUrlSpy: ReturnType<typeof vi.fn>;
  extractAuthSpy: ReturnType<typeof vi.fn>;
};

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-1',
    startTime: Date.now() - 250,
    originalUrl: 'https://example.com/file.pdf',
    baseUrl: 'https://example.com/file.pdf',
    isDrive: false,
    fileMeta: { ext: 'pdf', name: 'file.pdf' },
    tabId: 17,
    attemptedAuthUsers: [],
    fallbackStarted: false,
    isCancelled: false,
    ...overrides,
  };
}

function installChromeMocks() {
  (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
  chrome.downloads = {
    download: vi.fn(),
    cancel: vi.fn(),
  } as never;
  chrome.tabs = {
    create: vi.fn(),
    sendMessage: vi.fn(),
  } as never;
}

async function loadDownloadHandler(options: LoadOptions = {}): Promise<TestContext> {
  vi.resetModules();

  const stateModule = {
    pendingByRequestId: new Map<string, PendingDownload>(),
    pendingByDownloadId: new Map<number, PendingDownload>(),
    pendingByUrl: new Map<string, PendingDownload>(),
    pendingByBypassTabId: new Map<number, PendingDownload>(),
    AUTHUSER_CANDIDATES: options.authCandidates ?? [0, 1, 2],
    IS_FIREFOX: options.isFirefox ?? false,
    SUPPORTS_DOWNLOADS_API: options.supportsDownloadsApi ?? true,
  };

  const cleanupSpy = vi.fn();
  const sendStatusSpy = vi.fn();
  const recordSpy = vi.fn();
  const normalizeUrlSpy = vi.fn(() => options.normalizeResult ?? {
    baseUrl: 'https://drive.google.com/uc?id=abc',
    isDrive: true,
  });
  const buildUrlSpy = vi.fn((baseUrl: string, authuser: number) => `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}authuser=${authuser}`);
  const extractAuthSpy = vi.fn(() => options.initialAuthUser);

  vi.doMock('../entrypoints/background/state', () => stateModule);
  vi.doMock('../entrypoints/background/auth-utils', () => ({
    extractAuthUserFromUrl: extractAuthSpy,
  }));
  vi.doMock('../entrypoints/background/url-helpers', () => ({
    normalizeUrl: normalizeUrlSpy,
    buildUrlWithAuthUser: buildUrlSpy,
    getFilenameExt: vi.fn((filename?: string) => filename?.split('.').pop()?.toLowerCase()),
  }));
  vi.doMock('../entrypoints/background/cleanup', () => ({ cleanup: cleanupSpy }));
  vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab: sendStatusSpy }));
  vi.doMock('../entrypoints/utils/analytics', () => ({ recordDownloadEvent: recordSpy }));

  const mod = await import('../entrypoints/background/download-handler');
  return {
    mod,
    stateModule,
    cleanupSpy,
    sendStatusSpy,
    recordSpy,
    normalizeUrlSpy,
    buildUrlSpy,
    extractAuthSpy,
  };
}

describe('background download handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installChromeMocks();
  });

  it('startSingleAttempt records failure and cleans up when browser blocks start', async () => {
    const ctx = await loadDownloadHandler();
    const pending = makePending();
    (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => cb(undefined));
    const respondOnce = vi.fn();

    ctx.mod.startSingleAttempt(pending, respondOnce);

    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      error_type: 'BROWSER_START_FAIL_DIRECT',
    }));
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(pending);
    expect(respondOnce).toHaveBeenCalledWith({ started: false, userMessage: 'Browser blocked download.' });
  });

  it('startSingleAttempt falls back to unknown file type when metadata is missing', async () => {
    const ctx = await loadDownloadHandler();
    const pending = makePending({ fileMeta: undefined as any });
    (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => cb(undefined));

    ctx.mod.startSingleAttempt(pending);

    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'unknown',
      error_type: 'BROWSER_START_FAIL_DIRECT',
    }));
  });

  it('startSingleAttempt stores pending download on success', async () => {
    const ctx = await loadDownloadHandler();
    const pending = makePending();
    (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => cb(42));
    const respondOnce = vi.fn();

    ctx.mod.startSingleAttempt(pending, respondOnce);

    expect(pending.currentDownloadId).toBe(42);
    expect(ctx.stateModule.pendingByDownloadId.get(42)).toBe(pending);
    expect(respondOnce).toHaveBeenCalledWith({ started: true, requestId: pending.requestId, downloadId: 42 });
  });

  it('startSingleAttempt falls back to tab-open flow when downloads API is unavailable', async () => {
    const ctx = await loadDownloadHandler({ supportsDownloadsApi: false });
    const pending = makePending();
    const respondOnce = vi.fn();
    (chrome.tabs.create as any).mockImplementation((_details: unknown, cb: () => void) => cb());

    ctx.mod.startSingleAttempt(pending, respondOnce);

    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: pending.baseUrl, active: true }),
      expect.any(Function),
    );
    expect(respondOnce).toHaveBeenCalledWith(expect.objectContaining({
      started: true,
      requestId: pending.requestId,
    }));
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(pending);
    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      error_type: 'DOWNLOADS_API_UNAVAILABLE',
    }));
  });

  it('openDriveBypassTab tracks bypass tab IDs when a tab is returned', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: true });
    const pending = makePending({ isDrive: true });
    (chrome.tabs.create as any).mockImplementation((_: unknown, cb: (tab: { id?: number }) => void) => cb({ id: 77 }));
    ctx.mod.openDriveBypassTab(pending, 'https://drive.google.com/uc?id=abc');
    expect(ctx.stateModule.pendingByBypassTabId.get(77)).toBe(pending);
  });

  it('openDriveBypassTab ignores tabs without numeric IDs', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: true });
    const pending = makePending({ isDrive: true });
    (chrome.tabs.create as any).mockImplementation((_: unknown, cb: (tab: { id?: number }) => void) => cb({}));
    ctx.mod.openDriveBypassTab(pending, 'https://drive.google.com/uc?id=abc');
    expect(ctx.stateModule.pendingByBypassTabId.size).toBe(0);
  });

  it('startNextDriveAttempt fails when all auth users are exhausted', async () => {
    const ctx = await loadDownloadHandler({ authCandidates: [0, 1] });
    const pending = makePending({
      isDrive: true,
      attemptedAuthUsers: [0, 1],
    });
    ctx.mod.startNextDriveAttempt(pending);
    expect(ctx.sendStatusSpy).toHaveBeenCalledWith(
      pending,
      'error',
      'Access denied for all accounts.',
      'AUTH_ALL_FAILED',
    );
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(pending);
    expect(ctx.recordSpy).toHaveBeenCalled();
  });

  it('startNextDriveAttempt uses unknown type for exhausted auth when metadata is missing', async () => {
    const ctx = await loadDownloadHandler({ authCandidates: [0] });
    const pending = makePending({
      isDrive: true,
      attemptedAuthUsers: [0],
      fileMeta: undefined as any,
    });
    ctx.mod.startNextDriveAttempt(pending);
    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'unknown',
      error_type: 'AUTH_ALL_FAILED',
    }));
  });

  it('startNextDriveAttempt uses bypass tab path in Firefox mode', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: true, authCandidates: [3] });
    const pending = makePending({ isDrive: true, attemptedAuthUsers: [] });
    (chrome.tabs.create as any).mockImplementation((_: unknown, cb: (tab: { id?: number }) => void) => cb({ id: 5 }));
    ctx.mod.startNextDriveAttempt(pending);
    expect(pending.currentAuthUser).toBe(3);
    expect(ctx.stateModule.pendingByBypassTabId.get(5)).toBe(pending);
  });

  it('startNextDriveAttempt retries auth user after browser start failure in Chromium mode', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: false, authCandidates: [0, 1] });
    const pending = makePending({ isDrive: true });
    let calls = 0;
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      calls += 1;
      if (calls === 1) {
        (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'forbidden' };
        cb(undefined);
      } else {
        (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
        cb(99);
      }
    });

    ctx.mod.startNextDriveAttempt(pending);

    expect(calls).toBe(2);
    expect(pending.attemptedAuthUsers).toEqual([0, 1]);
    expect(ctx.stateModule.pendingByDownloadId.get(99)).toBe(pending);
  });

  it('handleDownloadRequest rejects empty URL payloads', async () => {
    const ctx = await loadDownloadHandler();
    const sendResponse = vi.fn();
    const result = ctx.mod.handleDownloadRequest({}, { tab: { id: 1 } } as chrome.runtime.MessageSender, sendResponse);
    expect(result).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ started: false, userMessage: 'No valid link found.' });
  });

  it('handleDownloadRequest starts non-drive downloads through direct attempt', async () => {
    const ctx = await loadDownloadHandler({
      normalizeResult: { baseUrl: 'https://example.com/a.pdf', isDrive: false },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => cb(123));
    const sendResponse = vi.fn();

    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/a.pdf', requestId: 'req-direct' },
      { tab: { id: 11 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(ctx.normalizeUrlSpy).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ started: true, requestId: 'req-direct', downloadId: 123 });
    expect(ctx.stateModule.pendingByDownloadId.has(123)).toBe(true);
  });

  it('handleDownloadRequest uses firefox Drive bypass flow and responds once', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: true,
      initialAuthUser: 4,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.tabs.create as any).mockImplementation((_: unknown, cb: (tab: { id?: number }) => void) => cb({ id: 300 }));
    const sendResponse = vi.fn();

    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc&authuser=4', requestId: 'req-firefox' },
      { tab: { id: 12 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(ctx.extractAuthSpy).toHaveBeenCalled();
    const pending = ctx.stateModule.pendingByRequestId.get('req-firefox');
    expect(pending?.attemptedAuthUsers).toContain(4);
    expect(sendResponse).toHaveBeenCalledWith({ started: true, requestId: 'req-firefox', userMessage: 'Opening Drive tab…' });
  });

  it('handleDownloadRequest firefox flow uses base URL when no initial auth is found', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: true,
      initialAuthUser: undefined,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=xyz', isDrive: true },
    });
    const createSpy = chrome.tabs.create as any;
    createSpy.mockImplementation((opts: { url: string }, cb: (tab: { id?: number }) => void) => cb({ id: 987 }));
    const sendResponse = vi.fn();

    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=xyz', requestId: 'req-firefox-no-auth' },
      { tab: { id: 31 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://drive.google.com/uc?id=xyz' }),
      expect.any(Function),
    );
    expect(sendResponse).toHaveBeenCalledWith({
      started: true,
      requestId: 'req-firefox-no-auth',
      userMessage: 'Opening Drive tab…',
    });
  });

  it('handleDownloadRequest succeeds on Chromium Drive native download', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      initialAuthUser: 1,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(321);
    });
    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-drive-success' },
      { tab: { id: 20 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(ctx.buildUrlSpy).toHaveBeenCalled();
    expect(ctx.stateModule.pendingByDownloadId.get(321)?.requestId).toBe('req-drive-success');
    expect(sendResponse).toHaveBeenCalledWith({ started: true, requestId: 'req-drive-success', downloadId: 321 });
  });

  it('handleDownloadRequest falls back to bypass tab when native Drive start fails', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
      cb(undefined);
    });
    (chrome.tabs.create as any).mockImplementation((_: unknown, cb: (tab: { id?: number }) => void) => cb({ id: 301 }));

    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-fallback' },
      { tab: { id: 13 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      error_type: 'BROWSER_START_FAIL',
    }));
    expect(sendResponse).toHaveBeenCalledWith({
      started: true,
      requestId: 'req-fallback',
      userMessage: 'Browser blocked. Trying Drive tab…',
    });
    expect(ctx.stateModule.pendingByBypassTabId.get(301)?.requestId).toBe('req-fallback');
  });

  it('handleDownloadRequest processes repeated callback without duplicate responses', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
      cb(undefined);
      cb(undefined);
    });
    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-repeat' },
      { tab: { id: 21 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({
      started: true,
      requestId: 'req-repeat',
      userMessage: 'Browser blocked. Trying Drive tab…',
    });
  });

  it('handleDownloadRequest handles cancellation race after download ID assignment', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      const pending = ctx.stateModule.pendingByRequestId.get('req-race');
      if (pending) pending.isCancelled = true;
      cb(404);
    });

    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-race' },
      { tab: { id: 14 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(404);
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-race' }), 404);
  });

  it('handleDownloadRequest exits early when request is pre-cancelled before flow branch', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: true,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    const setOriginal = ctx.stateModule.pendingByRequestId.set.bind(ctx.stateModule.pendingByRequestId);
    ctx.stateModule.pendingByRequestId.set = ((key: string, value: PendingDownload) => {
      value.isCancelled = true;
      return setOriginal(key, value);
    }) as typeof ctx.stateModule.pendingByRequestId.set;

    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-pre-cancel' },
      { tab: { id: 15 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(ctx.cleanupSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-pre-cancel' }));
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('handleDownloadRequest exits early when pre-cancelled in Chromium Drive flow', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    const setOriginal = ctx.stateModule.pendingByRequestId.set.bind(ctx.stateModule.pendingByRequestId);
    ctx.stateModule.pendingByRequestId.set = ((key: string, value: PendingDownload) => {
      value.isCancelled = true;
      return setOriginal(key, value);
    }) as typeof ctx.stateModule.pendingByRequestId.set;
    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-pre-cancel-drive' },
      { tab: { id: 22 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-pre-cancel-drive' }));
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('handleDownloadRequest exits early when pre-cancelled in non-drive flow', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://example.com/report.pdf', isDrive: false },
    });
    const setOriginal = ctx.stateModule.pendingByRequestId.set.bind(ctx.stateModule.pendingByRequestId);
    ctx.stateModule.pendingByRequestId.set = ((key: string, value: PendingDownload) => {
      value.isCancelled = true;
      return setOriginal(key, value);
    }) as typeof ctx.stateModule.pendingByRequestId.set;
    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/report.pdf', requestId: 'req-pre-cancel-direct' },
      { tab: { id: 23 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-pre-cancel-direct' }));
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('handleDownloadRequest handles cancellation race even when browser does not return an ID', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=abc', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      const pending = ctx.stateModule.pendingByRequestId.get('req-race-no-id');
      if (pending) pending.isCancelled = true;
      cb(undefined);
    });

    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-race-no-id' },
      { tab: { id: 15 } } as chrome.runtime.MessageSender,
      vi.fn(),
    );

    expect(chrome.downloads.cancel).not.toHaveBeenCalled();
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-race-no-id' }), undefined);
  });
});
