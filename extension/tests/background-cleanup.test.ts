import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, cleanupOrphanedPendingDownloads } from '../entrypoints/background/cleanup';
import {
  cancelledByUs,
  pendingByBypassTabId,
  pendingByDownloadId,
  pendingByRequestId,
  pendingByUrl,
  recentDownloads,
  PENDING_DOWNLOAD_TTL_MS,
} from '../entrypoints/background/state';
import type { PendingDownload } from '../entrypoints/background/types';

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-cleanup',
    startTime: Date.now(),
    originalUrl: 'https://example.com/file.pdf',
    baseUrl: 'https://example.com/file.pdf',
    isDrive: false,
    fileMeta: { ext: 'pdf', name: 'file.pdf' },
    attemptedAuthUsers: [],
    fallbackStarted: false,
    isCancelled: false,
    ...overrides,
  };
}

describe('background cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pendingByRequestId.clear();
    pendingByDownloadId.clear();
    pendingByUrl.clear();
    pendingByBypassTabId.clear();
    cancelledByUs.clear();
    recentDownloads.clear();
    chrome.tabs = {
      remove: vi.fn(),
    } as never;
  });

  it('cleans all maps and closes bypass tabs for a pending download', () => {
    const pending = makePending();
    pendingByRequestId.set(pending.requestId, pending);
    pendingByDownloadId.set(9, pending);
    pendingByUrl.set('https://example.com/file.pdf', pending);
    pendingByBypassTabId.set(21, pending);
    cancelledByUs.add(9);

    cleanup(pending, 9);

    expect(pendingByRequestId.has(pending.requestId)).toBe(false);
    expect(pendingByDownloadId.has(9)).toBe(false);
    expect(cancelledByUs.has(9)).toBe(false);
    expect(pendingByUrl.size).toBe(0);
    expect(pendingByBypassTabId.size).toBe(0);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(21);
  });

  it('does not throw when bypass tab close fails', () => {
    const pending = makePending();
    pendingByBypassTabId.set(7, pending);
    chrome.tabs.remove = vi.fn(() => {
      throw new Error('already closed');
    }) as never;
    expect(() => cleanup(pending)).not.toThrow();
  });

  it('removes stale pending downloads and old recent-download records', () => {
    const staleStart = Date.now() - PENDING_DOWNLOAD_TTL_MS - 1000;
    const freshStart = Date.now() - 100;
    const stale = makePending({ requestId: 'stale', startTime: staleStart });
    const fresh = makePending({ requestId: 'fresh', startTime: freshStart });
    pendingByRequestId.set(stale.requestId, stale);
    pendingByRequestId.set(fresh.requestId, fresh);
    recentDownloads.set('old.pdf', staleStart);
    recentDownloads.set('new.pdf', freshStart);

    cleanupOrphanedPendingDownloads();

    expect(pendingByRequestId.has('stale')).toBe(false);
    expect(pendingByRequestId.has('fresh')).toBe(true);
    expect(recentDownloads.has('old.pdf')).toBe(false);
    expect(recentDownloads.has('new.pdf')).toBe(true);
  });

  it('bounds cancelled-by-us set size to avoid unbounded growth', () => {
    for (let i = 0; i < 120; i += 1) {
      cancelledByUs.add(i);
    }
    cleanupOrphanedPendingDownloads();
    expect(cancelledByUs.size).toBe(50);
  });
});

