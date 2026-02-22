import { describe, expect, it } from 'vitest';
import {
  isOraclePrimaryRefreshHour,
  isOracleWindowHour,
  isWorkerRefreshHour,
  resolveMetricsSource
} from './metrics-source';

describe('metrics source schedule', () => {
  it('selects Oracle during the 21:00-03:00 UTC window', () => {
    expect(isOracleWindowHour(21)).toBe(true);
    expect(isOracleWindowHour(22)).toBe(true);
    expect(isOracleWindowHour(0)).toBe(true);
    expect(isOracleWindowHour(2)).toBe(true);
    expect(isOracleWindowHour(3)).toBe(false);
    expect(isOracleWindowHour(12)).toBe(false);
  });

  it('marks worker refresh hours', () => {
    expect(isWorkerRefreshHour(3)).toBe(true);
    expect(isWorkerRefreshHour(6)).toBe(true);
    expect(isWorkerRefreshHour(21)).toBe(true);
    expect(isWorkerRefreshHour(5)).toBe(false);
  });

  it('resolves source from UTC hour', () => {
    expect(resolveMetricsSource(new Date('2026-02-21T22:00:00.000Z'))).toBe('oracle');
    expect(resolveMetricsSource(new Date('2026-02-21T01:00:00.000Z'))).toBe('oracle');
    expect(resolveMetricsSource(new Date('2026-02-21T09:00:00.000Z'))).toBe('worker');
  });

  it('marks 01:00 UTC as the primary Oracle refresh hour', () => {
    expect(isOraclePrimaryRefreshHour(new Date('2026-02-21T01:00:00.000Z'))).toBe(true);
    expect(isOraclePrimaryRefreshHour(new Date('2026-02-21T02:00:00.000Z'))).toBe(false);
  });
});
