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
});
