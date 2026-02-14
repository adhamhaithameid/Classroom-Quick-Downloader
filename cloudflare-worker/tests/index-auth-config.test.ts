import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

function mockEnv(overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };

  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: "do-shared-secret",
    DANGER_PASSWORD: "danger-secret",
    ORACLE_ENDPOINT: "http://oracle.local/ingest-batch",
    MAX_BATCH_EVENTS: "10000",
    DASHBOARD_PASSWORD: "dashboard-secret",
    ...overrides,
  };
}

describe("Worker auth config hardening", () => {
  it("requires DASHBOARD_PASSWORD and does not fall back to DO_SHARED_SECRET", async () => {
    const env = mockEnv({ DASHBOARD_PASSWORD: undefined });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=do-shared-secret",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).toContain("DASHBOARD_PASSWORD missing");
  });

  it("blocks protected CORS requests from disallowed origins", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        Origin: "https://evil.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const body = await res.json() as { ok: boolean; error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe("cors_origin_not_allowed");
  });

  it("enforces strict admin CORS allowlist", async () => {
    const env = mockEnv({
      CORS_ALLOWED_ORIGINS: "https://stats.example.com",
      ADMIN_CORS_ALLOWED_ORIGINS: "https://admin.example.com",
    });
    const blockedReq = new Request("https://example.com/admin/update-config", {
      method: "POST",
      headers: {
        Origin: "https://stats.example.com",
      },
      body: JSON.stringify({ maxBatchEvents: 50 }),
    });
    const blockedRes = await worker.fetch(blockedReq, env, {} as ExecutionContext);
    const blockedBody = await blockedRes.json() as { ok: boolean; error: string };
    expect(blockedRes.status).toBe(403);
    expect(blockedBody.error).toBe("cors_origin_not_allowed");

    const allowedReq = new Request("https://example.com/admin/update-config", {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Admin-Secret",
      },
    });
    const allowedRes = await worker.fetch(allowedReq, env, {} as ExecutionContext);
    expect(allowedRes.status).toBe(204);
    expect(allowedRes.headers.get("Access-Control-Allow-Origin")).toBe("https://admin.example.com");
    expect(allowedRes.headers.get("Access-Control-Allow-Headers")).toContain("X-Admin-Secret");
  });

  it("does not fallback admin CORS to general allowlist", async () => {
    const env = mockEnv({
      CORS_ALLOWED_ORIGINS: "https://stats.example.com",
      ADMIN_CORS_ALLOWED_ORIGINS: undefined,
    });
    const request = new Request("https://example.com/admin/update-config", {
      method: "OPTIONS",
      headers: {
        Origin: "https://stats.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Admin-Secret",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("allows wildcard CORS for public track preflight", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/track", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(res.headers.get("Access-Control-Allow-Headers")).not.toContain("X-Admin-Secret");
  });

  it("does not emit CORS origin for protected requests without Origin header", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        "X-Admin-Secret": "do-shared-secret",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects OPTIONS preflight on unknown routes", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/unknown-endpoint", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(403);
  });

  it("enforces strict session binding on protected endpoints", async () => {
    const env = mockEnv({ SESSION_BINDING_MODE: "strict" });
    const loginReq = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "Oracle-Test-UA",
      },
      body: "password=dashboard-secret",
    });

    const loginRes = await worker.fetch(loginReq, env, {} as ExecutionContext);
    expect(loginRes.status).toBe(302);
    const setCookie = loginRes.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("cqd_session=");

    const stolenTokenReq = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        Cookie: setCookie,
        "CF-Connecting-IP": "198.51.100.7",
        "User-Agent": "Oracle-Test-UA",
      },
    });
    const stolenTokenRes = await worker.fetch(stolenTokenReq, env, {} as ExecutionContext);
    expect(stolenTokenRes.status).toBe(401);

    const sameClientReq = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        Cookie: setCookie,
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "Oracle-Test-UA",
      },
    });
    const sameClientRes = await worker.fetch(sameClientReq, env, {} as ExecutionContext);
    expect(sameClientRes.status).toBe(200);
  });

  it("normalizes compressed IPv6 prefixes for strict session binding", async () => {
    const env = mockEnv({ SESSION_BINDING_MODE: "strict" });
    const loginReq = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": "2001:db8::1",
        "User-Agent": "Oracle-Test-UA-IPv6",
      },
      body: "password=dashboard-secret",
    });

    const loginRes = await worker.fetch(loginReq, env, {} as ExecutionContext);
    expect(loginRes.status).toBe(302);
    const setCookie = loginRes.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("cqd_session=");

    const samePrefixReq = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        Cookie: setCookie,
        "CF-Connecting-IP": "2001:db8::abcd",
        "User-Agent": "Oracle-Test-UA-IPv6",
      },
    });
    const samePrefixRes = await worker.fetch(samePrefixReq, env, {} as ExecutionContext);
    expect(samePrefixRes.status).toBe(200);

    const differentPrefixReq = new Request("https://example.com/stats", {
      method: "GET",
      headers: {
        Cookie: setCookie,
        "CF-Connecting-IP": "2001:db8:1::1",
        "User-Agent": "Oracle-Test-UA-IPv6",
      },
    });
    const differentPrefixRes = await worker.fetch(differentPrefixReq, env, {} as ExecutionContext);
    expect(differentPrefixRes.status).toBe(401);
  });
});
