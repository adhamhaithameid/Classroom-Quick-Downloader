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
});

