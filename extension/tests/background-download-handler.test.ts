import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

type LoadOptions = {
  isFirefox?: boolean;
  normalizeResult?: { baseUrl: string; isDrive: boolean };
  initialAuthUser?: number | undefined;
  authCandidates?: number[];
  validateDownloadUrlResult?:
    | { valid: boolean; url?: string; reason: string; host?: string | null }
    | ((url: string) => { valid: boolean; url?: string; reason: string; host?: string | null });
};

type TestContext = {
  mod: typeof import('../entrypoints/background/download-handler');
  stateModule: {
    pendingByRequestId: Map<string, PendingDownload>;
    pendingByDownloadId: Map<number, PendingDownload>;
    pendingByUrl: Map<string, Set<PendingDownload>>;
    pendingByBypassTabId: Map<number, PendingDownload>;
    AUTHUSER_CANDIDATES: number[];
    IS_FIREFOX: boolean;
    pendingByUrlAdd: (url: string, pending: PendingDownload) => void;
    pendingByUrlRemove: ReturnType<typeof vi.fn>;
    pendingByUrlGet: (url: string) => PendingDownload | undefined;
  };
  cleanupSpy: ReturnType<typeof vi.fn>;
  sendStatusSpy: ReturnType<typeof vi.fn>;
  recordSpy: ReturnType<typeof vi.fn>;
  normalizeUrlSpy: ReturnType<typeof vi.fn>;
  buildUrlSpy: ReturnType<typeof vi.fn>;
  extractAuthSpy: ReturnType<typeof vi.fn>;
  validateSpy: ReturnType<typeof vi.fn>;
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
    cancel: vi.fn((_id: number, cb?: () => void) => cb?.()),
    erase: vi.fn((_filter: object, cb?: () => void) => cb?.()),
  } as never;
  chrome.tabs = {
    create: vi.fn(),
    sendMessage: vi.fn(),
  } as never;
}

async function loadDownloadHandler(options: LoadOptions = {}): Promise<TestContext> {
  vi.resetModules();

  const pendingByUrl = new Map<string, Set<PendingDownload>>();
  const stateModule = {
    pendingByRequestId: new Map<string, PendingDownload>(),
    pendingByDownloadId: new Map<number, PendingDownload>(),
    pendingByUrl,
    pendingByBypassTabId: new Map<number, PendingDownload>(),
    AUTHUSER_CANDIDATES: options.authCandidates ?? [0, 1, 2],
    IS_FIREFOX: options.isFirefox ?? false,
    pendingByUrlAdd: (url: string, pending: PendingDownload) => {
      let bucket = pendingByUrl.get(url);
      if (!bucket) { bucket = new Set(); pendingByUrl.set(url, bucket); }
      bucket.add(pending);
    },
    pendingByUrlRemove: vi.fn(),
    pendingByUrlGet: (url: string) => {
      const bucket = pendingByUrl.get(url);
      if (!bucket || bucket.size === 0) return undefined;
      for (const p of bucket) { if (p.currentDownloadId == null) return p; }
      return bucket.values().next().value as PendingDownload | undefined;
    },
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
  const validateSpy = vi.fn((url: string) => {
    const result = options.validateDownloadUrlResult;
    if (typeof result === 'function') return result(url);
    return result ?? { valid: true, url, reason: 'OK', host: null };
  });

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
  vi.doMock('../src/v2/decision/download-validator', () => ({
    validateDownloadUrl: validateSpy,
  }));

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
    validateSpy,
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

  it('startSingleAttempt blocks invalid direct-download URLs before calling the browser API', async () => {
    const ctx = await loadDownloadHandler({
      validateDownloadUrlResult: { valid: false, reason: 'Unsupported Google Docs resource' },
    });
    const pending = makePending({ baseUrl: 'https://docs.google.com/forms/d/abc/viewform' });
    const respondOnce = vi.fn();

    ctx.mod.startSingleAttempt(pending, respondOnce);

    expect(chrome.downloads.download).not.toHaveBeenCalled();
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(pending);
    expect(respondOnce).toHaveBeenCalledWith({
      started: false,
      userMessage: 'Download blocked: invalid URL.',
    });
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

  it('startNextDriveAttempt skips invalid Drive auth URLs and advances to the next account', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      authCandidates: [0, 1],
      validateDownloadUrlResult: (url) =>
        url.includes('authuser=0')
          ? { valid: false, reason: 'Unsupported host', url, host: 'drive.google.com' }
          : { valid: true, reason: 'OK', url, host: 'drive.google.com' },
    });
    const pending = makePending({ isDrive: true });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(55);
    });

    ctx.mod.startNextDriveAttempt(pending);

    expect(ctx.validateSpy).toHaveBeenCalledTimes(2);
    expect(pending.attemptedAuthUsers).toEqual([0, 1]);
    expect(pending.currentAuthUser).toBe(1);
    expect(ctx.stateModule.pendingByDownloadId.get(55)).toBe(pending);
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

  it('handleDownloadRequest blocks invalid initial Drive URLs before starting the browser download', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.google.com/uc?id=bad', isDrive: true },
      validateDownloadUrlResult: { valid: false, reason: 'Unsupported Google Docs resource' },
    });
    const sendResponse = vi.fn();

    const result = ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=bad', requestId: 'req-invalid-drive' },
      { tab: { id: 41 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(result).toBe(true);
    expect(chrome.downloads.download).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      started: false,
      userMessage: 'Download blocked: invalid URL.',
    });
    expect(ctx.cleanupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-invalid-drive' }),
    );
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

    expect(chrome.downloads.cancel).toHaveBeenCalledWith(404, expect.any(Function));
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

  it('two concurrent non-drive requests for the same URL are tracked independently', async () => {
    const ctx = await loadDownloadHandler({
      normalizeResult: { baseUrl: 'https://example.com/file.pdf', isDrive: false },
    });
    let nextDownloadId = 100;
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(nextDownloadId++);
    });

    const resp1 = vi.fn();
    const resp2 = vi.fn();

    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/file.pdf', requestId: 'req-concurrent-1' },
      { tab: { id: 10 } } as chrome.runtime.MessageSender,
      resp1,
    );
    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/file.pdf', requestId: 'req-concurrent-2' },
      { tab: { id: 11 } } as chrome.runtime.MessageSender,
      resp2,
    );

    // Both tracked in requestId map
    expect(ctx.stateModule.pendingByRequestId.has('req-concurrent-1')).toBe(true);
    expect(ctx.stateModule.pendingByRequestId.has('req-concurrent-2')).toBe(true);

    // Both tracked in downloadId map with distinct IDs
    expect(ctx.stateModule.pendingByDownloadId.get(100)?.requestId).toBe('req-concurrent-1');
    expect(ctx.stateModule.pendingByDownloadId.get(101)?.requestId).toBe('req-concurrent-2');

    // URL bucket holds both
    const bucket = ctx.stateModule.pendingByUrl.get('https://example.com/file.pdf');
    expect(bucket?.size).toBe(2);

    // Responses are independent
    expect(resp1).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-concurrent-1', downloadId: 100 }));
    expect(resp2).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-concurrent-2', downloadId: 101 }));
  });

  it('cancelling one of two concurrent same-URL requests does not affect the other', async () => {
    const ctx = await loadDownloadHandler({
      normalizeResult: { baseUrl: 'https://example.com/shared.pdf', isDrive: false },
    });
    let nextId = 200;
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(nextId++);
    });

    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/shared.pdf', requestId: 'req-shared-a' },
      { tab: { id: 20 } } as chrome.runtime.MessageSender,
      vi.fn(),
    );
    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/shared.pdf', requestId: 'req-shared-b' },
      { tab: { id: 21 } } as chrome.runtime.MessageSender,
      vi.fn(),
    );

    const pendingA = ctx.stateModule.pendingByRequestId.get('req-shared-a')!;
    const pendingB = ctx.stateModule.pendingByRequestId.get('req-shared-b')!;
    expect(pendingA).toBeDefined();
    expect(pendingB).toBeDefined();

    // URL bucket has both before any cleanup
    expect(ctx.stateModule.pendingByUrl.get('https://example.com/shared.pdf')?.size).toBe(2);

    // Simulate cleanup for A (as would happen on cancel/complete)
    const bucket = ctx.stateModule.pendingByUrl.get('https://example.com/shared.pdf')!;
    bucket.delete(pendingA);

    // B is still tracked
    expect(ctx.stateModule.pendingByUrl.get('https://example.com/shared.pdf')?.has(pendingB)).toBe(true);
    expect(ctx.stateModule.pendingByUrl.get('https://example.com/shared.pdf')?.has(pendingA)).toBe(false);
  });
});
