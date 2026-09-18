import { describe, expect, it } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";

// W3 fix: the uninstall page emits one lifecycle event on mount carrying the
// stats piggybacked on the uninstall URL (d/a params). The DO's closed action
// set must accept `uninstall_view` (type `content`) or the signal dies with a
// 400 and uninstall totals never reach the warehouse.
//
// NOTE: validation lives inside the DO, so these tests call the DO directly
// (worker-level tests with a mocked DO stub bypass it entirely).

class MockStorage {
  private map = new Map<string, unknown>();
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
    return null;
  }
  async setAlarm(_ts: number): Promise<void> {}
  async deleteAlarm(): Promise<void> {}
}

class MockState {
  storage = new MockStorage();
}

function makeDO(): DownloadsDurable {
  const env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as unknown as DownloadsEnv;
  return new DownloadsDurable(new MockState() as unknown as DurableObjectState, env);
}

function eventRequest(action: string): Request {
  return new Request("http://do/api/public/website/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "1",
      sessionId: "sess-test",
      pagePath: "/uninstall",
      events: [
        {
          eventId: "evt-uninstall-view-1",
          eventType: "content",
          action,
          placement: "uninstall_page",
          meta: { downloads: 12, attempts: 15 },
        },
      ],
    }),
  });
}

describe("uninstall_view website event", () => {
  it("accepts action uninstall_view (type content)", async () => {
    const res = await makeDO().fetch(eventRequest("uninstall_view"));
    // The website-events ingest contract returns 200 (unlike /track's 202).
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  it("still rejects genuinely unknown actions", async () => {
    const res = await makeDO().fetch(eventRequest("definitely_not_an_action"));
    expect(res.status).toBe(400);
  });
});
