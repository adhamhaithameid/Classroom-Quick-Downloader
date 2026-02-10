import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAndIncrementRateLimit } from '../entrypoints/utils/analytics/rate-limiter';
import { MAX_DAILY_REQUESTS, STORAGE_KEYS } from '../entrypoints/utils/analytics/constants';

type StorageMap = Record<string, unknown>;

function installStorageMock(seed: StorageMap = {}): StorageMap {
  const storageData: StorageMap = { ...seed };
  vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: (result: StorageMap) => void) => {
    const list = Array.isArray(keys) ? keys : [keys];
    const result: StorageMap = {};
    for (const key of list) {
      if (typeof key === 'string') result[key] = storageData[key];
    }
    callback(result);
  });
  vi.spyOn(chrome.storage.local, 'set').mockImplementation((items: StorageMap, callback?: () => void) => {
    Object.assign(storageData, items);
    callback?.();
  });
  return storageData;
}

describe('analytics rate limiter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    installStorageMock();
  });

  it('resets for a new day and increments until limit is reached', async () => {
    vi.setSystemTime(new Date('2026-02-10T03:00:00.000Z'));
    const first = await checkAndIncrementRateLimit(3);
    const second = await checkAndIncrementRateLimit(3);
    const third = await checkAndIncrementRateLimit(3);
    const fourth = await checkAndIncrementRateLimit(3);

    expect(first).toEqual({ allowed: true, remaining: 2, isNewDay: true });
    expect(second).toEqual({ allowed: true, remaining: 1, isNewDay: false });
    expect(third).toEqual({ allowed: true, remaining: 0, isNewDay: false });
    expect(fourth).toEqual({ allowed: false, remaining: 0, isNewDay: false });
  });

  it('uses previous UTC date before 1:00 AM UTC', async () => {
    const storageData = installStorageMock();
    vi.setSystemTime(new Date('2026-02-10T00:30:00.000Z'));
    await checkAndIncrementRateLimit(2);
    const state = storageData[STORAGE_KEYS.RATE_LIMIT] as { date: string; count: number };
    expect(state.date).toBe('2026-02-09');
    expect(state.count).toBe(1);
  });

  it('falls back to default limit when maxDailyRequests is invalid', async () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
    const result = await checkAndIncrementRateLimit(Number.NaN);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_DAILY_REQUESTS - 1);
  });

  it('enforces minimum limit of one request per day', async () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
    const first = await checkAndIncrementRateLimit(0);
    const second = await checkAndIncrementRateLimit(0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);
    expect(second.allowed).toBe(false);
  });
});
