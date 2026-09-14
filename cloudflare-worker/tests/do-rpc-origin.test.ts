import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env as WorkerEnv } from "../src/types";
import { TEST_DO_SHARED_SECRET } from "./helpers/dummy-secrets";

/**
 * DO-RPC origin pinning: every Worker->DO stub fetch must target the fixed
 * internal placeholder origin ("https://do"), never an origin derived from
 * the incoming request. A client-controlled Host/scheme must not be able to
 * point DO remote procedure calls at another destination.
 */
function makeEnv(doFetch: (input: RequestInfo | URL) => Promise<Response>): WorkerEnv {
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => ({ fetch: doFetch }),
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: TEST_DO_SHARED_SECRET,
    DANGER_PASSWORD: TEST_DO_SHARED_SECRET,
    ORACLE_ENDPOINT: "https://oracle.example.com/ingest-batch",
    MAX_BATCH_EVENTS: "10000",
    CORS_ALLOWED_ORIGINS: "https://classroom-quick-downloader-website.pages.dev",
  };
}

async function collectDoUrls(env: WorkerEnv): Promise<string[]> {
  const urls: string[] = [];
  env.DOWNLOADS_DO = {
    idFromName: () => "downloads-id",
    get: () => ({
      fetch: async (input: RequestInfo | URL) => {
        urls.push(typeof input === "string" ? input : input instanceof Request ? input.url : String(input));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    }),
  } as unknown as DurableObjectNamespace;
  return urls;
}

describe("DO-RPC origin pinning", () => {
  it("public /track forwards into the DO on the fixed internal origin", async () => {
    const env = makeEnv(async () =>
      new Response(JSON.stringify({ ok: true, accepted: 0 }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const urls = await collectDoUrls(env);

    const res = await worker.fetch(
      new Request("https://attacker-controlled.example.com/track", {
        method: "POST",
        headers: { Origin: "https://attacker-controlled.example.com" },
        body: JSON.stringify({ events: [] }),
      }),
      env,
      {} as ExecutionContext,
    );

    expect(res.ok).toBe(true);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).origin).toBe("https://do");
    }
  });

  it("admin passthrough forwards into the DO on the fixed internal origin", async () => {
    const env = makeEnv(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const urls = await collectDoUrls(env);

    const res = await worker.fetch(
      new Request("https://attacker-controlled.example.com/admin/ip-allowlist", {
        method: "GET",
        headers: { "X-Admin-Secret": TEST_DO_SHARED_SECRET },
      }),
      env,
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).origin).toBe("https://do");
    }
  });

  it("website events proxy forwards into the DO on the fixed internal origin", async () => {
    const env = makeEnv(async () =>
      new Response(JSON.stringify({ ok: true, accepted: 0 }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const urls = await collectDoUrls(env);

    const res = await worker.fetch(
      new Request("https://attacker-controlled.example.com/api/site/v1/events", {
        method: "POST",
        headers: { Origin: "https://classroom-quick-downloader-website.pages.dev" },
        body: JSON.stringify({ events: [], sessionId: "s", pagePath: "/" }),
      }),
      env,
      {} as ExecutionContext,
    );

    expect(res.ok).toBe(true);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).origin).toBe("https://do");
    }
  });
});
