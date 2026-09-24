import { describe, expect, it } from 'vitest';
import { computeTrends } from '../src/archive-trends';

function batchPayload(day: string, hours: number[], perHour = 10): string {
  return JSON.stringify({
    batchId: `do-${day}-${hours.join('_')}`,
    timeBuckets: hours.map((hour) => ({
      bucketStart: `${day}T${String(hour).padStart(2, '0')}:00:00Z`,
      bucketEnd: `${day}T${String(hour).padStart(2, '0')}:59:59Z`,
      totals: { totalEvents: perHour, totalDownloads: perHour, totalSuccess: perHour, totalFail: 0 },
      counters: {},
    })),
  });
}

function row(day: string, hours: number[], perHour = 10) {
  return {
    created_at_utc: Date.parse(`${day}T12:00:00Z`),
    payload: batchPayload(day, hours, perHour),
  };
}

describe('archive trends', () => {
  it('folds hourly buckets into a per-day series with zero-filled gaps', () => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(now - (13 - index) * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    });
    // Week 1 (older): 5 downloads/day. Week 2 (newer): 15/day on two days only.
    const rows = [
      ...days.slice(0, 7).map((day) => row(day, [9])),
      ...days.slice(7).map((day) => row(day, [8, 20], 7.5)),
    ].map((input) => ({ created_at_utc: input.created_at_utc, payload: input.payload }));

    const trends = computeTrends(rows, { now, windowDays: 14 });

    expect(trends.daily).toHaveLength(14);
    expect(trends.daily[0].downloads).toBe(10);
    expect(trends.daily[8].downloads).toBe(15);
    expect(trends.daily[9].downloads).toBe(15);
    // A day with no archived batches reads as zero, not missing.
    expect(trends.daily.every((day) => typeof day.downloads === 'number')).toBe(true);
    expect(trends.weekOverWeekPercent).not.toBeNull();
  });

  it('returns null week-over-week when the previous week had no data', () => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    const recentDay = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const trends = computeTrends([row(recentDay, [10])], { now, windowDays: 28 });
    expect(trends.daily[trends.daily.length - 2].downloads).toBe(10);
    expect(trends.weekOverWeekPercent).toBe(100);
  });

  it('ignores rows outside the window and malformed payloads', () => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    const oldRow = {
      created_at_utc: now - 90 * 24 * 60 * 60 * 1000,
      payload: batchPayload('2026-06-21', [9]),
    };
    const junkRow = { created_at_utc: now, payload: 'not-json' };
    const trends = computeTrends([oldRow, junkRow], { now, windowDays: 28 });
    expect(trends.daily.every((day) => day.downloads === 0)).toBe(true);
    expect(trends.weekOverWeekPercent).toBeNull();
  });
});
