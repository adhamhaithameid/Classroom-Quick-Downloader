import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOverview, fetchUserChangelog, resetWebsiteSnapshotCacheForTests } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetWebsiteSnapshotCacheForTests();
});

describe('public website acceptance contracts', () => {
  it('accepts a full overview payload from Oracle snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T22:10:00.000Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            schemaVersion: '1',
            ok: true,
            generatedAt: 1771700000000,
            snapshotId: 'snapshot-overview',
            overview: {
              ok: true,
              generatedAt: 1771700000000,
              totals: { downloads: 1200, success: 1100, fail: 100 },
              installs: {
                usersTotal: 400,
                lastSyncedAtUtc: 1771699000000,
                browsers: [{ key: 'chrome', name: 'Chrome', usersCount: 300, version: '1.3.6', rating: '5', ratingCount: 10 }]
              },
              versions: { github: '1.3.6', chrome: '1.3.6', firefox: null, edge: null },
              status: { systemLive: true, liveSinceUtc: 1771600000000, workerHealth: 'up' },
              links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
            },
            map: {
              ok: true,
              generatedAt: 1771700000000,
              granularity: 'country',
              countries: [{ countryCode: 'US', count: 1200 }],
              totals: { countries: 1, downloads: 1200 },
              privacyNote: 'country only'
            },
            changelog: {
              ok: true,
              generatedAt: 1771700000000,
              headline: "What's new for students",
              description: 'Simple release notes',
              entries: [
                {
                  id: 'release-136',
                  version: '1.3.6',
                  title: 'Stability improvements',
                  summary: 'Security and reliability improvements.',
                  highlights: ['Fewer errors'],
                  releasedAtUtc: 1771600000000
                }
              ],
              fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
              lastUpdatedAtUtc: 1771600000000
            },
            userChangelogSummary: {
              headline: "What's new for students",
              description: 'Simple release notes',
              entriesCount: 1,
              lastUpdatedAtUtc: 1771600000000,
              fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'
            },
            privacy: {
              headline: 'Privacy',
              description: 'No raw IP storage',
              userPrivacyUrl: 'https://classroom-quick-downloader-website.pages.dev/privacy',
              fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md'
            }
          }),
          { status: 200 }
        )
      )
    );

    const payload = await fetchOverview();
    expect(payload.totals.downloads).toBe(1200);
    expect(payload.status.workerHealth).toBe('up');
  });

  it('accepts user changelog contract from Oracle snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: 1771700000000,
          snapshotId: 'snapshot-changelog',
          overview: {
            ok: true,
            generatedAt: 1771700000000,
            totals: { downloads: 1, success: 1, fail: 0 },
            installs: { usersTotal: 1, lastSyncedAtUtc: 1771700000000, browsers: [] },
            versions: { github: '1.3.6', chrome: '1.3.6', firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1771600000000, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          },
          map: {
            ok: true,
            generatedAt: 1771700000000,
            granularity: 'country',
            countries: [{ countryCode: 'US', count: 1 }],
            totals: { countries: 1, downloads: 1 },
            privacyNote: 'country only'
          },
          changelog: {
            ok: true,
            generatedAt: 1771700000000,
            headline: "What's new for students",
            description: 'Simple release notes',
            entries: [
              {
                id: 'release-136',
                version: '1.3.6',
                title: 'Stability improvements',
                summary: 'Security and reliability improvements.',
                highlights: ['Fewer errors'],
                releasedAtUtc: 1771600000000
              }
            ],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: 1771600000000
          },
          userChangelogSummary: {
            headline: "What's new for students",
            description: 'Simple release notes',
            entriesCount: 1,
            lastUpdatedAtUtc: 1771600000000,
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'
          },
          privacy: {
            headline: 'Privacy',
            description: 'No raw IP storage',
            userPrivacyUrl: 'https://classroom-quick-downloader-website.pages.dev/privacy',
            fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md'
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const changelog = await fetchUserChangelog();

    expect(changelog.entries[0]?.title).toContain('Stability');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
