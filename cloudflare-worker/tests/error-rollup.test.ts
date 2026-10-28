// filepath: cloudflare-worker/tests/error-rollup.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { StoredEvent } from "../src/types";

// 1ef6.2: /track ingests failure events with use-case context, aggregates
// them into a bounded errorRollup (pre-aggregated on write), and the
// admin endpoint /admin/website/error-rollup serves the top rows.

const STORAGE_KEY = "analytics_state";

vi.mock("../src/event-archive", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/event-archive")>();
  return {
    ...actual,
    ensureArchiveSchema: vi.fn(async () => ({ ok: true })),
    archiveBatch: vi.fn(async () => ({ ok: true })),
    pruneArchive: vi.fn(async () => true),
    readArchiveStats: vi.fn(async () => null),
  };
});

class MockStorage {
  private map = new Map<string, unknown>();
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
    return null;
  }
  async setAlarm(_ts: number): Promise<void> {}
  async deleteAlarm(): Promise<void> {}
}

class MockState {
  storage = new MockStorage();
  waitUntil = vi.fn((p: Promise<unknown>) => p);
  blockConcurrencyWhile = vi.fn(async (fn: () => Promise<void>) => fn);
}

function makeDO() {
  const state = new MockState();
  const env = { DO_SHARED_SECRET: "secret" } as unknown as DownloadsEnv;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return obj;
}

function failEvent(overrides: Partial<Record<string, unknown>> = {}): StoredEvent {
  return {
    status: "fail",
    file_type: "pdf",
    browser: "chrome",
    os: "windows",
    ext_version: "1.9.3",
    duration_ms: 10,
    bypass_used: false,
    language: "en",
    timestamp: Date.now(),
    error_type: "SIZE_MISMATCH",
    pageType: "assignment_details",
    engineMode: "v2",
    strategy: "drive-auth",
    ...overrides,
  } as unknown as StoredEvent;
}

async function postTrack(obj: DownloadsDurable, events: unknown[]): Promise<Record<string, unknown>> {
  const res = await obj.fetch(
    new Request("http://do/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    }),
  );
  return (await res.json()) as Record<string, unknown>;
}

async function getRollup(obj: DownloadsDurable, secret = "secret"): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await obj.fetch(
    new Request("http://do/admin/website/error-rollup", {
      method: "GET",
      headers: { "X-Admin-Secret": secret },
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.useFakeTimers();
  return () => {
    vi.useRealTimers();
  };
});

describe("error rollup (1ef6.2)", () => {
  it("aggregates failure events with use-case context, camelCase aliased", async () => {
    const obj = makeDO();
    await postTrack(obj, [failEvent(), failEvent({ pageType: "stream" })]);
    const { status, body } = await getRollup(obj);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const rows = body.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    const details = rows.find((row) => row.pageType === "assignment_details");
    expect(details).toMatchObject({
      errorType: "size_mismatch",
      os: "windows",
      browser: "chrome",
      extVersion: "1.9.3",
      engineMode: "v2",
      strategy: "drive-auth",
      count: 1,
    });
    expect(rows.find((row) => row.pageType === "stream")?.count).toBe(1);
  });

  it("does not count success or cancelled events", async () => {
    const obj = makeDO();
    await postTrack(obj, [
      failEvent(),
      { ...failEvent(), status: "success" },
      { ...failEvent(), status: "cancelled" },
    ]);
    const { body } = await getRollup(obj);
    expect((body.rows as unknown[]).length).toBe(1);
  });

  it("is unauthorized without the admin secret", async () => {
    const obj = makeDO();
    const { status } = await getRollup(obj, "wrong");
    expect(status).toBe(401);
  });

  it("caps the rollup at 200 keys, evicting the smallest counts", async () => {
    const obj = makeDO();
    const events: StoredEvent[] = [];
    // One dominant key plus 210 distinct minor keys.
    for (let i = 0; i < 210; i += 1) {
      events.push(failEvent({ error_type: `minor_${i}` }));
    }
    events.unshift(failEvent(), failEvent(), failEvent()); // SIZE_MISMATCH x3
    await postTrack(obj, events);
    const { body } = await getRollup(obj);
    expect(body.totalKeys).toBeLessThanOrEqual(200);
    const rows = body.rows as Array<Record<string, unknown>>;
    const top = rows[0];
    expect(top.errorType).toBe("size_mismatch");
    expect(top.count).toBe(3);
    // The endpoint serves the top-50 rows; equal counts keep insertion
    // order, so the first surviving minor keys are visible.
    expect(rows.some((row) => row.errorType === "minor_11")).toBe(true);
    expect(rows.some((row) => row.errorType === "minor_10")).toBe(false); // evicted (11 over the cap)
  });
});
