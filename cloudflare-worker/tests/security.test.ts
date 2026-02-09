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

async function callDOGet(obj: DownloadsDurable, path: string) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "GET",
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
    }, { "X-Client-IP": "5.5.5.5" });
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
    expect(stored.buffer?.length ?? 0).toBe(1);
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
    const payload = await res.json() as { serverTimeUtc?: number; dailyFlushWindowStartUtc?: number; dailyFlushWindowMinutes?: number; committedSeq?: number };
    expect(typeof payload.serverTimeUtc).toBe("number");
    expect(payload.dailyFlushWindowStartUtc).toBe(1);
    expect(payload.dailyFlushWindowMinutes).toBe(120);
    expect(typeof payload.committedSeq).toBe("number");
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
      const res = await callDO(obj, "/track", { events: [makeEvent()] }, { "X-Client-IP": "9.9.9.9" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
