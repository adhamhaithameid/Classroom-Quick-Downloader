// filepath: cloudflare-worker/src/index.ts
import { renderDashboard, renderLoginPage } from "./dashboard";
import type { Env as WorkerEnv, StatsResponse } from "./types";

// ---------------------------------------------------------------------------
// Helper: get DO stub
// ---------------------------------------------------------------------------

function getDownloadsStub(env: WorkerEnv): DurableObjectStub {
  const id = env.DOWNLOADS_DO.idFromName("downloads");
  return env.DOWNLOADS_DO.get(id);
}

// ---------------------------------------------------------------------------
// Dashboard (GET / shows login every time, POST / validates password & renders)
// ---------------------------------------------------------------------------

async function handleRoot(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const method = request.method.toUpperCase();

  // Always show login page on GET /
  if (method === "GET") {
    return new Response(renderLoginPage(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("multipart/form-data")
    ) {
      return new Response("Unsupported content type", { status: 400 });
    }

    const form = await request.formData();
    const password = (form.get("password") || "").toString();

    if (!env.DO_SHARED_SECRET) {
      return new Response(
        renderLoginPage("Server misconfigured: DO_SHARED_SECRET missing."),
        {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    }

    if (password !== env.DO_SHARED_SECRET) {
      return new Response(renderLoginPage("Invalid password."), {
        status: 401,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Correct password for this request: fetch stats and render dashboard.
    const stub = getDownloadsStub(env);
    const url = new URL(request.url);
    url.pathname = "/stats";

    const statsRes = await stub.fetch(url.toString(), {
      method: "GET",
    });
    if (!statsRes.ok) {
      const text = await statsRes.text().catch(() => "");
      return new Response(
        `Failed to load stats from Durable Object.\n\n${statsRes.status} ${statsRes.statusText}\n${text}`,
        { status: 500 },
      );
    }

    const stats = (await statsRes.json()) as StatsResponse;
    const html = renderDashboard(stats);

    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}

// ---------------------------------------------------------------------------
// Generic proxy to DO
// ---------------------------------------------------------------------------

async function proxyToDO(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const stub = getDownloadsStub(env);
  return stub.fetch(request);
}

// ---------------------------------------------------------------------------
// Worker fetch
// ---------------------------------------------------------------------------

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Root (dashboard + login)
    if (pathname === "/") {
      return handleRoot(request, env);
    }

    // Public JSON endpoints
    if (pathname === "/stats" && request.method === "GET") {
      return proxyToDO(request, env);
    }

    if (pathname === "/config" && request.method === "GET") {
      return proxyToDO(request, env);
    }

    if (pathname === "/health" && request.method === "GET") {
      return proxyToDO(request, env);
    }

    if (pathname === "/track" && request.method === "POST") {
      return proxyToDO(request, env);
    }

    if (pathname === "/debug/flush" && request.method === "POST") {
      return proxyToDO(request, env);
    }

    if (pathname === "/debug/reset" && request.method === "POST") {
      return proxyToDO(request, env);
    }

    // Admin routes (Danger Zone) – just forward; DO will check X-Admin-Secret.
    if (
      pathname === "/admin/force-flush" ||
      pathname === "/admin/cut-power" ||
      pathname === "/admin/restore-power" ||
      pathname === "/admin/full-sync"
    ) {
      return proxyToDO(request, env);
    }

    return new Response("Not found (worker)", { status: 404 });
  },
};

/**
 * IMPORTANT: export the Durable Object class from the entrypoint
 * so Wrangler can wire the binding.
 */
export { DownloadsDurable } from "./downloads_do";