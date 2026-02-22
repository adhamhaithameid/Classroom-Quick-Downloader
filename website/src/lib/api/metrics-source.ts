import type { PublicMetricsSource } from '$lib/types/public';

export const WORKER_REFRESH_HOURS_UTC = [3, 6, 9, 12, 15, 18, 21] as const;
export const ORACLE_WINDOW_START_UTC = 21;
export const ORACLE_WINDOW_END_UTC = 3;
export const ORACLE_PRIMARY_REFRESH_HOUR_UTC = 1;

export function isWorkerRefreshHour(hourUtc: number): boolean {
  return WORKER_REFRESH_HOURS_UTC.includes(hourUtc as (typeof WORKER_REFRESH_HOURS_UTC)[number]);
}

export function isOracleWindowHour(hourUtc: number): boolean {
  return hourUtc >= ORACLE_WINDOW_START_UTC || hourUtc < ORACLE_WINDOW_END_UTC;
}

export function resolveMetricsSource(now: Date = new Date()): PublicMetricsSource {
  const hourUtc = now.getUTCHours();
  return isOracleWindowHour(hourUtc) ? 'oracle' : 'worker';
}

export function isOraclePrimaryRefreshHour(now: Date = new Date()): boolean {
  return now.getUTCHours() === ORACLE_PRIMARY_REFRESH_HOUR_UTC;
}
