// filepath: extension/tests/helpers/background-flow.ts
/**
 * Production flow harness for the download-outcome corpus (no-dead-ends
 * program). Drives the REAL background listeners (index.ts) and the REAL
 * download-handler state machine with only the browser host mocked —
 * and, unlike the success-by-default suites, SCRIPTED failures:
 *
 *   downloadScript: a queue of host behaviors consumed per
 *   chrome.downloads.download call, last item repeating:
 *     'id'        → callback succeeds with a fresh id
 *     'lastError' → chrome.runtime.lastError + cb(undefined)
 *     'never'     → no callback at all (stall)
 *
 * The corpus asserts the terminal status call the machine reports to the
 * tab: (status, errorCode) — the user-visible contract.
 */
import { vi } from 'vitest';
import type { PendingDownload } from '../../entrypoints/background/types';

export const DRIVE_BASE =
  'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t';
export const ORIGINAL_URL = 'https://drive.google.com/file/d/FILE123/view';
export const EXTERNAL_URL = 'https://portal.example.edu/file/d/XYZ123/view';

export type DownloadScriptStep = 'id' | 'lastError' | 'never';

export interface FlowHarnessOptions {
  isFirefox?: boolean;
  authCandidates?: number[];
  cancelledByUs?: Set<number>;
  downloadScript?: DownloadScriptStep[];
}

export interface StatusCall {
  requestId: string;
  status: string;
  userMessage?: string;
  errorCode?: string;
}

export function makeFlowState(options: FlowHarnessOptions = {}) {
  let expiredHook: ((p: PendingDownload) => void) | null = null;
  const pendingByRequestId = new Map<string, PendingDownload>();
  const pendingByDownloadId = new Map<number, PendingDownload>();
  const pendingByUrl = new Map<string, Set<PendingDownload>>();
  const indexUrl = (url: string, p: PendingDownload) => {
    let bucket = pendingByUrl.get(url);
    if (!bucket) {
      bucket = new Set();
      pendingByUrl.set(url, bucket);
    }
    bucket.add(p);
  };
  return {
    // Test-side trigger for the stall-deadline hook (the real registry
    // schedules it via setTimeout; the mock records and exposes it here).
    firePendingExpired: (requestId: string) => {
      const pending = pendingByRequestId.get(requestId);
      if (pending) expiredHook?.(pending);
    },
    pendingByRequestId,
    pendingByDownloadId,
    pendingByUrl,
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
      for (const [url, bucket] of pendingByUrl.entries()) {
        if (bucket.delete(p) && bucket.size === 0) pendingByUrl.delete(url);
      }
    },
    isRegistered: (requestId: string) => pendingByRequestId.has(requestId),
    setPendingExpiredHook: (hook: ((p: PendingDownload) => void) | null) => {
      expiredHook = hook;
    },
    getPendingByRequestId: (id: string) => pendingByRequestId.get(id),
    getPendingByDownloadId: (id: number) => pendingByDownloadId.get(id),
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

export type FlowHarness = Awaited<ReturnType<typeof loadFlowHarness>>;

export async function loadFlowHarness(options: FlowHarnessOptions = {}) {
  vi.resetModules();

  const stateModule = makeFlowState(options);

  const cleanupSpy = vi.fn((pending: PendingDownload) => {
    // Faithful: real cleanup unregisters the pending.
    stateModule.unregisterPending(pending);
  });
  const sendStatusSpy = vi.fn(
    (pending: PendingDownload, status: string, userMessage?: string, errorCode?: string) => {
      statusCalls.push({
        requestId: pending.requestId,
        status,
        userMessage,
        errorCode,
      });
    },
  );
  const recordSpy = vi.fn();

  vi.doMock('../../entrypoints/background/state', () => stateModule);
  vi.doMock('../../entrypoints/background/icon-manager', () => ({
    createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
    isClassroomUrl: () => true,
    setActionIcon: vi.fn(),
    GRAY_ICON_PATHS: {},
  }));
  vi.doMock('../../entrypoints/background/auth-utils', () => ({
    extractDriveFileId: vi.fn(() => null),
    extractAuthUserFromUrl: vi.fn(() => undefined),
  }));
  vi.doMock('../../entrypoints/background/url-helpers', () => ({
    getFilenameExt: (f: string) => f?.split('.').pop()?.toLowerCase() ?? '',
    normalizeUrl: vi.fn((url: string) => {
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        host = '';
      }
      if (host === 'drive.usercontent.google.com' || host === 'drive.google.com') {
        return { baseUrl: DRIVE_BASE, isDrive: true };
      }
      return { baseUrl: url, isDrive: false };
    }),
    buildUrlWithAuthUser: vi.fn(
      (baseUrl: string, authuser: number) =>
        `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}authuser=${authuser}`,
    ),
  }));
  vi.doMock('../../entrypoints/background/cleanup', () => ({
    cleanup: cleanupSpy,
    cleanupOrphanedPendingDownloads: vi.fn(),
  }));
  vi.doMock('../../entrypoints/background/analytics-alarm', () => ({
    ensureAnalyticsAlarm: vi.fn(),
    checkAndCloseFileTab: vi.fn(),
  }));
  vi.doMock('../../entrypoints/background/message-sender', () => ({
    sendStatusToTab: (...args: Parameters<typeof sendStatusSpy>) => sendStatusSpy(...args),
    setDownloadStatusListener: vi.fn(),
  }));
  vi.doMock('../../entrypoints/utils/analytics', () => ({
    Analytics: { flush: vi.fn(async () => {}) },
    refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
    recordDownloadEvent: recordSpy,
  }));
  vi.doMock('../../entrypoints/content/i18n', () => ({ t: (k: string) => k }));
  vi.doMock('../../src/v2/decision/download-validator', () => ({
    validateDownloadUrl: vi.fn((url: string) =>
      url.startsWith('https://')
        ? { valid: true }
        : { valid: false, reason: 'UNSAFE_SCHEME' },
    ),
  }));

  // --- Browser host, scripted ---
  const statusCalls: StatusCall[] = [];
  const downloadCalls: Array<{ url: string }> = [];
  const tabCreations: Array<{ url: string }> = [];
  let nextDownloadId = 1000;
  const script = options.downloadScript ?? ['id'];
  const nextBehavior = (): DownloadScriptStep => {
    const step = script[Math.min(downloadCalls.length - 1, script.length - 1)];
    return step ?? 'id';
  };

  chrome.downloads.download = vi.fn((opts: any, cb?: (id?: number) => void) => {
    downloadCalls.push({ url: opts?.url });
    const behavior = nextBehavior();
    if (behavior === 'never') return undefined as never; // stall: no callback
    if (behavior === 'lastError') {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'blocked' };
      cb?.(undefined);
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      return undefined as never;
    }
    const id = nextDownloadId++;
    cb?.(id);
    return id as never;
  }) as never;
  chrome.downloads.cancel = vi.fn((_id: number, cb?: () => void) => cb?.()) as never;
  chrome.downloads.erase = vi.fn((_f: object, cb?: () => void) => cb?.()) as never;
  chrome.tabs.create = vi.fn(((opts: any, cb?: (t: any) => void) => {
    tabCreations.push({ url: opts?.url });
    cb?.({ id: 100 + tabCreations.length });
    return { id: 100 + tabCreations.length } as never;
  }) as never) as never;
  chrome.tabs.remove = vi.fn((_t: number, cb?: () => void) => cb?.()) as never;

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
  (chrome.downloads as any).onCreated = { addListener: (l: any) => onCreatedListeners.push(l) };
  (chrome.downloads as any).onDeterminingFilename = {
    addListener: (l: any) => onDeterminingFilenameListeners.push(l),
  };
  vi.spyOn(chrome.storage.local, 'get').mockImplementation((_k: any, cb: any) =>
    cb({ extensionEnabled: true }),
  );
  (chrome.runtime as { lastError?: unknown }).lastError = undefined;

  const mod = await import('../../entrypoints/background/index');
  (mod.default as unknown as () => void)();

  const dispatchMessage = (message: any, sender: any = { tab: { id: 5 } }) => {
    for (const listener of onMessageListeners) listener(message, sender, vi.fn());
  };

  return {
    stateModule,
    firePendingExpired: (requestId: string) => stateModule.firePendingExpired(requestId),
    statusCalls,
    downloadCalls,
    tabCreations,
    cleanupSpy,
    recordSpy,
    requestDownload: (url: string = ORIGINAL_URL, requestId = 'req-corpus', fileMeta: any = { name: 'lecture.pdf', ext: 'pdf' }) =>
      dispatchMessage({ type: 'CQD_DOWNLOAD', url, requestId, fileMeta }),
    dispatchDownloadChange: (delta: any) => {
      for (const l of downloadChangedListeners) l(delta);
    },
    dispatchDownloadCreated: (item: any) => {
      for (const l of onCreatedListeners) l(item);
    },
    dispatchDeterminingFilename: (item: any, suggest?: any) => {
      for (const l of onDeterminingFilenameListeners) l(item, suggest ?? vi.fn());
    },
    /** The LAST status reported for a request — the user-visible terminal. */
    lastStatus: (requestId = 'req-corpus'): StatusCall | undefined => {
      const calls = statusCalls.filter((c) => c.requestId === requestId);
      return calls[calls.length - 1];
    },
    statusCallsFor: (requestId = 'req-corpus') => statusCalls.filter((c) => c.requestId === requestId),
  };
}
