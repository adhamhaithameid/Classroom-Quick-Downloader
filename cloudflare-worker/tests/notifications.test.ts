import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearKvCacheForTests } from "../src/cache";
import worker from "../src/index";
import {
  applyDismissals,
  buildNotifications,
  parseDismissals,
  sanitizeNotificationId,
  NOTIFICATION_DISMISSALS_KV_KEY,
} from "../src/notifications";
import type { Env, StatsResponse } from "../src/types";
import { TEST_DASHBOARD_PASSWORD, TEST_DANGER_PASSWORD, TEST_SHARED_SECRET } from "./helpers/dummy-secrets";

function makeStats(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    ok: true,
    totalEvents: 0,
    totalDownloads: 0,
    totalSuccess: 0,
    totalFail: 0,
    totalCancelled: 0,
    pendingEvents: 0,
    lastEventAt: null,
    lastFlushAt: null,
    counters: {
      byStatus: {},
      byType: {},
      byBrowser: {},
      byOs: {},
      byExtVersion: {},
      byLanguage: {},
      byCountry: {},
      byErrorType: {},
    },
    retryState: null,
    quota: {
      requestsToday: 0,
      quotaLevel: "BELOW_LIMITS",
      modeLabel: "chill",
      remoteEnabled: true,
      batchSizeSuggestion: 50,
    },
    envSnapshot: { maxBatchEvents: "10000", oracleEndpoint: "" },
    requestsToday: 0,
    requestDate: "2026-10-09",
    uniqueRequestsToday: 0,
    uniqueIpsToday: 0,
    isApproximated: false,
    remoteConfig: {
      batchSize: 50,
      maxDailyRequests: 100_000,
      maxRetry: 5,
      maxEventsPerRequest: 5000,
      maxBufferSize: 50000,
      flushMode: "next_day",
      timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
      configVersion: 2,
      allowLegacyEvents: true,
      remoteEnabledReason: "ok",
      hardRemoteOff: false,
    },
    bufferStatus: { currentSize: 0, maxSize: 50000, utilizationPercent: "0.00" },
    nextAlarmAt: null,
    changelog: [],
    changelogConfig: { rules: [] },
    ...overrides,
  } as StatsResponse;
}

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("buildNotifications aggregation", () => {
  it("returns an empty list for healthy fixture stats", () => {
    const notifications = buildNotifications({ stats: makeStats() });
    expect(notifications).toEqual([]);
  });

  it("aggregates pipeline health warnings with reasons", () => {
    const notifications = buildNotifications({
      stats: makeStats(),
      pipelineHealth: { status: "warn", reasons: ["pending_batches_high", "stale_flush"] },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].id).toBe("pipeline:warn");
    expect(notifications[0].severity).toBe("warn");
    expect(notifications[0].detail).toContain("pending_batches_high");
  });

  it("aggregates scrape-health failures per store", () => {
    const notifications = buildNotifications({
      stats: makeStats(),
      scrapeAlerts: [
        { store: "chrome", reason: "consecutive_failures_3" },
        { store: "firefox", reason: "last_ok_stale_49h" },
      ],
    });
    expect(notifications.map((notification) => notification.id)).toEqual([
      "scrape:chrome",
      "scrape:firefox",
    ]);
  });

  it("flags quota proximity from the level and the request ratio", () => {
    const soft = buildNotifications({
      stats: makeStats({
        quota: { requestsToday: 50, quotaLevel: "QUOTA_SOFT_LIMIT", modeLabel: "busy", remoteEnabled: true, batchSizeSuggestion: 20 },
      }),
    });
    expect(soft.map((notification) => notification.id)).toContain("quota:QUOTA_SOFT_LIMIT");

    const nearLimit = buildNotifications({
      stats: makeStats({
        quota: { requestsToday: 96_000, quotaLevel: "BELOW_LIMITS", modeLabel: "chill", remoteEnabled: true, batchSizeSuggestion: 50 },
      }),
    });
    const critical = nearLimit.filter((notification) => notification.severity === "critical");
    expect(critical.map((notification) => notification.id)).toContain("quota:requests-95");

    const approaching = buildNotifications({
      stats: makeStats({
        quota: { requestsToday: 85_000, quotaLevel: "BELOW_LIMITS", modeLabel: "chill", remoteEnabled: true, batchSizeSuggestion: 50 },
      }),
    });
    expect(approaching.map((notification) => notification.id)).toContain("quota:requests-80");
  });

  it("aggregates uptime failures from the summary", () => {
    const notifications = buildNotifications({
      stats: makeStats(),
      uptime: {
        lastCheck: { timestamp: 1_000, ok: false, latencyMs: 9_000 },
        uptime24h: 97.5,
        uptime7d: null,
        checks24h: 40,
        checks7d: 0,
        consecutiveFailures: 14,
      },
    });
    const ids = notifications.map((notification) => notification.id);
    expect(ids).toContain("uptime:last-check");
    expect(ids).toContain("uptime:consecutive-failures");
    expect(ids).toContain("uptime:24h-below-99");
    expect(notifications.find((notification) => notification.id === "uptime:consecutive-failures")?.severity).toBe("critical");
  });

  it("sorts critical before warn", () => {
    const notifications = buildNotifications({
      stats: makeStats({
        quota: { requestsToday: 98_000, quotaLevel: "QUOTA_SOFT_LIMIT", modeLabel: "busy", remoteEnabled: true, batchSizeSuggestion: 10 },
      }),
      scrapeAlerts: [{ store: "edge", reason: "consecutive_failures_4" }],
    });
    expect(notifications[0].severity).toBe("critical");
    expect(notifications[notifications.length - 1].severity).toBe("warn");
  });

  it("sanitizes notification ids strictly", () => {
    expect(sanitizeNotificationId("scrape:chrome")).toBe("scrape:chrome");
    expect(sanitizeNotificationId("bad id with spaces")).toBe("");
    expect(sanitizeNotificationId('"><script>')).toBe("");
    expect(sanitizeNotificationId(42)).toBe("");
    expect(parseDismissals(' [{"id":"a:b","ts":1},{"id":"<x>","ts":2}]')).toEqual([{ id: "a:b", ts: 1 }]);
  });
});

describe("applyDismissals", () => {
  it("hides dismissed notifications and reports the hidden ids", () => {
    const notifications = buildNotifications({
      stats: makeStats(),
      scrapeAlerts: [{ store: "chrome", reason: "consecutive_failures_3" }],
      pipelineHealth: { status: "warn", reasons: ["x"] },
    });
    const state = applyDismissals(notifications, [{ id: "scrape:chrome", ts: 5 }]);
    expect(state.visible.map((notification) => notification.id)).toEqual(["pipeline:warn"]);
    expect(state.dismissedIds).toEqual(["scrape:chrome"]);
  });
});

// --- Route integration (session + CSRF + bounded KV) ------------------------

function extractCookie(header: string | null): string {
  if (!header) return "";
  return header.split(";")[0] ?? "";
}

function mockEnv(kv: ReturnType<typeof memoryKv>, doRoutes: Record<string, unknown>): Env {
  const stub = {
    fetch: async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      // Rate-limit-compatible answers for the login-attempt flow.
      if (url.includes("/auth/check-ip-allowlist")) {
        return new Response(JSON.stringify({ allowed: true, enabled: true, stepUpBypassEnabled: false }), { status: 200 });
      }
      if (url.includes("/auth/login-attempt")) {
        return new Response(JSON.stringify({ ok: true, allowed: true }), { status: 200 });
      }
      for (const [fragment, payload] of Object.entries(doRoutes)) {
        if (url.includes(fragment)) {
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      }
      return new Response("{}", { status: 200 });
    },
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: TEST_SHARED_SECRET,
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
    MAX_BATCH_EVENTS: "10000",
    SITE_SNAPSHOT_KV: kv as unknown as Env["SITE_SNAPSHOT_KV"],
  } as unknown as Env;
}

async function login(): Promise<{ cookie: string; envBase: () => Env }> {
  const env = mockEnv(memoryKv(), {});
  const res = await worker.fetch(new Request("https://example.com/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `password=${TEST_DASHBOARD_PASSWORD}`,
  }), env, {} as ExecutionContext);
  expect(res.status).toBe(302);
  const cookie = extractCookie(res.headers.get("Set-Cookie"));
  expect(cookie).toContain("cqd_session=");
  return { cookie, envBase: () => env };
}

async function dismiss(cookie: string, env: Env, id: unknown): Promise<Response> {
  return worker.fetch(new Request("https://example.com/admin/notifications/dismiss", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.com",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  }), env, {} as ExecutionContext);
}

describe("notification dismissal routes", () => {
  beforeEach(() => {
    clearKvCacheForTests();
  });

  it("persists a dismissal in KV and rejects invalid ids", async () => {
    const { cookie } = await login();
    const kv = memoryKv();
    const env = mockEnv(kv, {});

    const ok = await dismiss(cookie, env, "scrape:chrome");
    expect(ok.status).toBe(200);
    const stored = JSON.parse(kv.store.get(NOTIFICATION_DISMISSALS_KV_KEY) ?? "[]") as Array<{ id: string }>;
    expect(stored).toEqual([{ id: "scrape:chrome", ts: expect.any(Number) }]);

    const bad = await dismiss(cookie, env, '"><script>');
    expect(bad.status).toBe(400);
    const afterBad = JSON.parse(kv.store.get(NOTIFICATION_DISMISSALS_KV_KEY) ?? "[]") as unknown[];
    expect(afterBad.length).toBe(1);
  });

  it("requires session auth", async () => {
    const env = mockEnv(memoryKv(), {});
    const res = await worker.fetch(new Request("https://example.com/admin/notifications/dismiss", {
      method: "POST",
      headers: { Origin: "https://example.com", "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "a:b" }),
    }), env, {} as ExecutionContext);
    expect(res.status).toBe(401);
  });

  it("bounds dismissal storage at 200 records, dropping the oldest", async () => {
    const { cookie } = await login();
    const kv = memoryKv();
    const seed = Array.from({ length: 200 }, (_, i) => ({ id: `old:${i}`, ts: i }));
    kv.store.set(NOTIFICATION_DISMISSALS_KV_KEY, JSON.stringify(seed));
    const env = mockEnv(kv, {});

    const res = await dismiss(cookie, env, "new:notification");
    expect(res.status).toBe(200);
    const stored = JSON.parse(kv.store.get(NOTIFICATION_DISMISSALS_KV_KEY) ?? "[]") as Array<{ id: string }>;
    expect(stored.length).toBe(200);
    expect(stored[stored.length - 1].id).toBe("new:notification");
    expect(stored[0].id).toBe("old:1");
  });

  it("resets all dismissals", async () => {
    const { cookie } = await login();
    const kv = memoryKv();
    kv.store.set(NOTIFICATION_DISMISSALS_KV_KEY, JSON.stringify([{ id: "a:b", ts: 1 }]));
    const env = mockEnv(kv, {});

    const res = await worker.fetch(new Request("https://example.com/admin/notifications/reset", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://example.com", "X-Requested-With": "XMLHttpRequest" },
    }), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(kv.store.get(NOTIFICATION_DISMISSALS_KV_KEY)).toBe("[]");
  });
});

describe("dashboard notifications tab", () => {
  beforeEach(() => {
    clearKvCacheForTests();
  });

  const DO_ROUTES = {
    "/pipeline-health": { ok: true, status: "warn", reasons: ["pending_batches_high"], now: 1, bufferSize: 0, maxBufferSize: 50000, bufferUtilization: 0, pendingBatches: 0, oldestPendingAgeMs: null, consecutiveFailures: 0 },
    "/stats": makeStats(),
  };

  it("renders the tab, badge, items, and hides dismissed ids", async () => {
    const { cookie } = await login();
    const kv = memoryKv();
    // A scrape alert that stays visible next to the dismissed pipeline item.
    kv.store.set("site:v1:scrape-health", JSON.stringify({
      stores: { chrome: { lastOkAtUtc: null, lastFailAtUtc: 1, consecutiveFailures: 5 } },
      updatedAtUtc: 1,
      lastAlertStatus: null,
      lastAlertAtUtc: null,
    }));
    kv.store.set(NOTIFICATION_DISMISSALS_KV_KEY, JSON.stringify([{ id: "pipeline:warn", ts: 1 }]));
    const env = mockEnv(kv, DO_ROUTES);

    const res = await worker.fetch(new Request("https://example.com/dashboard", {
      headers: { Cookie: cookie },
    }), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('id="tab-notifications"');
    expect(html).toContain('id="panel-notifications"');
    // Badge counts the surviving notifications (pipeline:warn dismissed).
    expect(html).toContain('data-notification-count>1</span>');
    // The dismissed pipeline:warn item is hidden worker-side.
    expect(html).not.toContain('data-notification-id="pipeline:warn"');
    expect(html).toContain('data-notification-id="scrape:chrome"');
    expect(html).toContain("1 dismissed");
    // ADMIN_DATA carries the bundle for later slices.
    expect(html).toContain("window.ADMIN_DATA");
  });

  it("renders the all-clear state with no signals", async () => {
    const { cookie } = await login();
    const kv = memoryKv();
    const env = mockEnv(kv, { "/stats": makeStats(), "/pipeline-health": { ok: true, status: "ok", reasons: [] } });

    const res = await worker.fetch(new Request("https://example.com/dashboard", {
      headers: { Cookie: cookie },
    }), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("All clear — no active notifications");
    expect(html).not.toContain("data-notification-count");
  });

  it("escapes hostile reason strings in notification details", async () => {
    const { cookie } = await login();
    const env = mockEnv(memoryKv(), {
      "/stats": makeStats(),
      "/pipeline-health": { ok: true, status: "critical", reasons: ['"><script>alert(1)</script>'] },
    });
    const res = await worker.fetch(new Request("https://example.com/dashboard", {
      headers: { Cookie: cookie },
    }), env, {} as ExecutionContext);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
