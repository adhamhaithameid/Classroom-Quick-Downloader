import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../entrypoints/utils/analytics/constants';
import {
  __resetStorageForTests,
  __storageTestInternals,
  loadQueue,
  normalizeStats,
} from '../entrypoints/utils/analytics/storage';

describe('analytics storage internals', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await __resetStorageForTests();
  });

  it('openQueueDb skips createObjectStore when queue store already exists', async () => {
    const createObjectStore = vi.fn();
    const fakeDb: any = {
      objectStoreNames: { contains: () => true },
      createObjectStore,
      close: vi.fn(),
      transaction: vi.fn(),
    };
    const req: any = { result: fakeDb };
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        req.onupgradeneeded?.(new Event('upgradeneeded'));
        req.onsuccess?.(new Event('success'));
      }, 0);
      return req;
    });

    const db = await __storageTestInternals.openQueueDb();
    expect(db).toBe(fakeDb);
    expect(createObjectStore).not.toHaveBeenCalled();
  });

  it('sanitizeEvent applies fallbacks for malformed fields', () => {
    const ev = __storageTestInternals.sanitizeEvent({
      status: 'unknown-status',
      file_type: '   ',
      browser: '',
      os: '',
      ext_version: '',
      duration_ms: -10,
      bypass_used: 1,
      error_type: '    ',
      language: '',
      timestamp: -100,
      source: '',
      retryCount: -1,
      commitSeq: Number.NaN,
      count: 0,
    }, 12345);

    expect(ev).toEqual(expect.objectContaining({
      status: 'success',
      file_type: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      ext_version: 'unknown',
      duration_ms: 0,
      bypass_used: false,
      error_type: undefined,
      language: 'unknown',
      timestamp: 12345,
      source: undefined,
      retryCount: undefined,
      commitSeq: undefined,
      count: undefined,
    }));

    const withError = __storageTestInternals.sanitizeEvent({
      status: 'fail',
      file_type: 'pdf',
      browser: 'chrome',
      os: 'mac',
      ext_version: '1.0.0',
      duration_ms: 10,
      bypass_used: false,
      error_type: 'NETWORK',
      language: 'en',
      timestamp: 5000,
      source: 'content',
    }, 1);
    expect(withError?.error_type).toBe('NETWORK');
    expect(withError?.source).toBe('content');
  });

  it('sanitizeQueue handles non-array inputs and clean arrays', () => {
    const bad = __storageTestInternals.sanitizeQueue({ nope: true });
    expect(bad.queue).toEqual([]);
    expect(bad.changed).toBe(true);

    const cleanItem = {
      status: 'success',
      file_type: 'pdf',
      browser: 'chrome',
      os: 'mac',
      ext_version: '1.0.0',
      duration_ms: 10,
      bypass_used: false,
      language: 'en',
      timestamp: 1000,
      id: 'id-1',
      source: 'content',
      retryCount: 1,
      commitSeq: 2,
      count: 3,
      rollup: false,
    };
    const clean = __storageTestInternals.sanitizeQueue([cleanItem]);
    expect(clean.changed).toBe(false);
    expect(clean.queue[0]).toEqual(cleanItem);
  });

  it('getEventCount clamps non-positive values and keeps valid counts', () => {
    expect(__storageTestInternals.getEventCount({ count: -1 } as any)).toBe(1);
    expect(__storageTestInternals.getEventCount({ count: 0 } as any)).toBe(1);
    expect(__storageTestInternals.getEventCount({ count: 7 } as any)).toBe(7);
  });

  it('buildRollupKey and rollupEvents apply fallback values for malformed events', () => {
    const key = __storageTestInternals.buildRollupKey({
      status: '' as any,
      file_type: '' as any,
      browser: '' as any,
      os: '' as any,
      language: '' as any,
      ext_version: '' as any,
      error_type: '',
      source: '',
      bypass_used: true,
    } as any, 1000, false);
    expect(key).toContain('success');
    expect(key).toContain('unknown');
    expect(key.endsWith('|1')).toBe(true);

    const coarse = __storageTestInternals.rollupEvents([
      {
        status: '' as any,
        file_type: '' as any,
        browser: '' as any,
        os: '' as any,
        ext_version: '' as any,
        duration_ms: undefined as any,
        bypass_used: false,
        language: '' as any,
        timestamp: undefined as any,
        id: 'bad-1',
      } as any,
    ], true);
    expect(coarse[0].browser).toBe('mixed');
    expect(coarse[0].os).toBe('mixed');
    expect(coarse[0].ext_version).toBe('mixed');
    expect(coarse[0].language).toBe('mixed');
    expect(typeof coarse[0].timestamp).toBe('number');

    const nonCoarse = __storageTestInternals.rollupEvents([
      {
        status: 'success',
        file_type: '' as any,
        browser: '' as any,
        os: '' as any,
        ext_version: '' as any,
        duration_ms: 20,
        bypass_used: undefined as any,
        language: '' as any,
        timestamp: 1000,
        id: 'bad-2',
      } as any,
    ], false);
    expect(nonCoarse[0].file_type).toBe('unknown');
    expect(nonCoarse[0].browser).toBe('unknown');
    expect(nonCoarse[0].os).toBe('unknown');
    expect(nonCoarse[0].ext_version).toBe('0.0.0');
    expect(nonCoarse[0].language).toBe('unknown');
    expect(nonCoarse[0].bypass_used).toBe(false);
  });

  it('normalizeConfig and migrateConfig cover branch defaults and version upgrades', () => {
    const normalized = __storageTestInternals.normalizeConfig({
      ...DEFAULT_CONFIG,
      flushMode: 'time_based',
      remoteEnabled: 'yes' as any,
      maxEventsPerRequest: null as any,
    });
    expect(normalized.flushMode).toBe('time_based');
    expect(normalized.remoteEnabled).toBe(DEFAULT_CONFIG.remoteEnabled);
    expect(normalized.maxEventsPerRequest).toBe(DEFAULT_CONFIG.maxEventsPerRequest);

    const migratedFromOld = __storageTestInternals.migrateConfig({
      ...DEFAULT_CONFIG,
      configVersion: 1,
    });
    expect(migratedFromOld.configVersion).toBe(DEFAULT_CONFIG.configVersion);

    const migratedFromInvalid = __storageTestInternals.migrateConfig('bad-shape');
    expect(migratedFromInvalid).toEqual(DEFAULT_CONFIG);
  });

  it('clampInt returns fallback for non-numeric values and clamps boundaries', () => {
    expect(__storageTestInternals.clampInt('bad', 1, 10, 7)).toBe(7);
    expect(__storageTestInternals.clampInt(-100, 1, 10, 7)).toBe(1);
    expect(__storageTestInternals.clampInt(999, 1, 10, 7)).toBe(10);
  });

  it('normalizeStats executes both null and populated branches', () => {
    const empty = normalizeStats(undefined);
    expect(empty.total).toBe(0);

    const full = normalizeStats({
      total: 9,
      byType: { pdf: 4 },
      success: 7,
      fail: 1,
      cancelled: 1,
      attempts: 9,
      bySpeed: { fast: 3, medium: 3, slow: 3 },
      bypassCount: 2,
      failByErrorType: { NETWORK: 1 },
      byLanguage: { en: 8, ar: 1 },
      lastUpdated: 99,
    });
    expect(full.total).toBe(9);
    expect(full.bySpeed?.medium).toBe(3);
    expect(full.failByErrorType?.NETWORK).toBe(1);
    expect(full.byLanguage?.ar).toBe(1);
    expect(full.lastUpdated).toBe(99);
  });

  it('loadQueueWithIntegrity uses in-memory fallback when persistent storage is unavailable', async () => {
    vi.spyOn(chrome.storage.local, 'set').mockImplementation((_items, cb) => {
      (chrome.runtime as any).lastError = { message: 'set-fail' };
      cb?.();
      (chrome.runtime as any).lastError = undefined;
    });
    await __storageTestInternals.saveQueueWithIntegrity([
      {
        status: 'success',
        file_type: 'pdf',
        browser: 'chrome',
        os: 'mac',
        ext_version: '1.0.0',
        duration_ms: 12,
        bypass_used: false,
        language: 'en',
        timestamp: 5000,
        id: 'mem-1',
      },
    ]);

    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_keys, cb) => {
      cb({});
    });
    const loaded = await __storageTestInternals.loadQueueWithIntegrity();
    expect(loaded.queue.map((ev) => ev.id)).toContain('mem-1');
    expect(loaded.valid).toBe(true);
  });

  it('loadQueue handles empty IndexedDB reads without crashing', async () => {
    const fakeDb = {
      transaction: () => ({
        objectStore: () => ({
          index: () => ({
            getAll: () => {
              const req: any = {};
              setTimeout(() => {
                req.result = undefined;
                req.onsuccess?.(new Event('success'));
              }, 0);
              return req;
            },
          }),
        }),
      }),
      close: vi.fn(),
    };
    const openReq: any = {};
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        openReq.result = fakeDb;
        openReq.onsuccess?.(new Event('success'));
      }, 0);
      return openReq;
    });

    const loaded = await loadQueue();
    expect(loaded.queue).toEqual([]);
    expect(loaded.valid).toBe(true);
  });
});
