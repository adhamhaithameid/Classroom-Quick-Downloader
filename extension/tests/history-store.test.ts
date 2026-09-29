import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';
import {
  HISTORY_CAP,
  appendEntry,
  clearHistory,
  computeChecksum,
  getHistory,
  loadHistory,
  recordDownloadHistory,
  searchEntries,
} from '../src/history/history-store';

// ============================================================================
// DOWNLOAD HISTORY (bead 0h4d.1.6, plan
// docs/superpowers/plans/2026-09-28-download-history.md). Local-only,
// checksummed like the analytics queue; PII-free visible schema (host only
// in the visible fields — the url rides the entry solely so re-download
// works; history never leaves the machine). Cancelled downloads never
// record (the recorder filters to success/failed terminals).
// ============================================================================

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-h1',
    startTime: Date.now() - 1000,
    originalUrl: 'https://drive.google.com/file/d/FILE123/view',
    baseUrl: 'https://drive.usercontent.google.com/download?id=FILE123&confirm=t',
    isDrive: true,
    fileMeta: { ext: 'pdf', name: 'lecture-notes.pdf' },
    tabId: 5,
    attemptedAuthUsers: [],
    isCancelled: false,
    totalBytes: 12345,
    ...overrides,
  };
}

describe('history store (0h4d.1.6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appendEntry adds and trims to HISTORY_CAP (oldest first)', () => {
    let entries: ReturnType<typeof appendEntry> = [];
    for (let i = 0; i < HISTORY_CAP + 10; i++) {
      entries = appendEntry(entries, {
        id: `req-${i}`,
        ts: 1000 + i,
        filename: `f${i}.pdf`,
        ext: 'pdf',
        status: 'success',
        host: 'drive.usercontent.google.com',
        url: `https://x/${i}`,
      });
    }
    expect(entries.length).toBe(HISTORY_CAP);
    // Oldest trimmed: req-0..req-9 are gone; newest present.
    expect(entries.some((e) => e.id === 'req-0')).toBe(false);
    expect(entries.some((e) => e.id === `req-${HISTORY_CAP + 9}`)).toBe(true);
  });

  it('appendEntry is idempotent per entry id (one settle = one row)', () => {
    let entries = appendEntry([], { id: 'req-1', ts: 1, filename: 'a.pdf', status: 'success', host: 'x', url: 'u' });
    entries = appendEntry(entries, { id: 'req-1', ts: 2, filename: 'a.pdf', status: 'success', host: 'x', url: 'u' });
    expect(entries.length).toBe(1);
  });

  it('searchEntries filters by filename substring (case-insensitive)', () => {
    const entries = [
      { id: '1', ts: 1, filename: 'Lecture Notes.pdf', status: 'success' as const, host: 'x', url: 'u' },
      { id: '2', ts: 2, filename: 'syllabus.docx', status: 'failed' as const, errorCode: 'SIZE_MISMATCH', host: 'x', url: 'u' },
    ];
    expect(searchEntries(entries, 'lecture')).toEqual([entries[0]]);
    expect(searchEntries(entries, 'SYLLABUS')).toEqual([entries[1]]);
    expect(searchEntries(entries, '')).toHaveLength(2);
  });

  it('loadHistory sanitizes corrupt payloads and reports integrity', async () => {
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) =>
      cb({ cqd_history_v1: 'not-an-array' }),
    );
    const { entries, valid } = await loadHistory();
    expect(entries).toEqual([]);
    expect(valid).toBe(false);
  });

  it('loadHistory keeps entries when the checksum matches', async () => {
    const good = [{ id: '1', ts: 1, filename: 'a.pdf', status: 'success', host: 'x', url: 'u' }];
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) =>
      cb({
        cqd_history_v1: good,
        cqd_history_integrity_v1: computeChecksum(JSON.stringify(good)),
      }),
    );
    const { entries, valid } = await loadHistory();
    expect(entries).toEqual(good);
    expect(valid).toBe(true);
  });

  it('recordDownloadHistory writes the PII-free schema from a pending', async () => {
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) => cb({}));

    await recordDownloadHistory(makePending(), 'success');

    const payload = setSpy.mock.calls[0][0] as Record<string, unknown>;
    const entries = payload.cqd_history_v1 as Array<Record<string, unknown>>;
    const entry = entries.find((e) => e.id === 'req-h1');
    expect(entry).toBeTruthy();
    expect(entry?.filename).toBe('lecture-notes.pdf');
    expect(entry?.host).toBe('drive.usercontent.google.com');
    expect(entry?.bytes).toBe(12345);
    expect(entry?.status).toBe('success');
  });

  it('recordDownloadHistory ignores cancelled and unknown statuses', async () => {
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) => cb({}));

    await recordDownloadHistory(makePending(), 'cancelled');
    await recordDownloadHistory(makePending(), 'trying');

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('getHistory returns entries via the message-facing read path', async () => {
    const good = [{ id: '2', ts: 2, filename: 'b.pdf', status: 'failed', errorCode: 'SIZE_MISMATCH', host: 'x', url: 'u' }];
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) =>
      cb({
        cqd_history_v1: good,
        cqd_history_integrity_v1: computeChecksum(JSON.stringify(good)),
      }),
    );
    const entries = await getHistory();
    expect(entries[0]?.errorCode).toBe('SIZE_MISMATCH');
  });

  it('clearHistory empties the store', async () => {
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    await clearHistory();
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cqd_history_v1: [], cqd_history_integrity_v1: expect.any(String) }),
      expect.any(Function),
    );
  });
});
