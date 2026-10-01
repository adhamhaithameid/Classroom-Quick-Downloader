/**
 * ============================================================================
 * CACHE — request-scoped quota shields (Cloudflare quota incident 2026-09-30)
 * ============================================================================
 *
 * Cloudflare now counts Workers KV GET operations against the same 100,000/day
 * request budget as Worker invocations. The worker's hot paths (GET /config,
 * the website snapshot, store stats/trends/reviews) each did a KV read per
 * request, which — multiplied by extension polls and site visitors — burned
 * the daily budget and 429'd the whole account.
 *
 * cachedKvGet: an isolate-level memory cache in front of KV. Isolates persist
 * across requests, so a short TTL turns O(requests) KV reads into O(time).
 * Three properties (all tested):
 *   - TTL: fresh within the window, one KV read per window per isolate.
 *   - Single-flight: concurrent misses share one KV read (no stampede).
 *   - Stale-on-error: if KV throws — quota exhaustion, 429, transient — the
 *     last known value is served even past its TTL. A quota outage becomes a
 *     soft degradation instead of an error page.
 *
 * withEdgeCache: `caches.default` in front of expensive public GETs. Cache
 * hits skip the DO fetch and KV reads entirely. The worker is still invoked
 * (edge caching in front of the worker needs a Cloudflare Cache Rule —
 * recommended separately), but the internal quota pressure collapses.
 */

export interface KvLike {
  get: (key: string) => Promise<string | null>;
}

type CacheEntry = { value: string; at: number };

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

/** Evict entries older than this regardless of TTL — bounds memory. */
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 64;

export function clearKvCacheForTests(): void {
  memory.clear();
  inflight.clear();
}

/**
 * KV GET behind a TTL memory cache. `ttlMs` = how long a cached value is
 * served before the next read; on KV failure the stale value is served
 * regardless of age (null only when nothing was ever cached).
 */
export async function cachedKvGet(
  kv: KvLike | undefined,
  key: string,
  ttlMs: number,
): Promise<string | null> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;

  const pending = inflight.get(key);
  if (pending) return pending;

  const flight = (async (): Promise<string | null> => {
    let value: string | null = null;
    try {
      value = kv ? await kv.get(key) : null;
    } catch {
      // Quota exhaustion (429) or transient KV failure: fall through with
      // the stale value if we have one.
      const stale = memory.get(key);
      return stale ? stale.value : null;
    }
    if (value !== null && value !== undefined) {
      if (memory.size >= MAX_ENTRIES) {
        const oldest = [...memory.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) memory.delete(oldest[0]);
      }
      memory.set(key, { value, at: Date.now() });
    }
    return value;
  })();

  inflight.set(key, flight);
  try {
    return await flight;
  } finally {
    // Keep the resolved entry out of the inflight map; the memory map holds
    // the value now. Also drop entries past the hard age on the next read.
    inflight.delete(key);
    for (const [k, entry] of memory) {
      if (Date.now() - entry.at > MAX_AGE_MS) memory.delete(k);
    }
  }
}

/**
 * Edge-cache wrapper for expensive public GETs: on a `caches.default` hit the
 * producer never runs (no DO fetch, no KV reads); on a miss the produced
 * response is cached for `ttlSeconds`. Only GETs are cacheable; failures are
 * never cached.
 */
export async function withEdgeCache(
  request: Request,
  ttlSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  if (request.method !== "GET") return produce();
  let cache: Cache | null = null;
  try {
    // The worker runtime's CacheStorage has `default`; the DOM type does not.
    cache = (caches as unknown as { default?: Cache }).default ?? null;
  } catch {
    cache = null;
  }
  const url = new URL(request.url);
  const cacheKey = new Request(url.toString(), { method: "GET" });

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const res = new Response(hit.body, hit);
        res.headers.set("x-cqd-cache", "hit");
        return res;
      }
    } catch {
      // Cache API unavailable/misbehaving: just produce.
    }
  }

  const produced = await produce();
  if (produced.status === 200 && cache) {
    try {
      const cached = produced.clone();
      cached.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
      await cache.put(cacheKey, cached);
    } catch {
      // Cache put failures must never break the response.
    }
  }
  return produced;
}
