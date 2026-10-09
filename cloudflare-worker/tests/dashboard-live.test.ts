// filepath: tests/dashboard-live.test.ts
// Slice 2 commit 5: refresh-gated live stats websocket. Contract: the
// /admin/live upgrade passes the existing admin auth (401 before any
// upgrade, at both the worker and DO layers), the accepted socket gets a
// server-initiated hello plus throttled pushes (at most one per 5s, no
// client messages), and the dashboard ships a user-initiated "Go live"
// toggle with a hard 10-minute auto-close and no auto-reconnect.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadsDurable, LIVE_PUSH_MIN_INTERVAL_MS } from "../src/downloads_do";
import worker from "../src/index";
import { renderDashboard } from "../src/dashboard/main";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { StatsResponse } from "../src/types";
import { TEST_DO_SHARED_SECRET, TEST_DASHBOARD_PASSWORD } from "./helpers/dummy-secrets";

// ---------------------------------------------------------------------------
// Minimal hibernation-API mocks (node environment: no workerd globals here).
// ---------------------------------------------------------------------------

class MockLiveSocket {
  sent: string[] = [];
  closed: Array<{ code?: number; reason?: string }> = [];
  readyState = 1;

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed.push({ code, reason });
    this.readyState = 3;
  }

  addEventListener(): void {
    // The DO attaches no message listeners by design (client sends nothing).
  }
}

let pairCounter = 0;

class MockWebSocketPair {
  0: MockLiveSocket;
  1: MockLiveSocket;

  constructor() {
    pairCounter += 1;
    this[0] = new MockLiveSocket();
    this[1] = new MockLiveSocket();
  }
}

class MockWebSocketRequestResponsePair {
  constructor(public request: string, public response: string) {}
}

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

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
    return this.alarm;
  }

  async setAlarm(ts: number): Promise<void> {
    this.alarm = ts;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

class LiveMockState {
  storage = new MockStorage();
  accepted: MockLiveSocket[] = [];
  autoResponse: MockWebSocketRequestResponsePair | null = null;

  acceptWebSocket(ws: MockLiveSocket): void {
    this.accepted.push(ws);
  }

  getWebSockets(): MockLiveSocket[] {
    return this.accepted;
  }

  setWebSocketAutoResponse(pair: MockWebSocketRequestResponsePair): void {
    this.autoResponse = pair;
  }
}

(globalThis as Record<string, unknown>).WebSocketPair = MockWebSocketPair;
(globalThis as Record<string, unknown>).WebSocketRequestResponsePair = MockWebSocketRequestResponsePair;

function makeDO() {
  const state = new LiveMockState();
  const env: Env = {
    DO_SHARED_SECRET: TEST_DO_SHARED_SECRET,
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function countReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    installId: "install-1",
    lifetimeCount: 1000,
    browser: "chrome",
    clientBatchId: `dlc-${Math.random()}`,
    ...overrides,
  });
}

async function postReport(obj: DownloadsDurable, body: string): Promise<void> {
  const res = await obj.fetch(
    new Request("http://do/track", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.7" },
      body,
    }),
  );
  expect(res.status).toBe(200);
}

async function upgradeLive(obj: DownloadsDurable, withSecret = true): Promise<Response> {
  const headers: Record<string, string> = { Upgrade: "websocket" };
  if (withSecret) headers["X-Admin-Secret"] = TEST_DO_SHARED_SECRET;
  return obj.fetch(new Request("http://do/admin/live", { headers }));
}

// Node's undici Response rejects status 101 (a workerd-only allowance for
// websocket handshakes). While the upgrade runs, swap in a permissive fake so
// the DO's real 101 construction path is exercised unchanged.
class FakeUpgradeResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body = null;

  constructor(_body: null, init: { status: number; statusText?: string; headers?: HeadersInit }) {
    this.status = init.status;
    this.statusText = init.statusText || "";
    this.headers = new Headers(init.headers);
  }
}

async function withUpgradeResponseSupport<T>(fn: () => Promise<T>): Promise<T> {
  const original = globalThis.Response;
  (globalThis as Record<string, unknown>).Response = FakeUpgradeResponse;
  try {
    return await fn();
  } finally {
    (globalThis as Record<string, unknown>).Response = original;
  }
}

// ---------------------------------------------------------------------------
// Worker-layer helpers (same pattern as tests/index-auth-config.test.ts).
// ---------------------------------------------------------------------------

function workerEnv(doFetch: (req: Request) => Promise<Response>): Env {
  const stub = {
    fetch: async (input: RequestInfo | URL): Promise<Response> => doFetch(new Request(input as RequestInfo)),
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: TEST_DO_SHARED_SECRET,
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    MAX_BATCH_EVENTS: "10000",
  } as Env;
}

function makeStats(): StatsResponse {
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
      maxDailyRequests: 50,
      maxRetry: 20,
      maxEventsPerRequest: 5000,
      maxBufferSize: 50000,
      flushMode: "weekly",
      timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
      dailyFlushWindowStartUtc: 0,
      dailyFlushWindowMinutes: 120,
      configVersion: 2,
      cancelHoldDelayMs: 1000,
      allowLegacyEvents: true,
      remoteEnabledReason: "ok",
      hardRemoteOff: false,
    },
    bufferStatus: { currentSize: 0, maxSize: 50000, utilizationPercent: "0.00" },
    nextAlarmAt: null,
    changelog: [],
    changelogConfig: { rules: [] },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("live stats websocket auth (commit 5)", () => {
  it("worker rejects an unauthenticated upgrade with 401 before contacting the DO", async () => {
    let doCalls = 0;
    const env = workerEnv(async () => {
      doCalls += 1;
      return new Response(null, { status: 101 });
    });
    const res = await worker.fetch(
      new Request("https://example.com/admin/live", {
        method: "GET",
        headers: { Upgrade: "websocket" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(401);
    expect(doCalls).toBe(0);
  });

  it("worker passes an authenticated upgrade through to the DO verbatim", async () => {
    // Plain-object 101: undici cannot build a real one in Node, and the
    // proxy must return the DO's response untouched (no re-wrapping).
    const env = workerEnv(
      async () =>
        ({
          status: 101,
          statusText: "Switching Protocols",
          headers: new Headers({ Upgrade: "websocket" }),
        }) as unknown as Response,
    );
    const res = await worker.fetch(
      new Request("https://example.com/admin/live", {
        method: "GET",
        headers: { Upgrade: "websocket", "X-Admin-Secret": TEST_DO_SHARED_SECRET },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(101);
  });

  it("DO rejects an upgrade without the admin secret with 401", async () => {
    const { obj } = makeDO();
    const res = await upgradeLive(obj, false);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("DO rejects a non-websocket GET on /admin/live with 426", async () => {
    const { obj } = makeDO();
    const res = await obj.fetch(
      new Request("http://do/admin/live", {
        headers: { "X-Admin-Secret": TEST_DO_SHARED_SECRET },
      }),
    );
    expect(res.status).toBe(426);
  });
});

describe("live stats websocket pushes (commit 5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the upgrade, sends a hello snapshot, and throttles pushes to one per 5s", async () => {
    const { obj, state } = makeDO();

    const res = await withUpgradeResponseSupport(() => upgradeLive(obj));
    expect(res.status).toBe(101);
    expect(res.statusText).toBe("Switching Protocols");

    // Hibernation API wired: one socket accepted, ping auto-response set.
    expect(state.accepted).toHaveLength(1);
    expect(state.autoResponse).toBeInstanceOf(MockWebSocketRequestResponsePair);
    expect(state.autoResponse?.request).toBe("ping");

    // Server-initiated hello snapshot (the client never sends anything).
    const server = state.accepted[0];
    expect(server.sent).toHaveLength(1);
    const hello = JSON.parse(server.sent[0]) as Record<string, unknown>;
    expect(hello.type).toBe("stats-delta");
    expect(hello.reason).toBe("hello");

    // First state change inside no prior window: immediate push.
    await postReport(obj, countReport({ installId: "install-live", lifetimeCount: 10 }));
    expect(server.sent).toHaveLength(2);
    const delta = JSON.parse(server.sent[1]) as Record<string, unknown>;
    expect(delta.reason).toBe("delta");

    // Second change inside the 5s window: throttled, nothing sent yet.
    await postReport(obj, countReport({ installId: "install-live", lifetimeCount: 20 }));
    expect(server.sent).toHaveLength(2);

    // Trailing push fires at the window edge.
    vi.advanceTimersByTime(LIVE_PUSH_MIN_INTERVAL_MS);
    expect(server.sent).toHaveLength(3);

    // The DO never waits on client input: no message listeners anywhere.
    expect(server.closed).toHaveLength(0);
  });

  it("sends nothing when no live socket is attached", async () => {
    const { obj, state } = makeDO();
    await postReport(obj, countReport({ installId: "install-quiet", lifetimeCount: 5 }));
    vi.advanceTimersByTime(60_000);
    expect(state.accepted).toHaveLength(0);
  });
});

describe("dashboard Go live toggle (commit 5)", () => {
  it("renders the toggle, state line, and last-push hook", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="live-toggle"');
    expect(html).toContain('id="live-state"');
    expect(html).toContain('id="live-last-push"');
    expect(html).toContain('data-live-state="off"');
    expect(html).toContain("Go live");
  });

  it("opens exactly one websocket path with no client->server traffic and no auto-reconnect", () => {
    const html = renderDashboard(makeStats());
    // One connect site, pointed at the DO route.
    expect(html).toContain('"/admin/live"');
    expect(html.match(/new WebSocket\(/g) ?? []).toHaveLength(1);
    // Client sends nothing after connect (hibernation bills incoming 20:1).
    expect(html).not.toContain("ws.send(");
    // openLiveSocket appears exactly twice: the definition and the single
    // user-toggle call site. onclose resets state only — no reconnect path.
    expect(html.match(/openLiveSocket\(/g) ?? []).toHaveLength(2);
  });

  it("carries the 10-minute auto-close timer and visibility/unload closes", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("LIVE_CLOSE_AFTER_MS = 10 * 60 * 1000");
    expect(html).toContain("Auto-closed after 10 minutes");
    expect(html).toContain("visibilitychange");
    expect(html).toContain("beforeunload");
    expect(html).toContain("pagehide");
  });
});
