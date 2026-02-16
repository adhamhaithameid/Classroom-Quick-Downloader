
import { describe, it, expect, vi } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

// Mock Storage
class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async getAlarm() { return this.alarm; }
  async setAlarm(time: number) { this.alarm = time; }
  async deleteAlarm() { this.alarm = null; }
}

class MockState {
  storage = new MockStorage() as unknown as DurableObjectStorage;
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) { this.pending.push(promise.catch(() => {})); }
}

function makeDO(overrides: Partial<Env> = {}) {
  const state = new MockState();
  const env: Env = {
    ORACLE_ENDPOINT: "http://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    ...overrides,
  } as Env;

  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);

  // Mock global fetch
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  return { obj, state, fetchMock };
}

describe("DownloadsDurable Batch Building", () => {
  it("correctly aggregates events into a batch", async () => {
    const { obj, fetchMock } = makeDO();
    const now = Date.now();
    const hour1 = new Date(now).setUTCHours(10, 0, 0, 0); // 10:00 UTC
    const hour2 = new Date(now).setUTCHours(11, 0, 0, 0); // 11:00 UTC

    // Mock successful flush response
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith("/ingest-batch")) {
        const body = JSON.parse(options.body);
        return new Response(JSON.stringify({
          ok: true,
          batchId: body.batchId,
          ingestedAt: now
        }));
      }
      return new Response("Not Found", { status: 404 });
    });

    // Add events across two hours
    const events = [
      // Hour 1
      { id: "ev1", timestamp: hour1 + 1000, status: "success", file_type: "pdf", browser: "chrome", os: "win", ext_version: "1.0.0", count: 1 },
      { id: "ev2", timestamp: hour1 + 2000, status: "fail", error_type: "network", file_type: "zip", browser: "firefox", os: "mac", ext_version: "1.0.0", count: 1 },

      // Hour 2
      { id: "ev3", timestamp: hour2 + 1000, status: "success", file_type: "pdf", browser: "chrome", os: "win", ext_version: "1.1.0", count: 2 }, // Weighted count 2
    ];

    for (const ev of events) {
      await obj.fetch(new Request("http://do/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [ev] }),
      }));
    }

    // Force flush
    const res = await obj.fetch(new Request("http://do/admin/force-flush", {
      method: "POST",
      headers: { "X-Admin-Secret": "secret" },
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { sent: number };
    expect(body.sent).toBe(4); // Total weighted count: 1 + 1 + 2 = 4

    // Verify Oracle request payload
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const url = call[0];
    const options = call[1];

    expect(url).toBe("http://example.com/ingest-batch");
    const payload = JSON.parse(options.body);

    // Verify Summary
    expect(payload.summary.totals.totalEvents).toBe(4);
    expect(payload.summary.totals.totalDownloads).toBe(4);
    expect(payload.summary.totals.totalSuccess).toBe(3); // 1 (ev1) + 2 (ev3)
    expect(payload.summary.totals.totalFail).toBe(1); // 1 (ev2)

    expect(payload.summary.browsers["chrome"]).toBe(3);
    expect(payload.summary.browsers["firefox"]).toBe(1);
    expect(payload.summary.os["win"]).toBe(3);
    expect(payload.summary.os["mac"]).toBe(1);

    // Verify Time Buckets
    expect(payload.timeBuckets).toHaveLength(2);

    // Bucket 1 (10:00)
    const bucket1 = payload.timeBuckets[0];
    expect(bucket1.totals.totalEvents).toBe(2); // ev1, ev2
    expect(bucket1.counters.byStatus["success"]).toBe(1);
    expect(bucket1.counters.byStatus["fail"]).toBe(1);

    // Bucket 2 (11:00)
    const bucket2 = payload.timeBuckets[1];
    expect(bucket2.totals.totalEvents).toBe(2); // ev3 (count=2)
    expect(bucket2.counters.byStatus["success"]).toBe(2);

    // Verify Sequence IDs
    // Since fetch calls happened sequentially, seq should be increasing
    // But `makeDO` creates a new instance each time, effectively resetting state unless persisted?
    // Wait, `makeDO` creates one instance and reuses it.
    expect(payload.delivery.minSeq).toBeGreaterThan(0);
    expect(payload.delivery.maxSeq).toBeGreaterThanOrEqual(payload.delivery.minSeq);
    expect(payload.delivery.acceptedCount).toBe(4);
  });
});
