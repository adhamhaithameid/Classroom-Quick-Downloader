import { describe, it, expect } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

const STORAGE_KEY = "analytics_state";

type StoredAnalyticsState = {
  counters: {
    byExtVersion: Record<string, number>;
  };
};

// Mock Storage and State (Simplified from security.test.ts)
class MockStorage {
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async getAlarm() { return null; }
  async setAlarm() {}
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) { this.pending.push(promise.catch(() => {})); }
}

function makeDO() {
  const state = new MockState();
  const env: Env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function makeTrackRequest(id: string, extVersion: string): Request {
  return new Request("http://do/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        id,
        status: "success",
        file_type: "pdf",
        browser: "chrome",
        os: "mac",
        ext_version: extVersion,
        timestamp: Date.now(),
      }],
    }),
  });
}

describe("ext_version sanitization", () => {
  it("routes invalid ext_version values into the bounded fallback bucket", async () => {
    const { obj, state } = makeDO();
    const invalidVersions = [
      "<script>alert(1)</script>",
      "v1.2.3 release",
      "a".repeat(200),
    ];

    for (const [idx, extVersion] of invalidVersions.entries()) {
      const res = await obj.fetch(makeTrackRequest(`bad-${idx}`, extVersion));
      expect(res.status).toBe(202);
    }

    const stored = await state.storage.get<StoredAnalyticsState>(STORAGE_KEY);
    const buckets = stored?.counters.byExtVersion ?? {};

    expect(buckets["0.0.0"]).toBe(invalidVersions.length);
    expect(buckets["<script>alert(1)</script>"]).toBeUndefined();
    expect(buckets["v1.2.3 release"]).toBeUndefined();
  });

  it("accepts valid ext_version values and normalizes casing", async () => {
    const { obj, state } = makeDO();

    const res = await obj.fetch(makeTrackRequest("ok-1", " V1.2.3-BETA "));
    expect(res.status).toBe(202);

    const stored = await state.storage.get<StoredAnalyticsState>(STORAGE_KEY);
    const buckets = stored?.counters.byExtVersion ?? {};

    expect(buckets["v1.2.3-beta"]).toBe(1);
    expect(buckets["0.0.0"]).toBeUndefined();
  });
});
