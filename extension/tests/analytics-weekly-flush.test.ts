// filepath: extension/tests/analytics-weekly-flush.test.ts
// W1: weekly flush mode - slot math (local midnight), per-slot jitter, due gate,
// empty-queue slot advance, suppression of all other triggers, single-batch send,
// full-drain loop, and failure backoff. All slot math uses LOCAL Date getters.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWeeklySlotInfo,
  getWeeklyDue,
  __flushTestInternals,
} from '../entrypoints/utils/analytics/flush';
import { DEFAULT_CONFIG } from '../entrypoints/utils/analytics/constants';
import type { AnalyticsConfig, AnalyticsEvent, AnalyticsMeta, LocalStats } from '../entrypoints/utils/analytics/types';

type FlushTestState = {
  cfg: AnalyticsConfig;
  meta: AnalyticsMeta;
  queue: AnalyticsEvent[];
  stats: LocalStats;
  validQueue: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localMidnightMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function makeMeta(overrides: Partial<AnalyticsMeta> = {}): AnalyticsMeta {
  return {
    lastFlushAt: null,
    nextRetryAt: null,
    backoffIndex: 0,
    lastDailyFlushUtcDate: null,
    dailyFlushOffsetMinutes: null,
    lastWeeklyFlushSlotKey: null,
    weeklyOffsetSlotKey: null,
    weeklyOffsetMinutes: null,
    ...overrides,
  };
}

function makeWeeklyCfg(overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig {
  return {
    ...DEFAULT_CONFIG,
    flushMode: 'weekly',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'mac',
    ext_version: '1.0.0',
    duration_ms: 100,
    bypass_used: false,
    language: 'en',
    timestamp: Date.now() - 60 * 60 * 1000,
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

function makeState(
  queue: AnalyticsEvent[],
  cfg: AnalyticsConfig = makeWeeklyCfg(),
  meta: AnalyticsMeta = makeMeta()
): FlushTestState {
  return {
    cfg,
    meta,
    queue,
    stats: { total: 0, byType: {} },
    validQueue: true,
  };
}

describe('weekly flush slot math', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17, 13, 47, 0));
    vi.stubGlobal('fetch', vi.fn());
  });

  it('a) maps a mid-day local time to that day local midnight', () => {
    const now = new Date(2026, 8, 17, 13, 47, 0);
    const meta = makeMeta({
      weeklyOffsetMinutes: 0,
      weeklyOffsetSlotKey: localDateKey(now),
    });
    const info = getWeeklySlotInfo(now.getTime(), meta);
    expect(info.slotStartMs).toBe(localMidnightMs(now));
    expect(info.slotKey).toBe(localDateKey(now));
    expect(info.dueAtMs).toBe(localMidnightMs(now));
    expect(info.metaChanged).toBe(false);
  });

  it('a) maps a time just after local midnight to today 00:00', () => {
    const now = new Date(2026, 8, 17, 0, 20, 0);
    const meta = makeMeta({
      weeklyOffsetMinutes: 0,
      weeklyOffsetSlotKey: localDateKey(now),
    });
    const info = getWeeklySlotInfo(now.getTime(), meta);
    expect(info.slotStartMs).toBe(localMidnightMs(now));
    expect(info.slotKey).toBe(localDateKey(now));
    expect(info.dueAtMs).toBe(localMidnightMs(now));
  });

  it('b) keeps one jitter offset per slot and redraws it when the slot advances', () => {
    const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 42;
      return array;
    });
    try {
      const day1 = new Date(2026, 8, 17, 13, 47, 0);
      const first = getWeeklySlotInfo(day1.getTime(), makeMeta());
      expect(first.metaChanged).toBe(true);
      expect(first.meta.weeklyOffsetSlotKey).toBe(localDateKey(day1));
      expect(first.meta.weeklyOffsetMinutes).toBe(42);
      expect(first.dueAtMs).toBe(localMidnightMs(day1) + 42 * 60 * 1000);

      // Same slot: offset persisted, no redraw.
      const stable = getWeeklySlotInfo(day1.getTime() + 60 * 1000, first.meta);
      expect(stable.metaChanged).toBe(false);
      expect(stable.meta.weeklyOffsetMinutes).toBe(42);
      expect(stable.dueAtMs).toBe(first.dueAtMs);

      // Slot advanced: new offset drawn, new slot key stored.
      cryptoSpy.mockImplementation((array) => {
        (array as Uint32Array)[0] = 7;
        return array;
      });
      const day2 = new Date(2026, 8, 18, 9, 0, 0);
      const redrawn = getWeeklySlotInfo(day2.getTime(), stable.meta);
      expect(redrawn.metaChanged).toBe(true);
      expect(redrawn.meta.weeklyOffsetSlotKey).toBe(localDateKey(day2));
      expect(redrawn.meta.weeklyOffsetMinutes).toBe(7);
      expect(redrawn.dueAtMs).toBe(localMidnightMs(day2) + 7 * 60 * 1000);
    } finally {
      cryptoSpy.mockRestore();
    }
  });

  it('c) is not due before dueAtMs and due after it while the slot key is unrecorded', () => {
    const cfg = makeWeeklyCfg();
    const slotKey = localDateKey(new Date(2026, 8, 17, 0, 0, 0));
    const early = new Date(2026, 8, 17, 0, 30, 0); // dueAt = 01:00 (offset 60)
    const boundary = new Date(2026, 8, 17, 1, 0, 0);
    const late = new Date(2026, 8, 17, 1, 1, 0);
    const baseMeta = makeMeta({ weeklyOffsetMinutes: 60, weeklyOffsetSlotKey: slotKey });

    expect(getWeeklyDue(early.getTime(), baseMeta, cfg).due).toBe(false);

    const due = getWeeklyDue(boundary.getTime(), baseMeta, cfg);
    expect(due.due).toBe(true);
    expect(due.urgent).toBe(true);
    expect(due.slotKey).toBe(slotKey);

    expect(getWeeklyDue(late.getTime(), baseMeta, cfg).due).toBe(true);

    // Already recorded for this slot: never due again within the slot.
    const recorded = getWeeklyDue(late.getTime(), { ...baseMeta, lastWeeklyFlushSlotKey: slotKey }, cfg);
    expect(recorded.due).toBe(false);
  });

  it('d) getFlushDecision with an empty weekly queue advances the slot key without a request', () => {
    const decision = __flushTestInternals.getFlushDecision(makeWeeklyCfg(), makeMeta(), 0, null);
    expect(decision.shouldFlush).toBe(false);
    expect(decision.metaChanged).toBe(true);
    expect(decision.meta.lastWeeklyFlushSlotKey).toBe(localDateKey(new Date(2026, 8, 17, 13, 47, 0)));
  });

  it('d) internalFlush with an empty weekly queue performs no fetch but persists the advanced slot key', async () => {
    const state = makeState([]);
    const { mod, saveMeta } = await loadFlushModule(state);
    await mod.internalFlush();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(saveMeta).toHaveBeenCalled();
    expect(state.meta.lastWeeklyFlushSlotKey).toBe(localDateKey(new Date(2026, 8, 17, 13, 47, 0)));
  });

  it('d) getFlushDecision in weekly mode survives a broken clock without touching meta', () => {
    const epochSlotKey = localDateKey(new Date(0));
    const meta = makeMeta({
      weeklyOffsetMinutes: 30,
      weeklyOffsetSlotKey: epochSlotKey,
      lastWeeklyFlushSlotKey: epochSlotKey,
    });
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(Number.NaN);
    const perfSpy = vi.spyOn(performance, 'now').mockReturnValue(Number.NaN);
    try {
      const decision = __flushTestInternals.getFlushDecision(makeWeeklyCfg(), meta, 0, null);
      // The safe-clock fallback (changed=false) must not flush or dirty meta.
      expect(decision.shouldFlush).toBe(false);
      expect(decision.metaChanged).toBe(false);
    } finally {
      dateSpy.mockRestore();
      perfSpy.mockRestore();
    }
  });

  it('d) internalFlush with an empty weekly queue and a broken clock performs no request and no meta writes', async () => {
    const epochSlotKey = localDateKey(new Date(0));
    const state = makeState([], makeWeeklyCfg(), makeMeta({
      weeklyOffsetMinutes: 30,
      weeklyOffsetSlotKey: epochSlotKey,
      lastWeeklyFlushSlotKey: epochSlotKey,
    }));
    const { mod, saveMeta } = await loadFlushModule(state);
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(Number.NaN);
    const perfSpy = vi.spyOn(performance, 'now').mockReturnValue(Number.NaN);
    try {
      await mod.internalFlush();
    } finally {
      dateSpy.mockRestore();
      perfSpy.mockRestore();
    }
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(saveMeta).not.toHaveBeenCalled();
  });

  it('e) weekly mode ignores count/age/daily triggers while the slot is not due', async () => {
    const now = new Date(2026, 8, 17, 0, 20, 0);
    vi.setSystemTime(now);
    const slotKey = localDateKey(now);
    const events = Array.from({ length: 600 }, (_, i) =>
      makeEvent({ id: `wk-e-${i}`, timestamp: now.getTime() - 60 * 60 * 1000 })
    );
    const state = makeState(events, makeWeeklyCfg(), makeMeta({
      weeklyOffsetMinutes: 100, // dueAt = 01:40 local; now = 00:20 -> not due
      weeklyOffsetSlotKey: slotKey,
    }));
    const { mod } = await loadFlushModule(state);
    await mod.internalFlush();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(state.queue).toHaveLength(600);
  });

  it('f) sends exactly one POST with all 120 events and advances the slot key on success', async () => {
    const now = new Date(2026, 8, 17, 13, 47, 0);
    vi.setSystemTime(now);
    const slotKey = localDateKey(now);
    const events = Array.from({ length: 120 }, (_, i) =>
      makeEvent({ id: `wk-f-${i}`, timestamp: now.getTime() - 60 * 60 * 1000 })
    );
    const state = makeState(events);
    const { mod } = await loadFlushModule(state);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse((init?.body as string) || '{}') as { clientBatchId?: string };
      return new Response(JSON.stringify({
        ok: true,
        accepted: 120,
        clientBatchId: body.clientBatchId,
        ackId: 'ack-wk-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    await mod.internalFlush();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1]?.body as string) || '{}'
    ) as { events: AnalyticsEvent[] };
    expect(sentBody.events).toHaveLength(120);
    expect(state.queue).toHaveLength(0);
    expect(state.meta.lastWeeklyFlushSlotKey).toBe(slotKey);
  });

  it('g) drains 12,000 events in 3 POSTs (5000+5000+2000) and advances the slot key', async () => {
    const now = new Date(2026, 8, 17, 13, 47, 0);
    vi.setSystemTime(now);
    const slotKey = localDateKey(now);
    const events = Array.from({ length: 12000 }, (_, i) =>
      makeEvent({ id: `wk-g-${i}`, timestamp: now.getTime() - 60 * 60 * 1000 })
    );
    const state = makeState(events);
    const { mod } = await loadFlushModule(state);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse((init?.body as string) || '{}') as { clientBatchId?: string };
      return new Response(JSON.stringify({
        ok: true,
        clientBatchId: body.clientBatchId,
        ackId: 'ack-drain-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    await mod.internalFlush();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const batchSizes = fetchMock.mock.calls.map(
      (call) => (JSON.parse((call[1]?.body as string) || '{}') as { events: AnalyticsEvent[] }).events.length
    );
    expect(batchSizes).toEqual([5000, 5000, 2000]);
    const batchIds = fetchMock.mock.calls.map(
      (call) => (JSON.parse((call[1]?.body as string) || '{}') as { clientBatchId?: string }).clientBatchId
    );
    expect(new Set(batchIds).size).toBe(3);
    expect(state.queue).toHaveLength(0);
    expect(state.meta.lastWeeklyFlushSlotKey).toBe(slotKey);
  });

  it('h) keeps the slot key and queue and sets backoff when the POST fails', async () => {
    const now = new Date(2026, 8, 17, 13, 47, 0);
    vi.setSystemTime(now);
    const events = Array.from({ length: 120 }, (_, i) =>
      makeEvent({ id: `wk-h-${i}`, timestamp: now.getTime() - 60 * 60 * 1000 })
    );
    const state = makeState(events);
    const { mod } = await loadFlushModule(state);
    vi.mocked(fetch).mockResolvedValue(new Response('server overload', { status: 500 }));

    await mod.internalFlush();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(state.meta.lastWeeklyFlushSlotKey).toBeNull();
    expect(state.meta.nextRetryAt).toBeTruthy();
    expect(state.meta.backoffIndex).toBe(1);
    expect(state.queue).toHaveLength(120);
    expect(state.queue.every((ev) => ev.retryCount === 1)).toBe(true);
  });
});
