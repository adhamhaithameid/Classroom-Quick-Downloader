import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadStateWithDelay(delayMs = 2500) {
  vi.resetModules();
  vi.doMock('../entrypoints/utils/analytics', () => ({
    getCancelHoldDelayMs: vi.fn(async () => delayMs),
  }));
  return import('../entrypoints/content/state');
}

describe('content state module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports expected selectors, patterns, and timing constants', async () => {
    const state = await loadStateWithDelay();
    expect(state.CLASSROOM_URL_PATTERN.test('https://classroom.google.com/u/0/h')).toBe(true);
    expect(state.DRIVE_ANCHOR_SELECTOR).toContain('a[href*=');
    expect(state.ATTACHMENT_CONTAINER_SELECTOR.length).toBeGreaterThan(0);
    expect(state.DRIVE_URL_PATTERNS.length).toBeGreaterThan(0);
    expect(state.INJECTED_ATTR).toBe('data-cqd-injected');
    expect(state.PROCESSED_ATTR).toBe('data-cqd-processed');
    expect(state.RESCAN_INTERVAL_MS).toBe(2000);
  });

  it('maintains mutable state through setter helpers', async () => {
    const state = await loadStateWithDelay();
    state.setScanTimeoutId(10);
    state.setRescanIntervalId(12);
    state.setObserver({ disconnect: () => undefined } as unknown as MutationObserver);
    state.setDesiredEnabled(false);
    state.setEffectiveEnabled(true);
    state.setInitialized(true);
    state.setGlobalEnabled(false);
    expect(state.scanTimeoutId).toBe(10);
    expect(state.rescanIntervalId).toBe(12);
    expect(state.observer).toBeTruthy();
    expect(state.desiredEnabled).toBe(false);
    expect(state.effectiveEnabled).toBe(true);
    expect(state.initialized).toBe(true);
    expect(state.globalEnabled).toBe(false);
  });

  it('generates unique request IDs and keeps pending button map mutable', async () => {
    const state = await loadStateWithDelay();
    const a = state.getNextRequestId();
    const b = state.getNextRequestId();
    expect(a.startsWith('cqd-')).toBe(true);
    expect(a).not.toBe(b);
    state.pendingButtons.set('x', {
      button: document.createElement('button'),
      requestId: 'x',
      startedAt: Date.now(),
    });
    expect(state.pendingButtons.has('x')).toBe(true);
  });

  it('hydrates cancelHoldDelayMs from analytics config on module load', async () => {
    const state = await loadStateWithDelay(4321);
    await Promise.resolve();
    await Promise.resolve();
    expect(state.cancelHoldDelayMs).toBe(4321);
  });
});
