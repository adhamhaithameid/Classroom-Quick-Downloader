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

describe('cloudflare worker reliability behavior', () => {
  it('returns structured upstream_unavailable when DO gateway fails', async () => {
    const doFailure = vi.fn(async () => {
      throw new Error('do down');
    });
    const response = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/events', {
        method: 'POST',
        headers: {
          Origin: 'https://classroom-quick-downloader-website.pages.dev',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          schemaVersion: '1',
          sessionId: 'session-a',
          pagePath: '/overview',
          events: [
            { eventId: 'evt-a', eventType: 'cta', action: 'install_click', placement: 'hero_install' }
          ]
        })
      }),
      env({}, doFailure),
      {} as ExecutionContext
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://classroom-quick-downloader-website.pages.dev');
    const payload = await response.json() as { ok?: boolean; error?: { code?: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('upstream_unavailable');
  });

  it('fails safely when ORACLE_ENDPOINT is missing or insecure', async () => {
    const missingResponse = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview'),
      env({ ORACLE_ENDPOINT: '' }),
      {} as ExecutionContext
    );
    expect(missingResponse.status).toBe(503);
    expect((await missingResponse.json() as { error?: string }).error).toBe('oracle_endpoint_missing');

    const insecureResponse = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview'),
      env({ ORACLE_ENDPOINT: 'http://oracle.example.com/ingest-batch' }),
      {} as ExecutionContext
    );
    expect(insecureResponse.status).toBe(503);
    expect((await insecureResponse.json() as { error?: string }).error).toBe('oracle_endpoint_insecure');
  });
});
