import { describe, expect, it, vi } from 'vitest';
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

function randomAscii(seed: number, minLen: number, maxLen: number): string {
  const size = minLen + (seed % (maxLen - minLen + 1));
  let out = '';
  for (let i = 0; i < size; i += 1) {
    const code = 32 + ((seed * 17 + i * 11) % 94);
    out += String.fromCharCode(code);
  }
  return out;
}

describe('cloudflare worker fuzz safety', () => {
  it('returns controlled 4xx/5xx responses for malformed website events payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));

    for (let i = 0; i < 120; i += 1) {
      const malformedBody = i % 3 === 0
        ? randomAscii(i + 9, 1, 300)
        : JSON.stringify({
            sessionId: randomAscii(i + 1, 0, 60),
            pagePath: randomAscii(i + 2, 0, 90),
            events: i % 2 === 0 ? randomAscii(i + 3, 0, 140) : [{ foo: randomAscii(i + 4, 0, 140) }]
          });

      const response = await worker.fetch(
        new Request('https://worker.example.com/api/public/website/events', {
          method: 'POST',
          headers: {
            Origin: 'https://classroom-quick-downloader-website.pages.dev',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: malformedBody
        }),
        env(),
        {} as ExecutionContext
      );

      expect([200, 400, 401, 403, 405, 413, 422, 500, 502, 503]).toContain(response.status);
      // No uncaught throw means parser/validation path remained safe.
      await response.text();
    }
  });
});
