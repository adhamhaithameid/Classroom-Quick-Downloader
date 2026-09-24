import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';
import { TEST_DASHBOARD_PASSWORD, TEST_DANGER_PASSWORD, TEST_SHARED_SECRET } from "./helpers/dummy-secrets";

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
    DO_SHARED_SECRET: TEST_SHARED_SECRET,
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
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

  it('serves the public overview without any ORACLE_ENDPOINT configured', async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/public/site-metrics')) {
        return new Response(
          JSON.stringify({
            ok: true,
            source: 'cloudflare-worker',
            generatedAt: Date.now(),
            totals: { downloads: 320, success: 300, fail: 20, cancelled: 0, countries: 1 },
            countries: [{ countryCode: 'US', count: 320 }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    const namespace = {
      idFromName: (_name: string) => 'downloads-id',
      get: (_id: string) => ({ fetch: doFetch })
    };
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview'),
      env({ ORACLE_ENDPOINT: '', DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok?: boolean; totals?: { downloads?: number } };
    expect(payload.ok).toBe(true);
    expect(payload.totals?.downloads).toBe(320);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('oracle'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('falls back to the last-good KV snapshot when the DO metrics are unavailable', async () => {
    const cachedSnapshot = {
      schemaVersion: '1',
      ok: true,
      snapshotId: 'last-good-cache',
      generatedAtUtc: Date.now() - 30 * 60 * 1000,
      cacheWrittenAtUtc: Date.now() - 30 * 60 * 1000,
      overview: {
        schemaVersion: '1',
        ok: true,
        generatedAt: Date.now() - 30 * 60 * 1000,
        totals: { downloads: 42, success: 40, fail: 2 }
      },
      map: { countries: [] },
      changelog: { entries: [] }
    };
    const kv = {
      get: vi.fn(async (key: string) =>
        key === 'site:v1:snapshot' ? JSON.stringify(cachedSnapshot) : null
      ),
      put: vi.fn(async () => undefined)
    };
    const response = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview'),
      env({ SITE_SNAPSHOT_KV: kv as unknown as KVNamespace }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-site-fallback')).toBe('snapshot-cache');
    const payload = await response.json() as { ok?: boolean; totals?: { downloads?: number } };
    expect(payload.ok).toBe(true);
    expect(payload.totals?.downloads).toBe(42);
  });
});
