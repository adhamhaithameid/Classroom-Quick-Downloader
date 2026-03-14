import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

function mockEnv(overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async (input: RequestInfo) => {
      // Return rate-limit-compatible response for login-attempt checks
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/auth/check-ip-allowlist")) {
        return new Response(JSON.stringify({ allowed: true, enabled: true, stepUpBypassEnabled: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
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
    CORS_ALLOWED_ORIGINS: "https://classroom-quick-downloader-website.pages.dev,https://stats.example.com",
    ...overrides,
  };
}

function extractCookie(setCookie: string | null): string {
  if (!setCookie) return "";
  const idx = setCookie.indexOf(";");
  return idx === -1 ? setCookie : setCookie.slice(0, idx);
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

  it("rejects non-allowlisted login when normal dashboard password is used", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: false, enabled: true, stepUpBypassEnabled: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
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
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=dashboard-secret",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const text = await res.text();
    expect(res.status).toBe(401);
    expect(text).toContain("admin danger password");
  });

  it("denies non-allowlisted login when step-up bypass is disabled", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: false, enabled: true, stepUpBypassEnabled: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, allowed: true }), {
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
      body: "password=danger-secret",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const text = await res.text();
    expect(res.status).toBe(403);
    expect(text).toContain("not allowlisted");
  });

  it("allows non-allowlisted login with admin danger password in the single field", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: false, enabled: true, stepUpBypassEnabled: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
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
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=danger-secret",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(302);
    expect(res.headers.get("Set-Cookie")).toContain("cqd_session=");
  });

  it("rejects non-allowlisted login with invalid admin danger password", async () => {
    const stub = {
      fetch: async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        if (url.includes("/auth/check-ip-allowlist")) {
          return new Response(JSON.stringify({ allowed: false, enabled: true, stepUpBypassEnabled: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
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
    const env = mockEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });
    const request = new Request("https://example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=wrong-step-up",
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const text = await res.text();
    expect(res.status).toBe(401);
    expect(text).toContain("admin danger password");
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

  it("returns structured CORS error envelope for website events route", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/api/public/website/events", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: "1",
        sessionId: "session-123",
        pagePath: "/overview",
        events: [
          {
            eventId: "evt-200001",
            eventType: "cta",
            action: "install_click",
            placement: "hero_install",
          },
        ],
      }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const body = await res.json() as {
      ok?: boolean;
      schemaVersion?: string;
      error?: {
        code?: string;
        retryable?: boolean;
      };
    };

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.schemaVersion).toBe("1");
    expect(body.error?.code).toBe("cors_origin_not_allowed");
    expect(body.error?.retryable).toBe(false);
  });

  it("requires Origin header for website events route", async () => {
    const env = mockEnv({
      CORS_ALLOWED_ORIGINS: "https://website.example",
    });
    const request = new Request("https://example.com/api/public/website/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: "1",
        sessionId: "session-123",
        pagePath: "/overview",
        events: [
          {
            eventId: "evt-200002",
            eventType: "cta",
            action: "install_click",
            placement: "hero_install",
          },
        ],
      }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const body = await res.json() as {
      ok?: boolean;
      schemaVersion?: string;
      error?: {
        code?: string;
        retryable?: boolean;
      };
    };

    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(body.ok).toBe(false);
    expect(body.schemaVersion).toBe("1");
    expect(body.error?.code).toBe("origin_required");
    expect(body.error?.retryable).toBe(false);
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

  it("rejects session-auth mutating admin requests without CSRF header", async () => {
    const env = mockEnv();
    const loginRes = await worker.fetch(new Request("https://example.com/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "password=dashboard-secret",
    }), env, {} as ExecutionContext);
    expect(loginRes.status).toBe(302);
    const cookie = extractCookie(loginRes.headers.get("Set-Cookie"));
    expect(cookie).toContain("cqd_session=");

    const adminRes = await worker.fetch(new Request("https://example.com/admin/force-flush", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://example.com",
      },
    }), env, {} as ExecutionContext);
    const body = await adminRes.json() as { error?: string; code?: string };
    expect(adminRes.status).toBe(403);
    expect(body.error).toBe("csrf_validation_failed");
    expect(body.code).toBe("csrf_missing_x_requested_with");
  });

  it("accepts session-auth mutating admin requests with CSRF header and same-origin", async () => {
    const env = mockEnv();
    const loginRes = await worker.fetch(new Request("https://example.com/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "password=dashboard-secret",
    }), env, {} as ExecutionContext);
    expect(loginRes.status).toBe(302);
    const cookie = extractCookie(loginRes.headers.get("Set-Cookie"));

    const adminRes = await worker.fetch(new Request("https://example.com/admin/force-flush", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://example.com",
        "X-Requested-With": "XMLHttpRequest",
      },
    }), env, {} as ExecutionContext);
    expect(adminRes.status).toBe(200);
  });

  it("enforces Cloudflare Access identity for dashboard routes when enabled", async () => {
    const env = mockEnv({ CLOUDFLARE_ACCESS_REQUIRED: "true" });
    const denied = await worker.fetch(
      new Request("https://example.com/", { method: "GET" }),
      env,
      {} as ExecutionContext,
    );
    expect(denied.status).toBe(403);

    const allowed = await worker.fetch(
      new Request("https://example.com/", {
        method: "GET",
        headers: { "CF-Access-Authenticated-User-Email": "admin@example.com" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(allowed.status).toBe(200);
  });

  it("enforces Cloudflare Access email allowlist when configured", async () => {
    const env = mockEnv({
      CLOUDFLARE_ACCESS_REQUIRED: "true",
      CLOUDFLARE_ACCESS_EMAIL_ALLOWLIST: "owner@example.com,admin@example.com",
    });
    const denied = await worker.fetch(
      new Request("https://example.com/", {
        method: "GET",
        headers: { "CF-Access-Authenticated-User-Email": "random@example.com" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(denied.status).toBe(403);

    const allowed = await worker.fetch(
      new Request("https://example.com/", {
        method: "GET",
        headers: { "CF-Access-Authenticated-User-Email": "owner@example.com" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(allowed.status).toBe(200);
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

  it("proxies /public/site-metrics to Durable Object public metrics endpoint", async () => {
    const env = mockEnv();
    const request = new Request("https://example.com/public/site-metrics", {
      method: "GET",
      headers: {
        Origin: "https://evil.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    const payload = await res.json() as { ok?: boolean };
    expect(payload.ok).toBe(true);
  });

  it("proxies Oracle public website overview through the Worker with wildcard CORS", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://oracle.local/api/public/website/overview") {
        return new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1771700000000,
            totals: { downloads: 42, success: 40, fail: 2 },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=120",
            },
          },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const env = mockEnv({ ORACLE_ENDPOINT: "https://oracle.local" });
    const request = new Request("https://example.com/api/public/website/overview", {
      method: "GET",
      headers: { Origin: "https://any-origin.example" },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; totals?: { downloads?: number } };

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("max-age=120");
    expect(payload.ok).toBe(true);
    expect(payload.totals?.downloads).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("proxies uninstall feedback POST with x-requested-with header", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://oracle.local/api/public/website/uninstall") {
        const headers = new Headers(init?.headers as HeadersInit);
        expect(headers.get("content-type")).toContain("application/json");
        expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
        expect(headers.get("origin")).toBe("https://website.example");
        return new Response(
          JSON.stringify({ ok: true, generatedAt: 1771700000000, submissionId: 5, message: "recorded" }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const env = mockEnv({ ORACLE_ENDPOINT: "https://oracle.local" });
    const request = new Request("https://example.com/api/public/website/uninstall", {
      method: "POST",
      headers: {
        Origin: "https://website.example",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({ reason: "test" }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; submissionId?: number };
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(payload.ok).toBe(true);
    expect(payload.submissionId).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const preflight = await worker.fetch(
      new Request("https://example.com/api/public/website/uninstall", {
        method: "OPTIONS",
        headers: {
          Origin: "https://website.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, X-Requested-With",
        },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("X-Requested-With");

    vi.unstubAllGlobals();
  });

  it("keeps newsletter subscribe route disabled while preserving rollback code", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "should_not_call_upstream" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const env = mockEnv({ ORACLE_ENDPOINT: "https://oracle.local" });
    const request = new Request("https://example.com/api/public/website/newsletter/subscribe", {
      method: "POST",
      headers: {
        Origin: "https://website.example",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({ email: "student@example.com", source: "overview_ready_to_save_hours" }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  /* NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  it("proxies newsletter subscribe POST to Oracle public website route", async () => {
    // rollback implementation retained here for one-step restore
  });
  NEWSLETTER_CTA_DISABLED_ROLLBACK_END */

  it("routes website events POST through the DO gateway", async () => {
    const doFetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input as Request;
      if (new URL(req.url).pathname === "/api/public/website/events") {
        expect(req.method).toBe("POST");
        expect(req.headers.get("content-type")).toContain("application/json");
        expect(req.headers.get("origin")).toBe("https://website.example");
        const payload = await req.json() as { events?: unknown[] };
        expect(Array.isArray(payload.events)).toBe(true);
        return new Response(
          JSON.stringify({ ok: true, generatedAt: 1771700000000, acceptedCount: 2, rejectedCount: 0 }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetchMock }),
    };
    const env = mockEnv({
      ORACLE_ENDPOINT: "https://oracle.local",
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
      CORS_ALLOWED_ORIGINS: "https://website.example",
    });
    const request = new Request("https://example.com/api/public/website/events", {
      method: "POST",
      headers: {
        Origin: "https://website.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: "1",
        sessionId: "session-1",
        pagePath: "/overview",
        events: [
          { eventId: "evt-1", eventType: "cta", action: "install_click", placement: "hero_install" },
          { eventId: "evt-2", eventType: "map", action: "map_yes", placement: "map_prompt_yes" },
        ],
      }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; acceptedCount?: number };
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://website.example");
    expect(payload.ok).toBe(true);
    expect(payload.acceptedCount).toBe(2);
    expect(doFetchMock).toHaveBeenCalledTimes(1);

    const methodRejected = await worker.fetch(
      new Request("https://example.com/api/public/website/events", {
        method: "GET",
      }),
      env,
      {} as ExecutionContext,
    );
    expect(methodRejected.status).toBe(405);

  });

  it("routes /admin/website/replay-dlq through protected admin proxy", async () => {
    const doFetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input as Request;
      expect(new URL(req.url).pathname).toBe("/admin/website/replay-dlq");
      expect(req.method).toBe("POST");
      expect(req.headers.get("x-admin-secret")).toBe("do-shared-secret");
      expect(req.headers.get("content-type")).toContain("application/json");
      const payload = await req.json() as { limit?: number };
      expect(payload.limit).toBe(3);
      return new Response(JSON.stringify({ ok: true, replayed: 3, pendingBatches: 5, deadLetterBatches: 0 }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetchMock }),
    };
    const env = mockEnv({
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    });
    const request = new Request("https://example.com/admin/website/replay-dlq", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Admin-Secret": "do-shared-secret",
      },
      body: JSON.stringify({ limit: 3 }),
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; replayed?: number };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.replayed).toBe(3);
    expect(doFetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes cached public website snapshot via /admin/website/snapshot/refresh", async () => {
    let kvValue: string | null = null;
    const kv = {
      get: vi.fn(async () => kvValue),
      put: vi.fn(async (_key: string, value: string) => {
        kvValue = value;
      }),
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://oracle.local/api/public/website/snapshot") {
        return new Response(
          JSON.stringify({
            ok: true,
            generatedAtUtc: 1771700000000,
            changelog: {
              entries: [{ version: "1.5.0" }],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const env = mockEnv({
      ORACLE_ENDPOINT: "https://oracle.local",
      SITE_SNAPSHOT_KV: kv as unknown as KVNamespace,
    });
    const request = new Request("https://example.com/admin/website/snapshot/refresh", {
      method: "POST",
      headers: {
        "X-Admin-Secret": "do-shared-secret",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; refreshed?: boolean; latestVersion?: string | null };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.refreshed).toBe(true);
    expect(payload.latestVersion).toBe("1.5.0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
    expect(kvValue).not.toBeNull();

    vi.unstubAllGlobals();
  });

  it("requires auth for /admin/website/snapshot/refresh", async () => {
    const env = mockEnv();
    const res = await worker.fetch(
      new Request("https://example.com/admin/website/snapshot/refresh", {
        method: "POST",
      }),
      env,
      {} as ExecutionContext,
    );
    const payload = await res.json() as { ok?: boolean; error?: string };
    expect(res.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("unauthorized");
  });

  it("redirects /dashboard/website to login when session is missing", async () => {
    const env = mockEnv();
    const res = await worker.fetch(
      new Request("https://example.com/dashboard/website", { method: "GET" }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("serves /dashboard/website after normal dashboard login", async () => {
    const env = mockEnv();
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
    const cookie = loginRes.headers.get("Set-Cookie") || "";
    expect(cookie).toContain("cqd_session=");

    const dashboardRes = await worker.fetch(
      new Request("https://example.com/dashboard/website", {
        method: "GET",
        headers: {
          Cookie: cookie,
          "CF-Connecting-IP": "203.0.113.10",
        },
      }),
      env,
      {} as ExecutionContext,
    );
    const html = await dashboardRes.text();
    expect(dashboardRes.status).toBe(200);
    expect(html).toContain("Website Data Console");
    expect(html).toContain("/admin/website/console/summary");
  });

  it("serves /admin/website/console/summary with X-Admin-Secret", async () => {
    const doFetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input as Request;
      if (new URL(req.url).pathname === "/admin/website/status") {
        return new Response(
          JSON.stringify({
            ok: true,
            website: { refreshEnabled: true },
            telemetry: { pendingBatches: 2, deadLetterBatches: 1 },
            publicSnapshot: { totals: { downloads: 42, countries: 3 } },
          }),
          { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const namespace = {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetchMock }),
    };
    const env = mockEnv({
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
      SITE_SNAPSHOT_KV: {
        get: async () => JSON.stringify({
          snapshotId: "snap-1",
          generatedAtUtc: 1771700000000,
          totals: { downloads: 21, countries: 2 },
        }),
        put: async () => undefined,
      },
    });

    const res = await worker.fetch(
      new Request("https://example.com/admin/website/console/summary", {
        method: "GET",
        headers: {
          "X-Admin-Secret": "do-shared-secret",
        },
      }),
      env,
      {} as ExecutionContext,
    );

    const body = await res.json() as {
      ok?: boolean;
      snapshot?: { totals?: { downloads?: number } };
      telemetry?: { pendingBatches?: number };
    };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.snapshot?.totals?.downloads).toBe(21);
    expect(body.telemetry?.pendingBatches).toBe(2);
    expect(doFetchMock).toHaveBeenCalled();
  });

  it("requires danger step-up cookie for raw website console endpoints", async () => {
    const env = mockEnv({
      SITE_SNAPSHOT_KV: {
        get: async () => JSON.stringify({ ok: true }),
        put: async () => undefined,
      },
    });

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
    const cookie = loginRes.headers.get("Set-Cookie") || "";
    expect(cookie).toContain("cqd_session=");

    const rawRes = await worker.fetch(
      new Request("https://example.com/admin/website/console/kv", {
        method: "GET",
        headers: {
          Cookie: cookie,
          "CF-Connecting-IP": "203.0.113.10",
        },
      }),
      env,
      {} as ExecutionContext,
    );
    const payload = await rawRes.json() as { code?: string; message?: string };
    expect(rawRes.status).toBe(403);
    expect(payload.code).toBe("step_up_required");
    expect(payload.message).toContain("Danger step-up");
  });

  it("returns 503 for proxied Oracle public routes when ORACLE_ENDPOINT is missing", async () => {
    const env = mockEnv({ ORACLE_ENDPOINT: "" });
    const request = new Request("https://example.com/api/public/website/changelog", {
      method: "GET",
      headers: {
        Origin: "https://website.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; error?: string };

    expect(res.status).toBe(503);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("oracle_endpoint_missing");
  });

  it("rejects insecure non-loopback ORACLE_ENDPOINT without explicit override", async () => {
    const env = mockEnv({ ORACLE_ENDPOINT: "http://oracle.local" });
    const request = new Request("https://example.com/api/public/website/overview", {
      method: "GET",
      headers: {
        Origin: "https://website.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; error?: string };

    expect(res.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("oracle_endpoint_insecure");
  });

  it("allows insecure non-loopback ORACLE_ENDPOINT only when explicit override is enabled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "http://oracle.local:8080/api/public/website/overview") {
        return new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1771700000000,
            totals: { downloads: 11, success: 10, fail: 1 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const env = mockEnv({
      ORACLE_ENDPOINT: "http://oracle.local:8080",
      ALLOW_INSECURE_ORACLE_ENDPOINT: "true",
    });
    const request = new Request("https://example.com/api/public/website/overview", {
      method: "GET",
      headers: {
        Origin: "https://website.example",
      },
    });

    const res = await worker.fetch(request, env, {} as ExecutionContext);
    const payload = await res.json() as { ok?: boolean; totals?: { downloads?: number } };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.totals?.downloads).toBe(11);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
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
    expect(res.headers.get("Set-Cookie")).toContain("cqd_danger_stepup=");
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
    expect(dangerRes.headers.get("Set-Cookie")).toContain("cqd_danger_stepup=");
  });

  it("records optional session-binding mismatches without blocking the session", async () => {
    const doFetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/auth/check-ip-allowlist")) {
        return new Response(JSON.stringify({ allowed: true, enabled: true, stepUpBypassEnabled: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/auth/login-attempt")) {
        return new Response(JSON.stringify({ ok: true, allowed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/auth/session-binding-mismatch")) {
        return new Response(JSON.stringify({ ok: true, count: 1 }), {
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
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => ({ fetch: doFetch }),
    };
    const env = mockEnv({
      DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
      SESSION_BINDING_MODE: "optional",
    });

    const loginRes = await worker.fetch(
      new Request("https://example.com/", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "CF-Connecting-IP": "41.33.62.123",
          "User-Agent": "CQD Test Agent A",
        },
        body: "password=dashboard-secret",
      }),
      env,
      {} as ExecutionContext,
    );
    expect(loginRes.status).toBe(302);
    const cookie = extractCookie(loginRes.headers.get("Set-Cookie"));
    expect(cookie).toContain("cqd_session=");

    const revisitRes = await worker.fetch(
      new Request("https://example.com/", {
        method: "GET",
        headers: {
          Cookie: cookie,
          "CF-Connecting-IP": "41.33.62.123",
          "User-Agent": "CQD Test Agent B",
        },
      }),
      env,
      {} as ExecutionContext,
    );

    expect(revisitRes.status).toBe(302);
    expect(revisitRes.headers.get("Location")).toBe("https://example.com/dashboard");
    const mismatchCall = doFetch.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      return url.includes("/auth/session-binding-mismatch");
    });
    expect(mismatchCall).toBeDefined();
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
