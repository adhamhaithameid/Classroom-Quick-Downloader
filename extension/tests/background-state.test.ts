import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function restoreNavigator() {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  }
}

async function loadStateModuleWithNavigator(userAgent?: string) {
  vi.resetModules();
  if (typeof userAgent === 'string') {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent },
      configurable: true,
    });
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
    });
  }
  return import('../entrypoints/background/state');
}

describe('background state module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreNavigator();
  });

  it('initializes all pending maps and sets', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Chrome/120');
    expect(state.pendingByRequestId).toBeInstanceOf(Map);
    expect(state.pendingByDownloadId).toBeInstanceOf(Map);
    expect(state.pendingByUrl).toBeInstanceOf(Map);
    expect(state.pendingByBypassTabId).toBeInstanceOf(Map);
    expect(state.cancelledByUs).toBeInstanceOf(Set);
    expect(state.recentDownloads).toBeInstanceOf(Map);
  });

  it('exports expected constants and classroom URL pattern', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Chrome/120');
    expect(state.AUTHUSER_CANDIDATES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.PENDING_DOWNLOAD_TTL_MS).toBe(10 * 60 * 1000);
    expect(state.CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(state.CLASSROOM_URL_PATTERN.test('https://classroom.google.com/u/0/h')).toBe(true);
    expect(state.CLASSROOM_URL_PATTERN.test('https://example.com')).toBe(false);
  });

  it('detects Firefox user agent at module load', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Firefox/123');
    expect(state.IS_FIREFOX).toBe(true);
  });

  it('handles missing navigator safely', async () => {
    const state = await loadStateModuleWithNavigator();
    expect(state.IS_FIREFOX).toBe(false);
  });
});
