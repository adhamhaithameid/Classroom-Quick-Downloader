import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

const TEST_TIMEOUT_MS = 20_000;

function createEnv(overrides: Partial<Env> = {}): Env {
  const doStub = {
    fetch: async (_input: RequestInfo) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
  const namespace = {
    idFromName: (_name: string) => 'downloads-id',
    get: (_id: string) => doStub
  };

  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    DO_SHARED_SECRET: 'shared-secret',
    DANGER_PASSWORD: 'danger-secret',
    ORACLE_ENDPOINT: 'https://oracle.example.com/ingest-batch',
    MAX_BATCH_EVENTS: '10000',
    DASHBOARD_PASSWORD: 'dashboard-secret',
    CORS_ALLOWED_ORIGINS: 'https://classroom-quick-downloader-website.pages.dev',
    ...overrides
  };
}

describe('cloudflare worker smoke tests', () => {
  it(
    'returns healthy payload for /health and does not expose /public/site-metrics',
    async () => {
    const env = createEnv();

    const healthRes = await worker.fetch(new Request('https://worker.example.com/health'), env, {} as ExecutionContext);
    expect(healthRes.status).toBe(200);
    const healthBody = await healthRes.json() as { ok?: boolean };
    expect(healthBody.ok).toBe(true);

    const metricsRes = await worker.fetch(new Request('https://worker.example.com/public/site-metrics'), env, {} as ExecutionContext);
    expect(metricsRes.status).toBe(404);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'proxies public website overview route to Oracle endpoint',
    async () => {
    const env = createEnv();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        expect(url).toContain('/api/public/website/overview');
        return new Response(JSON.stringify({ ok: true, generatedAt: 1, totals: { downloads: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      })
    );

    const res = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview', {
        headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
      }),
      env,
      {} as ExecutionContext
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok?: boolean };
    expect(body.ok).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'proxies public website snapshot route to Oracle endpoint',
    async () => {
    const env = createEnv();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        expect(url).toContain('/api/public/website/snapshot');
        return new Response(
          JSON.stringify({
            schemaVersion: '1',
            ok: true,
            generatedAt: 1771800000000,
            snapshotId: 'public-website-1771800000000'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      })
    );

    const res = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/snapshot', {
        headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
      }),
      env,
      {} as ExecutionContext
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok?: boolean; schemaVersion?: string };
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe('1');
    },
    TEST_TIMEOUT_MS
  );
});
