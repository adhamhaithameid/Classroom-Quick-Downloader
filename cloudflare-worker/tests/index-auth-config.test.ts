import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

function mockEnv(overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async (input: RequestInfo) => {
      // Return rate-limit-compatible response for login-attempt checks
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/auth/login-attempt")) {
        return new Response(JSON.stringify({ ok: true, allowed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };

  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: "do-shared-secret",
    DANGER_PASSWORD: "danger-secret",
    ORACLE_ENDPOINT: "https://oracle.local/ingest-batch",
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

  it("returns 503 when login-attempt dependency is unavailable", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: true, enabled: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/auth/login-attempt")) {
          throw new Error("durable-object-down");
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    };
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=wrong-password",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("X-Dependency-Error")).toBe("durable-object-unavailable");
    expect(text).toContain("temporarily unavailable");
  });

  it("still logs in when clearing login-attempt state fails", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: true, enabled: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/auth/login-attempt")) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    };
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=dashboard-secret",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(302);
    expect(res.headers.get("Set-Cookie")).toContain("cqd_session=");
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

  it("serves public site metrics with wildcard CORS", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/public/site-metrics")) {
          return new Response(
            JSON.stringify({
              ok: true,
              source: "cloudflare-worker",
              generatedAt: 1771700000000,
              snapshotAtUtc: 1771699200000,
              totals: { downloads: 1200, countries: 2 },
              countries: [
                { countryCode: "US", count: 700 },
                { countryCode: "GB", count: 500 },
              ],
              schedule: {
                refreshHoursUtc: [3, 6, 9, 12, 15, 18, 21],
                activeHourUtc: 12,
                isRefreshWindow: true,
                lastRefreshAtUtc: 1771699200000,
                nextRefreshAtUtc: 1771702800000,
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    };
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/public/site-metrics", {
      method: "GET",
      headers: {
        Origin: "https://evil.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { totals?: { downloads?: number } };

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(payload.totals?.downloads).toBe(1200);
  });

  it("returns 502 when public site metrics upstream is unavailable", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/public/site-metrics")) {
          throw new Error("do-offline");
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    };
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/public/site-metrics", {
      method: "GET",
      headers: {
        Origin: "https://any.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; error?: string };
    expect(res.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("upstream_unavailable");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
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

  it("serves public release-notes HTML using changelog entries", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/changelog")) {
          return new Response(JSON.stringify({
            ok: true,
            entries: [
              {
                id: "entry-1",
                version: "1.3.6",
                date: "2026-02-20T00:00:00.000Z",
                changes: ['Escaped <script>alert("xss")</script> content'],
              },
            ],
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    };
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });

    const request = new Request("https://example.com/release-notes", {
      method: "GET",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Release Notes");
    expect(html).toContain("v1.3.6");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<script>alert("xss")</script>');
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

  // ---------------------------------------------------------------------------
  // /auth/verify-danger: Auth enforcement (Phase 2)
  // ---------------------------------------------------------------------------

  it("rejects unauthenticated /auth/verify-danger with 401", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/auth/verify-danger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "danger-secret" }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const body = await res.json() as { ok: boolean; error: string; message: string };

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
    expect(body.message).toContain("Valid session or X-Admin-Secret required");
  });

  it("allows /auth/verify-danger with valid X-Admin-Secret", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/auth/verify-danger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "do-shared-secret",
      },
      body: JSON.stringify({ password: "danger-secret" }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const body = await res.json() as { ok: boolean };

    // Should reach the password check, and since password is correct, return 200
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("allows /auth/verify-danger with valid session cookie", async () => {
    const env = mockEnv();

    // First login to get a session cookie
    const loginReq = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: "password=dashboard-secret",
    });
    const loginRes = await worker.fetch(loginReq, env, {} as ExecutionContext);
    expect(loginRes.status).toBe(302);
    const setCookie = loginRes.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("cqd_session=");

    // Use session to call verify-danger
    const dangerReq = new Request("https://example.com/auth/verify-danger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie,
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({ password: "danger-secret" }),
    });
    const dangerRes = await worker.fetch(dangerReq, env, {} as ExecutionContext);
    const body = await dangerRes.json() as { ok: boolean };

    expect(dangerRes.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // /auth/verify-danger: CORS (Phase 3)
  // ---------------------------------------------------------------------------

  it("includes X-Admin-Secret in allowed headers for /auth/verify-danger preflight", async () => {
    const env = mockEnv({
      CORS_ALLOWED_ORIGINS: "https://dashboard.example.com",
    });
    const request = new Request("https://example.com/auth/verify-danger", {
      method: "OPTIONS",
      headers: {
        Origin: "https://dashboard.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Admin-Secret",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://dashboard.example.com");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Admin-Secret");
  });

  it("rejects /auth/verify-danger preflight from disallowed origin", async () => {
    const env = mockEnv({
      CORS_ALLOWED_ORIGINS: "https://dashboard.example.com",
    });
    const request = new Request("https://example.com/auth/verify-danger", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Admin-Secret",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
