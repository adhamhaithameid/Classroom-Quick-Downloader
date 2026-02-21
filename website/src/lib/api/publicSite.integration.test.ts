import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapData, fetchOverview, fetchUninstallStats, submitUninstallFeedback } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public website API integration', () => {
  it('fetches overview from Oracle endpoint contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1700000,
            totals: { downloads: 10, success: 9, fail: 1 },
            installs: { usersTotal: 99, lastSyncedAtUtc: 1700000, browsers: [] },
            versions: { github: '1.3.6', chrome: '1.3.6', firefox: '1.3.6', edge: '1.3.6' },
            status: { systemLive: true, liveSinceUtc: 1700000, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          }),
          { status: 200 }
        )
      )
    );

    const payload = await fetchOverview();
    expect(payload.ok).toBe(true);
    expect(payload.totals.downloads).toBe(10);
  });

  it('fetches map data and strips invalid rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1700000,
            granularity: 'country',
            countries: [{ countryCode: 'us', count: 10 }, { countryCode: 'xx', count: 0 }],
            totals: { countries: 1, downloads: 10 },
            privacyNote: 'note'
          }),
          { status: 200 }
        )
      )
    );

    const payload = await fetchMapData();
    expect(payload.countries).toEqual([{ countryCode: 'US', count: 10 }]);
  });

  it('submits uninstall feedback then loads stats', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, generatedAt: 1, submissionId: 7, message: 'saved' }), {
          status: 201
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 2,
            stats: {
              totalSubmissions: 1,
              lastSubmittedAtUtc: 2,
              topReasons: [{ reason: 'Temporary uninstall', count: 1 }]
            }
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const submit = await submitUninstallFeedback({
      reason: 'Temporary uninstall',
      browser: 'chrome',
      version: '1.3.6',
      source: 'extension'
    });
    const stats = await fetchUninstallStats();

    expect(submit.ok).toBe(true);
    expect(stats.stats.totalSubmissions).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
