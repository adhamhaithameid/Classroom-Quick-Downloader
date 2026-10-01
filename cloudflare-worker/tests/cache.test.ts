import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedKvGet, clearKvCacheForTests, withEdgeCache, type KvLike } from "../src/cache";

// ============================================================================
// QUOTA SHIELDS (Cloudflare quota incident 2026-09-30: KV GETs count against
// the 100k/day request budget; hot paths did one KV read per request).
// cachedKvGet: TTL memory cache, single-flight, stale-on-error.
// withEdgeCache: caches.default in front of expensive public GETs.
// ============================================================================

function makeKv(script: Array<{ value: string | null; fail?: boolean }> = []): {
  kv: KvLike;
  calls: { n: number };
} {
  const calls = { n: 0 };
  let i = 0;
  return {
    calls,
    kv: {
      get: async () => {
        calls.n += 1;
        const step = script[Math.min(i, script.length - 1)];
        i += 1;
        if (step?.fail) throw new Error("429 quota exceeded");
        return step?.value ?? null;
      },
    },
  };
}

describe("cachedKvGet — quota shield", () => {
  it("serves repeated reads from memory: one KV read within the TTL", async () => {
    clearKvCacheForTests();
    const { kv, calls } = makeKv([{ value: '{"a":1}' }]);
    const first = await cachedKvGet(kv, "k1", 60_000);
    const second = await cachedKvGet(kv, "k1", 60_000);
    const third = await cachedKvGet(kv, "k1", 60_000);
    expect(first).toBe('{"a":1}');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(calls.n).toBe(1);
  });

  it("reads again after the TTL expires", async () => {
    clearKvCacheForTests();
    vi.useFakeTimers();
    try {
      const { kv, calls } = makeKv([{ value: "v1" }, { value: "v2" }]);
      const t0 = Date.now();
      expect(await cachedKvGet(kv, "k", 1_000)).toBe("v1");
      vi.setSystemTime(t0 + 1_500);
      expect(await cachedKvGet(kv, "k", 1_000)).toBe("v2");
      expect(calls.n).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("single-flight: concurrent misses share one KV read", async () => {
    clearKvCacheForTests();
    const { kv, calls } = makeKv([{ value: "shared" }]);
    const results = await Promise.all([
      cachedKvGet(kv, "k", 60_000),
      cachedKvGet(kv, "k", 60_000),
      cachedKvGet(kv, "k", 60_000),
    ]);
    expect(results).toEqual(["shared", "shared", "shared"]);
    expect(calls.n).toBe(1);
  });

  it("stale-on-error: serves the last value when KV starts throwing (quota 429)", async () => {
    clearKvCacheForTests();
    const { kv } = makeKv([{ value: "last-good" }, { fail: true }, { fail: true }]);
    const t0 = Date.now();
    expect(await cachedKvGet(kv, "k", 1_000)).toBe("last-good");
    // Past TTL and failing: stale value still served — a quota outage is a
    // soft degradation, not an error page.
    vi.setSystemTime(t0 + 60_000);
    expect(await cachedKvGet(kv, "k", 1_000)).toBe("last-good");
    vi.setSystemTime(t0 + 120_000);
    expect(await cachedKvGet(kv, "k", 1_000)).toBe("last-good");
  });

  it("returns null when there is no binding and nothing cached", async () => {
    clearKvCacheForTests();
    expect(await cachedKvGet(undefined, "k", 60_000)).toBeNull();
  });
});

describe("withEdgeCache — quota shield", () => {
  function installCaches(hitResponse?: Response) {
    const puts: Array<{ key: string; status: number }> = [];
    (globalThis as any).caches = {
      default: {
        match: vi.fn(async () => hitResponse ?? undefined),
        put: vi.fn(async (req: Request, res: Response) => {
          puts.push({ key: req.url, status: res.status });
        }),
      },
    };
    return puts;
  }

  afterEach(() => {
    delete (globalThis as any).caches;
  });

  it("produces and caches on miss (200 only)", async () => {
    const puts = installCaches();
    const produced = vi.fn(async () => new Response("{}", { status: 200 }));
    const req = new Request("https://worker.test/config");
    const res = await withEdgeCache(req, 120, produced);
    expect(await res.text()).toBe("{}");
    expect(res.headers.get("x-cqd-cache")).toBeNull();
    expect(produced).toHaveBeenCalledTimes(1);
    expect(puts).toHaveLength(1);
  });

  it("serves the cached copy on hit without producing", async () => {
    installCaches(new Response('{"hit":true}', { status: 200 }));
    const produced = vi.fn(async () => new Response("{}"));
    const res = await withEdgeCache(new Request("https://worker.test/config"), 120, produced);
    expect(await res.text()).toContain("hit");
    expect(res.headers.get("x-cqd-cache")).toBe("hit");
    expect(produced).not.toHaveBeenCalled();
  });

  it("never caches failures, and skips non-GET requests", async () => {
    const puts = installCaches();
    const failing = vi.fn(async () => new Response("boom", { status: 500 }));
    await withEdgeCache(new Request("https://worker.test/config"), 120, failing);
    expect(puts).toHaveLength(0);

    const postProduced = vi.fn(async () => new Response("{}"));
    await withEdgeCache(
      new Request("https://worker.test/track", { method: "POST" }),
      120,
      postProduced,
    );
    expect(postProduced).toHaveBeenCalledTimes(1);
    expect(puts).toHaveLength(0);
  });

  it("works without the Cache API (caches undefined)", async () => {
    delete (globalThis as any).caches;
    const produced = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await withEdgeCache(new Request("https://worker.test/config"), 120, produced);
    expect(res.status).toBe(200);
    expect(produced).toHaveBeenCalledTimes(1);
  });
});
