// filepath: extension/tests/analytics-max-retry.test.ts
// T3: maxRetry default 5 -> 20. Proves the DEFAULT_CONFIG default and the
// survival behavior of queued events across consecutive failed flush attempts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../entrypoints/utils/analytics/constants';
import type { AnalyticsConfig, AnalyticsEvent, AnalyticsMeta, LocalStats } from '../entrypoints/utils/analytics/types';

type FlushTestState = {
  cfg: AnalyticsConfig;
  meta: AnalyticsMeta;
  queue: AnalyticsEvent[];
  stats: LocalStats;
  validQueue: boolean;
};

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'mac',
    ext_version: '1.3.0',
    duration_ms: 200,
    bypass_used: false,
    language: 'en',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // stale -> urgent flush
    id: `ext-${Math.random().toString(36).slice(2, 10)}`,
    retryCount: 0,
    ...overrides,
  };
}

async function loadFlushModule(state: FlushTestState) {
  vi.resetModules();
  vi.doMock('../entrypoints/utils/analytics/constants', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../entrypoints/utils/analytics/constants');
    return {
      ...actual,
      TRACK_URL: 'https://worker.example/track',
    };
  });
  const saveMeta = vi.fn(async (meta: AnalyticsMeta) => {
    state.meta = { ...meta };
  });
  const saveQueue = vi.fn(async (queue: AnalyticsEvent[]) => {
    state.queue = queue.map((event) => ({ ...event }));
  });
  const saveStats = vi.fn(async (stats: LocalStats) => {
    state.stats = { ...stats };
  });

  vi.doMock('../entrypoints/utils/analytics/storage', () => ({
    loadConfig: vi.fn(async () => ({ ...state.cfg })),
    loadMeta: vi.fn(async () => ({ ...state.meta })),
    loadQueue: vi.fn(async () => ({ queue: state.queue.map((ev) => ({ ...ev })), valid: state.validQueue })),
    saveMeta,
    saveQueue,
    loadStats: vi.fn(async () => ({ ...state.stats })),
    saveStats,
  }));
  vi.doMock('../entrypoints/utils/analytics/rate-limiter', () => ({
    checkAndIncrementRateLimit: vi.fn(async () => ({ allowed: true, remaining: 0, isNewDay: false })),
  }));

  const mod = await import('../entrypoints/utils/analytics/flush');
  return { mod, saveMeta, saveQueue, saveStats };
}

function makeState(queue: AnalyticsEvent[]): FlushTestState {
  return {
    cfg: { ...DEFAULT_CONFIG },
    meta: {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      dailyFlushOffsetMinutes: 0,
      lastDailyFlushUtcDate: null,
    },
    queue,
    stats: { total: 0, byType: {} },
    validQueue: true,
  };
}

describe('analytics maxRetry default (T3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T05:00:00.000Z'));
    vi.stubGlobal('fetch', vi.fn());
  });

  it('defaults DEFAULT_CONFIG.maxRetry to 20 while keeping maxDailyRequests at 50', () => {
    expect(DEFAULT_CONFIG.maxRetry).toBe(20);
    expect(DEFAULT_CONFIG.maxDailyRequests).toBe(50);
  });

  it('keeps queued events in the queue after 8 consecutive failed flush attempts', async () => {
    const queue = [
      makeEvent({ id: 'survive-1' }),
      makeEvent({ id: 'survive-2' }),
      makeEvent({ id: 'survive-3' }),
    ];
    const state = makeState(queue);
    const { mod } = await loadFlushModule(state);
    vi.mocked(fetch).mockResolvedValue(new Response('server overload', { status: 503 }));

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await mod.internalFlush();
      // Clear the backoff gate so the next attempt actually sends again.
      state.meta.nextRetryAt = null;
    }

    const survivingIds = state.queue.map((ev) => ev.id);
    expect(survivingIds).toContain('survive-1');
    expect(survivingIds).toContain('survive-2');
    expect(survivingIds).toContain('survive-3');
    expect(state.queue).toHaveLength(3);
    for (const ev of state.queue) {
      expect(ev.retryCount).toBe(8);
    }
  });
});
