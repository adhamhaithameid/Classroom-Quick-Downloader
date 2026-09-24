import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';
import { TEST_DASHBOARD_PASSWORD, TEST_DANGER_PASSWORD, TEST_SHARED_SECRET } from "./helpers/dummy-secrets";

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
    DO_SHARED_SECRET: TEST_SHARED_SECRET,
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
    MAX_BATCH_EVENTS: '10000',
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    CORS_ALLOWED_ORIGINS: 'https://classroom-quick-downloader-website.pages.dev',
    ...overrides
  };
}

describe('cloudflare worker smoke tests', () => {
  it(
    'returns healthy payload for /health and exposes /public/site-metrics',
    async () => {
    const env = createEnv();

    const healthRes = await worker.fetch(new Request('https://worker.example.com/health'), env, {} as ExecutionContext);
    expect(healthRes.status).toBe(200);
    const healthBody = await healthRes.json() as { ok?: boolean };
    expect(healthBody.ok).toBe(true);

    const metricsRes = await worker.fetch(new Request('https://worker.example.com/public/site-metrics'), env, {} as ExecutionContext);
    expect(metricsRes.status).toBe(200);
    const metricsBody = await metricsRes.json() as { ok?: boolean };
    expect(metricsBody.ok).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'serves public website overview from the edge self-serve snapshot',
    async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/public/site-metrics')) {
        return new Response(
          JSON.stringify({
            ok: true,
            source: 'cloudflare-worker',
            generatedAt: Date.now(),
            totals: { downloads: 145848, success: 138000, fail: 1200, cancelled: 900, countries: 2 },
            countries: [
              { countryCode: 'US', count: 100 },
              { countryCode: 'DE', count: 50 }
            ]
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
    const env = createEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/overview', {
        headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
      }),
      env,
      {} as ExecutionContext
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok?: boolean; totals?: { downloads?: number } };
    expect(body.ok).toBe(true);
    expect(body.totals?.downloads).toBe(145848);
    // Oracle must not be consulted for public website data.
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('oracle'))).toBe(false);
    vi.unstubAllGlobals();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'serves public website snapshot from the edge self-serve pipeline',
    async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/public/site-metrics')) {
        return new Response(
          JSON.stringify({
            ok: true,
            source: 'cloudflare-worker',
            generatedAt: Date.now(),
            totals: { downloads: 145848, success: 138000, fail: 1200, cancelled: 900, countries: 2 },
            countries: [
              { countryCode: 'US', count: 100 },
              { countryCode: 'DE', count: 50 }
            ]
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
    const env = createEnv({ DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace });

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request('https://worker.example.com/api/public/website/snapshot', {
        headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
      }),
      env,
      {} as ExecutionContext
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok?: boolean;
      schemaVersion?: string;
      snapshotId?: string;
      overview?: { totals?: { downloads?: number } };
      map?: { totals?: { countries?: number } };
    };
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe('1');
    expect(body.snapshotId?.startsWith('ws-cf-selfserve-')).toBe(true);
    expect(body.overview?.totals?.downloads).toBe(145848);
    expect(body.map?.totals?.countries).toBe(2);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('oracle'))).toBe(false);
    vi.unstubAllGlobals();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'serves fresh snapshot from KV without upstream pull',
    async () => {
      const now = Date.now();
      const kvGet = vi.fn(async () =>
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          snapshotId: `cached-${now}`,
          generatedAtUtc: now,
          cacheWrittenAtUtc: now
        })
      );
      const kvPut = vi.fn(async () => undefined);
      const env = createEnv({
        SITE_SNAPSHOT_KV: {
          get: kvGet,
          put: kvPut
        } as unknown as KVNamespace
      });

      const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await worker.fetch(
        new Request('https://worker.example.com/api/public/website/snapshot', {
          headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
        }),
        env,
        {} as ExecutionContext
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('x-site-cache')).toBe('hit');
      expect(kvGet).toHaveBeenCalledTimes(1);
      expect(kvPut).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'revalidates stale snapshot via the self-serve pipeline and rewrites KV cache',
    async () => {
      const staleTs = Date.now() - (7 * 60 * 60 * 1000);
      const kvGet = vi.fn(async () =>
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          snapshotId: 'stale-cache',
          generatedAtUtc: staleTs,
          cacheWrittenAtUtc: staleTs
        })
      );
      const kvPut = vi.fn(async () => undefined);
      const env = createEnv({
        SITE_SNAPSHOT_KV: {
          get: kvGet,
          put: kvPut
        } as unknown as KVNamespace
      });

      const doFetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/public/site-metrics')) {
          return new Response(
            JSON.stringify({
              ok: true,
              source: 'cloudflare-worker',
              generatedAt: Date.now(),
              totals: { downloads: 200, success: 190, fail: 10, cancelled: 0, countries: 1 },
              countries: [{ countryCode: 'US', count: 200 }]
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
      (env as { DOWNLOADS_DO?: unknown }).DOWNLOADS_DO = namespace;

      const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await worker.fetch(
        new Request('https://worker.example.com/api/public/website/snapshot', {
          headers: { Origin: 'https://classroom-quick-downloader-website.pages.dev' }
        }),
        env,
        {} as ExecutionContext
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('x-site-cache')).toBe('revalidated');
      // Exactly one SNAPSHOT write (scrape-health bookkeeping writes its own key).
      const snapshotPuts = kvPut.mock.calls.filter((call) => call[0] === 'site:v1:snapshot');
      expect(snapshotPuts).toHaveLength(1);
      const written = JSON.parse(snapshotPuts[0][1] as string) as { snapshotId?: string };
      expect(written.snapshotId?.startsWith('ws-cf-selfserve-')).toBe(true);
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calledUrls.some((url) => url.includes('oracle'))).toBe(false);
      vi.unstubAllGlobals();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'returns stale cached snapshot when the self-serve rebuild fails',
    async () => {
      const staleTs = Date.now() - (7 * 60 * 60 * 1000);
      const stalePayload = {
        schemaVersion: '1',
        ok: true,
        snapshotId: 'stale-cache',
        generatedAtUtc: staleTs,
        cacheWrittenAtUtc: staleTs
      };
      const kvGet = vi.fn(async () => JSON.stringify(stalePayload));
      const kvPut = vi.fn(async () => undefined);
      const env = createEnv({
        SITE_SNAPSHOT_KV: {
          get: kvGet,
          put: kvPut
        } as unknown as KVNamespace
      });

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('oracle-down');
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
      expect(res.headers.get('x-site-cache')).toBe('stale');
      // Self-heal: the stale payload is re-put verbatim so its KV TTL
      // extends and the fallback survives long Oracle outages.
      expect(kvPut).toHaveBeenCalledTimes(1);
      expect(kvPut.mock.calls[0][0]).toBe('site:v1:snapshot');
      expect(kvPut.mock.calls[0][1]).toBe(JSON.stringify(stalePayload));
      const body = (await res.json()) as { snapshotId?: string };
      expect(body.snapshotId).toBe('stale-cache');
    },
    TEST_TIMEOUT_MS
  );
});
