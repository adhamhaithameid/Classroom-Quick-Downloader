import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMapData,
  fetchOverview,
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

  it('loads user changelog and privacy from Oracle public APIs', async () => {
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 2,
            headline: 'h',
            description: 'd',
            sections: [
              {
                id: 'what-we-collect',
                title: 'What we collect',
                summary: 'Only aggregate metrics.',
                bullets: ['No raw IP lists'],
                priority: 1
              }
            ],
            fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md',
            lastUpdatedAtUtc: 2
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const changelog = await fetchUserChangelog();
    const privacy = await fetchUserPrivacy();

    expect(changelog.entries[0]?.version).toBe('1.3.6');
    expect(privacy.sections[0]?.id).toBe('what-we-collect');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses worker public metrics outside Oracle window and falls back to Oracle installs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T09:00:00.000Z'));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            source: 'cloudflare-worker',
            generatedAt: 1771700000000,
            snapshotAtUtc: 1771699200000,
            totals: { downloads: 300, countries: 2 },
            countries: [
              { countryCode: 'US', count: 200 },
              { countryCode: 'GB', count: 100 }
            ],
            schedule: {
              refreshHoursUtc: [3, 6, 9, 12, 15, 18, 21],
              activeHourUtc: 9,
              isRefreshWindow: true,
              lastRefreshAtUtc: 1771699200000,
              nextRefreshAtUtc: 1771702800000
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
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
        )
      );

    vi.stubGlobal('fetch', fetchMock);
    const payload = await fetchOverview();
    expect(payload.totals.downloads).toBe(300);
    expect(payload.installs.usersTotal).toBe(99);
  });
});
