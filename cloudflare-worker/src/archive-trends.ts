/**
 * Downloads-over-time trends computed from the D1 event archive. Each archived
 * extension batch carries aggregated hourly time buckets; this module folds
 * the recent rows into a compact per-day series for the public website and
 * admin consoles.
 */

export type TrendDay = {
  /** UTC date, e.g. "2026-09-21" */
  date: string;
  downloads: number;
};

export type TrendsSeries = {
  /** Oldest → newest, at most `windowDays` entries, missing days are 0. */
  daily: TrendDay[];
  /** Percent change of the last 7 days vs the previous 7; null when the prior week had no data. */
  weekOverWeekPercent: number | null;
  computedAtUtc: number;
};

export type ArchiveRowInput = {
  created_at_utc?: unknown;
  payload?: unknown;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function extractDailyDownloads(payloadText: string, buckets: Map<string, number>): void {
  let parsed: {
    timeBuckets?: Array<{ bucketStart?: unknown; totals?: { totalDownloads?: unknown } }>;
  };
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    return;
  }
  if (!parsed || !Array.isArray(parsed.timeBuckets)) return;
  for (const bucket of parsed.timeBuckets) {
    const start = Date.parse(String(bucket.bucketStart ?? ""));
    const downloads = Number(bucket.totals?.totalDownloads);
    if (!Number.isFinite(start) || start <= 0) continue;
    if (!Number.isFinite(downloads) || downloads <= 0) continue;
    const key = utcDateKey(start);
    buckets.set(key, (buckets.get(key) ?? 0) + downloads);
  }
}

/**
 * Compute the trends series from raw archive rows. Rows older than the window
 * are ignored; days with no archive coverage read as zero.
 */
export function computeTrends(
  rows: ArchiveRowInput[],
  opts: { now?: number; windowDays?: number } = {},
): TrendsSeries {
  const now = typeof opts.now === "number" && opts.now > 0 ? opts.now : Date.now();
  const windowDays = Math.min(Math.max(opts.windowDays ?? 28, 7), 90);
  const todayStart = Math.floor(now / MS_PER_DAY) * MS_PER_DAY;
  const windowStart = todayStart - (windowDays - 1) * MS_PER_DAY;

  const buckets = new Map<string, number>();
  for (const row of rows) {
    const createdAt = Number(row?.created_at_utc);
    if (!Number.isFinite(createdAt) || createdAt < windowStart - MS_PER_DAY) continue;
    const payloadText = typeof row?.payload === "string" ? row.payload : "";
    if (!payloadText) continue;
    extractDailyDownloads(payloadText, buckets);
  }

  const daily: TrendDay[] = [];
  for (let dayStart = windowStart; dayStart <= todayStart; dayStart += MS_PER_DAY) {
    const key = utcDateKey(dayStart);
    daily.push({ date: key, downloads: buckets.get(key) ?? 0 });
  }

  const sum = (days: TrendDay[]): number => days.reduce((total, day) => total + day.downloads, 0);
  const currentWeek = sum(daily.slice(-7));
  const previousWeek = sum(daily.slice(-14, -7));
  let weekOverWeekPercent: number | null = null;
  if (previousWeek > 0) {
    weekOverWeekPercent = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
  } else if (currentWeek > 0) {
    weekOverWeekPercent = 100;
  }

  return { daily, weekOverWeekPercent, computedAtUtc: now };
}
