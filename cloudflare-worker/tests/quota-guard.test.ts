import { describe, it, expect } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

const STORAGE_KEY = "analytics_state";

// MockStorage/MockState copied from tests/security.test.ts: the DO is
// instantiated directly with a mocked DurableObjectState, and tests seed
// persisted state by writing the sharded STORAGE_KEY core shape before
// constructing the DO.
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

type SeededState = {
  reqCountDate?: string | null;
  reqCountToday?: number;
  reqDailyCounts?: Record<string, number>;
  doRequestsToday?: number;
  configMaxRetry?: number;
};

function makeDO(stored?: SeededState) {
  const state = new MockState();
  if (stored) {
    state.storage.seed(STORAGE_KEY, stored);
  }
  const env: Env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function utcDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function doGet(obj: DownloadsDurable, path: string): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await obj.fetch(new Request(`http://do${path}`, { method: "GET" }));
  const body = (await res.json()) as Record<string, unknown>;
  return { res, body };
}

// Seed state so ensureRequestDay() keeps reqCountToday at `count` for today:
// reqCountDate must be today (no rollover reset) and reqDailyCounts[today]
// must agree (ensureRequestDay re-syncs reqCountToday from it).
function seededRequestCount(count: number): SeededState {
  const today = utcDateKey(0);
  return {
    reqCountDate: today,
    reqCountToday: count,
    reqDailyCounts: { [today]: count },
  };
}

describe("DO request counter (quota guard counts every DO request)", () => {
  it("counts two /config calls plus the /stats read in doRequestsToday", async () => {
    const { obj } = makeDO();

    await doGet(obj, "/config");
    await doGet(obj, "/config");
    const { res, body } = await doGet(obj, "/stats");

    expect(res.status).toBe(200);
    // Two /config fetches + this /stats fetch (which is itself a DO request,
    // because the guard counts EVERY request to the singleton DO).
    expect(body.doRequestsToday).toBe(3);
  });

  it("a single /stats read on a fresh DO reports doRequestsToday 1", async () => {
    const { obj } = makeDO();

    const { body } = await doGet(obj, "/stats");

    expect(body.doRequestsToday).toBe(1);
  });

  it("resets doRequestsToday when the UTC day rolls over", async () => {
    const { obj } = makeDO({
      reqCountDate: utcDateKey(-1),
      doRequestsToday: 999,
    });

    const { body } = await doGet(obj, "/stats");

    // Rollover resets the counter to 0; the /stats request itself counts as 1.
    expect(body.doRequestsToday).toBe(1);
    expect(body.requestDate).toBe(utcDateKey(0));
  });
});

describe("quota emergency cutoff at 70k combined DO requests", () => {
  it("returns remoteEnabled:false and QUOTA_VERY_HARD_LIMIT at 70000", async () => {
    const { obj } = makeDO(seededRequestCount(70_000));

    const { body } = await doGet(obj, "/config");

    expect(body.remoteEnabled).toBe(false);
    const quota = body.quota as { quotaLevel?: string };
    expect(quota.quotaLevel).toBe("QUOTA_VERY_HARD_LIMIT");
  });

  it("keeps remoteEnabled:true at 69999 with no buffer/retry pressure", async () => {
    const { obj } = makeDO(seededRequestCount(69_999));

    const { body } = await doGet(obj, "/config");

    expect(body.remoteEnabled).toBe(true);
    const quota = body.quota as { quotaLevel?: string };
    expect(quota.quotaLevel).not.toBe("QUOTA_VERY_HARD_LIMIT");
  });

  it("doRequestsToday alone trips the guard even when /track count is zero", async () => {
    // Isolates the max() combination: the guard must react to ALL DO traffic,
    // not only /track ingestion (the behavior motivating the counter).
    const { obj } = makeDO({
      reqCountDate: utcDateKey(0),
      reqCountToday: 0,
      reqDailyCounts: { [utcDateKey(0)]: 0 },
      doRequestsToday: 70_000,
    });

    const { body } = await doGet(obj, "/config");

    expect(body.remoteEnabled).toBe(false);
    const quota = body.quota as { quotaLevel?: string };
    expect(quota.quotaLevel).toBe("QUOTA_VERY_HARD_LIMIT");
  });
});

describe("configMaxRetry production migration (legacy default 5 -> 20)", () => {
  it("migrates a persisted legacy default of 5 to 20", async () => {
    const { obj } = makeDO({ configMaxRetry: 5 });

    const { body } = await doGet(obj, "/config");
    expect(body.maxRetry).toBe(20);

    const { body: stats } = await doGet(obj, "/stats");
    const remoteConfig = stats.remoteConfig as { maxRetry?: number };
    expect(remoteConfig.maxRetry).toBe(20);
  });

  it("keeps an admin-set configMaxRetry of 11", async () => {
    const { obj } = makeDO({ configMaxRetry: 11 });

    const { body } = await doGet(obj, "/config");
    expect(body.maxRetry).toBe(11);
  });

  it("defaults configMaxRetry to 20 when absent from persisted state", async () => {
    const { obj } = makeDO();

    const { body } = await doGet(obj, "/config");
    expect(body.maxRetry).toBe(20);
  });
});
