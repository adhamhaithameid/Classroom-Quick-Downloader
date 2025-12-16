// filepath: cloudflare-worker/src/index.ts
import { renderDashboard, renderLoginPage } from "./dashboard";
import type { Env as WorkerEnv, StatsResponse } from "./types";

function getDownloadsStub(env: WorkerEnv): DurableObjectStub {
  const id = env.DOWNLOADS_DO.idFromName("downloads");
  return env.DOWNLOADS_DO.get(id);
}

// --- CORS helpers -----------------------------------------------------------

function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin") || "*";

  // If you want to lock it down later, replace "*" with a whitelist check.
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Secret",
  );
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function withCors(request: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const ch = corsHeaders(request);
  ch.forEach((v, k) => headers.set(k, v));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// ---------------------------------------------------------------------------
// Dashboard (GET / shows login every time, POST / validates password & renders)
// ---------------------------------------------------------------------------

async function handleRoot(request: Request, env: WorkerEnv): Promise<Response> {
  const method = request.method.toUpperCase();

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
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    if (password !== env.DO_SHARED_SECRET) {
      return new Response(renderLoginPage("Invalid password."), {
        status: 401,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const stub = getDownloadsStub(env);
    const url = new URL(request.url);
    url.pathname = "/stats";

    const statsRes = await stub.fetch(url.toString(), { method: "GET" });
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

async function proxyToDO(request: Request, env: WorkerEnv): Promise<Response> {
  const stub = getDownloadsStub(env);
  const res = await stub.fetch(request);
  return withCors(request, res);
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Preflight for all routes
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (pathname === "/") {
      return handleRoot(request, env);
    }

    if (
      (pathname === "/stats" && request.method === "GET") ||
      (pathname === "/config" && request.method === "GET") ||
      (pathname === "/health" && request.method === "GET") ||
      (pathname === "/track" && request.method === "POST") ||
      (pathname === "/debug/flush" && request.method === "POST") ||
      (pathname === "/debug/reset" && request.method === "POST") ||
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

export { DownloadsDurable } from "./downloads_do";