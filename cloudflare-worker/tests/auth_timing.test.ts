import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";
import { TEST_SECRET_123, TEST_PASSWORD_123, TEST_DANGER_123 } from "./helpers/dummy-secrets";

function buildAuthEnv(overrides: Partial<Env> = {}) {
  const doFetch = vi.fn(async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
    if (url.includes("/auth/check-ip-allowlist")) {
      return new Response(JSON.stringify({ allowed: true, enabled: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/auth/login-attempt")) {
      return new Response(JSON.stringify({ allowed: true, ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const namespace = {
    idFromName: vi.fn().mockReturnValue("stub-id"),
    get: vi.fn().mockReturnValue({ fetch: doFetch }),
  };

  const env: Env = {
    DO_SHARED_SECRET: TEST_SECRET_123,
    DASHBOARD_PASSWORD: TEST_PASSWORD_123,
    DANGER_PASSWORD: TEST_DANGER_123,
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    MAX_BATCH_EVENTS: "10000",
    ...overrides,
  };
  return { env, doFetch };
}

function makeLoginRequest(password: string): Request {
  const formData = new FormData();
  formData.append("password", password);
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
  });
}

function makeDangerRequest(password: string): Request {
  return new Request("http://localhost/auth/verify-danger", {
    method: "POST",
    body: JSON.stringify({ password }),
    headers: {
      "content-type": "application/json",
      "x-admin-secret": TEST_SECRET_123,
    },
  });
}

describe("Authentication timing safety", () => {
  it("allows login with the correct dashboard password", async () => {
    const { env } = buildAuthEnv();

    const res = await worker.fetch(makeLoginRequest(TEST_PASSWORD_123), env, {} as ExecutionContext);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
    expect(res.headers.get("Set-Cookie")).toContain("cqd_session=");
  });

  it("denies login with an incorrect dashboard password and records the failed attempt", async () => {
    const { env, doFetch } = buildAuthEnv();

    const res = await worker.fetch(makeLoginRequest("wrong"), env, {} as ExecutionContext);
    const body = await res.text();

    expect(res.status).toBe(401);
    expect(body).toContain("Invalid password");

    const loginAttemptCall = doFetch.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      return url.includes("/auth/login-attempt");
    });
    expect(loginAttemptCall).toBeDefined();
    const loginAttemptRequest = loginAttemptCall?.[0] as Request;
    const payload = await loginAttemptRequest.json() as { success: boolean };
    expect(payload.success).toBe(false);
  });

  it("allows danger verification with the correct password", async () => {
    const { env } = buildAuthEnv();

    const res = await worker.fetch(makeDangerRequest(TEST_DANGER_123), env, {} as ExecutionContext);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("denies danger verification with an incorrect password", async () => {
    const { env } = buildAuthEnv();

    const res = await worker.fetch(makeDangerRequest("wrong"), env, {} as ExecutionContext);
    const body = await res.json() as { ok: boolean; error: string };

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid danger password");
  });

  it("denies danger verification when DANGER_PASSWORD is not configured", async () => {
    const { env } = buildAuthEnv({ DANGER_PASSWORD: undefined });

    const res = await worker.fetch(makeDangerRequest(TEST_DANGER_123), env, {} as ExecutionContext);
    const body = await res.json() as { ok: boolean; error: string };

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid danger password");
  });
});
