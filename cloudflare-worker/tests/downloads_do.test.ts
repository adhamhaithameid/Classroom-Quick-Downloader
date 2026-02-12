
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DownloadsDurable, Env } from "../src/downloads_do";
import { OracleBatch } from "../src/types";

// Mock DurableObjectState
class MockStorage {
  private data = new Map<string, unknown>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarm = scheduledTime;
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

function createMockState(): DurableObjectState {
  return {
    id: { toString: () => "mock-id" } as DurableObjectId,
    storage: new MockStorage() as unknown as DurableObjectStorage,
    waitUntil: (_promise: Promise<unknown>) => {},
    blockConcurrencyWhile: async (callback: () => Promise<unknown>) => callback(),
  } as unknown as DurableObjectState;
}

const MOCK_ENV: Env = {
  ORACLE_ENDPOINT: "http://mock-oracle",
  DO_SHARED_SECRET: "secret123",
  MAX_BATCH_EVENTS: "100",
};

describe("DownloadsDurable Batch Processing", () => {
  let durable: DownloadsDurable;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    durable = new DownloadsDurable(createMockState(), MOCK_ENV);
    // Wait for load to complete (it's async in constructor but awaited in methods usually)
    // We can simulate wait by calling a method or accessing private loaded promise if exposed.
    // The class methods await this.loaded.
  });

  it("sanitizes inputs and produces lowercase keys in Oracle batch", async () => {
    // 1. Ingest mixed-case events
    const event1 = {
      status: "success",
      file_type: "ZIP",
      browser: "Chrome",
      os: "Windows",
      language: "EN-US",
      country: "US", // Should be sanitized if present
      timestamp: Date.now(),
      id: "ev1",
      count: 1,
    };

    const event2 = {
      status: "fail",
      file_type: "EXE",
      browser: "Firefox",
      os: "Linux",
      language: "fr-FR",
      error_type: "NETWORK_ERROR",
      timestamp: Date.now(),
      id: "ev2",
      count: 1,
    };

    const req = new Request("http://localhost/track", {
      method: "POST",
      body: JSON.stringify({ events: [event1, event2] }),
    });

    const res = await durable.fetch(req);
    expect(res.status).toBe(202);
    const body = await res.json() as { ok: boolean; accepted: number };
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(2);

    // 2. Trigger flush to generate OracleBatch
    // We use admin force flush
    const flushReq = new Request("http://localhost/admin/force-flush", {
      method: "POST",
      headers: { "X-Admin-Secret": "secret123" },
    });

    // We need to capture the batchId from the request body to return it in the mock response.
    // But fetch is called with a string body.
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
        const bodyStr = init.body;
        const batch = JSON.parse(bodyStr) as OracleBatch;
        return {
            ok: true,
            json: async () => ({ ok: true, batchId: batch.batchId, ingestedAt: Date.now() }),
        };
    });

    const flushRes = await durable.fetch(flushReq);
    expect(flushRes.status).toBe(200);
    const flushBody = await flushRes.json() as { ok: boolean; sent: number };
    expect(flushBody.ok).toBe(true);
    expect(flushBody.sent).toBe(2);

    // 3. Inspect the captured batch
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const url = callArgs[0];
    const init = callArgs[1];

    expect(url).toBe("http://mock-oracle/ingest-batch");
    const batch = JSON.parse(init.body) as OracleBatch;

    // Verify Summary Keys are lowercase
    expect(batch.summary.browsers).toHaveProperty("chrome");
    expect(batch.summary.browsers["chrome"]).toBe(1);
    expect(batch.summary.browsers).not.toHaveProperty("Chrome");

    expect(batch.summary.os).toHaveProperty("windows");
    expect(batch.summary.os).toHaveProperty("linux");

    expect(batch.summary.types).toHaveProperty("zip");
    expect(batch.summary.types).toHaveProperty("exe");

    expect(batch.summary.languages).toHaveProperty("en-us"); // sanitizeString lowercases
    expect(batch.summary.languages).toHaveProperty("fr-fr");

    expect(batch.summary.countries).toHaveProperty("us");

    expect(batch.summary.errorReasons).toHaveProperty("network_error");

    // Verify TimeBucket Counters are lowercase
    expect(batch.timeBuckets.length).toBeGreaterThan(0);
    const bucket = batch.timeBuckets[0];

    expect(bucket.counters.byBrowser).toHaveProperty("chrome");
    expect(bucket.counters.byOs).toHaveProperty("windows");
    expect(bucket.counters.byType).toHaveProperty("zip");

    // Verify top stats
    expect(batch.summary.topBrowser).not.toBe("Chrome");
    expect(batch.summary.topBrowser).not.toBe("unknown"); // Tie breaking might pick either if counts equal, but keys must be known.
  });
});
