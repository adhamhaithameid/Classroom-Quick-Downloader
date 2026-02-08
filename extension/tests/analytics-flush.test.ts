// filepath: extension/tests/analytics-flush.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBatchSize, getDailyFlushScheduleUtcMs } from '../entrypoints/utils/analytics/flush';
import { DEFAULT_CONFIG } from '../entrypoints/utils/analytics/constants';
import type { AnalyticsConfig, AnalyticsMeta } from '../entrypoints/utils/analytics/types';

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

    const result = getDailyFlushScheduleUtcMs(nowMs, meta);
    const expected = Date.UTC(2026, 1, 8, 1, 30, 0);
    expect(result.scheduleMs).toBe(expected);
    expect(result.changed).toBe(false);
  });

  it('getDailyFlushScheduleUtcMs schedules within 1am-3am UTC window', () => {
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

    const result = getDailyFlushScheduleUtcMs(nowMs, meta);
    const dayStart = Date.UTC(2026, 1, 8, 0, 0, 0);
    const windowStart = dayStart + 1 * 60 * 60 * 1000;
    const windowEnd = dayStart + 3 * 60 * 60 * 1000;
    expect(result.scheduleMs).toBeGreaterThanOrEqual(windowStart);
    expect(result.scheduleMs).toBeLessThan(windowEnd);
  });
});
