import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapData, fetchOverview, fetchWebsiteSnapshot, resetWebsiteSnapshotCacheForTests } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  resetWebsiteSnapshotCacheForTests();
});

describe('public website API smoke', () => {
  it('loads overview and map payloads through canonical Oracle snapshot', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: 1771800000000,
          snapshotId: 'snapshot-smoke',
          overview: {
            ok: true,
            generatedAt: 1771800000000,
            totals: { downloads: 1200, success: 1100, fail: 100 },
            installs: {
              usersTotal: 2000,
              lastSyncedAtUtc: 1771799900000,
              browsers: [
                { key: 'chrome', name: 'Chrome', usersCount: 1500, version: '1.3.7', rating: '4.9', ratingCount: 100 }
              ]
            },
            versions: { github: '1.3.7', chrome: '1.3.7', firefox: '1.3.7', edge: '1.3.7' },
            status: { systemLive: true, liveSinceUtc: 1771000000000, workerHealth: 'up' },
            links: {
              chrome: 'https://chrome.example',
              firefox: 'https://firefox.example',
              edge: 'https://edge.example',
              github: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader'
            }
          },
          map: {
            ok: true,
            generatedAt: 1771800000000,
            granularity: 'country',
            countries: [
              { countryCode: 'US', count: 800 },
              { countryCode: 'EG', count: 400 }
            ],
            totals: { countries: 2, downloads: 1200 },
            privacyNote: 'country aggregation only'
          },
          changelog: {
            ok: true,
            generatedAt: 1771800000000,
            headline: 'h',
            description: 'd',
            entries: [],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: null
          },
          userChangelogSummary: {
            headline: 'h',
            description: 'd',
            entriesCount: 0,
            lastUpdatedAtUtc: null,
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'
          },
          privacy: {
            headline: 'Privacy',
            description: 'No raw IP storage.',
            userPrivacyUrl: 'https://classroom-quick-downloader-website.pages.dev/privacy',
            fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md'
          }
        }),
        { status: 200 }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const [overview, map, snapshot] = await Promise.all([
      fetchOverview(),
      fetchMapData(),
      fetchWebsiteSnapshot({ force: true })
    ]);

    expect(overview.ok).toBe(true);
    expect(overview.totals.downloads).toBe(1200);
    expect(map.ok).toBe(true);
    expect(map.totals.countries).toBe(2);
    expect(snapshot.overview.totals.downloads).toBe(1200);
    expect(snapshot.map.countries[0]?.countryCode).toBe('US');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);
});
