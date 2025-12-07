// filepath: cloudflare-worker/src/index.ts

import type { Env } from './types';
import { DownloadsDurable } from './downloads_do';

// IMPORTANT: export the Durable Object class so Wrangler can bind it.
export { DownloadsDurable };

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // POST /track → forward to DO
    if (request.method === 'POST' && url.pathname === '/track') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);
      // Forward original request (body, headers, etc.)
      return stub.fetch(request);
    }

    // GET /stats → ask the DO for aggregated counters
    if (request.method === 'GET' && url.pathname === '/stats') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);
      // We use a fake URL path '/stats' that's interpreted by the DO.
      return stub.fetch('https://do.internal/stats');
    }

    // GET /health → quick health check with DO summary embedded
    if (request.method === 'GET' && url.pathname === '/health') {
      const id = env.DOWNLOADS_DO.idFromName('DownloadsStats');
      const stub = env.DOWNLOADS_DO.get(id);

      let doHealth: unknown = null;
      try {
        const res = await stub.fetch('https://do.internal/health');
        if (res.ok) {
          doHealth = await res.json();
        } else {
          doHealth = {
            ok: false,
            error: `DO responded with status ${res.status}`,
          };
        }
      } catch (err) {
        doHealth = {
          ok: false,
          error: 'DO unreachable',
          detail: (err as Error).message,
        };
      }

      return new Response(
        JSON.stringify({
          ok: true,
          do: doHealth,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  },
};