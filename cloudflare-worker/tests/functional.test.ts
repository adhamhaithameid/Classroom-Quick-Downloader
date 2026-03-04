import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

function env(
  overrides: Partial<Env> = {},
  stubFetch?: (input: RequestInfo | URL) => Promise<Response>
): Env {
  const stub = {
    fetch:
      stubFetch ??
      (async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }))
  };
  const namespace = {
    idFromName: (_name: string) => 'downloads-id',
    get: (_id: string) => stub
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: 'shared-secret',
    DASHBOARD_PASSWORD: 'dashboard-secret',
    DANGER_PASSWORD: 'danger-secret',
    ORACLE_ENDPOINT: 'https://oracle.example.com/ingest-batch',
    MAX_BATCH_EVENTS: '10000',
    CORS_ALLOWED_ORIGINS: 'https://classroom-quick-downloader-website.pages.dev',
    ...overrides
  };
}

describe('cloudflare worker functional telemetry routes', () => {
  it('accepts POST /api/public/website/events and forwards body to DO gateway', async () => {
    const doFetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input as Request;
      expect(req.method).toBe('POST');
      expect(new URL(req.url).pathname).toBe('/api/public/website/events');
      expect(req.headers.get('x-requested-with')).toBe('XMLHttpRequest');
      expect(req.headers.get('origin')).toBe('https://classroom-quick-downloader-website.pages.dev');
      const body = await req.json() as { events?: unknown[] };
      expect(Array.isArray(body.events)).toBe(true);
      return new Response(
        JSON.stringify({ ok: true, generatedAt: 1, acceptedCount: 2, rejectedCount: 0 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    const request = new Request('https://worker.example.com/api/public/website/events', {
      method: 'POST',
      headers: {
        Origin: 'https://classroom-quick-downloader-website.pages.dev',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        schemaVersion: '1',
        sessionId: 'ws-session-1',
        pagePath: '/overview',
        events: [
          { eventId: 'evt-1', eventType: 'cta', action: 'install_click', placement: 'hero_install' },
          { eventId: 'evt-2', eventType: 'map', action: 'map_yes', placement: 'map_prompt_yes' }
        ]
      })
    });

    const response = await worker.fetch(request, env({}, doFetchMock), {} as ExecutionContext);
    expect(response.status).toBe(200);

    const payload = await response.json() as { ok?: boolean; acceptedCount?: number };
    expect(payload.ok).toBe(true);
    expect(payload.acceptedCount).toBe(2);
    expect(doFetchMock).toHaveBeenCalledTimes(1);
  });
});
