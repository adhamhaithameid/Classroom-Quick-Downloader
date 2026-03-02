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

describe('cloudflare worker load and stress handling', () => {
  it('handles burst traffic for website events without non-2xx failures', async () => {
    const doFetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, generatedAt: Date.now(), acceptedCount: 1, rejectedCount: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const requests = Array.from({ length: 180 }, (_, i) =>
      worker.fetch(
        new Request('https://worker.example.com/api/public/website/events', {
          method: 'POST',
          headers: {
            Origin: 'https://classroom-quick-downloader-website.pages.dev',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            schemaVersion: '1',
            sessionId: `session-${i}`,
            pagePath: '/overview',
            events: [
              {
                eventId: `evt-${i}`,
                eventType: 'cta',
                action: i % 2 === 0 ? 'install_click' : 'download_click',
                placement: i % 2 === 0 ? 'hero_install' : 'hero_download'
              }
            ]
          })
        }),
        env({}, doFetchMock),
        {} as ExecutionContext
      )
    );

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status).toBe(200);
      const body = await response.json() as { ok?: boolean };
      expect(body.ok).toBe(true);
    }

    expect(doFetchMock).toHaveBeenCalledTimes(180);
  });
});
