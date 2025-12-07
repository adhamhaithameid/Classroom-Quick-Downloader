// src/index.ts
import type { Env } from './types';

// Simple CORS helper (helps if you test from web pages later)
function addCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return addCors(
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }),
      );
    }

    // POST /track → forward to Durable Object
    if (request.method === 'POST' && path === '/track') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);

      const doUrl = new URL(request.url);
      doUrl.pathname = '/track';
      const doReq = new Request(doUrl.toString(), request);

      const res = await stub.fetch(doReq);
      return addCors(res);
    }

    // GET /stats → query DO counters
    if (request.method === 'GET' && path === '/stats') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);

      const doUrl = new URL(request.url);
      doUrl.pathname = '/stats';
      const doReq = new Request(doUrl.toString(), { method: 'GET' });

      const res = await stub.fetch(doReq);
      return addCors(res);
    }

    // GET /health → proxy DO health
    if (request.method === 'GET' && path === '/health') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);

      const doUrl = new URL(request.url);
      doUrl.pathname = '/health';

      try {
        const res = await stub.fetch(
          new Request(doUrl.toString(), { method: 'GET' }),
        );
        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }

        const wrapped = new Response(
          JSON.stringify({
            ok: res.ok,
            do: data,
          }),
          {
            status: res.ok ? 200 : 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );

        return addCors(wrapped);
      } catch (err) {
        const wrapped = new Response(
          JSON.stringify({
            ok: false,
            error: 'DO health check failed',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
        return addCors(wrapped);
      }
    }

    return addCors(new Response('Not found', { status: 404 }));
  },
};