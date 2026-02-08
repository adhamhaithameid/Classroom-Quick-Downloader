import { describe, it, expect, vi } from "vitest";
import {
  createSessionCookieHeader,
  clearSessionCookieHeader,
  createSessionToken,
  verifySessionToken,
  isLocalEnvironment,
} from "../src/index";
import { DownloadsDurable } from "../src/downloads_do";

const STORAGE_KEY = "analytics_state";

class MockStorage {
  private map = new Map<string, any>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key);
  }

  async put(key: string, value: any): Promise<void> {
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
  const env = {
    ORACLE_ENDPOINT: "http://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  };
  const obj = new DownloadsDurable(state as any, env as any);
  return { obj, state };
}

function makeEvent(overrides: Partial<any> = {}) {
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

async function callDO(obj: DownloadsDurable, path: string, body: any, headers?: Record<string, string>) {
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

async function callDOWithoutAdmin(obj: DownloadsDurable, path: string, body: any, headers?: Record<string, string>) {
  return obj.fetch(new Request(`http://do${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
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
    const stored = await state.storage.get<any>(STORAGE_KEY);
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
    const stored = await state.storage.get<any>(STORAGE_KEY);
    expect(stored.buffer?.[0]?.ip_address).toBeUndefined();
    expect(stored.ipCountsSize).toBe(0);
    expect(stored.uniqueRequestsToday).toBe(0);
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

  it("enforces buffer size from config", async () => {
    const { obj } = makeDO();
    await callDO(obj, "/admin/update-config", {
      maxBufferSize: 1,
    }, { "X-Admin-Secret": "secret" });

    const first = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(first.status).toBe(202);
    const second = await callDO(obj, "/track", { events: [makeEvent()] });
    expect(second.status).toBe(503);
  });
});
