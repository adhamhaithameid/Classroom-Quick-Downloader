import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as WorkerEnv } from "../src/types";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { TEST_DANGER_PASSWORD, TEST_DO_SHARED_SECRET } from "./helpers/dummy-secrets";

// Key and TTL are specified by the plan; keep them verbatim here so a regression
// in either constant fails these tests.
const ANALYTICS_CONFIG_KV_KEY = "analytics:config:v1";
const ANALYTICS_CONFIG_KV_TTL_SECONDS = 604800;

function makeKvMock(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
    store.set(key, value);
  });
  const kv = { get, put };
  return { kv, get, put, store };
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
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
    ORACLE_ENDPOINT: "https://oracle.example.com/ingest-batch",
    MAX_BATCH_EVENTS: "10000",
  };
}

describe("Worker edge /config serving", () => {
  it("serves GET /config from KV with fresh serverTimeUtc and without calling the DO", async () => {
    const { kv } = makeKvMock({
      [ANALYTICS_CONFIG_KV_KEY]: JSON.stringify({
        ok: true,
        configVersion: 3,
        batchSize: 25,
        maxRetry: 20,
        flushMode: "next_day",
        remoteEnabled: true,
        remoteEnabledReason: "ok",
        changelogConfig: { applyMode: "auto", autoSyncEnabled: true },
      }),
    });
    const doFetch = vi.fn(async () => new Response("do should not be called", { status: 500 }));
    const env = makeWorkerEnv(kv, doFetch);

    const before = Date.now();
    const res = await worker.fetch(new Request("https://worker.example.com/config"), env, {} as ExecutionContext);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    // CORS applied the same way the DO proxy path applies it (public route).
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(body.ok).toBe(true);
    expect(body.batchSize).toBe(25);
    expect(body.maxRetry).toBe(20);
    expect(body.remoteEnabled).toBe(true);
    expect(typeof body.serverTimeUtc).toBe("number");
    expect(body.serverTimeUtc as number).toBeGreaterThanOrEqual(before);
    expect(body.serverTimeUtc as number).toBeLessThanOrEqual(Date.now());
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("falls back to the DO on KV miss", async () => {
    const { kv } = makeKvMock();
    const doFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, batchSize: 42, source: "do" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const env = makeWorkerEnv(kv, doFetch);

    const res = await worker.fetch(new Request("https://worker.example.com/config"), env, {} as ExecutionContext);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(body.batchSize).toBe(42);
    expect(body.source).toBe("do");
  });

  it("falls back to the DO on invalid KV JSON", async () => {
    const { kv } = makeKvMock({ [ANALYTICS_CONFIG_KV_KEY]: "{not valid json" });
    const doFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, batchSize: 7, source: "do" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const env = makeWorkerEnv(kv, doFetch);

    const res = await worker.fetch(new Request("https://worker.example.com/config"), env, {} as ExecutionContext);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(body.batchSize).toBe(7);
    expect(body.source).toBe("do");
  });

  it("scheduled() refreshes the config KV snapshot from the DO on every tick", async () => {
    const { kv, put } = makeKvMock();
    const doFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          batchSize: 30,
          maxRetry: 20,
          serverTimeUtc: 1234567890,
          committedSeq: 777,
          quota: { quotaLevel: "normal", modeLabel: "normal" },
          changelogConfig: { applyMode: "manual", autoSyncEnabled: false },
          remoteEnabled: true,
          remoteEnabledReason: "ok",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const env = makeWorkerEnv(kv, doFetch);

    // UTC hour 02 is outside both the ORACLE pull and export hour sets so the
    // cron run below only exercises the config KV refresh.
    const controller = { scheduledTime: Date.UTC(2026, 0, 15, 2, 0, 0) };
    await worker.scheduled(controller as unknown as ScheduledController, env, {} as ExecutionContext);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, value, opts] = put.mock.calls[0];
    expect(key).toBe(ANALYTICS_CONFIG_KV_KEY);
    const payload = JSON.parse(value as string) as Record<string, unknown>;
    expect("serverTimeUtc" in payload).toBe(false);
    expect("committedSeq" in payload).toBe(false);
    expect("quota" in payload).toBe(false);
    expect(payload.batchSize).toBe(30);
    expect(payload.maxRetry).toBe(20);
    expect(payload.changelogConfig).toEqual({ applyMode: "manual", autoSyncEnabled: false });
    expect(payload.remoteEnabled).toBe(true);
    expect(opts).toEqual({ expirationTtl: ANALYTICS_CONFIG_KV_TTL_SECONDS });
  });

  it("never serves committedSeq or quota from the KV-hit path", async () => {
    const { kv } = makeKvMock({
      [ANALYTICS_CONFIG_KV_KEY]: JSON.stringify({
        ok: true,
        batchSize: 25,
        maxRetry: 20,
        changelogConfig: { applyMode: "auto" },
        remoteEnabled: true,
      }),
    });
    const doFetch = vi.fn(async () => new Response("do should not be called", { status: 500 }));
    const env = makeWorkerEnv(kv, doFetch);

    const res = await worker.fetch(new Request("https://worker.example.com/config"), env, {} as ExecutionContext);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(typeof body.serverTimeUtc).toBe("number");
    expect("committedSeq" in body).toBe(false);
    expect("quota" in body).toBe(false);
    expect(doFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DO-side snapshot writes (handleAdminUpdateConfig)
// ---------------------------------------------------------------------------

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  seed(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(ts: number): Promise<void> {
    this.alarm = ts;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise.catch(() => {}));
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
    this.pending = [];
  }
}

function makeDOWithKv(kv: unknown) {
  const state = new MockState();
  const env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    SITE_SNAPSHOT_KV: kv,
  } as unknown as DownloadsEnv;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

async function updateConfig(obj: DownloadsDurable, body: Record<string, unknown>): Promise<Response> {
  return obj.fetch(new Request("http://do/admin/update-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": "secret",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  }));
}

describe("DownloadsDurable config KV snapshot", () => {
  it("writes the config snapshot to KV on admin update-config", async () => {
    const { kv, put } = makeKvMock();
    const { obj } = makeDOWithKv(kv);

    const res = await updateConfig(obj, { batchSize: 33 });
    expect(res.status).toBe(200);
    const payload = await res.json() as { ok?: boolean; config?: { batchSize?: number } };
    expect(payload.ok).toBe(true);
    expect(payload.config?.batchSize).toBe(33);

    // The config actually changed in the DO.
    const cfgRes = await obj.fetch(new Request("http://do/config"));
    expect(cfgRes.status).toBe(200);
    const cfg = await cfgRes.json() as { batchSize?: number };
    expect(cfg.batchSize).toBe(33);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, value, opts] = put.mock.calls[0];
    expect(key).toBe(ANALYTICS_CONFIG_KV_KEY);
    const snapshot = JSON.parse(value as string) as Record<string, unknown>;
    expect("serverTimeUtc" in snapshot).toBe(false);
    expect("committedSeq" in snapshot).toBe(false);
    expect("quota" in snapshot).toBe(false);
    expect(snapshot.batchSize).toBe(33);
    expect(typeof snapshot.maxRetry).toBe("number");
    expect(snapshot.changelogConfig).toEqual(expect.any(Object));
    expect(snapshot.remoteEnabled).toBe(true);
    expect(opts).toEqual({ expirationTtl: ANALYTICS_CONFIG_KV_TTL_SECONDS });
  });

  it("does not fail the admin response when the KV write throws", async () => {
    const put = vi.fn(async () => {
      throw new Error("kv unavailable");
    });
    const kv = { get: vi.fn(async () => null), put };
    const { obj } = makeDOWithKv(kv);

    const res = await updateConfig(obj, { batchSize: 44 });
    expect(res.status).toBe(200);
    const payload = await res.json() as { ok?: boolean; config?: { batchSize?: number } };
    expect(payload.ok).toBe(true);
    expect(payload.config?.batchSize).toBe(44);
    expect(put).toHaveBeenCalledTimes(1);
  });
});
