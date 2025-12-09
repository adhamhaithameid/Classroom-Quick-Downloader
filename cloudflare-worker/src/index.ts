// filepath: cloudflare-worker/src/index.ts
import type { Env } from "./types";
import { DownloadsDurable } from "./downloads_do";
import { DASHBOARD_HTML } from "./dashboard";

function makeCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Helper to get DO stub
    const getStub = () => {
      const id = env.DOWNLOADS_DO.idFromName("DownloadsStats");
      return env.DOWNLOADS_DO.get(id);
    };

    // -----------------------------------------------------------------------
    // HTML Dashboard at "/"
    // -----------------------------------------------------------------------
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(DASHBOARD_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // -----------------------------------------------------------------------
    // CORS preflight for POST endpoints
    // -----------------------------------------------------------------------
    if (
      (pathname === "/track" ||
        pathname === "/admin/force-flush" ||
        pathname === "/admin/cut-power" ||
        pathname === "/admin/full-sync") &&
      request.method === "OPTIONS"
    ) {
      return makeCorsPreflightResponse();
    }

    // Ingestion: Browser/extension calls POST /track
    if (pathname === "/track" && request.method === "POST") {
      const stub = getStub();
      const res = await stub.fetch(request);
      return withCors(res);
    }

    // Config for extension (read-only)
    if (pathname === "/config" && request.method === "GET") {
      const stub = getStub();
      const res = await stub.fetch("https://do/config");
      return withCors(res);
    }

    // Health (proxy to DO)
    if (pathname === "/health" && request.method === "GET") {
      const stub = getStub();
      const res = await stub.fetch("https://do/health");
      return withCors(res);
    }

    // Stats JSON (proxy to DO)
    if (pathname === "/stats" && request.method === "GET") {
      const stub = getStub();
      const res = await stub.fetch("https://do/stats");
      return withCors(res);
    }

    // -----------------------------------------------------------------------
    // DEBUG ENDPOINTS (dev only)
    // -----------------------------------------------------------------------
    if (pathname === "/debug/reset" && request.method === "POST") {
      const stub = getStub();
      const doReq = new Request("https://do/debug/reset", { method: "POST" });
      const res = await stub.fetch(doReq);
      return withCors(res);
    }

    if (pathname === "/debug/flush" && request.method === "POST") {
      const stub = getStub();
      const doReq = new Request("https://do/debug/flush", { method: "POST" });
      const res = await stub.fetch(doReq);
      return withCors(res);
    }

    // -----------------------------------------------------------------------
    // ADMIN ENDPOINTS (for dashboard Danger Area)
    // -----------------------------------------------------------------------
    if (pathname === "/admin/force-flush" && request.method === "POST") {
      const stub = getStub();
      const doReq = new Request("https://do/admin/force-flush", {
        method: "POST",
        headers: request.headers,
      });
      const res = await stub.fetch(doReq);
      return withCors(res);
    }

    if (pathname === "/admin/cut-power" && request.method === "POST") {
      const stub = getStub();
      const doReq = new Request("https://do/admin/cut-power", {
        method: "POST",
        headers: request.headers,
      });
      const res = await stub.fetch(doReq);
      return withCors(res);
    }

    if (pathname === "/admin/full-sync" && request.method === "POST") {
      const stub = getStub();
      const doReq = new Request("https://do/admin/full-sync", {
        method: "POST",
        headers: request.headers,
      });
      const res = await stub.fetch(doReq);
      return withCors(res);
    }

    return new Response("Not found", { status: 404 });
  },
};

export { DownloadsDurable };