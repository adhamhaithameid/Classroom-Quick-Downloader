import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';

// ============================================================================
// EXPECTED-SIZE VERIFICATION (bead 0h4d.1.5, plan
// docs/superpowers/plans/2026-09-28-size-verification.md). A completion
// whose bytesReceived ≠ totalBytes is a truncated file — never a success.
// It erases the partial, retries within the backoff policy (0h4d.1.3), and
// settles honestly as SIZE_MISMATCH when the policy is exhausted. Unknown
// size (totalBytes 0) skips verification honestly.
// ============================================================================

const complete = (id: number) => ({ id, state: { current: 'complete' } });

type ItemShape = { totalBytes?: number; bytesReceived?: number; mime?: string; filename?: string };

/** Patch the browser's downloads.search with per-id scripted items. */
function scriptSearch(items: Record<number, ItemShape>): void {
  (chrome.downloads as any).search = vi.fn(
    (query: { id: number }, cb: (results?: ItemShape[]) => void) => {
      cb([items[query.id]]);
    },
  );
}

describe('expected-size verification (0h4d.1.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a truncated completion retries instead of reporting success', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    scriptSearch({
      1000: { totalBytes: 100, bytesReceived: 40, mime: 'application/pdf' },
      1001: { totalBytes: 100, bytesReceived: 100, mime: 'application/pdf', filename: 'a.pdf' },
    });

    h.requestDownload('https://drive.google.com/uc?id=trunc1', 'sz-1');
    h.dispatchDownloadChange(complete(1000));

    // Not a success yet — the bytes are short.
    expect(h.lastStatus('sz-1')?.status).not.toBe('success');
    vi.advanceTimersByTime(2_000); // policy retry fires (delay ≤ 2s)
    expect(h.downloadCalls.length).toBe(2);

    // The retried download arrives complete → success.
    h.dispatchDownloadChange(complete(1001));
    expect(h.lastStatus('sz-1')?.status).toBe('success');
  });

  it('truncation that exhausts the policy settles as SIZE_MISMATCH and erases partials', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    scriptSearch({
      1000: { totalBytes: 100, bytesReceived: 40, mime: 'application/pdf' },
      1001: { totalBytes: 100, bytesReceived: 40, mime: 'application/pdf' },
      1002: { totalBytes: 100, bytesReceived: 40, mime: 'application/pdf' },
    });

    h.requestDownload('https://drive.google.com/uc?id=trunc2', 'sz-2');
    h.dispatchDownloadChange(complete(1000));
    vi.advanceTimersByTime(2_000);
    h.dispatchDownloadChange(complete(1001));
    vi.advanceTimersByTime(4_000);
    h.dispatchDownloadChange(complete(1002));

    const last = h.lastStatus('sz-2');
    expect(last?.status).toBe('error');
    expect(last?.errorCode).toBe('SIZE_MISMATCH');
    expect(last?.userMessage?.length ?? 0).toBeGreaterThan(0);
    expect(chrome.downloads.erase).toHaveBeenCalled();
  });

  it('an unknown total size skips verification honestly (no false failure)', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });
    scriptSearch({
      1000: { totalBytes: 0, bytesReceived: 12345, mime: 'application/pdf', filename: 'ok.pdf' },
    });

    h.requestDownload('https://drive.google.com/uc?id=unknown-size', 'sz-3');
    h.dispatchDownloadChange(complete(1000));

    expect(h.lastStatus('sz-3')?.status).toBe('success');
    expect(h.downloadCalls.length).toBe(1);
  });
});
