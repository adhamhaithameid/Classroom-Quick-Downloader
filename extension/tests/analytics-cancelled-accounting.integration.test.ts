import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsEvent } from '../entrypoints/utils/analytics/types';

type StorageMap = Record<string, unknown>;

function installPersistentChromeStorage(seed: StorageMap = {}): StorageMap {
  const data: StorageMap = { ...seed };

  vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys: unknown, callback?: (result: StorageMap) => void) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: StorageMap = {};
    for (const key of keyList) {
      if (typeof key === 'string') {
        result[key] = data[key];
      }
    }
    callback?.(result);
    return Promise.resolve(result);
  });

  vi.spyOn(chrome.storage.local, 'set').mockImplementation((items: StorageMap, callback?: () => void) => {
    Object.assign(data, items);
    callback?.();
    return Promise.resolve();
  });

  return data;
}

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'macos',
    ext_version: '1.3.6-test',
    duration_ms: 1500,
    bypass_used: false,
    language: 'en',
    timestamp: Date.now() - 1000,
    id: `it-${Math.random().toString(36).slice(2, 10)}`,
    retryCount: 0,
    ...overrides,
  };
}

async function loadAnalyticsStatsModules() {
  vi.resetModules();
  const flush = await import('../entrypoints/utils/analytics/flush');
  const storage = await import('../entrypoints/utils/analytics/storage');
  return { flush, storage };
}

describe('analytics cancelled accounting integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installPersistentChromeStorage();
  });

  it('persists success/fail into counted totals and byType while keeping cancelled separate', async () => {
    const { flush, storage } = await loadAnalyticsStatsModules();

    await flush.updateLocalStats(makeEvent({
      status: 'success',
      file_type: 'pdf',
      duration_ms: 1200,
      bypass_used: true,
      language: 'en',
    }));
    await flush.updateLocalStats(makeEvent({
      status: 'fail',
      file_type: 'docx',
      duration_ms: 5000,
      bypass_used: false,
      language: 'en',
      error_type: 'NETWORK',
    }));
    await flush.updateLocalStats(makeEvent({
      status: 'cancelled',
      file_type: 'pptx',
      duration_ms: 16000,
      bypass_used: true,
      language: 'ar',
    }));

    const stats = await storage.loadStats();
    expect(stats.total).toBe(2);
    expect(stats.success).toBe(1);
    expect(stats.fail).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.attempts).toBe(3);
    expect(stats.total).toBe((stats.success ?? 0) + (stats.fail ?? 0));
    expect(stats.byType?.pdf).toBe(1);
    expect(stats.byType?.docx).toBe(1);
    expect(stats.byType?.pptx).toBeUndefined();
    expect(stats.failByErrorType?.NETWORK).toBe(1);
    expect(stats.bySpeed?.fast).toBe(1);
    expect(stats.bySpeed?.medium).toBe(1);
    expect(stats.bySpeed?.slow).toBe(1);
    expect(stats.bypassCount).toBe(2);
    expect(stats.byLanguage?.en).toBe(2);
    expect(stats.byLanguage?.ar).toBe(1);
  });

  it('never creates byType entries from cancelled-only events across repeated writes', async () => {
    const { flush, storage } = await loadAnalyticsStatsModules();

    await flush.updateLocalStats(makeEvent({
      status: 'cancelled',
      file_type: 'rar',
      duration_ms: 1100,
    }));
    await flush.updateLocalStats(makeEvent({
      status: 'cancelled',
      file_type: 'rar',
      duration_ms: 2400,
    }));
    await flush.updateLocalStats(makeEvent({
      status: 'cancelled',
      file_type: 'xlsx',
      duration_ms: 12000,
    }));

    const stats = await storage.loadStats();
    expect(stats.total).toBe(0);
    expect(stats.success).toBe(0);
    expect(stats.fail).toBe(0);
    expect(stats.cancelled).toBe(3);
    expect(stats.attempts).toBe(3);
    expect(stats.byType?.rar).toBeUndefined();
    expect(stats.byType?.xlsx).toBeUndefined();
    expect(Object.keys(stats.byType ?? {})).toEqual([]);
  });
});
