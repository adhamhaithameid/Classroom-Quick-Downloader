
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { Env } from "../src/types";

// Mock environment
const env: Env = {
  ORACLE_ENDPOINT: "http://example.com",
  DO_SHARED_SECRET: "secret",
  MAX_BATCH_EVENTS: "10000",
  DASHBOARD_PASSWORD: "dash-secret",
  DOWNLOADS_DO: {
    idFromName: () => ({ name: "test" }),
    get: () => ({
      fetch: async () => new Response(JSON.stringify({ ok: true })),
    }),
  } as any,
};

// Mock ExecutionContext
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as any;

describe("Security Headers", () => {
  it("should have security headers on root login page", async () => {
    const req = new Request("http://localhost/");
    const res = await worker.fetch(req, env, ctx);

    // These should FAIL initially
    expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("should have security headers on dashboard page", async () => {
    // Note: This requires a valid session or mock, but for headers check
    // we can simulate the redirect or response if auth fails,
    // BUT we want to check the actual dashboard response ideally.
    // For now, let's just check the redirect response or error response
    // as headers should apply generally to HTML responses.

    const req = new Request("http://localhost/dashboard");
    const res = await worker.fetch(req, env, ctx);

    // Even redirects should ideally have some headers, but definitely content responses
    if (res.headers.get("Content-Type")?.includes("text/html")) {
        expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    }
  });
});
