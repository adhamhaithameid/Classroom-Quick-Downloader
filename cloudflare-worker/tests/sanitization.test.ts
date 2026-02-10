import { describe, it, expect } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

const STORAGE_KEY = "analytics_state";

type StoredState = {
  counters: {
    byType: Record<string, number>;
    byExtVersion: Record<string, number>;
  };
};

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

describe("Sanitization Checks", () => {
  it("checks if ext_version is sanitized", async () => {
    const { obj, state } = makeDO();
    const maliciousVersion = "<script>alert('xss')</script>";

    await obj.fetch(new Request("http://do/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [{
          id: "event-1",
          status: "success",
          file_type: "pdf",
          ext_version: maliciousVersion,
          timestamp: Date.now()
        }]
      })
    }));

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    // If sanitized, the malicious key should NOT exist (it should be 'unknown')
    expect(stored?.counters.byExtVersion[maliciousVersion]).toBeUndefined();
    expect(stored?.counters.byExtVersion["unknown"]).toBe(1);
  });

  it("checks if file_type is sanitized", async () => {
    const { obj, state } = makeDO();
    const maliciousType = "<script>alert('xss')</script>";

    await obj.fetch(new Request("http://do/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [{
          id: "event-2",
          status: "success",
          file_type: maliciousType,
          ext_version: "1.0.0",
          timestamp: Date.now()
        }]
      })
    }));

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    // If sanitized, the malicious key should NOT exist (it should be 'unknown')
    // The provided code snippet in the task description suggests it MIGHT be vulnerable if not for sanitizeString
    // But we saw sanitizeString being used.
    expect(stored?.counters.byType[maliciousType]).toBeUndefined();
    expect(stored?.counters.byType["unknown"]).toBe(1);
  });
});
