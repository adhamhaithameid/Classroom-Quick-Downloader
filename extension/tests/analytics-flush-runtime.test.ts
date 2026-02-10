import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    timestamp: Date.now() - 1000,
    id: `ext-${Math.random().toString(36).slice(2, 10)}`,
    retryCount: 0,
    ...overrides,
  };
}

async function loadFlushModule(state: FlushTestState, rateAllowed = true) {
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
  const rateSpy = vi.fn(async () => ({
    allowed: rateAllowed,
    remaining: rateAllowed ? 100 : 0,
    isNewDay: false,
  }));
  vi.doMock('../entrypoints/utils/analytics/rate-limiter', () => ({
    checkAndIncrementRateLimit: rateSpy,
  }));

  const mod = await import('../entrypoints/utils/analytics/flush');
  return { mod, saveMeta, saveQueue, saveStats, rateSpy };
}

describe('analytics flush runtime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T05:00:00.000Z'));
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sendBatchToCloudflare handles HTTP status paths and success payload', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 50,
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
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
      },
      queue: [],
      stats: {
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
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state);
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 429 }));
    expect(await mod.sendBatchToCloudflare([makeEvent()], 'c1')).toMatchObject({ success: false, rateLimited: true });

    fetchMock.mockResolvedValueOnce(new Response('err', { status: 503 }));
    expect(await mod.sendBatchToCloudflare([makeEvent()], 'c2')).toMatchObject({ success: false, serverOverloaded: true });

    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    expect(await mod.sendBatchToCloudflare([makeEvent()], 'c3')).toMatchObject({ success: false, error: 'HTTP 400' });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      accepted: 1,
      acceptedIds: ['id-1'],
      duplicateIds: [],
      invalidIds: [],
      clientBatchId: 'c4',
      ackId: 'ack-123456',
      receivedAt: Date.now(),
    }), { status: 202, headers: { 'Content-Type': 'application/json' } }));
    expect(await mod.sendBatchToCloudflare([makeEvent()], 'c4')).toMatchObject({ success: true, clientBatchId: 'c4' });

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await mod.sendBatchToCloudflare([makeEvent()], 'c5')).toMatchObject({ success: false });

    expect(await mod.sendBatchToCloudflare([], 'empty')).toMatchObject({ success: false });
  });

  it('internalFlush handles successful ACK-based flush and commit pruning', async () => {
    const events = [
      makeEvent({ id: 'a1' }),
      makeEvent({ id: 'a2' }),
      makeEvent({ id: 'a3', commitSeq: 1 }),
    ];
    const state: FlushTestState = {
      cfg: {
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
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: null,
        lastCommittedSeq: 0,
      },
      queue: events,
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod, saveMeta } = await loadFlushModule(state, true);
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse((init?.body as string) || '{}') as { clientBatchId?: string };
      return new Response(JSON.stringify({
        ok: true,
        acceptedIds: ['a1'],
        duplicateIds: ['a2'],
        invalidIds: [],
        acceptedSeqs: [['a1', 5]],
        committedSeq: 5,
        clientBatchId: body.clientBatchId,
        ackId: 'ack-123456',
        receivedAt: Date.now(),
      }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    });

    await mod.internalFlush();

    expect(state.queue.some((ev) => ev.id === 'a1')).toBe(false);
    expect(state.queue.some((ev) => ev.id === 'a2')).toBe(false);
    expect(state.meta.lastCommittedSeq).toBe(5);
    expect(saveMeta).toHaveBeenCalled();
  });

  it('internalFlush applies retry cap and backoff on failures', async () => {
    const now = Date.now();
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 2,
        maxDailyRequests: 50,
        maxRetry: 1,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: null,
      },
      queue: [
        makeEvent({ id: 'r1', retryCount: 1, timestamp: now - 2 * 24 * 60 * 60 * 1000 }),
        makeEvent({ id: 'r2', retryCount: 0, timestamp: now - 2 * 24 * 60 * 60 * 1000 }),
      ],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state, true);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('server overload', { status: 503 }));

    await mod.internalFlush();

    // r1 exceeded maxRetry after increment and should be dropped.
    expect(state.queue.some((ev) => ev.id === 'r1')).toBe(false);
    expect(state.queue.some((ev) => ev.id === 'r2')).toBe(true);
    expect(state.meta.nextRetryAt).toBeTruthy();
    expect(state.meta.backoffIndex).toBeGreaterThan(0);
  });

  it('internalFlush exits cleanly when remote is disabled or queue empty', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 10,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: false,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
      },
      queue: [],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state, true);
    await expect(mod.internalFlush()).resolves.toBeUndefined();
    expect(state.queue).toHaveLength(0);
  });

  it('internalFlush saves meta when remote is disabled but queue metadata changed', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 10,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: false,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: null,
      },
      queue: [makeEvent({ id: 'remote-off-1' })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod, saveMeta } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(saveMeta).toHaveBeenCalled();
  });

  it('internalFlush exits without flushing when decision says not due yet', async () => {
    const now = Date.now();
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 10,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 23,
        dailyFlushWindowMinutes: 1,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: now,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: new Date(now).toISOString().slice(0, 10),
      },
      queue: [makeEvent({ id: 'not-due-1', timestamp: now - 500 })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(state.queue).toHaveLength(1);
  });

  it('internalFlush exits when sendable list is empty after commit filtering', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 1,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        lastCommittedSeq: null,
      },
      queue: [makeEvent({ id: 'seq-only-1', commitSeq: 50 })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(state.queue).toHaveLength(1);
  });

  it('internalFlush saves queue when integrity is invalid and exits when all events are committed', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 5,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        lastCommittedSeq: 10,
      },
      queue: [
        makeEvent({ id: 'c1', commitSeq: 1 }),
        makeEvent({ id: 'c2', commitSeq: 2 }),
      ],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: false,
    };
    const { mod, saveQueue } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(saveQueue).toHaveBeenCalled();
    expect(state.queue).toHaveLength(0);
  });

  it('internalFlush exits when backoff is active', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 1,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: Date.now() + 10_000,
        backoffIndex: 1,
        lastCommittedSeq: null,
      },
      queue: [makeEvent({ id: 'b1' })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod, saveMeta } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(saveMeta).toHaveBeenCalled();
  });

  it('internalFlush exits when rate limit rejects non-urgent flushes', async () => {
    const now = Date.now();
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 1,
        maxDailyRequests: 1,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 23,
        dailyFlushWindowMinutes: 1,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: now,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: new Date(now).toISOString().slice(0, 10),
      },
      queue: [makeEvent({ id: 'rl-1', timestamp: now - 1000 })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    const { mod, rateSpy } = await loadFlushModule(state, false);
    await mod.internalFlush();
    expect(rateSpy).toHaveBeenCalled();
    expect(state.queue).toHaveLength(1);
  });

  it('internalFlush treats ACK mismatch as failure and schedules retry', async () => {
    const old = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 1,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: null,
      },
      queue: [makeEvent({ id: 'ack-1', timestamp: old })],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({
      ok: true,
      acceptedIds: ['ack-1'],
      duplicateIds: [],
      invalidIds: [],
      clientBatchId: 'wrong-batch',
      ackId: 'ack-abcdef',
      receivedAt: Date.now(),
    }), { status: 202, headers: { 'Content-Type': 'application/json' } }));
    const { mod } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(state.meta.nextRetryAt).toBeTruthy();
    expect(state.meta.backoffIndex).toBe(1);
  });

  it('internalFlush removes sent IDs when ACK does not include accepted/duplicate/invalid arrays', async () => {
    const old = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 2,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 2,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: null,
      },
      queue: [
        makeEvent({ id: 'drop-1', timestamp: old }),
        makeEvent({ id: 'drop-2', timestamp: old }),
        makeEvent({ id: 'keep-3', timestamp: old }),
      ],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse((init?.body as string) || '{}') as { clientBatchId?: string };
      return new Response(JSON.stringify({
        ok: true,
        accepted: 2,
        clientBatchId: body.clientBatchId,
        ackId: 'ack-abcdef',
      }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    });
    const { mod } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(state.queue.some((ev) => ev.id === 'drop-1')).toBe(false);
  });

  it('internalFlush normalizes missing IDs and preserves non-sent events during retry failures', async () => {
    const old = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 2,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 2,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
        dailyFlushOffsetMinutes: 0,
        lastDailyFlushUtcDate: null,
      },
      queue: [
        makeEvent({ id: undefined, timestamp: old }),
        makeEvent({ id: 'retry-2', timestamp: old }),
        makeEvent({ id: 'keep-3', timestamp: old + 10_000 }),
      ],
      stats: {
        total: 0,
        byType: {},
      },
      validQueue: true,
    };
    vi.mocked(fetch).mockResolvedValueOnce(new Response('server overload', { status: 503 }));
    const { mod } = await loadFlushModule(state, true);
    await mod.internalFlush();
    expect(state.queue.some((ev) => ev.id === 'keep-3')).toBe(true);
    expect(state.queue.some((ev) => typeof ev.id === 'string')).toBe(true);
  });

  it('updateLocalStats tracks status counters and buckets', async () => {
    const state: FlushTestState = {
      cfg: {
        configVersion: 2,
        batchSize: 10,
        maxDailyRequests: 50,
        maxRetry: 2,
        flushMode: 'next_day',
        lowUsageFlushMinutes: 1440,
        midUsageFlushMinutes: 1440,
        highUsageFlushMinutes: 1440,
        remoteEnabled: true,
        cancelHoldDelayMs: 1000,
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        maxEventsPerRequest: 5000,
      },
      meta: {
        lastFlushAt: null,
        nextRetryAt: null,
        backoffIndex: 0,
      },
      queue: [],
      stats: {
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
      },
      validQueue: true,
    };
    const { mod } = await loadFlushModule(state, true);
    await mod.updateLocalStats(makeEvent({ status: 'success', duration_ms: 1000, bypass_used: true }));
    await mod.updateLocalStats(makeEvent({ status: 'fail', error_type: 'NETWORK', duration_ms: 5000 }));
    await mod.updateLocalStats(makeEvent({ status: 'cancelled', duration_ms: 20000, language: 'ar' }));
    expect(state.stats.total).toBe(3);
    expect(state.stats.success).toBe(1);
    expect(state.stats.fail).toBe(1);
    expect(state.stats.cancelled).toBe(1);
    expect(state.stats.failByErrorType?.NETWORK).toBe(1);
    expect(state.stats.bySpeed?.fast).toBe(1);
    expect(state.stats.bySpeed?.medium).toBe(1);
    expect(state.stats.bySpeed?.slow).toBe(1);
  });
});
