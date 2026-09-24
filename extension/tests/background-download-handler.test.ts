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
    registerPending: (pending: PendingDownload) => void;
    bindDownloadId: (pending: PendingDownload, downloadId: number) => boolean;
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

  const pendingByRequestId = new Map<string, PendingDownload>();
  const pendingByDownloadId = new Map<number, PendingDownload>();
  const pendingByUrl = new Map<string, Set<PendingDownload>>();
  const pendingByBypassTabId = new Map<number, PendingDownload>();
  const indexUrl = (url: string, p: PendingDownload) => {
    let bucket = pendingByUrl.get(url);
    if (!bucket) { bucket = new Set(); pendingByUrl.set(url, bucket); }
    bucket.add(p);
  };
  const stateModule = {
    setPendingExpiredHook: vi.fn(),
    pendingByRequestId,
    pendingByDownloadId,
    pendingByUrl,
    pendingByBypassTabId,
    AUTHUSER_CANDIDATES: options.authCandidates ?? [0, 1, 2],
    IS_FIREFOX: options.isFirefox ?? false,
    // D11 registry semantics (mirrors the real state module): binds require
    // the pending to still be authoritative, ids cannot be cross-claimed.
    registerPending: (p: PendingDownload) => {
      pendingByRequestId.set(p.requestId, p);
      indexUrl(p.baseUrl, p);
    },
    bindDownloadId: (p: PendingDownload, downloadId: number) => {
      if (pendingByRequestId.get(p.requestId) !== p) return false;
      const existing = pendingByDownloadId.get(downloadId);
      if (existing !== undefined && existing !== p) return false;
      p.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, p);
      return true;
    },
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
  vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab: sendStatusSpy, setDownloadStatusListener: vi.fn() }));
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
    ctx.stateModule.registerPending(pending); // D11: binds require authority
    (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => cb(42));
    const respondOnce = vi.fn();

    ctx.mod.startSingleAttempt(pending, respondOnce);

    expect(pending.currentDownloadId).toBe(42);
    expect(ctx.stateModule.pendingByDownloadId.get(42)).toBe(pending);
    expect(respondOnce).toHaveBeenCalledWith({ started: true, requestId: pending.requestId, downloadId: 42 });
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
      'Access denied for all your accounts. Open the file directly in Drive to confirm access.',
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

  it('startNextDriveAttempt downloads natively in Firefox mode (zero-tab contract)', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: true, authCandidates: [3] });
    const pending = makePending({ isDrive: true, attemptedAuthUsers: [] });
    ctx.stateModule.registerPending(pending); // D11: binds require authority
    ctx.mod.startNextDriveAttempt(pending);
    expect(pending.currentAuthUser).toBe(3);
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('authuser=3') }),
      expect.any(Function),
    );
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('startNextDriveAttempt retries auth user after browser start failure in Chromium mode', async () => {
    const ctx = await loadDownloadHandler({ isFirefox: false, authCandidates: [0, 1] });
    const pending = makePending({ isDrive: true });
    ctx.stateModule.registerPending(pending); // D11: binds require authority
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
    ctx.stateModule.registerPending(pending); // D11: binds require authority
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

  it('handleDownloadRequest downloads natively on Firefox and responds once (zero-tab contract)', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: true,
      initialAuthUser: 4,
      normalizeResult: { baseUrl: 'https://drive.usercontent.google.com/download?id=abc&export=download&confirm=t', isDrive: true },
    });
    const sendResponse = vi.fn();

    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(300);
    });
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc&authuser=4', requestId: 'req-firefox' },
      { tab: { id: 12 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(ctx.extractAuthSpy).toHaveBeenCalled();
    const pending = ctx.stateModule.pendingByRequestId.get('req-firefox');
    expect(pending?.attemptedAuthUsers).toContain(4);
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('authuser=4') }),
      expect.any(Function),
    );
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ started: true, requestId: 'req-firefox', downloadId: expect.any(Number) });
  });

  it('handleDownloadRequest firefox flow uses base URL when no initial auth is found', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: true,
      initialAuthUser: undefined,
      normalizeResult: { baseUrl: 'https://drive.usercontent.google.com/download?id=xyz&export=download&confirm=t', isDrive: true },
    });
    const sendResponse = vi.fn();

    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(987);
    });
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=xyz', requestId: 'req-firefox-no-auth' },
      { tab: { id: 31 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://drive.usercontent.google.com/download?id=xyz&export=download&confirm=t' }),
      expect.any(Function),
    );
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      started: true,
      requestId: 'req-firefox-no-auth',
      downloadId: expect.any(Number),
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

  it('handleDownloadRequest retries a refused start once, then fails with guidance (zero-tab contract)', async () => {
    vi.useFakeTimers();
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://drive.usercontent.google.com/download?id=abc&export=download&confirm=t', isDrive: true },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
      cb(undefined);
    });

    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://drive.google.com/open?id=abc', requestId: 'req-fallback' },
      { tab: { id: 13 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    // One automatic retry after the 1s backoff, then the honest terminal.
    expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_100);
    expect(chrome.downloads.download).toHaveBeenCalledTimes(2);
    expect(ctx.recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      error_type: 'BROWSER_START_FAIL',
    }));
    expect(sendResponse).toHaveBeenCalledWith({
      started: false,
      userMessage: expect.stringContaining('Browser blocked the download'),
    });
    expect(ctx.cleanupSpy).toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
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
    // The duplicate callback is swallowed by respondOnce deduplication.
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('handleDownloadRequest responds exactly once when the browser double-fires a success callback', async () => {
    const ctx = await loadDownloadHandler({
      isFirefox: false,
      normalizeResult: { baseUrl: 'https://example.com/file.pdf', isDrive: false },
    });
    (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      cb(77);
      cb(77);
    });
    const sendResponse = vi.fn();
    ctx.mod.handleDownloadRequest(
      { url: 'https://example.com/file.pdf', requestId: 'req-double-success' },
      { tab: { id: 25 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({
      started: true,
      requestId: 'req-double-success',
      downloadId: 77,
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

// ============================================================================
// START-CALLBACK TIMEOUT (S2) — audit docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md
// finding S2 / functional F1. A host that accepts the connection but never
// responds makes chrome.downloads.download's callback never fire, so the
// CQD_DOWNLOAD sendResponse dangled until the 150s stall deadline. The flow
// must settle honestly within DOWNLOAD_START_TIMEOUT_MS, and a late callback
// (download eventually created) must cancel the stray download, never
// resurrect the settled flow.
// ============================================================================

describe('background download handler — start-callback timeout (S2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installChromeMocks();
  });

  it('exposes DOWNLOAD_START_TIMEOUT_MS', async () => {
    const ctx = await loadDownloadHandler();
    expect(ctx.mod.DOWNLOAD_START_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('startSingleAttempt settles with an error when the start callback never fires', async () => {
    vi.useFakeTimers();
    try {
      const ctx = await loadDownloadHandler();
      const pending = makePending();
      ctx.stateModule.registerPending(pending);
      (chrome.downloads.download as any).mockImplementation(() => {
        /* never calls back */
      });
      const respondOnce = vi.fn();

      ctx.mod.startSingleAttempt(pending, respondOnce);
      expect(respondOnce).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ctx.mod.DOWNLOAD_START_TIMEOUT_MS + 1);

      expect(respondOnce).toHaveBeenCalledWith(
        expect.objectContaining({ started: false, userMessage: expect.any(String) }),
      );
      expect(ctx.recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail', error_type: 'DOWNLOAD_START_TIMEOUT' }),
      );
      expect(ctx.cleanupSpy).toHaveBeenCalledWith(pending);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handleDownloadRequest (Drive path) settles and reports when the start callback never fires', async () => {
    vi.useFakeTimers();
    try {
      const ctx = await loadDownloadHandler();
      (chrome.downloads.download as any).mockImplementation(() => {
        /* never calls back */
      });
      const respond = vi.fn();

      ctx.mod.handleDownloadRequest(
        { url: 'https://drive.google.com/uc?id=hang', requestId: 'req-hang', fileMeta: { name: 'h.pdf', ext: 'pdf' } },
        { tab: { id: 7 } } as chrome.runtime.MessageSender,
        respond,
      );
      expect(respond).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(ctx.mod.DOWNLOAD_START_TIMEOUT_MS + 1);

      expect(respond).toHaveBeenCalledWith(expect.objectContaining({ started: false }));
      expect(ctx.sendStatusSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'req-hang' }),
        'error',
        expect.any(String),
        'DOWNLOAD_START_TIMEOUT',
      );
      expect(ctx.recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail', error_type: 'DOWNLOAD_START_TIMEOUT' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('a late callback after the timeout cancels the stray download and stays settled', async () => {
    vi.useFakeTimers();
    try {
      const ctx = await loadDownloadHandler();
      const pending = makePending();
      ctx.stateModule.registerPending(pending);
      let lateCb: ((id?: number) => void) | undefined;
      (chrome.downloads.download as any).mockImplementation((_: unknown, cb: (id?: number) => void) => {
        lateCb = cb;
      });
      const respondOnce = vi.fn();

      ctx.mod.startSingleAttempt(pending, respondOnce);
      await vi.advanceTimersByTimeAsync(ctx.mod.DOWNLOAD_START_TIMEOUT_MS + 1);
      expect(respondOnce).toHaveBeenCalledTimes(1);

      // The download eventually starts after we already timed out.
      lateCb?.(99);

      expect(chrome.downloads.cancel).toHaveBeenCalledWith(99, expect.any(Function));
      expect(ctx.stateModule.pendingByDownloadId.get(99)).toBeUndefined();
      expect(respondOnce).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
