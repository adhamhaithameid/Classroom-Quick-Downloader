import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {
  __resetStorageForTests,
  compactQueueForBudget,
  loadConfig,
  loadMeta,
  loadQueue,
  loadStats,
  normalizeStats,
  saveConfig,
  saveMeta,
  saveQueue,
  saveStats,
  storageGet,
  storageSet,
} from '../entrypoints/utils/analytics/storage';
import { DEFAULT_CONFIG, DEFAULT_META, STORAGE_KEYS } from '../entrypoints/utils/analytics/constants';
import type { AnalyticsEvent } from '../entrypoints/utils/analytics/types';

let seq = 0;

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  seq += 1;
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'mac',
    ext_version: '1.0.0',
    duration_ms: 120,
    bypass_used: false,
    language: 'en',
    timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) + seq * 1000,
    id: `ext-${seq}`,
    ...overrides,
  };
}

function computeChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(36);
}

async function resetIdb(): Promise<void> {
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const fallback = setTimeout(() => finish(), 200);
    const req = indexedDB.deleteDatabase('cqd_analytics_db_v1');
    req.onsuccess = () => {
      clearTimeout(fallback);
      finish();
    };
    req.onerror = () => {
      clearTimeout(fallback);
      finish();
    };
    req.onblocked = () => {
      clearTimeout(fallback);
      finish();
    };
  });
}

type StorageMap = Record<string, unknown>;

function installStorageMock(seed: StorageMap = {}, opts: { failSet?: boolean } = {}): StorageMap {
  const storageData: StorageMap = { ...seed };
  const failSet = opts.failSet === true;
  vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: (result: StorageMap) => void) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: StorageMap = {};
    for (const key of keyList) {
      if (typeof key === 'string') {
        result[key] = storageData[key];
      }
    }
    callback(result);
  });
  vi.spyOn(chrome.storage.local, 'set').mockImplementation((items: Record<string, unknown>, callback?: () => void) => {
    if (failSet) {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'quota exceeded' };
      callback?.();
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
      return;
    }
    Object.assign(storageData, items);
    callback?.();
  });
  return storageData;
}

beforeAll(() => {
  vi.useRealTimers();
});

afterAll(() => {
  vi.useFakeTimers();
});

beforeEach(async () => {
  seq = 0;
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await __resetStorageForTests();
  await resetIdb();
  installStorageMock();
});

describe('analytics storage', () => {
  it('returns empty queue when no storage exists', async () => {
    const loaded = await loadQueue();
    expect(loaded.queue).toEqual([]);
    expect(loaded.valid).toBe(true);
  });

  it('migrates legacy storage queue into IndexedDB and clears legacy queue', async () => {
    const queue = [makeEvent({ id: 'legacy-1' }), makeEvent({ id: 'legacy-2' })];
    const raw = JSON.stringify(queue);
    const storageData = installStorageMock({
      [STORAGE_KEYS.QUEUE]: queue,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(raw),
    });

    const loaded = await loadQueue();
    expect(loaded.queue).toHaveLength(2);
    expect(storageData[STORAGE_KEYS.QUEUE]).toEqual([]);
    expect(storageData[STORAGE_KEYS.QUEUE_MIGRATED]).toBe(true);

    const loadedFromIdb = await loadQueue();
    expect(loadedFromIdb.queue.map((ev) => ev.id)).toEqual(['legacy-1', 'legacy-2']);
  });

  it('falls back to saving legacy queue when migration clear fails', async () => {
    const queue = [makeEvent({ id: 'legacy-fallback-1' }), makeEvent({ id: 'legacy-fallback-2' })];
    const raw = JSON.stringify(queue);
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: queue,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(raw),
    }, { failSet: true });

    const loaded = await loadQueue();
    expect(typeof loaded.valid).toBe('boolean');
    expect(loaded.queue.map((ev) => ev.id)).toEqual(['legacy-fallback-1', 'legacy-fallback-2']);
  });

  it('prefers non-empty IndexedDB queue over legacy storage queue', async () => {
    await saveQueue([makeEvent({ id: 'idb-first' })]);
    const legacy = [makeEvent({ id: 'legacy-only' })];
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: legacy,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(JSON.stringify(legacy)),
    });

    const loaded = await loadQueue();
    expect(loaded.queue).toHaveLength(1);
    expect(loaded.queue[0].id).toBe('idb-first');
  });

  it('treats empty IndexedDB queue as authoritative after migration', async () => {
    const staleLegacy = [makeEvent({ id: 'legacy-stale' })];
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: staleLegacy,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(JSON.stringify(staleLegacy)),
      [STORAGE_KEYS.QUEUE_MIGRATED]: true,
    });

    const loaded = await loadQueue();
    expect(loaded.queue).toEqual([]);
    expect(loaded.valid).toBe(true);
  });

  it('keeps authoritative queue in IndexedDB when legacy clear fails', async () => {
    installStorageMock({}, { failSet: true });
    await saveQueue([makeEvent({ id: 'idb-authoritative' })]);

    const loaded = await loadQueue();
    expect(loaded.queue).toHaveLength(1);
    expect(loaded.queue[0].id).toBe('idb-authoritative');
  });

  it('falls back to legacy storage when IndexedDB open fails', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('indexeddb disabled');
    });
    const storageData = installStorageMock();

    const queue = [makeEvent({ id: 'fallback-1' })];
    await saveQueue(queue);
    expect(Array.isArray(storageData[STORAGE_KEYS.QUEUE])).toBe(true);

    const loaded = await loadQueue();
    expect(loaded.queue.map((ev) => ev.id)).toEqual(['fallback-1']);
  });

  it('keeps in-memory queue when legacy storage set fails', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('indexeddb disabled');
    });
    installStorageMock({}, { failSet: true });

    const queue = [makeEvent({ id: 'memory-only' })];
    await saveQueue(queue);

    const loaded = await loadQueue();
    expect(loaded.queue).toHaveLength(1);
    expect(loaded.queue[0].id).toBe('memory-only');
  });

  it('sanitizes malformed queue events and reports invalid queue state', async () => {
    const malformed = [
      null,
      { foo: 'bar' },
      makeEvent({ id: 'valid-1' }),
      {
        ...makeEvent({ id: 'broken-2' }),
        status: 'unexpected',
        timestamp: -1,
        duration_ms: -500,
        count: -2,
      },
    ];
    const raw = JSON.stringify(malformed);
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: malformed,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(raw),
    });

    const loaded = await loadQueue();
    expect(loaded.valid).toBe(false);
    expect(loaded.queue).toHaveLength(3);
    expect(loaded.queue.some((ev) => ev.id === 'valid-1')).toBe(true);
    const normalizedMalformed = loaded.queue.find((ev) => ev.id === 'broken-2');
    expect(normalizedMalformed?.status).toBe('success');
    expect(normalizedMalformed?.duration_ms).toBe(0);
    expect(normalizedMalformed?.count).toBeUndefined();
    expect(loaded.queue.some((ev) => ev.file_type === 'unknown')).toBe(true);
  });

  it('returns queue on checksum mismatch without dropping data', async () => {
    const queue = [makeEvent({ id: 'tampered-1' }), makeEvent({ id: 'tampered-2' })];
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: queue,
      [STORAGE_KEYS.INTEGRITY]: 'bad-checksum',
    });

    const loaded = await loadQueue();
    expect(loaded.valid).toBe(false);
    expect(loaded.queue).toHaveLength(2);
    expect(loaded.queue[0].id).toBe('tampered-1');
  });

  it('assigns IDs to events missing IDs and sorts by timestamp when saving', async () => {
    const queue = [
      makeEvent({ id: undefined, timestamp: Date.UTC(2026, 1, 8, 5, 0, 0) }),
      makeEvent({ id: undefined, timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) }),
    ];
    await saveQueue(queue);

    const loaded = await loadQueue();
    expect(loaded.queue).toHaveLength(2);
    expect(loaded.queue[0].timestamp).toBeLessThan(loaded.queue[1].timestamp);
    expect(loaded.queue.every((ev) => typeof ev.id === 'string' && ev.id.length > 5)).toBe(true);
  });

  it('compacts queue above budget and generates rollups', () => {
    const queue: AnalyticsEvent[] = [];
    for (let i = 0; i < 600; i++) {
      queue.push(makeEvent({
        id: `ev-${i}`,
        timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) + i * 1000,
      }));
    }
    const result = compactQueueForBudget(queue);
    expect(result.compacted).toBe(true);
    expect(result.queue.length).toBeLessThanOrEqual(500);
    expect(result.queue.some((ev) => (ev.count ?? 1) > 1)).toBe(true);
  });

  it('keeps commit-sequenced events during compaction', () => {
    const queue: AnalyticsEvent[] = [];
    for (let i = 0; i < 520; i++) {
      queue.push(makeEvent({
        id: `ev-${i}`,
        timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) + i * 1000,
      }));
    }
    queue.push(makeEvent({ id: 'committed-1', commitSeq: 10 }));
    queue.push(makeEvent({ id: 'committed-2', commitSeq: 11 }));

    const result = compactQueueForBudget(queue);
    const ids = new Set(result.queue.map((ev) => ev.id));
    expect(ids.has('committed-1')).toBe(true);
    expect(ids.has('committed-2')).toBe(true);
  });

  it('rolls up weighted counts when compacting', () => {
    const queue: AnalyticsEvent[] = [];
    for (let i = 0; i < 510; i++) {
      queue.push(makeEvent({
        id: `weighted-${i}`,
        timestamp: Date.UTC(2026, 1, 8, 2, 0, 0) + i * 1000,
        count: i % 2 === 0 ? 2 : 1,
      }));
    }
    const result = compactQueueForBudget(queue);
    const rollup = result.queue.find((ev) => ev.rollup && (ev.count ?? 1) > 1);
    expect(rollup).toBeDefined();
  });

  it('loadConfig returns defaults when config is missing', async () => {
    const cfg = await loadConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('loadConfig migrates and clamps invalid config values', async () => {
    installStorageMock({
      [STORAGE_KEYS.CONFIG]: {
        configVersion: 1,
        batchSize: -5,
        maxDailyRequests: 100000,
        maxRetry: -1,
        flushMode: 'invalid',
        dailyFlushWindowStartUtc: 99,
        dailyFlushWindowMinutes: 99999,
        maxEventsPerRequest: 0,
      },
    });
    const cfg = await loadConfig();
    expect(cfg.configVersion).toBe(DEFAULT_CONFIG.configVersion);
    expect(cfg.batchSize).toBe(1);
    expect(cfg.maxDailyRequests).toBe(1000);
    expect(cfg.maxRetry).toBe(0);
    expect(cfg.flushMode).toBe('next_day');
    expect(cfg.dailyFlushWindowStartUtc).toBe(23);
    expect(cfg.dailyFlushWindowMinutes).toBe(24 * 60);
    expect(cfg.maxEventsPerRequest).toBe(1);
  });

  it('saveConfig persists normalized values', async () => {
    const storageData = installStorageMock();
    await saveConfig({
      ...DEFAULT_CONFIG,
      batchSize: 9999,
      maxRetry: 99,
      dailyFlushWindowStartUtc: -5,
    });
    const stored = storageData[STORAGE_KEYS.CONFIG] as typeof DEFAULT_CONFIG;
    expect(stored.batchSize).toBe(1000);
    expect(stored.maxRetry).toBe(20);
    expect(stored.dailyFlushWindowStartUtc).toBe(0);
  });

  it('loadMeta returns defaults and saveMeta persists metadata', async () => {
    const storageData = installStorageMock();
    expect(await loadMeta()).toEqual(DEFAULT_META);
    await saveMeta({
      ...DEFAULT_META,
      lastFlushAt: Date.now(),
      lastDailyFlushUtcDate: '2026-02-10',
    });
    expect(storageData[STORAGE_KEYS.META]).toEqual(expect.objectContaining({
      lastDailyFlushUtcDate: '2026-02-10',
    }));
  });

  it('normalizeStats fills missing fields safely', () => {
    const stats = normalizeStats({
      total: 3,
      byType: { pdf: 2 },
      bySpeed: { fast: 1 },
      byLanguage: { en: 1 },
    });
    expect(stats.total).toBe(3);
    expect(stats.byType.pdf).toBe(2);
    expect(stats.bySpeed?.fast).toBe(1);
    expect(stats.bySpeed?.medium).toBe(0);
    expect(stats.bySpeed?.slow).toBe(0);
    expect(stats.byLanguage?.en).toBe(1);
  });

  it('normalizeStats maps all persisted stat buckets when provided', () => {
    const stats = normalizeStats({
      total: 10,
      byType: { pdf: 5, doc: 5 },
      success: 8,
      fail: 1,
      cancelled: 1,
      attempts: 10,
      bySpeed: { fast: 3, medium: 4, slow: 3 },
      bypassCount: 2,
      failByErrorType: { NETWORK: 1 },
      byLanguage: { en: 9, ar: 1 },
      lastUpdated: 123456,
    });
    expect(stats.total).toBe(10);
    expect(stats.success).toBe(8);
    expect(stats.fail).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.attempts).toBe(10);
    expect(stats.bySpeed).toEqual({ fast: 3, medium: 4, slow: 3 });
    expect(stats.bypassCount).toBe(2);
    expect(stats.failByErrorType).toEqual({ NETWORK: 1 });
    expect(stats.byLanguage).toEqual({ en: 9, ar: 1 });
    expect(stats.lastUpdated).toBe(123456);
  });

  it('loadStats/saveStats roundtrip through storage', async () => {
    const storageData = installStorageMock();
    await saveStats({
      total: 8,
      byType: { pdf: 8 },
      success: 7,
      fail: 1,
      cancelled: 0,
      attempts: 8,
      bySpeed: { fast: 6, medium: 2, slow: 0 },
      bypassCount: 1,
      failByErrorType: { NETWORK: 1 },
      byLanguage: { en: 8 },
      lastUpdated: Date.now(),
    });
    expect(storageData[STORAGE_KEYS.STATS]).toBeTruthy();
    const loaded = await loadStats();
    expect(loaded.total).toBe(8);
    expect(loaded.success).toBe(7);
    expect(loaded.failByErrorType?.NETWORK).toBe(1);
  });

  it('storageGet/storageSet handle runtime errors gracefully', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_keys: any, cb: (result: Record<string, unknown>) => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'read-fail' };
      cb({});
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
    });
    vi.spyOn(chrome.storage.local, 'set').mockImplementation((_items: Record<string, unknown>, cb?: () => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'write-fail' };
      cb?.();
      (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
    });
    expect(await storageGet('any-key')).toBeUndefined();
    expect(await storageSet({ a: 1 })).toBe(false);
  });

  it('storageGet/storageSet handle synchronous throw paths', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(() => {
      throw new Error('sync-get-fail');
    });
    vi.spyOn(chrome.storage.local, 'set').mockImplementation(() => {
      throw new Error('sync-set-fail');
    });
    expect(await storageGet('k')).toBeUndefined();
    expect(await storageSet({ k: 1 })).toBe(false);
  });

  it('loadMeta merges partial metadata from storage', async () => {
    installStorageMock({
      [STORAGE_KEYS.META]: { lastFlushAt: 1234 },
    });
    const meta = await loadMeta();
    expect(meta.lastFlushAt).toBe(1234);
    expect(meta.backoffIndex).toBe(DEFAULT_META.backoffIndex);
  });

  it('normalizeStats returns safe defaults for nullish input', () => {
    const stats = normalizeStats(undefined);
    expect(stats.total).toBe(0);
    expect(stats.lastUpdated).toBeTypeOf('number');
  });

  it('compactQueueForBudget no-ops when all events are commit-protected', () => {
    const queue = Array.from({ length: 510 }, (_, i) =>
      makeEvent({ id: `protected-${i}`, commitSeq: i + 1 }),
    );
    const result = compactQueueForBudget(queue);
    expect(result.compacted).toBe(false);
    expect(result.queue.length).toBe(510);
  });

  it('compactQueueForBudget hits coarse rollup fallback when protected events exceed budget', () => {
    const protectedEvents = Array.from({ length: 520 }, (_, i) =>
      makeEvent({ id: `p-${i}`, commitSeq: i + 1, timestamp: Date.UTC(2026, 1, 8, 6, 0, 0) + i }),
    );
    const compactable = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ id: `c-${i}`, timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) - i * 1000 }),
    );
    const result = compactQueueForBudget([...protectedEvents, ...compactable]);
    expect(result.compacted).toBe(true);
    expect(result.queue.some((ev) => ev.rollup)).toBe(true);
  });

  it('loadConfig keeps already-current configVersion values', async () => {
    installStorageMock({
      [STORAGE_KEYS.CONFIG]: {
        ...DEFAULT_CONFIG,
        configVersion: DEFAULT_CONFIG.configVersion,
        batchSize: 55,
      },
    });
    const cfg = await loadConfig();
    expect(cfg.configVersion).toBe(DEFAULT_CONFIG.configVersion);
    expect(cfg.batchSize).toBe(55);
  });

  it('loadQueue handles non-array legacy queue values safely', async () => {
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: { bad: 'shape' },
      [STORAGE_KEYS.INTEGRITY]: 'abc',
    });
    const loaded = await loadQueue();
    expect(loaded.queue).toEqual([]);
    expect(loaded.valid).toBe(true);
  });

  it('falls back when indexedDB open request emits onerror', async () => {
    const storageData = installStorageMock();
    const fakeReq: any = {};
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        fakeReq.error = new Error('idb-open-error');
        fakeReq.onerror?.(new Event('error'));
      }, 0);
      return fakeReq;
    });

    const loaded = await loadQueue();
    expect(loaded.queue).toEqual([]);

    // Subsequent save should use legacy storage fallback after IDB disable.
    await saveQueue([makeEvent({ id: 'legacy-after-open-error' })]);
    expect(Array.isArray(storageData[STORAGE_KEYS.QUEUE])).toBe(true);
  });

  it('falls back to legacy queue when indexedDB read request fails', async () => {
    const queue = [makeEvent({ id: 'legacy-read-fallback' })];
    installStorageMock({
      [STORAGE_KEYS.QUEUE]: queue,
      [STORAGE_KEYS.INTEGRITY]: computeChecksum(JSON.stringify(queue)),
    });

    const fakeDb = {
      transaction: () => ({
        objectStore: () => ({
          index: () => ({
            getAll: () => {
              const req: any = {};
              setTimeout(() => {
                req.error = new Error('idb-read-error');
                req.onerror?.(new Event('error'));
              }, 0);
              return req;
            },
          }),
        }),
      }),
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
    expect(loaded.queue.map((ev) => ev.id)).toContain('legacy-read-fallback');
  });

  it('saveQueue falls back when indexedDB write transaction fails', async () => {
    const storageData = installStorageMock();
    const fakeDb = {
      transaction: () => {
        const tx: any = {
          objectStore: () => ({
            clear: () => {
              const req: any = {};
              setTimeout(() => {
                req.error = new Error('idb-clear-error');
                req.onerror?.(new Event('error'));
              }, 0);
              return req;
            },
            put: vi.fn(),
          }),
        };
        return tx;
      },
    };
    const openReq: any = {};
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        openReq.result = fakeDb;
        openReq.onsuccess?.(new Event('success'));
      }, 0);
      return openReq;
    });

    await saveQueue([makeEvent({ id: 'fallback-write' })]);
    const saved = storageData[STORAGE_KEYS.QUEUE] as AnalyticsEvent[];
    expect(saved.map((ev) => ev.id)).toContain('fallback-write');
  });
});
