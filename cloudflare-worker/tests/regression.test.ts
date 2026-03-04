import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

function env(overrides: Partial<Env> = {}): Env {
  const stub = {
    fetch: async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
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

describe('cloudflare worker regressions', () => {
  it('keeps method gating strict for website events endpoint', async () => {
    const getRes = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/events', {
        method: 'GET',
        headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
      }),
      env(),
      {} as ExecutionContext
    );
    expect(getRes.status).toBe(405);
    const getBody = await getRes.json() as { error?: { code?: string } };
    expect(getBody.error?.code).toBe('method_not_allowed');

    const optionsRes = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/events', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://classroom-quick-downloader-website.pages.dev',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, X-Requested-With'
        }
      }),
      env(),
      {} as ExecutionContext
    );

    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get('Access-Control-Allow-Origin')).toBe('https://classroom-quick-downloader-website.pages.dev');
    expect(optionsRes.headers.get('Access-Control-Allow-Headers')).toContain('X-Requested-With');
  });
});
