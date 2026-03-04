import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

type Prepared = {
  bind: (...args: unknown[]) => Prepared;
  all: () => Promise<{ success: boolean; results: Record<string, unknown>[] }>;
};

function makeEnv(overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async () =>
      new Response(JSON.stringify({ ok: true, telemetry: {}, website: {}, publicSnapshot: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  };
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => stub,
  };

  const d1 = {
    prepare(query: string): Prepared {
      return {
        bind: () => this.prepare(query),
        all: async () => {
          if (/sqlite_master/i.test(query)) {
            return {
              success: true,
              results: [
                { name: "site_snapshot_cache" },
                { name: "site_event_stage" },
              ],
            };
          }
          if (/site_snapshot_cache/i.test(query)) {
            return {
              success: true,
              results: [{ snapshot_id: "snap-1", generated_at_utc: 1771700000000 }],
            };
          }
          return { success: true, results: [] };
        },
      };
    },
  };

  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: "do-shared-secret",
    DASHBOARD_PASSWORD: "dashboard-secret",
    DANGER_PASSWORD: "danger-secret",
    ORACLE_ENDPOINT: "https://oracle.example.com/ingest-batch",
    MAX_BATCH_EVENTS: "10000",
    SITE_CACHE_DB: d1,
    ...overrides,
  };
}

describe("D1 console query guard", () => {
  it("rejects mutating SQL keywords", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://example.com/admin/website/console/d1/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-Admin-Secret": "do-shared-secret",
        },
        body: JSON.stringify({ query: "UPDATE site_snapshot_cache SET generated_at_utc = 1" }),
      }),
      env,
      {} as ExecutionContext,
    );

    const body = await res.json() as { code?: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe("query_read_only_required");
  });

  it("rejects wildcard queries for non-system tables", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://example.com/admin/website/console/d1/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-Admin-Secret": "do-shared-secret",
        },
        body: JSON.stringify({ query: "SELECT * FROM site_snapshot_cache" }),
      }),
      env,
      {} as ExecutionContext,
    );

    const body = await res.json() as { code?: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe("query_wildcard_blocked");
  });

  it("allows read-only explicit-column query and auto-adds limit", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://example.com/admin/website/console/d1/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-Admin-Secret": "do-shared-secret",
        },
        body: JSON.stringify({ query: "SELECT snapshot_id, generated_at_utc FROM site_snapshot_cache", maxRows: 50 }),
      }),
      env,
      {} as ExecutionContext,
    );

    const body = await res.json() as { ok?: boolean; rowCount?: number; query?: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rowCount).toBe(1);
    expect(body.query).toContain("LIMIT 50");
  });
});
