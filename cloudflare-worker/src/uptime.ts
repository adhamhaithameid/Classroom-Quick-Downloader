/**
 * Worker uptime self-check.
 *
 * A dedicated 5-minute cron trigger fetches the worker's own public
 * /uptime-ping route and records the result into a bounded KV ring. One KV
 * value holds both the 24h ring (288 entries at 5-minute granularity) and the
 * 7d hourly rollups (168 buckets), so each check costs exactly one KV read
 * and one KV write (288/day — inside the free-plan KV write budget).
 *
 * /uptime-ping is deliberately separate from /health: /health proxies into
 * the Durable Object, so a DO hiccup would fail the check even while the
 * worker itself serves fine, and 288 checks/day would burn DO requests for
 * no extra signal. The ping route touches neither the DO nor KV.
 */

export const UPTIME_KV_KEY = "site:v1:uptime";
export const UPTIME_RING_CAP = 288; // 5 min * 288 = 24h of checks
export const UPTIME_HOURLY_CAP = 168; // 168 hourly buckets = 7d
export const UPTIME_PING_PATH = "/uptime-ping";

/** Public workers.dev base URL (same constant the dashboard links use). */
export const WORKER_PUBLIC_BASE_URL = "https://cqd-analytics.adhamhaithameid.workers.dev";

export interface UptimeCheckEntry {
  /** Epoch ms of the check. */
  timestamp: number;
  ok: boolean;
  latencyMs: number;
}

export interface UptimeHourlyBucket {
  /** Epoch ms of the bucket's hour start. */
  hourStart: number;
  total: number;
  okCount: number;
}

export interface UptimeRing {
  recent: UptimeCheckEntry[];
  hourly: UptimeHourlyBucket[];
}

export interface UptimeSummary {
  lastCheck: UptimeCheckEntry | null;
  /** Percent 0-100 over the 24h ring; null when no checks recorded yet. */
  uptime24h: number | null;
  /** Percent 0-100 over the 7d hourly rollups; null when no data yet. */
  uptime7d: number | null;
  checks24h: number;
  checks7d: number;
  consecutiveFailures: number;
}

export function emptyUptimeRing(): UptimeRing {
  return { recent: [], hourly: [] };
}

function isUptimeRing(value: unknown): value is UptimeRing {
  if (!value || typeof value !== "object") return false;
  const ring = value as Partial<UptimeRing>;
  return Array.isArray(ring.recent) && Array.isArray(ring.hourly);
}

function hourStartOf(ts: number): number {
  return Math.floor(ts / 3_600_000) * 3_600_000;
}

/**
 * Fold one check into the ring. Pure: returns a new bounded structure
 * (oldest entries drop past the caps).
 */
export function appendUptimeCheck(ring: UptimeRing, entry: UptimeCheckEntry): UptimeRing {
  const recent = [...ring.recent, entry].slice(-UPTIME_RING_CAP);

  const bucketStart = hourStartOf(entry.timestamp);
  const hourly = [...ring.hourly];
  const lastIndex = hourly.length - 1;
  if (lastIndex >= 0 && hourly[lastIndex].hourStart === bucketStart) {
    hourly[lastIndex] = {
      hourStart: bucketStart,
      total: hourly[lastIndex].total + 1,
      okCount: hourly[lastIndex].okCount + (entry.ok ? 1 : 0),
    };
  } else {
    hourly.push({ hourStart: bucketStart, total: 1, okCount: entry.ok ? 1 : 0 });
  }
  return { recent, hourly: hourly.slice(-UPTIME_HOURLY_CAP) };
}

export function parseUptimeRing(raw: string | null): UptimeRing {
  if (!raw) return emptyUptimeRing();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isUptimeRing(parsed)) return emptyUptimeRing();
    const recent = parsed.recent.filter(
      (entry): entry is UptimeCheckEntry =>
        !!entry &&
        typeof entry.timestamp === "number" &&
        Number.isFinite(entry.timestamp) &&
        typeof entry.ok === "boolean" &&
        typeof entry.latencyMs === "number" &&
        Number.isFinite(entry.latencyMs),
    );
    const hourly = parsed.hourly.filter(
      (bucket): bucket is UptimeHourlyBucket =>
        !!bucket &&
        typeof bucket.hourStart === "number" &&
        Number.isFinite(bucket.hourStart) &&
        typeof bucket.total === "number" &&
        Number.isFinite(bucket.total) &&
        typeof bucket.okCount === "number" &&
        Number.isFinite(bucket.okCount),
    );
    return { recent, hourly };
  } catch {
    return emptyUptimeRing();
  }
}

function percent(ok: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((ok / total) * 1000) / 10;
}

export function computeUptimeSummary(ring: UptimeRing, _now = Date.now()): UptimeSummary {
  let consecutiveFailures = 0;
  for (let i = ring.recent.length - 1; i >= 0; i--) {
    if (ring.recent[i].ok) break;
    consecutiveFailures += 1;
  }
  const lastCheck = ring.recent.length > 0 ? ring.recent[ring.recent.length - 1] : null;
  const total24h = ring.recent.length;
  const ok24h = ring.recent.filter((entry) => entry.ok).length;
  const total7d = ring.hourly.reduce((sum, bucket) => sum + bucket.total, 0);
  const ok7d = ring.hourly.reduce((sum, bucket) => sum + bucket.okCount, 0);
  return {
    lastCheck,
    uptime24h: percent(ok24h, total24h),
    uptime7d: percent(ok7d, total7d),
    checks24h: total24h,
    checks7d: total7d,
    consecutiveFailures,
  };
}

/** Read-modify-write the ring in KV. Best-effort: KV failure must not break the cron. */
export async function recordUptimeCheck(
  env: { SITE_SNAPSHOT_KV?: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> } },
  entry: UptimeCheckEntry,
): Promise<void> {
  const kv = env.SITE_SNAPSHOT_KV;
  if (!kv) return;
  try {
    const ring = parseUptimeRing(await kv.get(UPTIME_KV_KEY));
    const next = appendUptimeCheck(ring, entry);
    await kv.put(UPTIME_KV_KEY, JSON.stringify(next));
  } catch {
    // Uptime history is observability, not a correctness path.
  }
}

export async function readUptimeSummary(env: {
  SITE_SNAPSHOT_KV?: { get(key: string): Promise<string | null> };
}): Promise<UptimeSummary | null> {
  const kv = env.SITE_SNAPSHOT_KV;
  if (!kv) return null;
  try {
    return computeUptimeSummary(parseUptimeRing(await kv.get(UPTIME_KV_KEY)));
  } catch {
    return null;
  }
}

/**
 * Fetch the worker's own /uptime-ping route, measure latency, and record the
 * result. Never throws: a failed fetch records an ok=false entry.
 */
export async function runUptimeSelfCheck(
  env: Parameters<typeof recordUptimeCheck>[0],
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<UptimeCheckEntry> {
  const started = Date.now();
  let ok = false;
  try {
    const response = await fetchImpl(`${WORKER_PUBLIC_BASE_URL}${UPTIME_PING_PATH}`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "cqd-uptime-selfcheck" },
    });
    ok = response.ok;
  } catch {
    ok = false;
  }
  const entry: UptimeCheckEntry = {
    timestamp: now,
    ok,
    latencyMs: Math.max(0, Date.now() - started),
  };
  await recordUptimeCheck(env, entry);
  return entry;
}
