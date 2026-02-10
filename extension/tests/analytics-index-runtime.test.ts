import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsConfig, AnalyticsEvent, AnalyticsMeta } from '../entrypoints/utils/analytics/types';

type RuntimeState = {
  queue: AnalyticsEvent[];
  cfg: AnalyticsConfig;
  meta: AnalyticsMeta;
};

function baseConfig(): AnalyticsConfig {
  return {
    configVersion: 2,
    batchSize: 2,
    maxDailyRequests: 50,
    maxRetry: 5,
    flushMode: 'next_day',
    lowUsageFlushMinutes: 1440,
    midUsageFlushMinutes: 1440,
    highUsageFlushMinutes: 1440,
    remoteEnabled: true,
    cancelHoldDelayMs: 1000,
    dailyFlushWindowStartUtc: 1,
    dailyFlushWindowMinutes: 120,
    maxEventsPerRequest: 5000,
  };
}

async function loadAnalyticsRuntime(state: RuntimeState, configUrl = 'https://worker.example/config') {
  vi.resetModules();

  const saveQueue = vi.fn(async (queue: AnalyticsEvent[]) => {
    state.queue = queue.map((ev) => ({ ...ev }));
  });
  const saveConfig = vi.fn(async (cfg: AnalyticsConfig) => {
    state.cfg = { ...cfg };
  });
  const saveMeta = vi.fn(async (meta: AnalyticsMeta) => {
    state.meta = { ...meta };
  });
  const flushSpy = vi.fn(async () => {});
  const updateStatsSpy = vi.fn(async () => {});

  vi.doMock('../entrypoints/utils/analytics/constants', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../entrypoints/utils/analytics/constants');
    return {
      ...actual,
      CONFIG_URL: configUrl,
      DEFAULT_CONFIG: baseConfig(),
    };
  });
  vi.doMock('../entrypoints/utils/analytics/detection', () => ({
    detectBrowser: vi.fn(() => 'chrome'),
    detectOS: vi.fn(async () => 'macos'),
    detectLanguage: vi.fn(() => 'en'),
    getExtensionVersion: vi.fn(() => '1.3.0'),
    generateEventId: vi.fn((ts?: number) => `id-${ts ?? Date.now()}`),
  }));
  vi.doMock('../entrypoints/utils/analytics/storage', () => ({
    loadQueue: vi.fn(async () => ({ queue: state.queue.map((ev) => ({ ...ev })), valid: true })),
    saveQueue,
    loadConfig: vi.fn(async () => ({ ...state.cfg })),
    saveConfig,
    loadStats: vi.fn(async () => ({
      total: 0,
      byType: {},
      success: 0,
      fail: 0,
      cancelled: 0,
      attempts: 0,
      bySpeed: { fast: 0, medium: 0, slow: 0 },
      bypassCount: 0,
      failByErrorType: {},
      byLanguage: {},
      lastUpdated: Date.now(),
    })),
    loadMeta: vi.fn(async () => ({ ...state.meta })),
    saveMeta,
  }));
  vi.doMock('../entrypoints/utils/analytics/flush', () => ({
    internalFlush: flushSpy,
    updateLocalStats: updateStatsSpy,
    getSafeUtcNowMs: vi.fn((meta: AnalyticsMeta) => ({ nowMs: Date.now(), meta, changed: false })),
  }));

  const mod = await import('../entrypoints/utils/analytics/index');
  return { mod, flushSpy, saveQueue, saveConfig, saveMeta, updateStatsSpy };
}

describe('analytics runtime index', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('recordDownloadEvent enqueues track operation and flushes on batch threshold', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod, flushSpy, saveQueue, updateStatsSpy } = await loadAnalyticsRuntime(state);
    mod.recordDownloadEvent({ status: 'success', type: 'pdf', duration_ms: 100, bypass_used: false, source: 'single' });
    await vi.waitFor(() => {
      expect(updateStatsSpy).toHaveBeenCalledTimes(1);
    });

    expect(saveQueue).toHaveBeenCalled();
    expect(state.queue.length).toBe(1);
    expect(flushSpy).not.toHaveBeenCalled();

    mod.recordDownloadEvent({ status: 'success', type: 'pdf', duration_ms: 100, bypass_used: false, source: 'single' });
    await vi.waitFor(() => {
      expect(flushSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshRemoteAnalyticsConfig applies remote config clamps and meta fields', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0, lastCommittedSeq: 3 },
    };
    const { mod, saveConfig, saveMeta } = await loadAnalyticsRuntime(state);

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      batchSize: 2000,
      maxDailyRequests: 0,
      maxRetry: 99,
      flushMode: 'time_based',
      remoteEnabled: false,
      cancelHoldDelayMs: 20000,
      maxEventsPerRequest: 999999,
      dailyFlushWindowStartUtc: 99,
      dailyFlushWindowMinutes: 2000,
      timeFlushMinutes: { low: 0, mid: 999999, high: 15 },
      serverTimeUtc: Date.now() + 5000,
      committedSeq: 20,
    }), { status: 200 }));

    await mod.refreshRemoteAnalyticsConfig();

    expect(saveConfig).toHaveBeenCalled();
    const savedCfg = saveConfig.mock.calls.at(-1)?.[0] as AnalyticsConfig;
    expect(savedCfg.batchSize).toBe(1000);
    expect(savedCfg.maxDailyRequests).toBe(1);
    expect(savedCfg.maxRetry).toBe(20);
    expect(savedCfg.flushMode).toBe('time_based');
    expect(savedCfg.remoteEnabled).toBe(false);
    expect(savedCfg.cancelHoldDelayMs).toBe(10000);
    expect(savedCfg.maxEventsPerRequest).toBe(50_000);
    expect(savedCfg.dailyFlushWindowStartUtc).toBe(23);
    expect(savedCfg.dailyFlushWindowMinutes).toBe(1440);
    expect(savedCfg.lowUsageFlushMinutes).toBe(1);
    expect(savedCfg.midUsageFlushMinutes).toBe(10080);
    expect(savedCfg.highUsageFlushMinutes).toBe(15);

    expect(saveMeta).toHaveBeenCalled();
    const savedMeta = saveMeta.mock.calls.at(-1)?.[0] as AnalyticsMeta;
    expect((savedMeta.lastCommittedSeq ?? 0) >= 20).toBe(true);
    expect(typeof savedMeta.serverTimeOffsetMs).toBe('number');
  });

  it('refreshRemoteAnalyticsConfig tolerates network and payload failures', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod, saveConfig } = await loadAnalyticsRuntime(state);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('fail', { status: 500 }));
    await expect(mod.refreshRemoteAnalyticsConfig()).resolves.toBeUndefined();
    expect(saveConfig).not.toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(mod.refreshRemoteAnalyticsConfig()).resolves.toBeUndefined();
  });

  it('getCancelHoldDelayMs returns configured delay', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: { ...baseConfig(), cancelHoldDelayMs: 3456 },
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod } = await loadAnalyticsRuntime(state);
    expect(await mod.getCancelHoldDelayMs()).toBe(3456);
  });

  it('recordDownloadEvent sanitizes malformed fields to safe defaults', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod } = await loadAnalyticsRuntime(state);
    mod.recordDownloadEvent({
      status: 'fail',
      type: 'INVALID FILE TYPE $$$$$$',
      duration_ms: -100,
      bypass_used: true,
      error_type: '!!!bad!!!',
      source: 'unknown source with spaces' as any,
    });
    await vi.waitFor(() => {
      expect(state.queue).toHaveLength(1);
    });
    expect(state.queue[0].file_type).toBe('unknown');
    expect(state.queue[0].error_type).toBe('unknown');
    expect(state.queue[0].source).toBe('unknown');
  });
});
