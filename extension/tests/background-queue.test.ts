import { describe, expect, it, vi } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';
// ============================================================================
// BACKGROUND QUEUE INTEGRATION (0h4d.1.2 task 2, plan
// docs/superpowers/plans/2026-09-28-queue-engine.md). Every start funnels
// through handleDownloadRequest; the queue gates admission there. The
// scheduler's own contract lives in tests/queue-engine.test.ts — this file
// proves the WIRING: pacing at the chokepoint, admission on settlement,
// restart recovery.
// ============================================================================

const complete = (id: number) => ({ id, state: { current: 'complete' } });

describe('background download queue (0h4d.1.2)', () => {
  it('admits at most 3 concurrent downloads; each settlement admits the next', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });

    for (let i = 0; i < 10; i++) {
      h.requestDownload(`https://drive.google.com/uc?id=file${i}`, `q-${i}`);
    }
    // Only the first `cap` requests reach chrome.downloads.download.
    expect(h.downloadCalls.length).toBe(3);

    // Settling q-0 (first admitted, downloadId 1000) admits exactly one more.
    h.dispatchDownloadChange(complete(1000));
    expect(h.downloadCalls.length).toBe(4);

    // Pacing holds: settle two more → exactly two admissions.
    h.dispatchDownloadChange(complete(1001));
    h.dispatchDownloadChange(complete(1002));
    expect(h.downloadCalls.length).toBe(6);
  });

  it('all queued requests eventually download after enough settlements', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });

    for (let i = 0; i < 5; i++) {
      h.requestDownload(`https://drive.google.com/uc?id=file${i}`, `d-${i}`);
    }
    // Drain: settle everything currently active, again and again.
    while (h.downloadCalls.length < 5) {
      const settledBefore = h.downloadCalls.length;
      for (let id = 1000; id < 1000 + settledBefore; id++) {
        h.dispatchDownloadChange(complete(id));
      }
    }
    expect(h.downloadCalls.length).toBe(5);
  });

  it('a cancelled queued request never downloads', async () => {
    const h = await loadFlowHarness({ downloadScript: ['id'] });

    for (let i = 0; i < 4; i++) {
      h.requestDownload(`https://drive.google.com/uc?id=file${i}`, `c-${i}`);
    }
    expect(h.downloadCalls.length).toBe(3);

    // Cancel the queued request through the registry cleanup path.
    const pending = h.stateModule.pendingByRequestId.get('c-3');
    expect(pending).toBeTruthy();
    pending!.isCancelled = true;
    h.stateModule.pendingByRequestId.delete('c-3');
    // (the cancel flow unregisters via cleanup; simulate the unregister side)
    h.cleanupSpy.mock?.calls ?? undefined;
    h.dispatchDownloadChange(complete(1000));
    // q slot freed → c-3 would be admitted if still queued; it must not be.
    expect(h.downloadCalls.length).toBe(4);
    expect(h.downloadCalls.every((c) => !c.url.includes('file3'))).toBe(true);
  });

  it('restart recovery: a reconciled in-progress record holds its active slot', async () => {
    vi.resetModules();
    const queue = await import('../entrypoints/background/queue');
    queue.resetQueueForTests();

    // A record that was downloading pre-restart comes back via reconcile.
    queue.queueRecoverActive('r-1');

    const started: string[] = [];
    for (let i = 0; i < 3; i++) queue.queueRequest(`n-${i}`, () => started.push(`n-${i}`));

    // r-1 occupies one of the 3 slots: only 2 of the new requests admit.
    expect(started).toEqual(['n-0', 'n-1']);
    expect(queue.getQueueSnapshot().activeIds).toContain('r-1');

    // When the recovered download settles, the third request admits.
    queue.queueSettled('r-1');
    expect(started).toEqual(['n-0', 'n-1', 'n-2']);
  });
});
