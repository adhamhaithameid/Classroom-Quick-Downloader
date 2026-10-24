import { beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { StoredEvent } from "../src/types";

// ldlz + 0wmv: the daily alarm must survive a delayed fire (catch-up window),
// the exception path of the flush must dead-letter an exhausted head batch,
// and the pipeline-health stale thresholds must follow the daily cadence
// (26h warn / 48h critical) with old-default instances migrated.

const STORAGE_KEY = "analytics_state";

vi.mock("../src/event-archive", () => {
  return {
    ensureArchiveSchema: vi.fn(async () => ({ ok: true })),
    archiveBatch: vi.fn(async (..._args: unknown[]) => {
      return { ok: true };
    }),
    pruneArchive: vi.fn(async () => true),
    readArchiveStats: vi.fn(async () => null),
  };
});

import { archiveBatch } from "../src/event-archive";
const archiveBatchMock = vi.mocked(archiveBatch);

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  seed(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  dump(): Record<string, unknown> {
    // persist() shards the large collections into their own storage values
    // (see downloads_do SHARDED STATE STORAGE) — merge them back for tests.
    const core = (this.map.get(STORAGE_KEY) ?? {}) as Record<string, unknown>;
    return {
      ...core,
      pendingBatches: this.map.get("analytics_pending_batches") ?? core.pendingBatches,
      buffer: this.map.get("analytics_buffer") ?? core.buffer,
    };
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
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
  waitUntil = vi.fn((p: Promise<unknown>) => p);
  blockConcurrencyWhile = vi.fn(async (fn: () => Promise<void>) => fn);
}

function makeEvent(seq: number): StoredEvent {
  return {
    status: "success",
    file_type: "pdf",
    browser: "chrome",
    os: "windows",
    ext_version: "1.9.2",
    duration_ms: 100,
    bypass_used: false,
    language: "en",
    timestamp: Date.now(),
    seq,
  };
}

function makePendingBatch(batchId: string, attempts: number, weightedCount: number) {
  return {
    batch: {
      batchId,
      generatedAt: Date.now(),
      timeZone: "UTC",
      summary: {
        totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
        browsers: {},
        os: {},
        countries: {},
        languages: {},
        versions: {},
        types: {},
        errorReasons: {},
        topBrowser: "unknown",
        topOs: "unknown",
        topCountry: "unknown",
        topType: "unknown",
      },
      timeBuckets: [],
    },
    weightedCount,
    maxSeq: weightedCount,
    attempts,
    createdAt: Date.now() - 60 * 60 * 1000,
  };
}

function makeDO(stored?: Record<string, unknown>) {
  const state = new MockState();
  if (stored) {
    state.storage.seed(STORAGE_KEY, stored);
  }
  const env = {
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    SITE_CACHE_DB: { fake: "d1" },
  } as unknown as DownloadsEnv;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

async function callDOGetWithAdmin(
  obj: DownloadsDurable,
  path: string,
): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await obj.fetch(
    new Request(`http://do${path}`, { method: "GET", headers: { "X-Admin-Secret": "secret" } }),
  );
  const body = (await res.json()) as Record<string, unknown>;
  return { res, body };
}

beforeEach(() => {
  vi.useFakeTimers();
  archiveBatchMock.mockClear().mockImplementation(async () => ({ ok: true }));
  return () => {
    vi.useRealTimers();
  };
});

describe("ldlz: daily alarm catch-up window", () => {
  it("flushes later in the day when the hour-0 alarm was missed", async () => {
    vi.setSystemTime(new Date("2026-10-24T05:00:00.000Z"));
    const { obj, state } = makeDO({
      buffer: [makeEvent(1), makeEvent(2)],
      pendingBatches: [],
      lastFlushAt: Date.parse("2026-10-23T12:00:00.000Z"),
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
    });

    await obj.alarm();

    expect(archiveBatchMock).toHaveBeenCalledTimes(1);
    expect(state.storage.dump().lastFlushAt).toBe(Date.now());
  });

  it("does not re-flush on the same day after a successful flush", async () => {
    vi.setSystemTime(new Date("2026-10-24T05:00:00.000Z"));
    const { obj } = makeDO({
      buffer: [makeEvent(1)],
      pendingBatches: [],
      lastFlushAt: Date.parse("2026-10-24T00:20:00.000Z"),
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
    });

    await obj.alarm();

    expect(archiveBatchMock).not.toHaveBeenCalled();
  });

  it("still flushes during hour 0 regardless of the last flush day", async () => {
    vi.setSystemTime(new Date("2026-10-24T00:30:00.000Z"));
    const { obj } = makeDO({
      buffer: [makeEvent(1)],
      pendingBatches: [],
      lastFlushAt: Date.parse("2026-10-24T00:20:00.000Z"),
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
    });

    await obj.alarm();

    expect(archiveBatchMock).toHaveBeenCalledTimes(1);
  });
});

describe("0wmv: exception path dead-letters the exhausted head batch", () => {
  it("moves the head batch to the dead-letter queue when the archive write throws", async () => {
    vi.setSystemTime(new Date("2026-10-24T00:30:00.000Z"));
    archiveBatchMock.mockRejectedValue(new Error("d1 exploded"));
    const { obj, state } = makeDO({
      buffer: [],
      pendingBatches: [makePendingBatch("poison-1", 8, 3)],
      lastFlushAt: Date.parse("2026-10-23T12:00:00.000Z"),
      retryState: { consecutiveFailures: 7 },
      configMaxBufferSize: 50000,
    });

    await obj.alarm();

    const after = state.storage.dump() as {
      pendingBatches?: unknown[];
      oracleDeadLetters?: Array<{ batchId: string; lastError?: string }>;
      deadLetteredBatchesTotal?: number;
    };
    expect(after.pendingBatches ?? []).toHaveLength(0);
    expect(after.oracleDeadLetters?.[0]?.batchId).toBe("poison-1");
    expect(after.deadLetteredBatchesTotal).toBe(1);
    expect(after.oracleDeadLetters?.[0]?.lastError).toContain("d1 exploded");
  });

  it("keeps the head batch queued while attempts remain", async () => {
    vi.setSystemTime(new Date("2026-10-24T00:30:00.000Z"));
    archiveBatchMock.mockRejectedValue(new Error("d1 exploded"));
    const { obj, state } = makeDO({
      buffer: [],
      pendingBatches: [makePendingBatch("young-1", 2, 3)],
      lastFlushAt: Date.parse("2026-10-23T12:00:00.000Z"),
      retryState: { consecutiveFailures: 1 },
      configMaxBufferSize: 50000,
    });

    await obj.alarm();

    const after = state.storage.dump() as {
      pendingBatches?: Array<{ batch: { batchId: string }; attempts?: number }>;
      oracleDeadLetters?: unknown[];
    };
    expect(after.pendingBatches?.[0]?.batch.batchId).toBe("young-1");
    expect(after.pendingBatches?.[0]?.attempts).toBe(3);
    expect(after.oracleDeadLetters ?? []).toHaveLength(0);
  });
});

describe("ldlz: pipeline-health stale thresholds follow the daily cadence", () => {
  it("does not warn while the daily flush is still inside one cycle", async () => {
    vi.useRealTimers();
    const { obj } = makeDO({
      buffer: [],
      pendingBatches: [],
      lastFlushAt: Date.now() - 25 * 60 * 60 * 1000,
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
    });
    const { body } = await callDOGetWithAdmin(obj, "/pipeline-health");
    expect(body.reasons ?? []).not.toContain("flush_delayed");
    expect(body.reasons ?? []).not.toContain("flush_stale");
  });

  it("goes critical past two missed cycles", async () => {
    vi.useRealTimers();
    const { obj } = makeDO({
      buffer: [],
      pendingBatches: [],
      lastFlushAt: Date.now() - 50 * 60 * 60 * 1000,
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
    });
    const { body } = await callDOGetWithAdmin(obj, "/pipeline-health");
    expect(body.status).toBe("critical");
    expect(body.reasons ?? []).toContain("flush_stale");
  });

  it("migrates instances that still hold the old 6h/24h defaults", async () => {
    vi.useRealTimers();
    const { obj } = makeDO({
      buffer: [],
      pendingBatches: [],
      lastFlushAt: Date.now(),
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
      configVersion: 2,
      configHealthWarnStaleMs: 6 * 60 * 60 * 1000,
      configHealthCriticalStaleMs: 24 * 60 * 60 * 1000,
    });
    const { body } = await callDOGetWithAdmin(obj, "/pipeline-health");
    const thresholds = body.thresholds as Record<string, unknown>;
    expect(thresholds.warnStaleMs).toBe(26 * 60 * 60 * 1000);
    expect(thresholds.criticalStaleMs).toBe(48 * 60 * 60 * 1000);
  });

  it("keeps genuinely custom stale thresholds through the migration", async () => {
    vi.useRealTimers();
    const { obj } = makeDO({
      buffer: [],
      pendingBatches: [],
      lastFlushAt: Date.now(),
      retryState: { consecutiveFailures: 0 },
      configMaxBufferSize: 50000,
      configVersion: 2,
      configHealthWarnStaleMs: 1000,
      configHealthCriticalStaleMs: 2000,
    });
    const { body } = await callDOGetWithAdmin(obj, "/pipeline-health");
    const thresholds = body.thresholds as Record<string, unknown>;
    expect(thresholds.warnStaleMs).toBe(1000);
    expect(thresholds.criticalStaleMs).toBe(2000);
  });
});
