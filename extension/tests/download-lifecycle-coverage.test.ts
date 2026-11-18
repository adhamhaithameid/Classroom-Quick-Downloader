// Coverage for the audit D4/D6 guards that the black-box repro tests do not
// reach: the stray-download kill (claimOrCancelStray) on all three start
// paths, the Drive cancel race, restartPending, and the stall-deadline timer
// guards in state.ts. The real state/registry runs; only the browser host and
// side modules are faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

const cleanupMock = vi.fn();
const queueMock = vi.fn((_id: string, start: () => void) => start());

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-1',
    startTime: Date.now(),
    originalUrl: 'https://drive.usercontent.google.com/download?id=D1',
    baseUrl: 'https://drive.usercontent.google.com/download?id=D1',
    isDrive: false,
    attemptedAuthUsers: [],
    isCancelled: false,
    ...overrides,
  };
}

async function load() {
  vi.resetModules();
  cleanupMock.mockReset();
  queueMock.mockClear();
  vi.doMock('../entrypoints/background/cleanup', () => ({ cleanup: cleanupMock }));
  vi.doMock('../entrypoints/background/message-sender', () => ({ sendStatusToTab: vi.fn() }));
  vi.doMock('../entrypoints/background/queue', () => ({ queueRequest: queueMock }));
  vi.doMock('../entrypoints/background/icon-animation', () => ({
    getIconAnimationController: () => null,
  }));
  vi.doMock('../entrypoints/utils/analytics', () => ({ recordDownloadEvent: vi.fn() }));
  vi.doMock('../src/history/history-store', () => ({
    recordDownloadHistory: vi.fn(async () => {}),
  }));
  const state = await import('../entrypoints/background/state');
  const handler = await import('../entrypoints/background/download-handler');
  return { state, handler };
}

function stubDownloads(id: number | undefined) {
  const c = chrome as any;
  c.runtime.lastError = undefined;
  c.downloads.download = vi.fn((_o: unknown, cb?: (i?: number) => void) => cb?.(id));
  c.downloads.cancel = vi.fn((_i: number, cb?: () => void) => cb?.());
}

describe('claimOrCancelStray', () => {
  beforeEach(() => vi.useRealTimers());

  it('kills a download whose pending the registry no longer tracks (single start)', async () => {
    const { handler } = await load();
    stubDownloads(77);
    const respond = vi.fn();
    handler.startSingleAttempt(makePending(), respond); // never registered
    expect((chrome as any).downloads.cancel).toHaveBeenCalledWith(77, expect.any(Function));
    expect(respond).not.toHaveBeenCalled();
  });

  it('survives a throwing cancel on a gone download', async () => {
    const { handler } = await load();
    stubDownloads(78);
    (chrome as any).downloads.cancel = vi.fn(() => {
      throw new Error('already gone');
    });
    const respond = vi.fn();
    expect(() => handler.startSingleAttempt(makePending(), respond)).not.toThrow();
    expect(respond).not.toHaveBeenCalled();
  });

  it('leaves the download alone when its id is already bound to another pending', async () => {
    const { state, handler } = await load();
    stubDownloads(79);
    const owner = makePending({ requestId: 'owner' });
    const late = makePending({ requestId: 'late' });
    state.registerPending(owner);
    state.registerPending(late);
    expect(state.bindDownloadId(owner, 79)).toBe(true);
    const respond = vi.fn();
    handler.startSingleAttempt(late, respond);
    expect((chrome as any).downloads.cancel).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });

  it('kills a stray from a late Drive account-sweep callback', async () => {
    const { handler } = await load();
    stubDownloads(80);
    const pending = makePending({
      isDrive: true,
      baseUrl: 'https://drive.google.com/uc?id=FILE1&export=download',
      attemptedAuthUsers: [],
    });
    handler.startNextDriveAttempt(pending); // not registered
    expect((chrome as any).downloads.cancel).toHaveBeenCalledWith(80, expect.any(Function));
  });

  it('leaves a Drive first attempt alone when its id is bound to another pending', async () => {
    const { state, handler } = await load();
    stubDownloads(81);
    const owner = makePending({ requestId: 'drive-owner' });
    state.registerPending(owner);
    expect(state.bindDownloadId(owner, 81)).toBe(true);
    const pending = makePending({
      requestId: 'drive-late',
      isDrive: true,
      baseUrl: 'https://drive.google.com/uc?id=FILE2&export=download',
    });
    handler.restartPending(pending);
    expect((chrome as any).downloads.cancel).not.toHaveBeenCalled();
    expect(state.pendingByDownloadId.get(81)).toBe(owner);
  });
});

describe('startDriveFlow cancel race', () => {
  it('settles a user-cancelled Drive start that throws synchronously', async () => {
    const { state, handler } = await load();
    stubDownloads(90);
    (chrome as any).downloads.download = vi.fn(() => {
      throw new Error('host refused');
    });
    const pending = makePending({
      requestId: 'drive-cancel',
      isDrive: true,
      baseUrl: 'https://drive.google.com/uc?id=FILE3&export=download',
      isCancelled: true,
    });
    state.registerPending(pending);
    handler.restartPending(pending);
    expect(cleanupMock).toHaveBeenCalledWith(pending, undefined);
    expect((chrome as any).downloads.cancel).not.toHaveBeenCalled();
  });

  it('cancels the late download when the user cancelled while the browser decided', async () => {
    const { state, handler } = await load();
    stubDownloads(95);
    const pending = makePending({
      requestId: 'drive-late-cancel',
      isDrive: true,
      baseUrl: 'https://drive.google.com/uc?id=FILE5&export=download',
      isCancelled: true,
    });
    state.registerPending(pending);
    handler.restartPending(pending);
    expect((chrome as any).downloads.cancel).toHaveBeenCalledWith(95, expect.any(Function));
    expect(cleanupMock).toHaveBeenCalledWith(pending, 95);
  });
});

describe('restartPending', () => {
  it('re-registers and starts a direct download through the queue', async () => {
    const { state, handler } = await load();
    stubDownloads(91);
    const pending = makePending({ requestId: 'direct-restart' });
    handler.restartPending(pending);
    expect(state.isRegistered('direct-restart')).toBe(true);
    expect((chrome as any).downloads.download).toHaveBeenCalledTimes(1);
    expect(state.pendingByDownloadId.get(91)).toBe(pending);
  });

  it('re-registers and starts a Drive download through the queue', async () => {
    const { state, handler } = await load();
    stubDownloads(92);
    const pending = makePending({
      requestId: 'drive-restart',
      isDrive: true,
      baseUrl: 'https://drive.google.com/uc?id=FILE4&export=download',
    });
    handler.restartPending(pending);
    expect(state.isRegistered('drive-restart')).toBe(true);
    expect(state.pendingByDownloadId.get(92)).toBe(pending);
  });

  it('shows the queued status when the queue holds the start', async () => {
    const { handler } = await load();
    queueMock.mockImplementationOnce((_id: string, _start: () => void, onQueued?: () => void) => {
      onQueued?.();
    });
    stubDownloads(93);
    handler.restartPending(makePending({ requestId: 'queued' }));
    expect((chrome as any).downloads.download).not.toHaveBeenCalled();
  });
});

describe('stall deadline timer guards', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not fire the expiry hook for a pending the registry replaced', async () => {
    vi.useFakeTimers();
    const { state } = await load();
    const hook = vi.fn();
    state.setPendingExpiredHook(hook);
    const original = makePending({ requestId: 'same-id' });
    state.registerPending(original);
    state.rearmDeadline(original);
    state.pendingByRequestId.set('same-id', makePending({ requestId: 'same-id' }));
    vi.advanceTimersByTime(state.PENDING_DEADLINE_MS + 1);
    expect(hook).not.toHaveBeenCalled();
  });

  it('fires the expiry hook for the live pending', async () => {
    vi.useFakeTimers();
    const { state } = await load();
    const hook = vi.fn();
    state.setPendingExpiredHook(hook);
    const live = makePending({ requestId: 'live-id' });
    state.registerPending(live);
    state.rearmDeadline(live);
    vi.advanceTimersByTime(state.PENDING_DEADLINE_MS + 1);
    expect(hook).toHaveBeenCalledWith(live);
  });

  it('arms nothing when setTimeout is unavailable', async () => {
    const { state } = await load();
    vi.stubGlobal('setTimeout', undefined);
    const pending = makePending({ requestId: 'no-timer' });
    state.registerPending(pending);
    expect(() => state.rearmDeadline(pending)).not.toThrow();
  });
});
