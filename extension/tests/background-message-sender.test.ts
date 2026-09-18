import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendStatusToTab,
  setDownloadStatusListener,
} from '../entrypoints/background/message-sender';
import type { PendingDownload } from '../entrypoints/background/types';

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-1',
    startTime: Date.now(),
    originalUrl: 'https://example.com/a.pdf',
    baseUrl: 'https://example.com/a.pdf',
    isDrive: false,
    fileMeta: { ext: 'pdf', name: 'a.pdf' },
    attemptedAuthUsers: [],
    isCancelled: false,
    tabId: 10,
    finalized: false,
    ...overrides,
  };
}

describe('background message sender', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chrome.tabs = {
      sendMessage: vi.fn(),
    } as never;
  });

  it('sends status updates to the originating tab', () => {
    const pending = makePending();
    sendStatusToTab(pending, 'error', 'failed', 'ERR');
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
      type: 'CQD_DOWNLOAD_STATUS',
      requestId: 'req-1',
      status: 'error',
      errorCode: 'ERR',
      userMessage: 'failed',
    });
  });

  it('marks success as finalized and prevents duplicate success updates', () => {
    const pending = makePending();
    sendStatusToTab(pending, 'success');
    sendStatusToTab(pending, 'success');
    expect(pending.finalized).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('returns early when tabId is not available', () => {
    const pending = makePending({ tabId: undefined });
    sendStatusToTab(pending, 'error');
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('swallows sendMessage failures when tab is gone', () => {
    chrome.tabs.sendMessage = vi.fn(() => {
      throw new Error('tab closed');
    }) as never;
    const pending = makePending();
    expect(() => sendStatusToTab(pending, 'error')).not.toThrow();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // S6/G2 bridge listener: the single status observer registered by the
  // bridge download service so tab-less downloads still settle.
  // ─────────────────────────────────────────────────────────────────────────

  describe('download status listener', () => {
    it('notifies the registered listener even when the download has no tab', () => {
      const listener = vi.fn();
      setDownloadStatusListener(listener);
      const pending = makePending({ tabId: undefined });
      sendStatusToTab(pending, 'success', undefined, undefined);
      expect(listener).toHaveBeenCalledWith(pending, 'success', undefined, undefined);
      setDownloadStatusListener(null);
    });

    it('forwards user messages and error codes to the listener', () => {
      const listener = vi.fn();
      setDownloadStatusListener(listener);
      const pending = makePending();
      sendStatusToTab(pending, 'error', 'failed', 'ERR');
      expect(listener).toHaveBeenCalledWith(pending, 'error', 'failed', 'ERR');
      setDownloadStatusListener(null);
    });

    it('ignores statuses after the listener is cleared', () => {
      const listener = vi.fn();
      setDownloadStatusListener(listener);
      setDownloadStatusListener(null);
      sendStatusToTab(makePending(), 'error');
      expect(listener).not.toHaveBeenCalled();
    });

    it('never lets a broken listener break the status funnel', () => {
      setDownloadStatusListener(() => {
        throw new Error('observer exploded');
      });
      const pending = makePending();
      expect(() => sendStatusToTab(pending, 'error')).not.toThrow();
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      setDownloadStatusListener(null);
    });
  });
});
