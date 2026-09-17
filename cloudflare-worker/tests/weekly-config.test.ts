import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as WorkerEnv } from "../src/types";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { TEST_DANGER_PASSWORD, TEST_DO_SHARED_SECRET } from "./helpers/dummy-secrets";

// W2: flushMode 'weekly' config plumbing — DO default, one-time legacy
// 'next_day' migration, sanitizer + /admin/update-config acceptance, and
// KV snapshot / edge /config passthrough.
const ANALYTICS_CONFIG_KV_KEY = "analytics:config:v1";

const STORAGE_KEY = "analytics_state";

// MockStorage/MockState copied from tests/quota-guard.test.ts: the DO is
// instantiated directly with a mocked DurableObjectState, and tests seed
// persisted state by writing the STORAGE_KEY core shape before constructing
// the DO.
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

function makeKvMock(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const put = vi.fn(async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
    store.set(key, value);
  });
  const kv = { get, put };
  return { kv, get, put, store };
}

type SeededState = {
  configFlushMode?: string;
};

function makeDO(stored?: SeededState, kv?: unknown) {
  const state = new MockState();
  if (stored) {
    state.storage.seed(STORAGE_KEY, stored);
  }
  const env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    SITE_SNAPSHOT_KV: kv,
  } as unknown as DownloadsEnv;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

async function doGet(obj: DownloadsDurable, path: string): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await obj.fetch(new Request(`http://do${path}`, { method: "GET" }));
  const body = (await res.json()) as Record<string, unknown>;
  return { res, body };
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

describe("flushMode weekly config plumbing (DO)", () => {
  it("a) a fresh DO defaults /config flushMode to weekly", async () => {
    const { obj } = makeDO();

    const { body } = await doGet(obj, "/config");
    expect(body.flushMode).toBe("weekly");
  });

  it("b) migrates a persisted legacy default of next_day to weekly", async () => {
    const { obj } = makeDO({ configFlushMode: "next_day" });

    const { body } = await doGet(obj, "/config");
    expect(body.flushMode).toBe("weekly");
  });

  it("b) keeps an admin-set configFlushMode of time_based", async () => {
    const { obj } = makeDO({ configFlushMode: "time_based" });

    const { body } = await doGet(obj, "/config");
    expect(body.flushMode).toBe("time_based");
  });

  it("c) sanitizer lets a stored weekly mode survive load", async () => {
    const { obj } = makeDO({ configFlushMode: "weekly" });

    const { body } = await doGet(obj, "/config");
    expect(body.flushMode).toBe("weekly");
  });

  it("d) POST /admin/update-config accepts flushMode weekly and persists it", async () => {
    const { obj } = makeDO();

    const res = await updateConfig(obj, { flushMode: "weekly" });
    expect(res.status).toBe(200);
    const payload = await res.json() as { ok?: boolean; config?: { flushMode?: string } };
    expect(payload.ok).toBe(true);
    expect(payload.config?.flushMode).toBe("weekly");

    const { body } = await doGet(obj, "/config");
    expect(body.flushMode).toBe("weekly");
  });

  it("d) POST /admin/update-config rejects a genuinely invalid flushMode", async () => {
    const { obj } = makeDO();

    const res = await updateConfig(obj, { flushMode: "hourly" });
    expect(res.status).toBe(400);
    const payload = await res.json() as { ok?: boolean; error?: string; fields?: string[] };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("invalid_config");
    expect(payload.fields).toContain("flushMode");
  });
});

describe("flushMode weekly in the KV snapshot and edge /config", () => {
  it("e) the KV snapshot built from a fresh DO carries flushMode weekly", async () => {
    const { kv, store, put } = makeKvMock();
    const { obj } = makeDO(undefined, kv);

    // Any accepted admin write republishes the config snapshot to KV.
    const res = await updateConfig(obj, { batchSize: 33 });
    expect(res.status).toBe(200);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, value] = put.mock.calls[0];
    expect(key).toBe(ANALYTICS_CONFIG_KV_KEY);
    const snapshot = JSON.parse(value as string) as Record<string, unknown>;
    expect(snapshot.flushMode).toBe("weekly");
    expect(store.get(ANALYTICS_CONFIG_KV_KEY)).toContain('"flushMode":"weekly"');
  });

  it("e) the edge /config KV-hit path preserves flushMode from the snapshot", async () => {
    const { kv } = makeKvMock({
      [ANALYTICS_CONFIG_KV_KEY]: JSON.stringify({
        ok: true,
        batchSize: 25,
        maxRetry: 20,
        flushMode: "weekly",
        remoteEnabled: true,
      }),
    });
    const doFetch = vi.fn(async () => new Response("do should not be called", { status: 500 }));
    const env = makeWorkerEnv(kv, doFetch);

    const res = await worker.fetch(new Request("https://worker.example.com/config"), env, {} as ExecutionContext);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.flushMode).toBe("weekly");
    expect(doFetch).not.toHaveBeenCalled();
  });
});
