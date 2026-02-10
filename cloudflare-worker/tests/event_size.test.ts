
import { describe, it, expect } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

// Mock implementation of Durable Object State
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
  waitUntil() {}
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

async function callDO(obj: DownloadsDurable, path: string, body: unknown) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }));
}

function makeEvent(overrides = {}) {
  return {
    id: "evt_123",
    timestamp: Date.now(),
    status: "success",
    file_type: "pdf",
    ...overrides
  };
}

describe("Event Size Validation", () => {
  it("accepts small events", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/track", {
      events: [makeEvent()]
    });
    expect(res.status).toBe(202);
  });

  it("rejects event larger than 10KB (ASCII)", async () => {
    const { obj } = makeDO();
    const bigString = "a".repeat(10 * 1024 + 100);
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ payload: bigString })]
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual(expect.objectContaining({ error: "event_too_large" }));
  });

  it("rejects event slightly larger than 10KB (ASCII)", async () => {
    const { obj } = makeDO();
    // 10KB = 10240 bytes.
    // Base event overhead is small (~100 bytes).
    // repeat 10200 should be safe-ish? No, wait.
    // We want to trigger > 10240.
    const bigString = "a".repeat(10240); // exactly 10KB payload + overhead > 10KB
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ payload: bigString })]
    });
    expect(res.status).toBe(400);
  });

  it("accepts event slightly smaller than 10KB (ASCII)", async () => {
    const { obj } = makeDO();
    // 10240 max. Overhead ~100.
    // payload 9000 is safe.
    const bigString = "a".repeat(9000);
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ payload: bigString })]
    });
    expect(res.status).toBe(202);
  });

  it("rejects event with multibyte chars exceeding byte limit (short string length)", async () => {
    const { obj } = makeDO();
    // \u0800 is 3 bytes in UTF-8.
    // 3500 chars * 3 bytes = 10500 bytes > 10240.
    // 3500 length < 10240 length limit.
    // This forces the "slow path" (if optimized) or just normal check.
    const multiByteString = "\u0800".repeat(3500);
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ payload: multiByteString })]
    });
    expect(res.status).toBe(400);
     const body = await res.json();
    expect(body).toEqual(expect.objectContaining({ error: "event_too_large" }));
  });

  it("accepts event with multibyte chars within limit", async () => {
    const { obj } = makeDO();
    // \u0800 is 3 bytes.
    // 3000 chars * 3 = 9000 bytes < 10240.
    const multiByteString = "\u0800".repeat(3000);
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ payload: multiByteString })]
    });
    expect(res.status).toBe(202);
  });
});
