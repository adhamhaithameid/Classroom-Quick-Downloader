import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendStatusToTab } from '../entrypoints/background/message-sender';
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
    fallbackStarted: false,
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
});
