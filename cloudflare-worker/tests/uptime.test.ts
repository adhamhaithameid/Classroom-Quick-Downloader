import { describe, expect, it, vi } from "vitest";
import {
  appendUptimeCheck,
  computeUptimeSummary,
  emptyUptimeRing,
  parseUptimeRing,
  recordUptimeCheck,
  runUptimeSelfCheck,
  UPTIME_HOURLY_CAP,
  UPTIME_RING_CAP,
} from "../src/uptime";
import worker from "../src/index";
import type { Env } from "../src/types";
import { TEST_DASHBOARD_PASSWORD, TEST_DANGER_PASSWORD, TEST_SHARED_SECRET } from "./helpers/dummy-secrets";

function makeEntry(ok: boolean, timestamp: number, latencyMs = 42) {
  return { timestamp, ok, latencyMs };
}

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("uptime ring", () => {
  it("appends checks and caps the recent ring at 288 entries (24h)", () => {
    let ring = emptyUptimeRing();
    const total = UPTIME_RING_CAP + 20;
    for (let i = 0; i < total; i++) {
      ring = appendUptimeCheck(ring, makeEntry(true, 1_000 + i * 300_000));
    }
    expect(ring.recent.length).toBe(UPTIME_RING_CAP);
    // Oldest entries drop off the front.
    expect(ring.recent[0].timestamp).toBe(1_000 + 20 * 300_000);
  });

  it("folds checks into hourly buckets and caps them at 168 (7d)", () => {
    let ring = emptyUptimeRing();
    // 4 checks inside one hour collapse into one bucket.
    for (let i = 0; i < 4; i++) {
      ring = appendUptimeCheck(ring, makeEntry(i !== 3, 3_600_000 + i * 60_000));
    }
    expect(ring.hourly.length).toBe(1);
    expect(ring.hourly[0]).toEqual({ hourStart: 3_600_000, total: 4, okCount: 3 });

    const totalHours = UPTIME_HOURLY_CAP + 5;
    for (let h = 0; h < totalHours; h++) {
      ring = appendUptimeCheck(ring, makeEntry(true, (h + 2) * 3_600_000));
    }
    expect(ring.hourly.length).toBe(UPTIME_HOURLY_CAP);
  });

  it("computes uptime percentages on a fixture ring", () => {
    let ring = emptyUptimeRing();
    for (let i = 0; i < 288; i++) {
      ring = appendUptimeCheck(ring, makeEntry(i % 29 !== 0, i * 300_000));
    }
    // 10 of 288 checks failed -> 278/288 = 96.5%.
    const summary = computeUptimeSummary(ring);
    expect(summary.checks24h).toBe(288);
    expect(summary.uptime24h).toBe(96.5);
    expect(summary.lastCheck?.ok).toBe(true);
    expect(summary.consecutiveFailures).toBe(0);
  });

  it("counts consecutive failures from the tail of the ring", () => {
    let ring = emptyUptimeRing();
    for (let i = 0; i < 10; i++) {
      ring = appendUptimeCheck(ring, makeEntry(i < 7, i * 300_000));
    }
    const summary = computeUptimeSummary(ring);
    expect(summary.consecutiveFailures).toBe(3);
    expect(summary.lastCheck?.ok).toBe(false);
  });

  it("reports an honest zero state for an empty ring", () => {
    const summary = computeUptimeSummary(emptyUptimeRing());
    expect(summary.lastCheck).toBeNull();
    expect(summary.uptime24h).toBeNull();
    expect(summary.uptime7d).toBeNull();
    expect(summary.checks24h).toBe(0);
  });

  it("ignores malformed KV payloads", () => {
    expect(parseUptimeRing(null)).toEqual(emptyUptimeRing());
    expect(parseUptimeRing("not json")).toEqual(emptyUptimeRing());
    expect(parseUptimeRing('{"recent":"nope","hourly":1}')).toEqual(emptyUptimeRing());
  });
});

describe("uptime recording", () => {
  it("persists ok and failure checks into KV", async () => {
    const kv = memoryKv();
    await recordUptimeCheck({ SITE_SNAPSHOT_KV: kv }, makeEntry(true, 1_000, 33));
    await recordUptimeCheck({ SITE_SNAPSHOT_KV: kv }, makeEntry(false, 4_000, 8_000));

    const ring = parseUptimeRing(kv.store.get("site:v1:uptime") ?? null);
    expect(ring.recent.length).toBe(2);
    expect(ring.recent[0]).toEqual({ timestamp: 1_000, ok: true, latencyMs: 33 });
    expect(ring.recent[1].ok).toBe(false);
    const summary = computeUptimeSummary(ring);
    expect(summary.uptime24h).toBe(50);
    expect(summary.consecutiveFailures).toBe(1);
  });

  it("stays a no-op without a KV binding and survives KV errors", async () => {
    await expect(recordUptimeCheck({}, makeEntry(true, 1_000))).resolves.toBeUndefined();
    const throwingKv = {
      get: async () => {
        throw new Error("kv down");
      },
      put: async () => {
        throw new Error("kv down");
      },
    };
    await expect(
      recordUptimeCheck({ SITE_SNAPSHOT_KV: throwingKv }, makeEntry(true, 1_000)),
    ).resolves.toBeUndefined();
  });
});

describe("uptime self-check", () => {
  it("records a successful ping with measured latency", async () => {
    const kv = memoryKv();
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const entry = await runUptimeSelfCheck({ SITE_SNAPSHOT_KV: kv }, 5_000, fetchImpl as unknown as typeof fetch);

    expect(entry.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(calledUrl).toContain("/uptime-ping");
    const ring = parseUptimeRing(kv.store.get("site:v1:uptime") ?? null);
    expect(ring.recent.length).toBe(1);
  });

  it("records a failure when the ping errors or returns non-2xx", async () => {
    const kv = memoryKv();
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const entry = await runUptimeSelfCheck({ SITE_SNAPSHOT_KV: kv }, 5_000, fetchImpl as unknown as typeof fetch);
    expect(entry.ok).toBe(false);

    const failingKv = memoryKv();
    const http500 = vi.fn(async () => new Response("nope", { status: 500 }));
    const entry500 = await runUptimeSelfCheck(
      { SITE_SNAPSHOT_KV: failingKv },
      6_000,
      http500 as unknown as typeof fetch,
    );
    expect(entry500.ok).toBe(false);
    const ring = parseUptimeRing(failingKv.store.get("site:v1:uptime") ?? null);
    expect(ring.recent.length).toBe(1);
    expect(ring.recent[0].ok).toBe(false);
  });
});

function makeEnv(kv: ReturnType<typeof memoryKv>, overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: TEST_SHARED_SECRET,
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
    MAX_BATCH_EVENTS: "10000",
    SITE_SNAPSHOT_KV: kv as unknown as Env["SITE_SNAPSHOT_KV"],
    ...overrides,
  };
}

describe("uptime-ping route", () => {
  it("answers ok without touching the DO", async () => {
    const doFetch = vi.fn(
      async () => new Response("should not be called", { status: 500 }),
    );
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetch }),
    };
    const env = makeEnv(memoryKv(), {
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    });

    const response = await worker.fetch(
      new Request("https://worker.example.com/uptime-ping", { method: "GET" }),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean; ts: number };
    expect(payload.ok).toBe(true);
    expect(typeof payload.ts).toBe("number");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe("cron dispatch", () => {
  function scheduledEnv(kv: ReturnType<typeof memoryKv>, doFetch: (url: string) => Promise<Response>) {
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetch }),
    };
    return makeEnv(memoryKv(), {
      SITE_SNAPSHOT_KV: kv as unknown as Env["SITE_SNAPSHOT_KV"],
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    });
  }

  it("runs the uptime self-check on the 5-minute trigger and skips hourly jobs", async () => {
    const kv = memoryKv();
    const doFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = scheduledEnv(kv, doFetch as (url: string) => Promise<Response>);
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    try {
      await worker.scheduled(
        { cron: "*/5 * * * *", scheduledTime: 1_000 } as ScheduledController,
        env,
        {} as ExecutionContext,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/uptime-ping");
    // Hourly jobs (config refresh, pipeline ping) must not run on this trigger.
    expect(doFetch).not.toHaveBeenCalled();
    const ring = parseUptimeRing(kv.store.get("site:v1:uptime") ?? null);
    expect(ring.recent.length).toBe(1);
  });

  it("does not run the uptime self-check on the hourly trigger", async () => {
    const kv = memoryKv();
    const doFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = scheduledEnv(kv, doFetch as (url: string) => Promise<Response>);
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    try {
      await worker.scheduled(
        { cron: "0 * * * *", scheduledTime: 1_000 } as ScheduledController,
        env,
        {} as ExecutionContext,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // The 5-minute trigger never fires on the hourly tick; the AMO user
    // refresh (also hourly, TTL-gated) may fetch, but not the ping.
    const pingCalls = fetchImpl.mock.calls.filter((call) => String(call[0]).includes("/uptime-ping"));
    expect(pingCalls.length).toBe(0);
    expect(doFetch).toHaveBeenCalled();
    expect(kv.store.get("site:v1:uptime") ?? null).toBeNull();
  });
});
