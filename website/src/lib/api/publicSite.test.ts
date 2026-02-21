import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coerceMapPayload,
  coerceOverviewPayload,
  fetchUninstallStats,
  submitUninstallFeedback
} from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('coerceOverviewPayload', () => {
  it('normalizes malformed overview payloads', () => {
    const payload = coerceOverviewPayload({
      ok: true,
      totals: { downloads: 10, success: 8, fail: 2 },
      installs: {
        usersTotal: 20,
        browsers: [{ key: 'chrome', usersCount: 20, version: '1.3.6' }]
      },
      versions: { github: '1.3.6', chrome: '1.3.6' },
      status: { systemLive: true, workerHealth: 'up' },
      links: { chrome: 'https://example.com' }
    });

    expect(payload.ok).toBe(true);
    expect(payload.totals.downloads).toBe(10);
    expect(payload.installs.browsers[0]?.key).toBe('chrome');
    expect(payload.status.workerHealth).toBe('up');
    expect(payload.links.chrome).toContain('https://');
  });

  it('falls back safely when fields are missing', () => {
    const payload = coerceOverviewPayload({});

    expect(payload.ok).toBe(false);
    expect(payload.totals.downloads).toBe(0);
    expect(payload.installs.browsers).toEqual([]);
    expect(payload.status.workerHealth).toBe('down');
  });
});

describe('coerceMapPayload', () => {
  it('filters invalid country values and normalizes valid codes', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: [
        { countryCode: 'us', count: 12 },
        { countryCode: 'USA', count: 10 },
        { countryCode: 'gb', count: 0 }
      ],
      totals: { countries: 1, downloads: 12 }
    });

    expect(payload.countries).toEqual([{ countryCode: 'US', count: 12 }]);
    expect(payload.totals.downloads).toBe(12);
  });
});

describe('uninstall feedback API', () => {
  it('fetches and normalizes uninstall stats payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1700000000000,
            stats: {
              totalSubmissions: 4,
              lastSubmittedAtUtc: 1700000000001,
              topReasons: [{ reason: 'Temporary uninstall', count: 2 }]
            }
          }),
          { status: 200 }
        )
      )
    );

    const payload = await fetchUninstallStats();
    expect(payload.ok).toBe(true);
    expect(payload.stats.totalSubmissions).toBe(4);
    expect(payload.stats.topReasons[0]?.reason).toBe('Temporary uninstall');
  });

  it('submits uninstall feedback payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, generatedAt: 1700001, submissionId: 12, message: 'ok' }), {
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await submitUninstallFeedback({
      reason: 'Temporary uninstall',
      browser: 'chrome',
      version: '1.3.6',
      source: 'extension',
      notes: 'Testing'
    });

    expect(response.ok).toBe(true);
    expect(response.submissionId).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, init] = call;
    expect(init?.method).toBe('POST');
  });
});
