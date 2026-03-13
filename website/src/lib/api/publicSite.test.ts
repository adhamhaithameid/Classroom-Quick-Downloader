import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coerceMapPayload,
  coerceOverviewPayload,
  fetchMapData,
  fetchOverview,
  resetWebsiteSnapshotCacheForTests,
  fetchUserChangelog,
  fetchUninstallStats,
  submitUninstallFeedback,
  submitWebsiteEvents
} from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  resetWebsiteSnapshotCacheForTests();
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

describe('oracle-only website data source routing', () => {
  it('reads overview from edge snapshot route with Oracle-compatible payload', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/data/bootstrap-snapshot.json')) {
        return new Response('missing', { status: 404 });
      }
      return new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: 1771700000000,
          snapshotId: 'snapshot-77',
          overview: {
            ok: true,
            generatedAt: 1771700000000,
            totals: { downloads: 77, success: 75, fail: 2 },
            installs: { usersTotal: 20, lastSyncedAtUtc: 1771699200000, browsers: [] },
            versions: { github: '1.3.6', chrome: '1.3.6', firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1771600000000, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          },
          map: {
            ok: true,
            generatedAt: 1771700000000,
            granularity: 'country',
            countries: [{ countryCode: 'US', count: 77 }],
            totals: { downloads: 77, countries: 1 },
            privacyNote: 'country only'
          },
          changelog: {
            ok: true,
            generatedAt: 1771700000000,
            headline: '',
            description: '',
            entries: [],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: null
          },
          userChangelogSummary: {
            headline: '',
            description: '',
            entriesCount: 0,
            lastUpdatedAtUtc: null,
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'
          },
          privacy: {
            headline: '',
            description: '',
            userPrivacyUrl: 'https://classroom-quick-downloader-website.pages.dev/privacy',
            fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md'
          }
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchOverview();
    expect(payload.totals.downloads).toBe(77);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('/api/site/v1/snapshot') || url.includes('/api/public/website/snapshot'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('/public/site-metrics'))).toBe(false);
  });

  it('reads map from edge snapshot route with Oracle-compatible payload', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/data/bootstrap-snapshot.json')) {
        return new Response('missing', { status: 404 });
      }
      return new Response(
        JSON.stringify({
          schemaVersion: '1',
          ok: true,
          generatedAt: 1771700000000,
          snapshotId: 'snapshot-88',
          overview: {
            ok: true,
            generatedAt: 1771700000000,
            totals: { downloads: 88, success: 88, fail: 0 },
            installs: { usersTotal: 1, lastSyncedAtUtc: 1771700000000, browsers: [] },
            versions: { github: null, chrome: null, firefox: null, edge: null },
            status: { systemLive: true, liveSinceUtc: 1771600000000, workerHealth: 'up' },
            links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
          },
          map: {
            ok: true,
            generatedAt: 1771700000000,
            granularity: 'country',
            countries: [{ countryCode: 'us', count: 88 }],
            totals: { downloads: 88, countries: 1 },
            privacyNote: 'country only'
          },
          changelog: {
            ok: true,
            generatedAt: 1771700000000,
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

    const payload = await fetchMapData();
    expect(payload.totals.downloads).toBe(88);
    expect(payload.countries).toEqual([{ countryCode: 'US', count: 88 }]);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('/api/site/v1/snapshot') || url.includes('/api/public/website/snapshot'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('/public/site-metrics'))).toBe(false);
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

  it('returns an empty uninstall stats payload when the public stats route is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: { code: 'method_not_allowed' } }), { status: 405 })
      )
    );

    const payload = await fetchUninstallStats();
    expect(payload.ok).toBe(false);
    expect(payload.stats.totalSubmissions).toBe(0);
    expect(payload.stats.lastSubmittedAtUtc).toBeNull();
    expect(payload.stats.topReasons).toEqual([]);
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

  it('submits website events payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, generatedAt: 1700002, acceptedCount: 2, rejectedCount: 0 }), {
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await submitWebsiteEvents({
      schemaVersion: '1',
      sessionId: 'session-1',
      pagePath: '/overview',
      events: [
        { eventId: 'evt-1', eventType: 'cta', action: 'install_click', placement: 'hero_install' },
        { eventId: 'evt-2', eventType: 'map', action: 'map_yes', placement: 'map_prompt_yes' }
      ]
    });

    expect(response.ok).toBe(true);
    expect(response.acceptedCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, init] = call;
    expect(init?.method).toBe('POST');
    const requestBody = JSON.parse(String(init?.body || '{}')) as { schemaVersion?: string };
    expect(requestBody.schemaVersion).toBe('1');
  });

  /* NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  it('submits newsletter subscription payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          generatedAt: 1700003,
          recordKey: 'student@example.com',
          message: 'You are subscribed for future updates.'
        }),
        { status: 201 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await submitNewsletterSubscription({
      email: 'student@example.com',
      source: 'overview_ready_to_save_hours'
    });

    expect(response.ok).toBe(true);
    expect(response.recordKey).toBe('student@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toContain('/api/public/website/newsletter/subscribe');
    expect(init?.method).toBe('POST');
  });
  NEWSLETTER_CTA_DISABLED_ROLLBACK_END */
});

describe('user-facing content APIs', () => {
  it('loads user changelog from manual source-controlled data', async () => {
    const data = await fetchUserChangelog();
    expect(data.ok).toBe(true);
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries[0]?.version).toBe('1.5.0');
  });

});
