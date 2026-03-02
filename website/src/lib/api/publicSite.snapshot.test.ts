import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ORACLE_SNAPSHOT_REFRESH_MS,
  fetchWebsiteSnapshot,
  resetWebsiteSnapshotCacheForTests
} from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetWebsiteSnapshotCacheForTests();
});

describe('fetchWebsiteSnapshot', () => {
  it('loads canonical snapshot from Oracle and caches for 3 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: 1,
          snapshotId: 'snapshot-1',
          overview: {
            ok: true,
            generatedAt: 1,
            totals: { downloads: 100, success: 90, fail: 10 },
            installs: {
              usersTotal: 0,
              lastSyncedAtUtc: 1,
              browsers: [
                { key: 'chrome', name: 'Chrome', usersCount: 20, version: '1.0.0', rating: '', ratingCount: 0 }
              ]
            },
            versions: { github: '1.0.0', chrome: '1.0.0', firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          },
          map: {
            ok: true,
            generatedAt: 1,
            granularity: 'country',
            countries: [
              { countryCode: 'us', count: 4 },
              { countryCode: 'US', count: 6 },
              { countryCode: 'de', count: 2 },
              { countryCode: 'de', count: 3 },
              { countryCode: 'gb', count: 0 }
            ],
            totals: { countries: 999, downloads: 999 },
            privacyNote: 'country-only'
          },
          changelog: {
            ok: true,
            generatedAt: 1,
            headline: 'h',
            description: 'd',
            entries: [],
            fullChangelogUrl: 'https://example.com/changelog',
            lastUpdatedAtUtc: null
          },
          userChangelogSummary: {
            headline: 'h',
            description: 'd',
            entriesCount: 0,
            lastUpdatedAtUtc: null,
            fullChangelogUrl: 'https://example.com/changelog'
          },
          privacy: {
            headline: 'p',
            description: 'pd',
            userPrivacyUrl: 'https://example.com/privacy',
            fullPrivacyUrl: 'https://example.com/full-privacy'
          }
        }),
        { status: 200 }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchWebsiteSnapshot();
    const second = await fetchWebsiteSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.map.countries).toEqual([
      { countryCode: 'US', count: 10 },
      { countryCode: 'DE', count: 5 }
    ]);
    expect(first.map.totals.countries).toBe(2);
    expect(first.map.totals.downloads).toBe(15);
    expect(first.overview.installs.usersTotal).toBe(20);
    expect(second.fetchedAtUtc).toBe(first.fetchedAtUtc);
    expect(first.nextRefreshAtUtc - first.fetchedAtUtc).toBe(ORACLE_SNAPSHOT_REFRESH_MS);
  }, 15_000);

  it('refreshes cache after 3 hours and when force=true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: Date.now(),
          snapshotId: `snapshot-${Date.now()}`,
          overview: {
            ok: true,
            generatedAt: Date.now(),
            totals: { downloads: fetchMock.mock.calls.length, success: 1, fail: 0 },
            installs: { usersTotal: 1, lastSyncedAtUtc: 1, browsers: [] },
            versions: { github: null, chrome: null, firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt: Date.now(),
          granularity: 'country',
          countries: [{ countryCode: 'US', count: 1 }],
          totals: { countries: 1, downloads: 1 },
          privacyNote: 'country-only'
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchWebsiteSnapshot();
    vi.setSystemTime(new Date('2026-02-23T01:00:00.000Z'));
    await fetchWebsiteSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await fetchWebsiteSnapshot({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    vi.setSystemTime(new Date('2026-02-23T04:10:00.000Z'));
    const refreshed = await fetchWebsiteSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(refreshed.fetchedAtUtc).toBeGreaterThan(first.fetchedAtUtc);
  });
});
