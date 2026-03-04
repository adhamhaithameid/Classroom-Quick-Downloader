import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadsDurable } from '../../cloudflare-worker/src/downloads_do';

type StorageMap = Record<string, unknown>;

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(ts: number): Promise<void> {
    this.alarm = ts;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise.catch(() => {}));
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
    this.pending = [];
  }
}

function installChromeStorage(seed: StorageMap = {}): StorageMap {
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

async function buildIntegrationContext() {
  vi.resetModules();
  let oracleChangelogPayload: Record<string, unknown> = {
    ok: true,
    entries: [],
    config: { rules: [] },
    meta: { contentChecksum: 'empty' },
  };
  vi.doMock('../entrypoints/utils/analytics/constants', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../entrypoints/utils/analytics/constants');
    return {
      ...actual,
      WORKER_BASE_URL: 'https://worker.test',
      TRACK_URL: 'https://worker.test/track',
      CONFIG_URL: 'https://worker.test/config',
      ORACLE_CHANGELOG_URL: 'https://oracle.test/api/public/extension/changelog',
    };
  });

  const state = new MockState();
  const env = {
    ORACLE_ENDPOINT: 'http://oracle.invalid',
    DO_SHARED_SECRET: 'secret',
    MAX_BATCH_EVENTS: '10000',
  } as any;
  const durable = new DownloadsDurable(state as any, env);

  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = input instanceof Request
      ? input.url
      : typeof input === 'string'
        ? input
        : input.toString();
    const requestMethod = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const requestHeaders = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const requestBody = typeof init?.body === 'string'
      ? init.body
      : input instanceof Request
        ? await input.text()
        : undefined;
    const url = new URL(requestUrl);
    if (url.pathname === '/track') {
      return durable.fetch(new Request('https://do/track', {
        method: requestMethod,
        headers: requestHeaders,
        body: requestBody,
      }));
    }
    if (url.pathname === '/config') {
      return durable.fetch(new Request('https://do/config', {
        method: 'GET',
      }));
    }
    if (url.pathname === '/api/public/extension/changelog') {
      return new Response(JSON.stringify(oracleChangelogPayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: '"oracle-etag"',
        },
      });
    }
    throw new Error(`Unexpected integration fetch URL: ${requestUrl}`);
  });
  vi.stubGlobal('fetch', fetchSpy);

  const storage = await import('../entrypoints/utils/analytics/storage');
  const flush = await import('../entrypoints/utils/analytics/flush');
  const analytics = await import('../entrypoints/utils/analytics/index');
  const changelog = await import('../entrypoints/utils/changelog');

  const setOracleChangelogPayload = (payload: Record<string, unknown>) => {
    oracleChangelogPayload = payload;
  };
  return { durable, state, fetchSpy, storage, flush, analytics, changelog, setOracleChangelogPayload };
}

describe('extension <-> cloudflare integration', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    installChromeStorage();
  });

  it('flushes extension queue into cloudflare DO /track and marks events as commit-sequenced', async () => {
    const { durable, storage, flush, fetchSpy } = await buildIntegrationContext();

    await storage.saveConfig({
      configVersion: 2,
      batchSize: 2,
      maxDailyRequests: 50,
      maxRetry: 3,
      flushMode: 'next_day',
      lowUsageFlushMinutes: 1440,
      midUsageFlushMinutes: 1440,
      highUsageFlushMinutes: 1440,
      remoteEnabled: true,
      cancelHoldDelayMs: 1000,
      dailyFlushWindowStartUtc: 1,
      dailyFlushWindowMinutes: 120,
      maxEventsPerRequest: 5000,
    });
    await storage.saveMeta({
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      dailyFlushOffsetMinutes: 0,
      lastDailyFlushUtcDate: null,
      lastKnownUtcMs: null,
      lastPerfMs: null,
      serverTimeOffsetMs: 0,
      lastCommittedSeq: null,
    });
    await storage.saveQueue([
      {
        // DO requires IDs with minimum length to guarantee idempotency keys.
        id: 'it-000001',
        status: 'success',
        file_type: 'pdf',
        browser: 'chrome',
        os: 'mac',
        ext_version: '1.3.0',
        duration_ms: 100,
        bypass_used: false,
        language: 'en',
        timestamp: Date.now() - 60_000,
      },
      {
        id: 'it-000002',
        status: 'fail',
        file_type: 'doc',
        browser: 'chrome',
        os: 'mac',
        ext_version: '1.3.0',
        duration_ms: 500,
        bypass_used: false,
        language: 'en',
        error_type: 'NETWORK',
        timestamp: Date.now() - 59_000,
      },
    ]);

    await flush.internalFlush();
    const queueAfter = await storage.loadQueue();
    // Extension keeps acknowledged events until committedSeq advances from Oracle.
    expect(queueAfter.queue).toHaveLength(2);
    expect(queueAfter.queue.every((ev) => typeof ev.commitSeq === 'number')).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();

    const statsRes = await durable.fetch(new Request('https://do/stats', { method: 'GET' }));
    const stats = await statsRes.json() as { totalEvents: number; totalFail: number };
    expect(stats.totalEvents).toBeGreaterThanOrEqual(2);
    expect(stats.totalFail).toBeGreaterThanOrEqual(1);

    const callsBeforeSecondFlush = fetchSpy.mock.calls.length;
    await flush.internalFlush();
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeSecondFlush);
  });

  it('pulls /config from cloudflare DO and applies remote settings in extension storage', async () => {
    const { durable, storage, analytics, fetchSpy } = await buildIntegrationContext();

    const adminRes = await durable.fetch(new Request('https://do/admin/update-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': 'secret',
      },
      body: JSON.stringify({
        batchSize: 77,
        maxDailyRequests: 123,
        maxRetry: 9,
        flushMode: 'time_based',
        timeFlushMinutes: { low: 30, mid: 60, high: 120 },
        dailyFlushWindowStartUtc: 2,
        dailyFlushWindowMinutes: 180,
        maxEventsPerRequest: 321,
        cancelHoldDelayMs: 2500,
        remoteEnabled: true,
      }),
    }));
    expect(adminRes.status).toBe(200);

    await analytics.refreshRemoteAnalyticsConfig();

    const cfg = await storage.loadConfig();
    const meta = await storage.loadMeta();

    expect(cfg.batchSize).toBe(77);
    expect(cfg.maxDailyRequests).toBe(123);
    expect(cfg.maxRetry).toBe(9);
    expect(cfg.flushMode).toBe('time_based');
    expect(cfg.lowUsageFlushMinutes).toBe(30);
    expect(cfg.midUsageFlushMinutes).toBe(60);
    expect(cfg.highUsageFlushMinutes).toBe(120);
    expect(cfg.dailyFlushWindowStartUtc).toBe(2);
    expect(cfg.dailyFlushWindowMinutes).toBe(180);
    expect(cfg.maxEventsPerRequest).toBe(321);
    expect(cfg.cancelHoldDelayMs).toBe(2500);
    expect(typeof meta.serverTimeOffsetMs).toBe('number');
    expect((meta.lastCommittedSeq ?? 0) >= 0).toBe(true);

    expect(fetchSpy).toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/config');
  });

  it('loads manual changelog data, applies notification rules, and keeps revision-aware seen state', async () => {
    const { changelog, fetchSpy } = await buildIntegrationContext();

    const data = await changelog.fetchChangelog(true);
    expect(data?.entries.length).toBeGreaterThan(0);
    expect(data?.entries[0]?.version).toBe('1.3.9');
    expect(data?.entries[0]?.changes[0]).toContain('Summary:');
    expect(data?.revisionToken).toBeTruthy();

    const rule = changelog.getMatchingRule(data?.config, '1.3.8');
    expect(rule?.priority).toBe('major');
    expect(rule?.effect).toBe('pulse');
    expect(changelog.getRuleClasses(rule, false)).toContain('cqd-pill-major');
    await changelog.markAsSeen('1.3.8', data);
    expect(await changelog.isVersionSeen('1.3.8', data)).toBe(true);

    const updated = await changelog.fetchChangelog(true);
    expect(updated?.revisionToken).toBeTruthy();
    expect(updated?.revisionToken).not.toBe(data?.revisionToken);
    expect(updated?.entries[0]?.changes[0]).toContain('Updated payload for same version');
    expect(await changelog.isVersionSeen('1.3.8', updated)).toBe(false);

    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes('/changelog'))).toBe(true);
  });
});
