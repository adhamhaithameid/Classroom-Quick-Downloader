import { beforeEach, describe, expect, it, vi } from 'vitest';

type PendingEntry = {
  button: HTMLButtonElement;
  requestId: string;
  fileMeta: { name: string; ext: string };
  startedAt: number;
};

async function loadDownloadHandlerModule() {
  vi.resetModules();
  const pendingButtons = new Map<string, PendingEntry>();
  const getButtonState = vi.fn(() => 'idle');
  const setButtonState = vi.fn();
  const setPillProgress = vi.fn();
  const nextIds = ['req-1', 'req-2', 'req-3'];

  vi.doMock('../entrypoints/content/state', () => ({
    pendingButtons,
    getNextRequestId: () => nextIds.shift() ?? 'req-z',
    cancelHoldDelayMs: 0,
    FEEDBACK_ERROR_MS: 10,
    FEEDBACK_CANCELLED_MS: 10,
    FEEDBACK_SUCCESS_MS: 10,
    LOADING_MIN_MS: 50,
    MAX_TERMINAL_STATE_MS: 200,
  }));
  vi.doMock('../entrypoints/content/url-utils', () => ({
    toDownloadUrl: (url: string) => `${url}?download=1`,
  }));
  vi.doMock('../entrypoints/content/button-state', () => ({
    getButtonState,
    setButtonState,
    setPillProgress,
    updateAriaLabel: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
  }));

  const mod = await import('../entrypoints/content/download-handler');
  return { mod, pendingButtons, getButtonState, setButtonState, setPillProgress };
}

describe('content/download-handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));
  });

  it('finds pending buttons by element', async () => {
    const { mod, pendingButtons } = await loadDownloadHandlerModule();
    const btn = document.createElement('button');
    pendingButtons.set('req-1', {
      button: btn,
      requestId: 'req-1',
      fileMeta: { name: 'a.pdf', ext: 'pdf' },
      startedAt: Date.now(),
    });
    expect(mod.findPendingButtonByElement(btn)?.requestId).toBe('req-1');
  });

  it('startBackgroundDownload returns runtime error when messaging is unavailable', async () => {
    const { mod } = await loadDownloadHandlerModule();
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = { runtime: undefined };
    const res = await mod.startBackgroundDownload('req-1', 'https://drive.google.com/file', {
      name: 'a.pdf',
      ext: 'pdf',
      kind: 'file',
    });
    expect(res.ok).toBe(false);
    expect(res.userMessage).toContain('runtimeError');
    (globalThis as any).chrome = originalChrome;
  });

  it('startBackgroundDownload handles success and failure callbacks', async () => {
    const { mod } = await loadDownloadHandlerModule();
    vi.spyOn(chrome.runtime as any, 'sendMessage')
      .mockImplementationOnce((...args: any[]) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') cb({ started: true });
      })
      .mockImplementationOnce((...args: any[]) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') cb({ started: false, userMessage: 'blocked' });
      });

    const ok = await mod.startBackgroundDownload('req-1', 'https://drive.google.com/file', {
      name: 'a.pdf',
      ext: 'pdf',
      kind: 'file',
    });
    expect(ok.ok).toBe(true);

    const fail = await mod.startBackgroundDownload('req-2', 'https://drive.google.com/file', {
      name: 'b.pdf',
      ext: 'pdf',
      kind: 'file',
    });
    expect(fail).toEqual({ ok: false, userMessage: 'blocked' });
  });

  it('ensureMinLoading waits when elapsed time is shorter than minimum', async () => {
    const { mod } = await loadDownloadHandlerModule();
    const startedAt = Date.now() - 10;
    const promise = mod.ensureMinLoading(startedAt);
    await vi.advanceTimersByTimeAsync(50);
    await promise;
  });

  it('handleSingleDownloadClick tracks pending request and starts background download', async () => {
    const { mod, pendingButtons, setButtonState, setPillProgress } = await loadDownloadHandlerModule();
    vi.spyOn(chrome.runtime as any, 'sendMessage').mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb({ started: true });
    });
    const btn = document.createElement('button');

    await mod.handleSingleDownloadClick(btn, 'https://drive.google.com/file', {
      name: 'a.pdf',
      ext: 'pdf',
      kind: 'file',
    });

    expect(setPillProgress).toHaveBeenCalledWith(btn, 0);
    expect(setButtonState).toHaveBeenCalledWith(btn, 'loading');
    expect(pendingButtons.has('req-1')).toBe(true);
  });
});
