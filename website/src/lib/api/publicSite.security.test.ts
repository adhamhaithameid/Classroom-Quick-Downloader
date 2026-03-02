import { afterEach, describe, expect, it, vi } from 'vitest';
import { coerceMapPayload, submitWebsiteEvents, submitUninstallFeedback } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public website API security hardening', () => {
  it('filters malformed country payload values and keeps strict ISO-2 uppercase output', () => {
    const payload = coerceMapPayload({
      ok: true,
      generatedAt: 1771800000000,
      countries: [
        { countryCode: 'us', count: 5 },
        { countryCode: 'US', count: 2 },
        { countryCode: 'eg', count: 3 },
        { countryCode: 'EGY', count: 1000 },
        { countryCode: '<script>', count: 1000 },
        { countryCode: 'fr', count: 0 },
        { countryCode: 'de', count: -10 },
        { countryCode: 'x1', count: 15 }
      ],
      totals: { countries: 999, downloads: 999 },
      privacyNote: 'raw'
    });

    expect(payload.countries).toEqual([
      { countryCode: 'X1', count: 15 },
      { countryCode: 'US', count: 7 },
      { countryCode: 'EG', count: 3 }
    ]);
    expect(payload.totals).toEqual({ countries: 3, downloads: 25 });
  });

  it('sends required anti-CSRF style header for public write endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/public/website/events');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('XMLHttpRequest');
      return new Response(JSON.stringify({ ok: true, generatedAt: 1, acceptedCount: 1, rejectedCount: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await submitWebsiteEvents({
      schemaVersion: '1',
      sessionId: 'ws_session',
      pagePath: '/overview',
      events: [
        {
          eventId: 'evt-abc-123456',
          eventType: 'cta',
          action: 'install_click',
          placement: 'hero_install'
        }
      ]
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, init] = call;
    const requestBody = JSON.parse(String(init?.body || '{}')) as { schemaVersion?: string };
    expect(requestBody.schemaVersion).toBe('1');
  });

  it('fails closed when uninstall endpoint returns a non-2xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    await expect(
      submitUninstallFeedback({
        reason: 'No longer needed',
        browser: 'chrome',
        version: '1.3.7',
        source: 'website',
        notes: 'security regression check'
      })
    ).rejects.toThrow('Access denied (403).');
  });
});
