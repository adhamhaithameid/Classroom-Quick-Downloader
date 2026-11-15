import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadFlowHarness, DRIVE_BASE } from './helpers/background-flow';

// ============================================================================
// #878 ENDLESS DOWNLOAD JUNK (bead oso5). A Drive request whose response is
// HTML (wrong-account interstitial) or short (truncated) is cancelled and
// erased from Chrome's download list — but the FILE stayed on disk, so one
// click could leave download.pdf, download (1).pdf, … behind. Also, the
// sweep's rotated attempt URLs (authuser=N) never matched the pending
// registry's exact-URL buckets, so the filename suggestion was missed and
// Chrome fell back to its bare `download` stem. Both behaviors are pinned
// here against the REAL background listeners.
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

describe('#878 download junk (oso5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a completed HTML interstitial is removed from disk, not just the list', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id', 'id'] });
    scriptSearch({
      1000: { totalBytes: 500, bytesReceived: 500, mime: 'text/html' },
    });

    h.requestDownload('https://drive.google.com/uc?id=junk1', 'junk-1');
    h.dispatchDownloadChange(complete(1000));

    // The file must leave the DISK (removeFile), and the list entry too.
    expect(chrome.downloads.removeFile).toHaveBeenCalledWith(1000, expect.any(Function));
    expect(chrome.downloads.erase).toHaveBeenCalled();
    const removeOrder = (chrome.downloads.removeFile as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const eraseOrder = (chrome.downloads.erase as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(eraseOrder);
    // The sweep continues to the next signed-in account.
    expect(h.downloadCalls.length).toBe(2);
    expect(h.downloadCalls[1].url).toBe(`${DRIVE_BASE}&authuser=0`);
  });

  it('a truncated completion removes the partial file from disk', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id', 'id'] });
    scriptSearch({
      1000: { totalBytes: 100, bytesReceived: 40, mime: 'application/pdf' },
      1001: { totalBytes: 100, bytesReceived: 100, mime: 'application/pdf', filename: 'a.pdf' },
    });

    h.requestDownload('https://drive.google.com/uc?id=trunc878', 'junk-2');
    h.dispatchDownloadChange(complete(1000));

    expect(chrome.downloads.removeFile).toHaveBeenCalledWith(1000, expect.any(Function));
    expect(chrome.downloads.erase).toHaveBeenCalled();
    const removeOrder = (chrome.downloads.removeFile as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const eraseOrder = (chrome.downloads.erase as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(eraseOrder);

    // The 0h4d.1.5 retry contract still holds: the policy retries, and the
    // healthy completion settles as success.
    vi.advanceTimersByTime(2_000);
    expect(h.downloadCalls.length).toBe(2);
    h.dispatchDownloadChange(complete(1001));
    expect(h.lastStatus('junk-2')?.status).toBe('success');
  });

  it('a rotated attempt URL still correlates for the filename suggestion', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id', 'never'] });
    scriptSearch({
      1000: { totalBytes: 500, bytesReceived: 500, mime: 'text/html' },
    });

    h.requestDownload('https://drive.google.com/uc?id=rot878', 'junk-3');
    // Attempt 1 (the bare URL) answers HTML → the sweep starts attempt 2,
    // now carrying authuser=0. Its start callback never fires ('never'), so
    // the pending is still unclaimed when Chrome asks for a filename — the
    // bind-race window.
    h.dispatchDownloadChange(complete(1000));
    expect(h.downloadCalls[1].url).toBe(`${DRIVE_BASE}&authuser=0`);

    const suggest = vi.fn();
    h.dispatchDeterminingFilename(
      { id: 5555, url: `${DRIVE_BASE}&authuser=0`, mime: 'application/pdf', filename: 'b.pdf' },
      suggest,
    );

    // The real title must ride on the suggestion, not the bare stem.
    expect(suggest).toHaveBeenCalledWith(
      expect.objectContaining({ filename: expect.stringContaining('lecture') }),
    );
  });
});
