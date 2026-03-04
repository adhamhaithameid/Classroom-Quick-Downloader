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
  delete (globalThis as { window?: unknown }).window;
});

describe('fetchWebsiteSnapshot', () => {
  function createMemoryStorage() {
    const map = new Map<string, string>();
    return {
      getItem(key: string): string | null {
        return map.has(key) ? (map.get(key) as string) : null;
      },
      setItem(key: string, value: string): void {
        map.set(key, value);
      },
      removeItem(key: string): void {
        map.delete(key);
      }
    };
  }

  function makeStoredSnapshot(snapshotId: string, generatedAt: number) {
    return {
      source: 'edge-backend',
      snapshotId,
      generatedAt,
      fetchedAtUtc: generatedAt + 1,
      nextRefreshAtUtc: generatedAt + ORACLE_SNAPSHOT_REFRESH_MS,
      overview: {
        schemaVersion: '1',
        ok: true,
        generatedAt,
        totals: { downloads: generatedAt, success: 1, fail: 0 },
        installs: { usersTotal: 1, lastSyncedAtUtc: generatedAt, browsers: [] },
        versions: { github: null, chrome: null, firefox: null, edge: null },
        status: { systemLive: true, liveSinceUtc: generatedAt, workerHealth: 'up' },
        links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
      },
      map: {
        schemaVersion: '1',
        ok: true,
        generatedAt,
        granularity: 'country',
        countries: [{ countryCode: 'US', count: 1 }],
        totals: { countries: 1, downloads: 1 },
        privacyNote: 'country-only'
      },
      changelog: {
        schemaVersion: '1',
        ok: true,
        generatedAt,
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
    };
  }

  it('prefers newer local next snapshot over stale session snapshot on refresh', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();

    const staleSession = makeStoredSnapshot('session-stale', 1772500000000);
    const freshLocal = makeStoredSnapshot('local-next', 1772600000000);

    sessionStorage.setItem('cqd.website.snapshot.session.v1', JSON.stringify(staleSession));
    localStorage.setItem('cqd.website.snapshot.next.v1', JSON.stringify(freshLocal));
    localStorage.setItem('cqd.website.snapshot.lastgood.v1', JSON.stringify(freshLocal));

    (globalThis as { window?: unknown }).window = {
      localStorage,
      sessionStorage
    };

    const fetchMock = vi.fn(async () => new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchWebsiteSnapshot();
    expect(snapshot.snapshotId).toBe('local-next');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads canonical snapshot from Oracle and caches for 3 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/data/bootstrap-snapshot.json')) {
        return new Response('missing', { status: 404 });
      }
      return new Response(
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
      );
    });

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

  it('keeps session-pinned snapshot stable until forced refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T00:00:00.000Z'));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/data/bootstrap-snapshot.json')) {
        return new Response('missing', { status: 404 });
      }
      return new Response(
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
          },
          map: {
            ok: true,
            generatedAt: Date.now(),
            granularity: 'country',
            countries: [{ countryCode: 'US', count: 1 }],
            totals: { countries: 1, downloads: 1 },
            privacyNote: 'country-only'
          },
          changelog: {
            ok: true,
            generatedAt: Date.now(),
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

    const first = await fetchWebsiteSnapshot();
    vi.setSystemTime(new Date('2026-02-23T01:00:00.000Z'));
    await fetchWebsiteSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const forced = await fetchWebsiteSnapshot({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date('2026-02-23T04:10:00.000Z'));
    const refreshed = await fetchWebsiteSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.fetchedAtUtc).toBe(forced.fetchedAtUtc);
  });
});
