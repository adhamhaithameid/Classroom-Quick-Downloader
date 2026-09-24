import { describe, expect, it, vi, afterEach } from "vitest";
import worker from "../src/index";
import type { Env as WorkerEnv } from "../src/types";
import { TEST_DO_SHARED_SECRET } from "./helpers/dummy-secrets";

function makeKvMock(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
    store.set(key, value);
  });
  return { kv: { get, put }, get, put, store };
}

function makeWorkerEnv(kv: unknown, doFetch: (input: RequestInfo | URL) => Promise<Response>): WorkerEnv {
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => ({ fetch: doFetch }),
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    SITE_SNAPSHOT_KV: kv as unknown as WorkerEnv["SITE_SNAPSHOT_KV"],
    DO_SHARED_SECRET: TEST_DO_SHARED_SECRET,
    DANGER_PASSWORD: TEST_DO_SHARED_SECRET,
    MAX_BATCH_EVENTS: "10000",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cron fires pipeline-health alerts", () => {
  it("scheduled() pings DO /pipeline-health with the admin secret on every tick", async () => {
    const { kv } = makeKvMock();
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/pipeline-health")) {
        return new Response(JSON.stringify({ ok: true, status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const env = makeWorkerEnv(kv, doFetch);

    // UTC hour 02 sits outside the ORACLE pull/export hour sets, so the cron
    // run exercises the alert ping and the config KV refresh only.
    const controller = { scheduledTime: Date.UTC(2026, 8, 17, 2, 0, 0) };
    await worker.scheduled(controller as unknown as ScheduledController, env, {} as ExecutionContext);

    const healthCall = doFetch.mock.calls
      .map((call) => {
        const input = call[0] as RequestInfo | URL;
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const headers = input instanceof Request ? input.headers : undefined;
        return { url, headers };
      })
      .find((call) => call.url.includes("/pipeline-health"));

    expect(healthCall).toBeDefined();
    expect(healthCall?.headers?.get("x-admin-secret")).toBe(TEST_DO_SHARED_SECRET);
  });

  it("scheduled() survives a pipeline-health failure", async () => {
    const { kv } = makeKvMock();
    const doFetch = vi.fn(async () => {
      throw new Error("do unavailable");
    });
    const env = makeWorkerEnv(kv, doFetch);

    const controller = { scheduledTime: Date.UTC(2026, 8, 17, 2, 0, 0) };
    await expect(
      worker.scheduled(controller as unknown as ScheduledController, env, {} as ExecutionContext),
    ).resolves.toBeUndefined();
  });
});

describe("stale snapshot self-heal", () => {
  const STALE_SNAPSHOT = JSON.stringify({
    snapshotId: "ws-public-website-snapshot-test-1",
    generatedAtUtc: Date.now() - 7 * 60 * 60 * 1000,
    cacheWrittenAtUtc: Date.now() - 7 * 60 * 60 * 1000,
    overview: { totals: { downloads: 1 } },
    map: { countries: [] },
    changelog: { entries: [] },
  });

  it("re-puts the stale KV snapshot when the self-serve rebuild fails", async () => {
    const { kv, put, store } = makeKvMock({ "site:v1:snapshot": STALE_SNAPSHOT });
    const doFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = makeWorkerEnv(kv, doFetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("stores down");
      }),
    );

    const res = await worker.fetch(
      new Request("https://worker.example.com/api/public/website/snapshot"),
      env,
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-site-cache")).toBe("stale");
    // Self-heal: the stale payload is re-put verbatim so its KV TTL extends
    // and the fallback survives long outages of the self-serve pipeline.
    expect(put).toHaveBeenCalledWith("site:v1:snapshot", STALE_SNAPSHOT, expect.anything());
    expect(store.get("site:v1:snapshot")).toBe(STALE_SNAPSHOT);
  });

  it("rebuilds the stale snapshot from the self-serve pipeline without double-writing", async () => {
    const { kv, put } = makeKvMock({ "site:v1:snapshot": STALE_SNAPSHOT });
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/public/site-metrics")) {
        return new Response(
          JSON.stringify({
            ok: true,
            source: "cloudflare-worker",
            generatedAt: Date.now(),
            totals: { downloads: 500, success: 480, fail: 20, cancelled: 0, countries: 1 },
            countries: [{ countryCode: "US", count: 500 }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const env = makeWorkerEnv(kv, doFetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404 })),
    );

    const res = await worker.fetch(
      new Request("https://worker.example.com/api/public/website/snapshot"),
      env,
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-site-cache")).toBe("revalidated");
    // Exactly one SNAPSHOT write: the refreshed envelope, not the stale
    // self-heal. (Scrape-health bookkeeping writes its own key.)
    const snapshotPuts = put.mock.calls.filter((call) => call[0] === "site:v1:snapshot");
    expect(snapshotPuts).toHaveLength(1);
    const [key, value] = snapshotPuts[0];
    expect(key).toBe("site:v1:snapshot");
    expect(String(value)).toContain("ws-cf-selfserve-");
    expect(String(value)).toContain('"downloads":500');
  });
});
