import { describe, expect, it, vi } from "vitest";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env as DownloadsEnv } from "../src/downloads_do";
import { redactStorageForBackup } from "../src/downloads_do";
import type { DurableObjectState } from "@cloudflare/workers-types";

// SEC-001 (bead d8ve): the public backup lane must never carry material that
// identifies visitors or exposes the admin perimeter. redactStorageForBackup
// strips it at the source for ?redacted=1; the default export keeps full
// fidelity for manual admin curls.

class MockStorage {
  private map = new Map<string, unknown>();

  seed(key: string, value: unknown): void {
    this.map.set(key, value);
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

  async list(): Promise<Map<string, unknown>> {
    return new Map(this.map);
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

  private alarm: number | null = null;
}

class MockState {
  storage = new MockStorage();
  waitUntil = vi.fn((p: Promise<unknown>) => p);
  blockConcurrencyWhile = vi.fn(async (fn: () => Promise<unknown>) => fn);
}

function makeDO(stored: Record<string, unknown>) {
  const state = new MockState();
  for (const [key, value] of Object.entries(stored)) {
    state.storage.seed(key, value);
  }
  const env = {
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    SITE_CACHE_DB: { fake: "d1" },
  } as unknown as DownloadsEnv;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function seedCore(): Record<string, unknown> {
  return {
    totalDownloads: 160000,
    totalEvents: 200000,
    loginAttempts: { "203.0.113.9": { attempts: 3, firstAttemptAt: 1 } },
    ipAllowlist: ["203.0.113.9", "198.51.100.4"],
    ipAllowlistEnabled: true,
    ipAllowlistStepUpBypassEnabled: false,
    sessionBindingLastExpectedPrefix: "203.0.113",
    dangerActionAuditLogs: [{ action: "flush", actorIp: "203.0.113.9", atUtc: 2 }],
    burstCounts: { "203.0.113.9": { count: 5, minute: 1 } },
    uninstallSubmissions: [
      {
        submissionId: 1,
        submittedAtUtc: 3,
        reason: "it broke my workflow",
        notes: "classroom dot example com",
        browser: "firefox",
        version: "1.9.1",
        source: "options-page",
      },
    ],
    uninstallSubmissionsTotal: 92,
  };
}

function seedTelemetry(): Record<string, unknown> {
  return {
    websiteTelemetryQueue: [
      {
        schemaVersion: 1,
        batchId: "b1",
        correlationId: "c1",
        generatedAtUtc: 10,
        sessionId: "visitor-session-1",
        pagePath: "/classrooms/teacher-name",
        attempt: 1,
        nextRetryAtUtc: null,
        lastError: null,
        events: [
          {
            eventId: "e1",
            eventType: "page_error",
            action: "error",
            placement: "overview",
            meta: { message: "TypeError at /classrooms/teacher-name" },
          },
        ],
      },
    ],
    websiteTelemetryDeadLetter: [
      {
        batchId: "b0",
        sessionId: "visitor-session-0",
        pagePath: "/pricing",
        events: [],
      },
    ],
  };
}

describe("redactStorageForBackup", () => {
  it("strips admin-perimeter keys from the analytics_state core", () => {
    const out = redactStorageForBackup({ analytics_state: seedCore() });
    const core = out.analytics_state as Record<string, unknown>;
    for (const key of [
      "loginAttempts",
      "ipAllowlist",
      "ipAllowlistEnabled",
      "ipAllowlistStepUpBypassEnabled",
      "sessionBindingLastExpectedPrefix",
      "dangerActionAuditLogs",
      "burstCounts",
    ]) {
      expect(core[key], `core.${key} must be gone`).toBeUndefined();
    }
    expect(core.totalDownloads).toBe(160000);
    expect(core.uninstallSubmissionsTotal).toBe(92);
  });

  it("keeps uninstall submission ids and strips the free text", () => {
    const out = redactStorageForBackup({ analytics_state: seedCore() });
    const core = out.analytics_state as Record<string, unknown>;
    const submissions = core.uninstallSubmissions as Array<Record<string, unknown>>;
    expect(submissions).toHaveLength(1);
    expect(submissions[0].submissionId).toBe(1);
    expect(submissions[0].browser).toBe("firefox");
    expect(submissions[0].reason).toBeUndefined();
    expect(submissions[0].notes).toBeUndefined();
  });

  it("strips sessionId, pagePath, and meta from telemetry at every depth", () => {
    const out = redactStorageForBackup({ analytics_website_telemetry: seedTelemetry() });
    const text = JSON.stringify(out);
    expect(text).not.toContain("visitor-session-1");
    expect(text).not.toContain("visitor-session-0");
    expect(text).not.toContain("/classrooms/teacher-name");
    expect(text).not.toContain("/pricing");
    expect(text).not.toContain("TypeError");
    const shard = out.analytics_website_telemetry as Record<string, unknown>;
    const queue = shard.websiteTelemetryQueue as Array<Record<string, unknown>>;
    expect(queue[0].batchId).toBe("b1");
    expect(queue[0].events[0]).toMatchObject({ eventId: "e1", placement: "overview" });
  });

  it("strips uninstall free text in the analytics_uninstall shard too", () => {
    const out = redactStorageForBackup({
      analytics_uninstall: { uninstallSubmissions: seedCore().uninstallSubmissions },
    });
    const submissions = (out.analytics_uninstall as Record<string, unknown>)
      .uninstallSubmissions as Array<Record<string, unknown>>;
    expect(submissions[0].submissionId).toBe(1);
    expect(submissions[0].reason).toBeUndefined();
    expect(submissions[0].notes).toBeUndefined();
  });

  it("leaves keys with no sensitive material untouched", () => {
    const storage = { analytics_changelog: [{ version: "1.9.1", note: "release" }] };
    const out = redactStorageForBackup(storage);
    expect(out).toEqual(storage);
  });
});

describe("GET /admin/storage-export redaction param", () => {
  const stored = {
    analytics_state: seedCore(),
    analytics_website_telemetry: seedTelemetry(),
    analytics_uninstall: { uninstallSubmissions: seedCore().uninstallSubmissions },
  };

  async function exportWith(query: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const { obj } = makeDO(stored);
    const res = await obj.fetch(
      new Request(`http://do/admin/storage-export${query}`, {
        method: "GET",
        headers: { "X-Admin-Secret": "secret" },
      }),
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("defaults to full fidelity (manual admin curl keeps everything)", async () => {
    const { status, body } = await exportWith("");
    expect(status).toBe(200);
    expect(body.redacted).toBe(false);
    const core = (body.storage as Record<string, unknown>).analytics_state as Record<
      string,
      unknown
    >;
    expect(core.ipAllowlist).toBeDefined();
    expect(core.loginAttempts).toBeDefined();
    expect(JSON.stringify(body)).toContain("visitor-session-1");
  });

  it("redacted=1 strips every sensitive key and flags the body", async () => {
    const { status, body } = await exportWith("?redacted=1");
    expect(status).toBe(200);
    expect(body.redacted).toBe(true);
    const text = JSON.stringify(body);
    for (const marker of [
      "ipAllowlist",
      "loginAttempts",
      "dangerActionAuditLogs",
      "sessionBindingLastExpectedPrefix",
      "burstCounts",
      "visitor-session-1",
      "/classrooms/teacher-name",
      "it broke my workflow",
      "classroom dot example com",
    ]) {
      expect(text, `redacted export must not contain ${marker}`).not.toContain(marker);
    }
  });

  it("rejects unauthenticated calls", async () => {
    const { obj } = makeDO(stored);
    const res = await obj.fetch(new Request("http://do/admin/storage-export?redacted=1"));
    expect(res.status).toBe(401);
  });
});
