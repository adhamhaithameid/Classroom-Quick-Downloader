import { describe, it, expect } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

const STORAGE_KEY = "analytics_state";

// Mock Storage and State
class MockStorage {
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAlarm() { return null; }
  async setAlarm() {}
  async deleteAlarm() {}
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) { this.pending.push(promise.catch(() => {})); }
}

function makeDO() {
  const state = new MockState();
  const env: Env = {
    ORACLE_ENDPOINT: "http://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function makeTrackRequest(events: any[]): Request {
  return new Request("http://do/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
}

const MAX_BYTES = 10 * 1024;

describe("event size validation", () => {
  it("accepts small events", async () => {
    const { obj } = makeDO();
    // Await loaded to ensure DO is ready
    await (obj as any).loaded;

    const event = {
      id: "small-event",
      status: "success",
      timestamp: Date.now(),
    };
    const res = await obj.fetch(makeTrackRequest([event]));
    expect(res.status).toBe(202);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(json.accepted).toBe(1);
  });

  it("rejects events larger than 10KB (fast path by length)", async () => {
    const { obj } = makeDO();
    await (obj as any).loaded;

    const largeString = "a".repeat(MAX_BYTES + 100);
    const event = {
      id: "large-event",
      status: "success",
      timestamp: Date.now(),
      payload: largeString,
    };
    const res = await obj.fetch(makeTrackRequest([event]));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.ok).toBe(false);
    expect(json.error).toBe("event_too_large");
  });

  it("rejects events larger than 10KB (slow path by encoding)", async () => {
    const { obj } = makeDO();
    await (obj as any).loaded;

    // Use multi-byte characters to pass the length check but fail the byte check.
    // '€' is 3 bytes.
    // MAX_BYTES = 10240.
    // Target length: > 3413 (to skip fast acceptance) AND < 10240 (to pass fast rejection).
    // Target bytes: > 10240.

    // 4000 characters * 3 bytes = 12000 bytes.
    const multiByteString = "€".repeat(4000);
    expect(multiByteString.length).toBeLessThan(MAX_BYTES);
    expect(multiByteString.length).toBeGreaterThan(MAX_BYTES / 3);

    // JSON overhead might add a few bytes, but 12000 is plenty over 10240.
    const event = {
      id: "heavy-event",
      status: "success",
      timestamp: Date.now(),
      payload: multiByteString,
    };

    const res = await obj.fetch(makeTrackRequest([event]));
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.ok).toBe(false);
    expect(json.error).toBe("event_too_large");
  });

  it("accepts events just under 10KB", async () => {
    const { obj } = makeDO();
    await (obj as any).loaded;

    // Create an event that is close to the limit but valid
    // JSON overhead is ~50 chars. We use ASCII so 1 char = 1 byte.
    const overhead = 100; // ample room for JSON structure
    const largeString = "a".repeat(MAX_BYTES - overhead);
    const event = {
      id: "borderline-event",
      status: "success",
      timestamp: Date.now(),
      payload: largeString,
    };

    // Verify encoded size is indeed < MAX_BYTES
    const size = new TextEncoder().encode(JSON.stringify(event)).length;
    expect(size).toBeLessThan(MAX_BYTES);

    const res = await obj.fetch(makeTrackRequest([event]));
    expect(res.status).toBe(202);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(json.accepted).toBe(1);
  });
});
