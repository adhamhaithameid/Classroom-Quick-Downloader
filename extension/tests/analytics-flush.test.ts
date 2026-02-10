// filepath: extension/tests/analytics-flush.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  resolveBatchSize,
  getDailyFlushScheduleUtcMs,
  getSafeUtcNowMs,
  buildAckRemovalSet,
  applyRetryCap,
  applyCommitSeqs,
  pruneCommittedEvents,
  isAckValidForBatch,
  __flushTestInternals,
} from '../entrypoints/utils/analytics/flush';
import { DEFAULT_CONFIG } from '../entrypoints/utils/analytics/constants';
import type { AnalyticsConfig, AnalyticsMeta, AnalyticsEvent } from '../entrypoints/utils/analytics/types';

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'mac',
    ext_version: '1.0.0',
    duration_ms: 0,
    bypass_used: false,
    language: 'en',
    timestamp: Date.UTC(2026, 1, 8, 0, 0, 0),
    id: 'ext-abc-123',
    ...overrides,
  };
}

describe('analytics flush helpers', () => {
  it('resolveBatchSize uses queue length when below batch size', () => {
    const cfg: AnalyticsConfig = { ...DEFAULT_CONFIG, maxEventsPerRequest: 5000 };
    const batch = resolveBatchSize(cfg, 10);
    expect(batch).toBe(10);
  });

  it('resolveBatchSize respects maxEventsPerRequest on overflow', () => {
    const cfg: AnalyticsConfig = {
      ...DEFAULT_CONFIG,
      batchSize: 50,
      maxEventsPerRequest: 200,
    };
    const batch = resolveBatchSize(cfg, 600);
    expect(batch).toBe(200);
  });

  it('getDailyFlushScheduleUtcMs uses stable offset when provided', () => {
    const nowMs = Date.UTC(2026, 1, 8, 12, 0, 0); // 2026-02-08T12:00:00Z
    const meta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      dailyFlushOffsetMinutes: 30,
      lastDailyFlushUtcDate: null,
      lastKnownUtcMs: null,
      lastPerfMs: null,
    };

    const result = getDailyFlushScheduleUtcMs(nowMs, meta, DEFAULT_CONFIG);
    const expected = Date.UTC(2026, 1, 8, 1, 30, 0);
    expect(result.scheduleMs).toBe(expected);
    expect(result.changed).toBe(false);
  });

  it('getDailyFlushScheduleUtcMs schedules within configured UTC window', () => {
    const nowMs = Date.UTC(2026, 1, 8, 12, 0, 0);
    const meta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      dailyFlushOffsetMinutes: null,
      lastDailyFlushUtcDate: null,
      lastKnownUtcMs: null,
      lastPerfMs: null,
    };

    const cfg: AnalyticsConfig = {
      ...DEFAULT_CONFIG,
      dailyFlushWindowStartUtc: 1,
      dailyFlushWindowMinutes: 120,
    };
    const result = getDailyFlushScheduleUtcMs(nowMs, meta, cfg);
    const dayStart = Date.UTC(2026, 1, 8, 0, 0, 0);
    const windowStart = dayStart + 1 * 60 * 60 * 1000;
    const windowEnd = dayStart + 3 * 60 * 60 * 1000;
    expect(result.scheduleMs).toBeGreaterThanOrEqual(windowStart);
    expect(result.scheduleMs).toBeLessThan(windowEnd);
  });

  it('buildAckRemovalSet includes invalid ids', () => {
    const removal = buildAckRemovalSet({
      success: true,
      acceptedIds: ['a'],
      duplicateIds: ['b'],
      invalidIds: ['c'],
    });
    expect(removal.has('b')).toBe(true);
    expect(removal.has('c')).toBe(true);
  });

  it('applyRetryCap drops events over maxRetry', () => {
    const events = [
      makeEvent({ id: 'a', retryCount: 0 }),
      makeEvent({ id: 'b', retryCount: 1 }),
      makeEvent({ id: 'c', retryCount: 2 }),
    ];
    const capped = applyRetryCap(events, 1);
    expect(capped.map((ev) => ev.id)).toEqual(['a', 'b']);
  });

  it('applyCommitSeqs assigns commit sequences to accepted events', () => {
    const events = [
      makeEvent({ id: 'a' }),
      makeEvent({ id: 'b' }),
    ];
    const updated = applyCommitSeqs(events, [['a', 10]]);
    expect(updated.find((ev) => ev.id === 'a')?.commitSeq).toBe(10);
    expect(updated.find((ev) => ev.id === 'b')?.commitSeq).toBeUndefined();
  });

  it('pruneCommittedEvents drops committed events', () => {
    const events = [
      makeEvent({ id: 'a', commitSeq: 5 }),
      makeEvent({ id: 'b', commitSeq: 12 }),
    ];
    const pruned = pruneCommittedEvents(events, 10);
    expect(pruned.map((ev) => ev.id)).toEqual(['b']);
  });

  it('isAckValidForBatch requires matching clientBatchId and ackId', () => {
    const ok = isAckValidForBatch({ success: true, clientBatchId: 'c1', ackId: 'ack-123' }, 'c1');
    expect(ok).toBe(true);
  });

  it('isAckValidForBatch rejects mismatched clientBatchId', () => {
    const ok = isAckValidForBatch({ success: true, clientBatchId: 'c2', ackId: 'ack-123' }, 'c1');
    expect(ok).toBe(false);
  });

  it('isAckValidForBatch rejects missing ackId', () => {
    const ok = isAckValidForBatch({ success: true, clientBatchId: 'c1' }, 'c1');
    expect(ok).toBe(false);
  });

  it('isAckValidForBatch returns true when clientBatchId is not provided', () => {
    expect(isAckValidForBatch({ success: true }, undefined)).toBe(true);
  });

  it('getSafeUtcNowMs falls back to monotonic clock delta when Date.now is invalid', () => {
    const dateNow = Date.now;
    Date.now = () => Number.NaN as unknown as number;
    const meta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      lastKnownUtcMs: 2000,
      lastPerfMs: 100,
      serverTimeOffsetMs: 0,
    };
    const perfSpy = vi.spyOn(performance, 'now').mockReturnValue(250);
    const result = getSafeUtcNowMs(meta);
    expect(result.nowMs).toBe(2150);
    Date.now = dateNow;
    perfSpy.mockRestore();
  });

  it('getSafeUtcNowMs uses performance.timeOrigin fallback when lastKnown is missing', () => {
    const dateNow = Date.now;
    Date.now = () => Number.NaN as unknown as number;
    const meta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      lastKnownUtcMs: null,
      lastPerfMs: null,
      serverTimeOffsetMs: 0,
    };
    const perfSpy = vi.spyOn(performance, 'now').mockReturnValue(10);
    const result = getSafeUtcNowMs(meta);
    expect(Number.isFinite(result.nowMs)).toBe(true);
    Date.now = dateNow;
    perfSpy.mockRestore();
  });

  it('__flushTestInternals.getRandomInt handles zero and crypto failure fallback', () => {
    expect(__flushTestInternals.getRandomInt(0)).toBe(0);
    const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('rng');
    });
    const value = __flushTestInternals.getRandomInt(10);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(10);
    cryptoSpy.mockRestore();
  });

  it('__flushTestInternals.resolveMaxEventsPerRequest enforces minimums', () => {
    expect(__flushTestInternals.resolveMaxEventsPerRequest({ ...DEFAULT_CONFIG, maxEventsPerRequest: 0 })).toBe(1);
    expect(__flushTestInternals.resolveMaxEventsPerRequest({ ...DEFAULT_CONFIG, maxEventsPerRequest: Number.NaN })).toBe(5000);
  });

  it('__flushTestInternals.getFlushDecision covers zero queue and time-based modes', () => {
    const zeroMeta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      dailyFlushOffsetMinutes: 0,
      lastDailyFlushUtcDate: null,
    };
    const zero = __flushTestInternals.getFlushDecision(DEFAULT_CONFIG, zeroMeta, 0, null);
    expect(zero.shouldFlush).toBe(false);

    const cfg: AnalyticsConfig = {
      ...DEFAULT_CONFIG,
      flushMode: 'time_based',
      lowUsageFlushMinutes: 1,
      midUsageFlushMinutes: 1,
      highUsageFlushMinutes: 1,
    };
    const meta: AnalyticsMeta = {
      ...zeroMeta,
      lastFlushAt: Date.now() - 2 * 60 * 1000,
    };
    const decision = __flushTestInternals.getFlushDecision(cfg, meta, 10, Date.now() - 2 * 60 * 1000);
    expect(decision.shouldFlush).toBe(true);
  });

  it('getSafeUtcNowMs returns lastKnown fallback when no clocks are usable', () => {
    const originalDateNow = Date.now;
    Date.now = () => Number.NaN as unknown as number;
    const perfNowSpy = vi.spyOn(performance, 'now').mockReturnValue(Number.NaN);
    const originalTimeOrigin = performance.timeOrigin;
    Object.defineProperty(performance, 'timeOrigin', { value: Number.NaN, configurable: true });

    const meta: AnalyticsMeta = {
      lastFlushAt: null,
      nextRetryAt: null,
      backoffIndex: 0,
      lastKnownUtcMs: 777,
      lastPerfMs: null,
      serverTimeOffsetMs: 0,
    };
    const result = getSafeUtcNowMs(meta);
    expect(result.nowMs).toBe(777);

    Date.now = originalDateNow;
    perfNowSpy.mockRestore();
    Object.defineProperty(performance, 'timeOrigin', { value: originalTimeOrigin, configurable: true });
  });

  it('applyCommitSeqs returns original queue for missing accepted seqs and id-less events', () => {
    const queue = [
      makeEvent({ id: undefined }),
      makeEvent({ id: 'known' }),
    ];
    expect(applyCommitSeqs(queue, undefined)).toEqual(queue);
    const updated = applyCommitSeqs(queue, [['known', 10]]);
    expect(updated[0].commitSeq).toBeUndefined();
    expect(updated[1].commitSeq).toBe(10);
  });
});
