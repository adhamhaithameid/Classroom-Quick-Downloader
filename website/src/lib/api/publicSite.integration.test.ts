import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMapData,
  fetchOverview,
  resetWebsiteSnapshotCacheForTests,
  fetchUninstallStats,
  fetchUserChangelog,
  submitUninstallFeedback
} from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('public website API integration', () => {
  it('fetches overview from Oracle endpoint contract', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T22:00:00.000Z'));
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T22:30:00.000Z'));
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

  it('loads user changelog from Oracle public APIs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1,
            headline: 'h',
            description: 'd',
            entries: [
              {
                id: 'release-136',
                version: '1.3.6',
                title: 'Stability',
                summary: 'Security and stability improvements.',
                highlights: ['A'],
                releasedAtUtc: 1
              }
            ],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: 1
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const changelog = await fetchUserChangelog();

    expect(changelog.entries[0]?.version).toBe('1.3.6');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests overview from Oracle API endpoint only', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      expect(url).toContain('/api/public/website/overview');
      expect(url).not.toContain('/public/site-metrics');
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt: 1771700000000,
          totals: { downloads: 10, success: 9, fail: 1 },
          installs: { usersTotal: 99, lastSyncedAtUtc: 1700000, browsers: [] },
          versions: { github: '1.3.6', chrome: '1.3.6', firefox: '1.3.6', edge: '1.3.6' },
          status: { systemLive: true, liveSinceUtc: 1700000, workerHealth: 'up' },
          links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
        }),
        { status: 200 }
      );
    });

    vi.stubGlobal('fetch', fetchMock);
    const payload = await fetchOverview();
    expect(payload.totals.downloads).toBe(10);
    expect(payload.installs.usersTotal).toBe(99);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
