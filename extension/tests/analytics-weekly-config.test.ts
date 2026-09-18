// W2: refreshRemoteAnalyticsConfig must accept a server-driven flushMode of
// 'weekly' (from the DO /config payload or its KV snapshot) instead of
// stripping it before saveConfig. Follows the mocking pattern in
// tests/analytics-index-runtime.test.ts.
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
    batchSize: 50,
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

  const saveConfig = vi.fn(async (cfg: AnalyticsConfig) => {
    state.cfg = { ...cfg };
  });
  const saveMeta = vi.fn(async (meta: AnalyticsMeta) => {
    state.meta = { ...meta };
  });

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
    saveQueue: vi.fn(async () => {}),
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
    internalFlush: vi.fn(async () => {}),
    updateLocalStats: vi.fn(async () => {}),
    getSafeUtcNowMs: vi.fn((meta: AnalyticsMeta) => ({ nowMs: Date.now(), meta, changed: false })),
  }));

  const mod = await import('../entrypoints/utils/analytics/index');
  return { mod, saveConfig, saveMeta };
}

describe('refreshRemoteAnalyticsConfig accepts weekly flushMode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('f) saves flushMode weekly when the remote config says so', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod, saveConfig } = await loadAnalyticsRuntime(state);

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      flushMode: 'weekly',
    }), { status: 200 }));

    await mod.refreshRemoteAnalyticsConfig();

    expect(saveConfig).toHaveBeenCalled();
    const savedCfg = saveConfig.mock.calls.at(-1)?.[0] as AnalyticsConfig;
    expect(savedCfg.flushMode).toBe('weekly');
  });

  it('f) still strips a genuinely invalid remote flushMode', async () => {
    const state: RuntimeState = {
      queue: [],
      cfg: baseConfig(),
      meta: { lastFlushAt: null, nextRetryAt: null, backoffIndex: 0 },
    };
    const { mod, saveConfig } = await loadAnalyticsRuntime(state);

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      flushMode: 'hourly',
    }), { status: 200 }));

    await mod.refreshRemoteAnalyticsConfig();

    expect(saveConfig).toHaveBeenCalled();
    const savedCfg = saveConfig.mock.calls.at(-1)?.[0] as AnalyticsConfig;
    expect(savedCfg.flushMode).toBe('next_day');
  });
});
