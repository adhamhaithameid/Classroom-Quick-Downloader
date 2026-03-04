import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

function buildEnv(): Env {
  const stub = {
    fetch: async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (url.includes("/auth/check-ip-allowlist")) {
        return new Response(JSON.stringify({ allowed: true, enabled: true, stepUpBypassEnabled: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({
            ok: true,
            stats: {},
            counters: {},
            config: {},
            timestamp: Date.now(),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/changelog")) {
        return new Response(JSON.stringify({ entries: [] }), {
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

  return {
    DOWNLOADS_DO: {
      idFromName: (_name: string) => "downloads-id",
      get: (_id: string) => stub,
    } as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: "do-shared-secret",
    DASHBOARD_PASSWORD: "dashboard-secret",
    DANGER_PASSWORD: "danger-secret",
    ORACLE_ENDPOINT: "https://oracle.example.com",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("referrer-policy")).toBeTruthy();
  expect(response.headers.get("permissions-policy")).toContain("camera=()");
}

describe("HTML security headers", () => {
  it("applies headers on root login page", async () => {
    const env = buildEnv();
    const res = await worker.fetch(new Request("https://example.com/"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it("applies headers on release notes page", async () => {
    const env = buildEnv();
    const res = await worker.fetch(new Request("https://example.com/release-notes"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });
});

