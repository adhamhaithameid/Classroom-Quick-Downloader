import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-persist-test',
    startTime: Date.now(),
    originalUrl: 'https://example.com/file.pdf',
    baseUrl: 'https://example.com/file.pdf',
    isDrive: false,
    attemptedAuthUsers: [],
    isCancelled: false,
    ...overrides,
  };
}

type StorageMap = Record<string, unknown>;

/** Callback-style chrome.storage.local mock (pattern: analytics-storage.test.ts). */
function installStorageMock(data: StorageMap = {}) {
  const calls = { get: 0, set: 0, failSet: false };
  const chromeAny = (globalThis as { chrome?: unknown }).chrome as Record<string, any>;
  if (!chromeAny) throw new Error('chrome global missing in test setup');
  vi.spyOn(chromeAny.storage.local, 'get').mockImplementation(
    (keys: any, callback: any) => {
      calls.get += 1;
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: StorageMap = {};
      for (const key of keyList) {
        if (typeof key === 'string' && key in data) result[key] = data[key];
      }
      callback(result);
    }
  );
  vi.spyOn(chromeAny.storage.local, 'set').mockImplementation(
    (items: any, callback?: any) => {
      calls.set += 1;
      if (calls.failSet) {
        chromeAny.runtime.lastError = { message: 'quota exceeded' };
        callback?.();
        chromeAny.runtime.lastError = undefined;
        return;
      }
      Object.assign(data, items);
      callback?.();
    }
  );
  return { data, calls };
}

/** Flush promise-chain microtasks (safe under global fake timers). */
async function flushMicro(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function loadPersistenceModule() {
  vi.resetModules();
  return import('../entrypoints/background/job-persistence');
}

describe('job persistence (bead 0h4d.1.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('createStoragePersistence upserts on register and bind, drops on unregister', async () => {
    const mod = await loadPersistenceModule();
    const { data, calls } = installStorageMock();
    const listener = mod.createStoragePersistence();

    const p = makePending({ requestId: 'req-1' });
    listener.onRegister?.(p);
    listener.onBind?.(makePending({ requestId: 'req-1', currentDownloadId: 7 }));
    await flushMicro();
    await flushMicro();
    let stored = data.cqd_pending_jobs_v1 as Record<string, PendingDownload>;
    expect(calls.set).toBe(2);
    expect(stored['req-1'].currentDownloadId).toBe(7);

    listener.onUnregister?.('req-1');
    await flushMicro();
    stored = data.cqd_pending_jobs_v1 as Record<string, PendingDownload>;
    expect(stored['req-1']).toBeUndefined();
  });

  it('storage set failures never throw (best-effort mirror)', async () => {
    const mod = await loadPersistenceModule();
    const { calls } = installStorageMock();
    calls.failSet = true;
    const listener = mod.createStoragePersistence();
    expect(() => listener.onRegister?.(makePending())).not.toThrow();
    await flushMicro();
    expect(calls.set).toBe(1);
  });

  it('registry listener hook: register/bind/unregister notify, throw-safe, detachable', async () => {
    vi.resetModules();
    const state = await import('../entrypoints/background/state');
    const events: string[] = [];
    state.setRegistryListener({
      onRegister: () => events.push('register'),
      onBind: () => events.push('bind'),
      onUnregister: () => {
        events.push('unregister');
        throw new Error('listener boom');
      },
    });

    const p = makePending({ requestId: 'req-hook' });
    state.registerPending(p);
    expect(state.bindDownloadId(p, 42)).toBe(true);
    state.unregisterPending(p);
    expect(events).toEqual(['register', 'bind', 'unregister']);
    // throwing listener must not have broken registry cleanup
    expect(state.isRegistered('req-hook')).toBe(false);

    state.setRegistryListener(null);
    const p2 = makePending({ requestId: 'req-hook-2' });
    expect(() => state.registerPending(p2)).not.toThrow();
    state.unregisterPending(p2);
    expect(events).toEqual(['register', 'bind', 'unregister']);
  });

  it('reconcile: in-progress download is rebound into the registry', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-live': makePending({ requestId: 'req-live', currentDownloadId: 11 }),
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 11, state: 'in_progress' }]));
    const result = await mod.reconcilePersistedJobs({ search });
    expect(result).toEqual({ rebound: 1, dropped: 0 });

    // same module instance as the persistence module (no resetModules):
    const state = await import('../entrypoints/background/state');
    expect(state.getPendingByRequestId('req-live')).toBeDefined();
    expect(state.getPendingByDownloadId(11)?.requestId).toBe('req-live');
    state.unregisterPending(state.getPendingByRequestId('req-live')!);
  });

  it('reconcile: interrupted, never-started, stale, and malformed records drop', async () => {
    const mod = await loadPersistenceModule();
    const now = Date.now();
    const { data } = installStorageMock({
      cqd_pending_jobs_v1: {
        'req-interrupted': makePending({ requestId: 'req-interrupted', currentDownloadId: 21, startTime: now }),
        'req-nostart': makePending({ requestId: 'req-nostart', startTime: now }),
        'req-stale': makePending({ requestId: 'req-stale', currentDownloadId: 22, startTime: now - 11 * 60 * 1000 }),
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 21, state: 'interrupted' }]));
    const result = await mod.reconcilePersistedJobs({ search, now: () => now });
    expect(result).toEqual({ rebound: 0, dropped: 3 });
    expect(Object.keys(data.cqd_pending_jobs_v1 as object)).toHaveLength(0);
  });

  it('reconcile: missing download (browser lost it) drops the record', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-gone': makePending({ requestId: 'req-gone', currentDownloadId: 99 }),
      },
    });
    const search = vi.fn((_q, cb) => cb([]));
    const result = await mod.reconcilePersistedJobs({ search });
    expect(result).toEqual({ rebound: 0, dropped: 1 });
  });

  it('reconcile: empty storage is a clean no-op and never throws', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock();
    await expect(mod.reconcilePersistedJobs({ search: vi.fn() })).resolves.toEqual({
      rebound: 0,
      dropped: 0,
    });
  });

  // --- real-life edge cases ---

  it('reconcile: corrupt record shapes drop without throwing', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-ok': makePending({ requestId: 'req-ok', currentDownloadId: 31 }),
        garbage: 'not-an-object',
        stale: 42,
        broken: null,
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 31, state: 'in_progress' }]));
    const result = await mod.reconcilePersistedJobs({ search });
    expect(result).toEqual({ rebound: 1, dropped: 3 });
  });

  it('reconcile: concurrent same-URL jobs all rebound (parallel downloads)', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-a': makePending({ requestId: 'req-a', currentDownloadId: 41, baseUrl: 'https://x/f.pdf' }),
        'req-b': makePending({ requestId: 'req-b', currentDownloadId: 42, baseUrl: 'https://x/f.pdf' }),
      },
    });
    const search = vi.fn((_q, cb) =>
      cb([
        { id: 41, state: 'in_progress' },
        { id: 42, state: 'in_progress' },
      ])
    );
    const result = await mod.reconcilePersistedJobs({ search });
    expect(result).toEqual({ rebound: 2, dropped: 0 });

    const state = await import('../entrypoints/background/state');
    expect(state.getPendingByDownloadId(41)?.requestId).toBe('req-a');
    expect(state.getPendingByDownloadId(42)?.requestId).toBe('req-b');
    expect(state.getUnclaimedPendingByUrl('https://x/f.pdf')).toBeUndefined();
    for (const p of [state.getPendingByRequestId('req-a')!, state.getPendingByRequestId('req-b')!]) {
      state.unregisterPending(p);
    }
  });

  it('reconcile: authuser sweep state survives a restart (no infinite re-sweep)', async () => {
    const mod = await loadPersistenceModule();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-sweep': makePending({
          requestId: 'req-sweep',
          currentDownloadId: 51,
          attemptedAuthUsers: [0, 1, 2],
          currentAuthUser: 3,
          initialAuthUser: 0,
        }),
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 51, state: 'in_progress' }]));
    await mod.reconcilePersistedJobs({ search });

    const state = await import('../entrypoints/background/state');
    const rebound = state.getPendingByRequestId('req-sweep')!;
    expect(rebound.attemptedAuthUsers).toEqual([0, 1, 2]);
    expect(rebound.currentAuthUser).toBe(3);
    state.unregisterPending(rebound);
  });

  it('reconcile: TTL boundary is exclusive (age == TTL still reconciles, +1ms drops)', async () => {
    const mod = await loadPersistenceModule();
    const now = Date.now();
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-edge': makePending({ requestId: 'req-edge', currentDownloadId: 61, startTime: now - (10 * 60 * 1000) }),
        'req-over': makePending({ requestId: 'req-over', currentDownloadId: 62, startTime: now - (10 * 60 * 1000 + 1) }),
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 61, state: 'in_progress' }]));
    const result = await mod.reconcilePersistedJobs({ search, now: () => now });
    expect(result).toEqual({ rebound: 1, dropped: 1 });
  });

  it('reconcile: stall deadline re-arms after rebind (restart at 140s still times out at 150s)', async () => {
    vi.useFakeTimers();
    const mod = await loadPersistenceModule();
    const state = await import('../entrypoints/background/state');
    installStorageMock({
      cqd_pending_jobs_v1: {
        'req-stall': makePending({ requestId: 'req-stall', currentDownloadId: 71, startTime: Date.now() }),
      },
    });
    const search = vi.fn((_q, cb) => cb([{ id: 71, state: 'in_progress' }]));
    await mod.reconcilePersistedJobs({ search });

    const expired: string[] = [];
    state.setPendingExpiredHook((p) => expired.push(p.requestId));
    try {
      await vi.advanceTimersByTimeAsync(150_000);
      expect(expired).toContain('req-stall');
    } finally {
      state.setPendingExpiredHook(null);
      const p = state.getPendingByRequestId('req-stall');
      if (p) state.unregisterPending(p);
    }
  });

  it('reconcile: storage write failure at the end still resolves honestly', async () => {
    const mod = await loadPersistenceModule();
    const { calls } = installStorageMock({
      cqd_pending_jobs_v1: {
        'req-x': makePending({ requestId: 'req-x', startTime: 0 }),
      },
    });
    calls.failSet = true;
    await expect(mod.reconcilePersistedJobs({ search: vi.fn() })).resolves.toEqual({
      rebound: 0,
      dropped: 1,
    });
  });

  it('reconcile: large mixed batch counts exactly', async () => {
    const mod = await loadPersistenceModule();
    const now = Date.now();
    const jobs: Record<string, PendingDownload> = {};
    for (let i = 0; i < 30; i += 1) {
      jobs[`live-${i}`] = makePending({ requestId: `live-${i}`, currentDownloadId: 100 + i, startTime: now });
    }
    for (let i = 0; i < 20; i += 1) {
      jobs[`dead-${i}`] = makePending({ requestId: `dead-${i}`, startTime: now - 11 * 60 * 1000 });
    }
    installStorageMock({ cqd_pending_jobs_v1: jobs });
    const search = vi.fn((_q, cb) =>
      cb(Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, state: 'in_progress' })))
    );
    const result = await mod.reconcilePersistedJobs({ search, now: () => now });
    expect(result).toEqual({ rebound: 30, dropped: 20 });
  });

  it('wiring: live state registry mirrors through the real listener', async () => {
    const mod = await loadPersistenceModule();
    const state = await import('../entrypoints/background/state');
    const { data } = installStorageMock();
    state.setRegistryListener(mod.createStoragePersistence());

    const p = makePending({ requestId: 'req-live-wire' });
    state.registerPending(p);
    await flushMicro();
    expect((data.cqd_pending_jobs_v1 as Record<string, unknown>)['req-live-wire']).toBeDefined();

    state.bindDownloadId(p, 91);
    await flushMicro();
    expect(((data.cqd_pending_jobs_v1 as Record<string, PendingDownload>)['req-live-wire']).currentDownloadId).toBe(91);

    state.unregisterPending(p);
    await flushMicro();
    expect((data.cqd_pending_jobs_v1 as Record<string, unknown>)['req-live-wire']).toBeUndefined();
    state.setRegistryListener(null);
  });
});
