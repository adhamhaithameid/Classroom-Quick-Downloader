import { afterEach, describe, expect, it, vi } from 'vitest';
import { coerceMapPayload, fetchWebsiteSnapshot, resetWebsiteSnapshotCacheForTests } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  resetWebsiteSnapshotCacheForTests();
});

describe('public website API load and stress behavior', () => {
  it('coerces a large country payload deterministically under load', () => {
    const sourceCountries: Array<{ countryCode: string; count: number }> = [];
    for (let i = 0; i < 10000; i += 1) {
      sourceCountries.push({ countryCode: i % 2 === 0 ? 'us' : 'eg', count: 1 });
    }
    for (let i = 0; i < 500; i += 1) {
      sourceCountries.push({ countryCode: 'XX' + i, count: 999 });
      sourceCountries.push({ countryCode: 'de', count: 0 });
      sourceCountries.push({ countryCode: 'fr', count: -3 });
    }

    const payload = coerceMapPayload({
      ok: true,
      generatedAt: 1,
      countries: sourceCountries,
      totals: { countries: 0, downloads: 0 },
      privacyNote: 'country only'
    });

    expect(payload.countries).toEqual([
      { countryCode: 'EG', count: 5000 },
      { countryCode: 'US', count: 5000 }
    ]);
    expect(payload.totals).toEqual({ countries: 2, downloads: 10000 });
  });

  it('deduplicates concurrent snapshot fetches to a single in-flight request set', async () => {
    let requestCount = 0;
    const fetchMock = vi.fn(async () => {
      requestCount += 1;
      return new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: requestCount,
          snapshotId: `snapshot-${requestCount}`,
          overview: {
            ok: true,
            generatedAt: requestCount,
            totals: { downloads: 42, success: 40, fail: 2 },
            installs: { usersTotal: 11, lastSyncedAtUtc: 1, browsers: [] },
            versions: { github: '1.3.7', chrome: null, firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          },
          map: {
            ok: true,
            generatedAt: requestCount,
            granularity: 'country',
            countries: [{ countryCode: 'US', count: 42 }],
            totals: { countries: 1, downloads: 42 },
            privacyNote: 'country only'
          },
          changelog: {
            ok: true,
            generatedAt: requestCount,
            headline: '',
            description: '',
            entries: [],
            fullChangelogUrl: '',
            lastUpdatedAtUtc: null
          },
          userChangelogSummary: {
            headline: '',
            description: '',
            entriesCount: 0,
            lastUpdatedAtUtc: null,
            fullChangelogUrl: ''
          },
          privacy: {
            headline: '',
            description: '',
            userPrivacyUrl: '',
            fullPrivacyUrl: ''
          }
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const snapshots = await Promise.all(
      Array.from({ length: 80 }, () => fetchWebsiteSnapshot())
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const snapshot of snapshots) {
      expect(snapshot.overview.totals.downloads).toBe(42);
      expect(snapshot.map.countries[0]?.countryCode).toBe('US');
    }
  });
});
