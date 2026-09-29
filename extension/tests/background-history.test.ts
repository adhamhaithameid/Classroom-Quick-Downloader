import { describe, expect, it, vi } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';

// ============================================================================
// HISTORY SETTLE WIRING (0h4d.1.6 task 2). Every terminal settle writes one
// history row: success via reportSuccess, classified fails via the interrupt
// path (SIZE_MISMATCH included, cancelled excluded). The store's own
// contract lives in tests/history-store.test.ts — this file proves the
// background writes rows at the real settle points.
// ============================================================================

const complete = (id: number) => ({ id, state: { current: 'complete' } });
const interrupted = (id: number, error: string) => ({
  id,
  state: { current: 'interrupted' },
  error: { current: error },
});

function historySets(storageSetSpy: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
  return (storageSetSpy.mock.calls as Array<[Record<string, unknown>]>)
    .map((call) => call[0])
    .filter((kv) => 'cqd_history_v1' in kv);
}

describe('history settle wiring (0h4d.1.6)', () => {
  it('a completed download records one success row', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    (chrome.downloads as any).search = vi.fn(
      (_q: unknown, cb: (items?: Array<{ mime?: string; filename?: string; totalBytes?: number; bytesReceived?: number }>) => void) =>
        cb([{ mime: 'application/pdf', filename: 'lecture.pdf', totalBytes: 500, bytesReceived: 500 }]),
    );
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) => cb({}));

    h.requestDownload('https://drive.google.com/uc?id=hist1', 'h-1');
    h.dispatchDownloadChange(complete(1000));
    // Timers are faked globally (tests/setup.ts) — advance to flush the
    // async history write.
    await vi.advanceTimersByTimeAsync(50);

    const writes = historySets(setSpy);
    expect(writes.length).toBe(1);
    const rows = writes[0].cqd_history_v1 as Array<Record<string, unknown>>;
    const row = rows.find((r) => r.id === 'h-1');
    expect(row?.status).toBe('success');
    expect(row?.filename).toBe('lecture.pdf');
    expect(row?.host).toBe('drive.usercontent.google.com');
  });

  it('a permanently interrupted download records one failed row with its class', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) => cb({}));

    h.requestDownload('https://drive.google.com/uc?id=hist2', 'h-2');
    h.dispatchDownloadChange(interrupted(1000, 'FILE_FAILED'));
    await vi.advanceTimersByTimeAsync(50);

    const writes = historySets(setSpy);
    expect(writes.length).toBe(1);
    const rows = writes[0].cqd_history_v1 as Array<Record<string, unknown>>;
    const row = rows.find((r) => r.id === 'h-2');
    expect(row?.status).toBe('failed');
    expect(row?.errorCode).toBe('FILE_FAILED');
  });

  it('a user cancellation records nothing', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    const setSpy = vi.fn((_kv: unknown, cb?: () => void) => cb?.());
    (chrome.storage.local.set as any) = setSpy;
    (chrome.storage.local.get as any) = vi.fn((_k: unknown, cb: (r: unknown) => void) => cb({}));

    h.requestDownload('https://drive.google.com/uc?id=hist3', 'h-3');
    // USER_CANCELED settles as 'cancelled' — history must ignore it.
    h.dispatchDownloadChange(interrupted(1000, 'USER_CANCELED'));

    expect(historySets(setSpy)).toHaveLength(0);
    expect(h.lastStatus('h-3')?.status).toBe('cancelled');
  });
});
