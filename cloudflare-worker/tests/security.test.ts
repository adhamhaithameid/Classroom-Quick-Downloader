import { describe, it, expect, vi } from "vitest";
import {
  createSessionCookieHeader,
  clearSessionCookieHeader,
  createSessionToken,
  verifySessionToken,
  isLocalEnvironment,
} from "../src/index";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";

const STORAGE_KEY = "analytics_state";

type StoredState = {
  loginAttempts?: Record<string, unknown>;
  buffer?: Array<Record<string, unknown>>;
  ipCountsSize?: number;
  uniqueRequestsToday?: number;
  pendingBatches?: Array<unknown>;
  retryState?: { consecutiveFailures?: number };
  lastFlushAt?: number;
  configMaxBufferSize?: number;
  totalEvents?: number;
  totalSuccess?: number;
  totalFail?: number;
  totalCancelled?: number;
  pendingEvents?: number;
  counters?: {
    byStatus?: Record<string, number>;
    byType?: Record<string, number>;
    byBrowser?: Record<string, number>;
    byOs?: Record<string, number>;
    byExtVersion?: Record<string, number>;
    byLanguage?: Record<string, number>;
    byCountry?: Record<string, number>;
    byErrorType?: Record<string, number>;
  };
  configHealthWarnPendingBatches?: number;
  configHealthCriticalPendingBatches?: number;
  configHealthWarnFailures?: number;
  configHealthCriticalFailures?: number;
  configHealthWarnStaleMs?: number;
  configHealthCriticalStaleMs?: number;
  configHealthWarnBufferUtil?: number;
  configHealthCriticalBufferUtil?: number;
  deliveryMetrics?: {
    totals?: {
      accepted?: number;
      stored?: number;
      forwarded?: number;
      committed?: number;
    };
    recent?: Array<Record<string, unknown>>;
  };
  failureRollups?: Array<Record<string, unknown>>;
};

type TestEvent = {
  id: string;
  status: "success" | "fail" | "cancelled";
  file_type: string;
  browser: string;
  os: string;
  ext_version: string;
  duration_ms: number;
  bypass_used: boolean;
  language: string;
  timestamp: number;
  [key: string]: unknown;
};

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  seed(key: string, value: unknown): void {
    this.map.set(key, value);
  }

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

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise.catch(() => {}));
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
    this.pending = [];
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

function makeDOWithStored(stored: StoredState) {
  const state = new MockState();
  state.storage.seed(STORAGE_KEY, stored);
  const env: Env = {
    ORACLE_ENDPOINT: "http://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function makeDOWithEnv(envOverride: Partial<Env>, stored?: StoredState) {
  const state = new MockState();
  if (stored) {
    state.storage.seed(STORAGE_KEY, stored);
  }
  const env: Env = {
    ORACLE_ENDPOINT: "http://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
    ...envOverride,
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function makeEvent(overrides: Partial<TestEvent> = {}): TestEvent {
  const now = Date.now();
  return {
    id: `ext-${now.toString(36)}-abcdef123456`,
    status: "success",
    file_type: "pdf",
    browser: "chrome",
    os: "mac",
    ext_version: "1.0.0",
    duration_ms: 100,
    bypass_used: false,
    language: "en",
    timestamp: now,
    ...overrides,
  };
}

async function callDO(obj: DownloadsDurable, path: string, body: unknown, headers?: Record<string, string>) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": "secret",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  }));
}

async function callDOWithoutAdmin(obj: DownloadsDurable, path: string, body: unknown, headers?: Record<string, string>) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  }));
}

async function callDORaw(obj: DownloadsDurable, path: string, body: string, headers?: Record<string, string>) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body,
  }));
}

async function callDOGet(obj: DownloadsDurable, path: string) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "GET",
  }));
}

async function callDOGetWithAdmin(obj: DownloadsDurable, path: string) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "GET",
    headers: {
      "X-Admin-Secret": "secret",
    },
  }));
}

describe("Worker security helpers", () => {
  it("detects local environments", () => {
    expect(isLocalEnvironment("localhost")).toBe(true);
    expect(isLocalEnvironment("127.0.0.1")).toBe(true);
    expect(isLocalEnvironment("example.com")).toBe(false);
  });

  it("creates secure cookies for non-local hosts", () => {
    const cookie = createSessionCookieHeader("token", new URL("https://example.com"));
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("creates insecure cookies for localhost", () => {
    const cookie = createSessionCookieHeader("token", new URL("http://localhost"));
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    const cleared = clearSessionCookieHeader(new URL("http://localhost"));
    expect(cleared).not.toContain("Secure");
  });

  it("verifies and rejects session tokens correctly", async () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const token = await createSessionToken("secret", "1.2.3.4");
    expect(await verifySessionToken(token, "secret", "1.2.3.4")).toBe(true);
    expect(await verifySessionToken(token + "x", "secret", "1.2.3.4")).toBe(false);

    spy.mockReturnValue(1_000_000 + 2 * 60 * 60 * 1000);
    expect(await verifySessionToken(token, "secret", "1.2.3.4")).toBe(false);
    spy.mockRestore();
  });
});

describe("Durable Object security behaviors", () => {
  it("checkOnly login attempts do not mutate state", async () => {
    const { obj, state } = makeDO();
    const res = await callDO(obj, "/auth/login-attempt", {
      ip: "1.1.1.1",
      success: false,
      checkOnly: true,
    });
    expect(res.status).toBe(200);
    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored?.loginAttempts?.["1.1.1.1"]).toBeUndefined();
  });

  it("locks out after max failed login attempts", async () => {
    const { obj } = makeDO();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await callDO(obj, "/auth/login-attempt", {
        ip: "2.2.2.2",
        success: false,
      });
    }
    const payload = await last!.json() as { allowed: boolean };
    expect(payload.allowed).toBe(false);
  });

  it("rejects login attempts without admin secret", async () => {
    const { obj } = makeDO();
    const res = await callDOWithoutAdmin(obj, "/auth/login-attempt", {
      ip: "9.9.9.9",
      success: false,
    });
    expect(res.status).toBe(401);
  });

  it("rejects ip allowlist checks without admin secret", async () => {
    const { obj } = makeDO();
    const res = await callDOWithoutAdmin(obj, "/auth/check-ip-allowlist", {
      ip: "1.2.3.4",
    });
    expect(res.status).toBe(401);
  });

  it("strips ip_address before buffering events", async () => {
    const { obj, state } = makeDO();
    const res = await callDO(obj, "/track", {
      events: [makeEvent({ ip_address: "5.5.5.5" })],
    }, { "CF-Connecting-IP": "5.5.5.5" });
    expect(res.status).toBe(202);
    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.[0]?.ip_address).toBeUndefined();
    expect(stored.ipCountsSize).toBe(0);
    expect(stored.uniqueRequestsToday).toBe(0);
  });

  it("echoes clientBatchId and returns ackId on /track", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/track", {
      clientBatchId: "client-123",
      events: [makeEvent()],
    });
    expect(res.status).toBe(202);
    const payload = await res.json() as { clientBatchId?: string; ackId?: string };
    expect(payload.clientBatchId).toBe("client-123");
    expect(typeof payload.ackId).toBe("string");
  });

  it("enforces max events per request from config", async () => {
    const { obj } = makeDO();
    await callDO(obj, "/admin/update-config", {
      maxEventsPerRequest: 1,
    }, { "X-Admin-Secret": "secret" });

    const res = await callDO(obj, "/track", {
      events: [makeEvent(), makeEvent()],
    });
    expect(res.status).toBe(400);
  });

  it("compacts when buffer size is constrained by config", async () => {
    const { obj, state } = makeDO();
    await callDO(obj, "/admin/update-config", {
      maxBufferSize: 1,
    }, { "X-Admin-Secret": "secret" });

    const first = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(first.status).toBe(202);
    const second = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(second.status).toBe(202);
    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.length ?? 0).toBeLessThanOrEqual(1);
    expect(stored.pendingBatches?.length ?? 0).toBeGreaterThan(0);
  });

  it("rejects invalid track payloads", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/track", { events: "nope" });
    expect(res.status).toBe(400);
  });

  it("rejects oversized track bodies before parsing", async () => {
    const { obj } = makeDO();
    const bigBody = "a".repeat(5 * 1024 * 1024 + 64);
    const res = await callDORaw(obj, "/track", bigBody, {
      "Content-Length": String(bigBody.length),
    });
    expect(res.status).toBe(413);
  });

  it("requires oracle ack with matching batchId", async () => {
    const { obj, state } = makeDO();
    await callDO(obj, "/track", { events: [makeEvent()] });
    const expectedBatchId = "do-seq0-1ev";

    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const parsed = JSON.parse(String(_init?.body || '{}'));
      expect(parsed.summary).toBeTruthy();
      expect(parsed.timeBuckets).toBeTruthy();
      expect(parsed.events).toBeUndefined();
      return new Response(
        JSON.stringify({ ok: true, batchId: expectedBatchId, ingestedAt: Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await callDO(obj, "/admin/force-flush", {});
    expect(res.status).toBe(200);

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.length ?? 0).toBe(0);
    vi.unstubAllGlobals();
  });

  it("rejects oracle ack with mismatched batchId", async () => {
    const { obj, state } = makeDO();
    await callDO(obj, "/track", { events: [makeEvent()] });

    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({ ok: true, batchId: "wrong-batch", ingestedAt: Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await callDO(obj, "/admin/force-flush", {});
    expect(res.status).toBe(500);

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.length ?? 0).toBe(0);
    expect(stored.pendingBatches?.length ?? 0).toBe(1);
    vi.unstubAllGlobals();
  });

  it("moves failed oracle batches into the pending replay queue", async () => {
    const { obj, state } = makeDO();
    await callDO(obj, "/track", { events: [makeEvent(), makeEvent()] });

    const fetchSpy = vi.fn(async () => {
      return new Response("oracle down", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await callDO(obj, "/admin/force-flush", {});
    expect(res.status).toBe(500);

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.length ?? 0).toBe(0);
    expect(stored.pendingBatches?.length ?? 0).toBe(1);
    vi.unstubAllGlobals();
  });

  it("rejects invalid config updates", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/admin/update-config", {
      batchSize: "nope",
    }, { "X-Admin-Secret": "secret" });
    expect(res.status).toBe(400);
    const payload = await res.json() as { error?: string };
    expect(payload.error).toBe("invalid_config");
  });

  it("includes server time and daily flush window in config", async () => {
    const { obj } = makeDO();
    const res = await callDOGet(obj, "/config");
    expect(res.status).toBe(200);
    const payload = await res.json() as { serverTimeUtc?: number; dailyFlushWindowStartUtc?: number; dailyFlushWindowMinutes?: number; committedSeq?: number; healthNotifyIntervalsMs?: { warn?: number; critical?: number } };
    expect(typeof payload.serverTimeUtc).toBe("number");
    expect(payload.dailyFlushWindowStartUtc).toBe(1);
    expect(payload.dailyFlushWindowMinutes).toBe(120);
    expect(typeof payload.committedSeq).toBe("number");
    expect(typeof payload.healthNotifyIntervalsMs?.warn).toBe("number");
    expect(typeof payload.healthNotifyIntervalsMs?.critical).toBe("number");
  });

  it("updates daily flush window config", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/admin/update-config", {
      dailyFlushWindowStartUtc: 3,
      dailyFlushWindowMinutes: 90,
    }, { "X-Admin-Secret": "secret" });
    expect(res.status).toBe(200);
    const payload = await res.json() as { config?: { dailyFlushWindowStartUtc?: number; dailyFlushWindowMinutes?: number } };
    expect(payload.config?.dailyFlushWindowStartUtc).toBe(3);
    expect(payload.config?.dailyFlushWindowMinutes).toBe(90);
  });

  it("updates health notification intervals", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/admin/update-config", {
      healthNotifyIntervalsMs: { warn: 45 * 60 * 1000, critical: 15 * 60 * 1000 },
    }, { "X-Admin-Secret": "secret" });
    expect(res.status).toBe(200);
    const payload = await res.json() as { config?: { healthNotifyIntervalsMs?: { warn?: number; critical?: number } } };
    expect(payload.config?.healthNotifyIntervalsMs?.warn).toBe(45 * 60 * 1000);
    expect(payload.config?.healthNotifyIntervalsMs?.critical).toBe(15 * 60 * 1000);
    const configRes = await callDOGet(obj, "/config");
    const cfgPayload = await configRes.json() as { healthNotifyIntervalsMs?: { warn?: number; critical?: number } };
    expect(cfgPayload.healthNotifyIntervalsMs?.warn).toBe(45 * 60 * 1000);
    expect(cfgPayload.healthNotifyIntervalsMs?.critical).toBe(15 * 60 * 1000);
  });

  it("round-trips health thresholds into stats for dashboard", async () => {
    const { obj } = makeDO();
    const updateRes = await callDO(obj, "/admin/update-config", {
      healthThresholds: {
        warnPendingBatches: 4,
        criticalPendingBatches: 8,
        warnFailures: 2,
        criticalFailures: 4,
        warnStaleMs: 2 * 60 * 60 * 1000,
        criticalStaleMs: 6 * 60 * 60 * 1000,
        warnBufferUtil: 0.75,
        criticalBufferUtil: 0.9,
      },
      healthNotifyIntervalsMs: { warn: 60 * 60 * 1000, critical: 20 * 60 * 1000 },
    }, { "X-Admin-Secret": "secret" });
    expect(updateRes.status).toBe(200);

    const statsRes = await callDOGet(obj, "/stats");
    expect(statsRes.status).toBe(200);
    const payload = await statsRes.json() as { remoteConfig?: { healthThresholds?: Record<string, unknown>; healthNotifyIntervalsMs?: { warn?: number; critical?: number } } };
    expect(payload.remoteConfig?.healthThresholds?.warnPendingBatches).toBe(4);
    expect(payload.remoteConfig?.healthThresholds?.criticalPendingBatches).toBe(8);
    expect(payload.remoteConfig?.healthNotifyIntervalsMs?.warn).toBe(60 * 60 * 1000);
    expect(payload.remoteConfig?.healthNotifyIntervalsMs?.critical).toBe(20 * 60 * 1000);
  });

  it("persists allowLegacyEvents in config", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/admin/update-config", {
      allowLegacyEvents: false,
    }, { "X-Admin-Secret": "secret" });
    expect(res.status).toBe(200);
    const configRes = await callDOGet(obj, "/config");
    const payload = await configRes.json() as { allowLegacyEvents?: boolean };
    expect(payload.allowLegacyEvents).toBe(false);
  });

  it("returns accepted sequences for track", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(res.status).toBe(202);
    const payload = await res.json() as { acceptedSeqs?: Array<[string, number]>; committedSeq?: number };
    expect(Array.isArray(payload.acceptedSeqs)).toBe(true);
    expect(typeof payload.committedSeq).toBe("number");
    const seq = payload.acceptedSeqs?.[0]?.[1];
    expect(typeof seq).toBe("number");
  });

  it("accepts future-skewed timestamps by clamping", async () => {
    const { obj } = makeDO();
    const future = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
    const res = await callDO(obj, "/track", { events: [makeEvent({ timestamp: future })] });
    expect(res.status).toBe(202);
    const payload = await res.json() as { accepted?: number };
    expect(payload.accepted).toBe(1);
  });

  it("accepts legacy id formats without rejecting", async () => {
    const { obj } = makeDO();
    const res = await callDO(obj, "/track", { events: [makeEvent({ id: "legacy-123456" })] });
    expect(res.status).toBe(202);
  });

  it("accepts legacy events without id when allowLegacyEvents is enabled", async () => {
    const { obj } = makeDO();
    const legacyEvent = { ...makeEvent() } as Record<string, unknown>;
    delete legacyEvent.id;
    const res = await callDO(obj, "/track", { events: [legacyEvent] });
    expect(res.status).toBe(202);
    const payload = await res.json() as { accepted?: number; acceptedIds?: string[] };
    expect(payload.accepted).toBe(1);
    expect(Array.isArray(payload.acceptedIds)).toBe(true);
    expect(payload.acceptedIds?.length ?? 0).toBe(1);
  });

  it("rejects legacy events without id when allowLegacyEvents is disabled", async () => {
    const { obj } = makeDO();
    await callDO(obj, "/admin/update-config", {
      allowLegacyEvents: false,
    }, { "X-Admin-Secret": "secret" });
    const legacyEvent = { ...makeEvent() } as Record<string, unknown>;
    delete legacyEvent.id;
    const res = await callDO(obj, "/track", { events: [legacyEvent] });
    expect(res.status).toBe(202);
    const payload = await res.json() as { accepted?: number; invalid?: number };
    expect(payload.accepted).toBe(0);
    expect(payload.invalid).toBe(1);
  });

  it("rate limits excessive track requests per IP", async () => {
    const { obj } = makeDO();
    let lastStatus = 0;
    for (let i = 0; i < 121; i++) {
      const res = await callDO(obj, "/track", { events: [makeEvent()] }, { "CF-Connecting-IP": "9.9.9.9" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("ignores X-Client-IP when rate limiting /track", async () => {
    const { obj } = makeDO();
    let lastStatus = 0;
    for (let i = 0; i < 121; i++) {
      const res = await callDO(obj, "/track", { events: [makeEvent()] }, {
        "CF-Connecting-IP": "7.7.7.7",
        "X-Client-IP": `1.2.3.${i}`,
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("accepts CF-IPCountry fallback for track country", async () => {
    const { obj, state } = makeDO();
    const res = await callDO(obj, "/track", { events: [makeEvent()] }, {
      "CF-Connecting-IP": "3.3.3.3",
      "CF-IPCountry": "GB",
    });
    expect(res.status).toBe(202);
    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.buffer?.[0]?.country).toBe("gb");
  });

  it("applies rollup count to counters", async () => {
    const { obj, state } = makeDO();
    const res = await callDO(obj, "/track", { events: [makeEvent({ count: 3 })] }, {
      "CF-Connecting-IP": "4.4.4.4",
    });
    expect(res.status).toBe(202);
    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored.totalEvents).toBe(3);
    expect(stored.counters?.byStatus?.success).toBe(3);
  });

  it("supports IPv4/IPv6 CIDR entries in allowlist", async () => {
    const { obj } = makeDO();
    await callDO(obj, "/admin/ip-allowlist", {
      enabled: true,
      allowlist: ["10.0.0.0/8", "2001:db8::/32"],
    }, { "X-Admin-Secret": "secret" });

    const v4Allowed = await callDO(obj, "/auth/check-ip-allowlist", { ip: "10.1.2.3" });
    const v4Payload = await v4Allowed.json() as { allowed: boolean };
    expect(v4Payload.allowed).toBe(true);

    const v6Allowed = await callDO(obj, "/auth/check-ip-allowlist", { ip: "2001:db8::1" });
    const v6Payload = await v6Allowed.json() as { allowed: boolean };
    expect(v6Payload.allowed).toBe(true);

    const denied = await callDO(obj, "/auth/check-ip-allowlist", { ip: "192.168.1.1" });
    const deniedPayload = await denied.json() as { allowed: boolean };
    expect(deniedPayload.allowed).toBe(false);
  });

  it("returns pipeline health status", async () => {
    const { obj } = makeDO();
    const res = await callDOGet(obj, "/pipeline-health");
    expect(res.status).toBe(200);
    const payload = await res.json() as { status?: string; reasons?: string[] };
    expect(payload.status).toBe("ok");
    expect(Array.isArray(payload.reasons)).toBe(true);
  });

  it("notifies webhook on critical pipeline health", async () => {
    const webhookUrl = "https://alert.example.com";
    const fetchSpy = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const pendingBatch = {
      batch: {
        batchId: "seed",
        generatedAt: Date.now(),
        timeZone: "UTC",
        summary: {
          totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
          browsers: {},
          os: {},
          countries: {},
          languages: {},
          versions: {},
          types: {},
          errorReasons: {},
          topBrowser: "unknown",
          topOs: "unknown",
          topCountry: "unknown",
          topType: "unknown",
        },
        timeBuckets: [],
      },
      weightedCount: 0,
      maxSeq: 0,
      attempts: 0,
      createdAt: Date.now() - 30 * 60 * 60 * 1000,
    };
    const { obj, state } = makeDOWithEnv({ ALERT_WEBHOOK_URL: webhookUrl }, {
      pendingBatches: Array.from({ length: 30 }, () => ({ ...pendingBatch })),
      retryState: { consecutiveFailures: 10 },
      lastFlushAt: Date.now() - 48 * 60 * 60 * 1000,
      buffer: [],
      configMaxBufferSize: 50000,
    });

    const res = await callDOGetWithAdmin(obj, "/pipeline-health");
    expect(res.status).toBe(200);
    await state.drain();

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toBe(webhookUrl);
    vi.unstubAllGlobals();
  });

  it("warns when pending batches exceed thresholds", async () => {
    const pendingBatch = {
      batch: {
        batchId: "seed",
        generatedAt: Date.now(),
        timeZone: "UTC",
        summary: {
          totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
          browsers: {},
          os: {},
          countries: {},
          languages: {},
          versions: {},
          types: {},
          errorReasons: {},
          topBrowser: "unknown",
          topOs: "unknown",
          topCountry: "unknown",
          topType: "unknown",
        },
        timeBuckets: [],
      },
      weightedCount: 0,
      maxSeq: 0,
      attempts: 0,
      createdAt: Date.now() - 7 * 60 * 60 * 1000,
    };
    const { obj } = makeDOWithStored({
      pendingBatches: Array.from({ length: 12 }, () => ({ ...pendingBatch })),
      retryState: { consecutiveFailures: 0 },
      lastFlushAt: Date.now() - 2 * 60 * 60 * 1000,
      buffer: [],
      configMaxBufferSize: 50000,
    });
    const res = await callDOGet(obj, "/pipeline-health");
    const payload = await res.json() as { status?: string; reasons?: string[] };
    expect(payload.status).toBe("warn");
    expect(payload.reasons || []).toContain("pending_batches_elevated");
  });

  it("does not trigger alert webhook from public pipeline-health", async () => {
    const webhookUrl = "https://alert.example.com";
    const fetchSpy = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const { obj, state } = makeDOWithEnv({ ALERT_WEBHOOK_URL: webhookUrl }, {
      pendingBatches: [],
      retryState: { consecutiveFailures: 0 },
      lastFlushAt: Date.now(),
      buffer: [],
      configMaxBufferSize: 50000,
    });
    const res = await callDOGet(obj, "/pipeline-health");
    expect(res.status).toBe(200);
    await state.drain();

    const webhookCalls = fetchSpy.mock.calls.filter((call) => {
      try {
        const url = new URL(String(call[0] ?? ""));
        return url.hostname === "alert.example.com";
      } catch {
        return false;
      }
    });
    expect(webhookCalls.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it("uses configured pipeline health thresholds", async () => {
    const { obj } = makeDOWithStored({
      configHealthWarnPendingBatches: 2,
      configHealthCriticalPendingBatches: 4,
      configHealthWarnFailures: 1,
      configHealthCriticalFailures: 2,
      configHealthWarnStaleMs: 1000,
      configHealthCriticalStaleMs: 2000,
      configHealthWarnBufferUtil: 0.4,
      configHealthCriticalBufferUtil: 0.6,
      buffer: [],
      pendingBatches: [],
      retryState: { consecutiveFailures: 0 },
      lastFlushAt: Date.now(),
      configMaxBufferSize: 50000,
    });

    const res = await callDOGet(obj, "/pipeline-health");
    expect(res.status).toBe(200);
    const payload = await res.json() as { thresholds?: Record<string, unknown> };
    expect(payload.thresholds?.warnPendingBatches).toBe(2);
    expect(payload.thresholds?.criticalPendingBatches).toBe(4);
    expect(payload.thresholds?.warnFailures).toBe(1);
    expect(payload.thresholds?.criticalFailures).toBe(2);
    expect(payload.thresholds?.warnStaleMs).toBe(1000);
    expect(payload.thresholds?.criticalStaleMs).toBe(2000);
    expect(payload.thresholds?.warnBufferUtil).toBe(0.4);
    expect(payload.thresholds?.criticalBufferUtil).toBe(0.6);
  });

  it("compacts pending batches when all attempts are non-zero", async () => {
    const pendingBatch = {
      batch: {
        batchId: "seed",
        generatedAt: Date.now(),
        timeZone: "UTC",
        summary: {
          totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
          browsers: {},
          os: {},
          countries: {},
          languages: {},
          versions: {},
          types: {},
          errorReasons: {},
          topBrowser: "unknown",
          topOs: "unknown",
          topCountry: "unknown",
          topType: "unknown",
        },
        timeBuckets: [],
      },
      weightedCount: 0,
      maxSeq: 0,
      attempts: 2,
      createdAt: Date.now() - 60 * 1000,
    };
    const stored = {
      pendingBatches: Array.from({ length: 55 }, () => ({ ...pendingBatch })),
      retryState: { consecutiveFailures: 3 },
      lastFlushAt: Date.now() - 8 * 60 * 60 * 1000,
      buffer: [],
      configMaxBufferSize: 50000,
    };
    const { state, obj } = makeDOWithStored(stored);
    await obj.fetch(new Request("http://do/health", { method: "GET" }));
    const next = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(next?.pendingBatches?.length ?? 0).toBeLessThanOrEqual(50);
  });

  it("tracks delivery metrics chain and exports failure rollups on flush success", async () => {
    const { obj, state } = makeDO();

    const invalid = await callDO(obj, "/track", { events: "invalid" });
    expect(invalid.status).toBe(400);

    const accepted = await callDO(obj, "/track", {
      events: [makeEvent({ count: 3 })],
    });
    expect(accepted.status).toBe(202);

    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        batchId?: string;
        delivery?: { acceptedCount?: number; forwardedCount?: number; committedCount?: number };
        failureLogs?: Array<{ errorCode?: string; sampleCount?: number }>;
      };
      expect(body.delivery?.acceptedCount).toBe(3);
      expect(body.delivery?.forwardedCount).toBe(3);
      expect(body.delivery?.committedCount).toBe(0);
      expect(body.failureLogs?.some((row) => row.errorCode === "invalid_payload")).toBe(true);
      return new Response(
        JSON.stringify({ ok: true, batchId: body.batchId, ingestedAt: Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const flush = await callDO(obj, "/admin/force-flush", {});
    expect(flush.status).toBe(200);
    const flushPayload = await flush.json() as { ok?: boolean; sent?: number };
    expect(flushPayload.ok).toBe(true);
    expect(flushPayload.sent).toBe(3);

    const stats = await callDOGet(obj, "/stats");
    expect(stats.status).toBe(200);
    const payload = await stats.json() as {
      deliveryMetrics?: {
        totals?: { accepted?: number; stored?: number; forwarded?: number; committed?: number };
        recent?: Array<{ status?: string }>;
      };
      failureSink?: { unsentRollups?: number; totalRollups?: number };
    };
    expect(payload.deliveryMetrics?.totals?.accepted).toBe(3);
    expect(payload.deliveryMetrics?.totals?.stored).toBe(3);
    expect(payload.deliveryMetrics?.totals?.forwarded).toBe(3);
    expect(payload.deliveryMetrics?.totals?.committed).toBe(3);
    expect(payload.deliveryMetrics?.recent?.[0]?.status).toBe("committed");
    expect(payload.failureSink?.totalRollups).toBeGreaterThan(0);
    expect(payload.failureSink?.unsentRollups).toBe(0);

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(stored?.failureRollups?.every((entry) => Number((entry as { unsentCount?: number }).unsentCount ?? 0) === 0)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("preserves rollup weighted counts in pending replay queue and commits exact sent value", async () => {
    const { obj, state } = makeDO();
    const tracked = await callDO(obj, "/track", {
      events: [makeEvent({ count: 4 })],
    });
    expect(tracked.status).toBe(202);

    const failFetch = vi.fn(async () => new Response("oracle down", { status: 503 }));
    vi.stubGlobal("fetch", failFetch);
    const firstFlush = await callDO(obj, "/admin/force-flush", {});
    expect(firstFlush.status).toBe(500);
    vi.unstubAllGlobals();

    const storedAfterFail = await state.storage.get<StoredState>(STORAGE_KEY);
    const pending = storedAfterFail?.pendingBatches?.[0] as { weightedCount?: number; batch?: { batchId?: string } } | undefined;
    expect(pending?.weightedCount).toBe(4);
    const pendingBatchId = pending?.batch?.batchId;
    expect(typeof pendingBatchId).toBe("string");

    const okFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: true, batchId: pendingBatchId, ingestedAt: Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    vi.stubGlobal("fetch", okFetch);
    const secondFlush = await callDO(obj, "/admin/force-flush", {});
    expect(secondFlush.status).toBe(200);
    const secondPayload = await secondFlush.json() as { sent?: number };
    expect(secondPayload.sent).toBe(4);
    vi.unstubAllGlobals();

    const storedAfterSuccess = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(storedAfterSuccess?.pendingBatches?.length ?? 0).toBe(0);
    expect(storedAfterSuccess?.pendingEvents ?? -1).toBe(0);
  });

  it("exports new failure rollups while replaying an existing pending batch", async () => {
    const { obj, state } = makeDO();
    const tracked = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(tracked.status).toBe(202);

    const failFetch = vi.fn(async () => new Response("oracle down", { status: 503 }));
    vi.stubGlobal("fetch", failFetch);
    const firstFlush = await callDO(obj, "/admin/force-flush", {});
    expect(firstFlush.status).toBe(500);
    vi.unstubAllGlobals();

    // Record a new structured failure after the batch has already moved to pending queue.
    const invalid = await callDO(obj, "/track", { events: "invalid" });
    expect(invalid.status).toBe(400);

    const stored = await state.storage.get<StoredState>(STORAGE_KEY);
    const pendingBatchId = (
      stored?.pendingBatches?.[0] as { batch?: { batchId?: string } } | undefined
    )?.batch?.batchId;
    expect(typeof pendingBatchId).toBe("string");

    const okFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        batchId?: string;
        failureLogs?: Array<{ errorCode?: string; sampleCount?: number }>;
      };
      expect(body.batchId).toBe(pendingBatchId);
      expect(body.failureLogs?.some((row) => row.errorCode === "invalid_payload")).toBe(true);
      return new Response(
        JSON.stringify({ ok: true, batchId: pendingBatchId, ingestedAt: Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", okFetch);
    const secondFlush = await callDO(obj, "/admin/force-flush", {});
    expect(secondFlush.status).toBe(200);
    vi.unstubAllGlobals();

    const storedAfter = await state.storage.get<StoredState>(STORAGE_KEY);
    expect(storedAfter?.failureRollups?.every((entry) => Number((entry as { unsentCount?: number }).unsentCount ?? 0) === 0)).toBe(true);
  });
});
