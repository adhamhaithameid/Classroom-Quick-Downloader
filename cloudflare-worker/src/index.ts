// src/index.ts
// Worker entrypoint that:
// - Exposes /track for the extension
// - Handles CORS (OPTIONS + POST)
// - Proxies to the Durable Object
// - Exposes /stats and /health for debugging

import type { Env } from './types';
import { DownloadsDurable } from './downloads_do';

// --- CORS helpers ---

function makeCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
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

    // CORS preflight for POST /track
    if (pathname === '/track' && request.method === 'OPTIONS') {
      return makeCorsPreflightResponse();
    }

    // Forward POST /track to Durable Object
    if (pathname === '/track' && request.method === 'POST') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);
      const res = await stub.fetch(request);
      return withCors(res);
    }

    // DO health (proxied)
    if (pathname === '/health' && request.method === 'GET') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);
      const res = await stub.fetch('https://do/health');
      return withCors(res);
    }

    // Aggregated stats (proxied)
    if (pathname === '/stats' && request.method === 'GET') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);
      const res = await stub.fetch('https://do/stats');
      return withCors(res);
    }

    return new Response('Not found', { status: 404 });
  },
};

// Important: export the DO class so Wrangler can bind it
export { DownloadsDurable };