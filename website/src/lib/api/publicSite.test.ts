import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coerceMapPayload,
  coerceOverviewPayload,
  fetchMapData,
  fetchOverview,
  fetchUserChangelog,
  fetchUserPrivacy,
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

describe('worker/oracle source routing', () => {
  it('merges worker downloads into overview outside Oracle window', async () => {
    vi.useFakeTimers();
    try {
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
              totals: { downloads: 77, countries: 2 },
              countries: [
                { countryCode: 'US', count: 50 },
                { countryCode: 'GB', count: 27 }
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
              totals: { downloads: 10, success: 8, fail: 2 },
              installs: { usersTotal: 20, lastSyncedAtUtc: 1771699200000, browsers: [] },
              versions: { github: '1.3.6', chrome: '1.3.6', firefox: null, edge: null },
              status: { systemLive: true, liveSinceUtc: 1771600000000, workerHealth: 'up' },
              links: { chrome: 'https://c', firefox: 'https://f', edge: 'https://e', github: 'https://g' }
            }),
            { status: 200 }
          )
        );
      vi.stubGlobal('fetch', fetchMock);

      const payload = await fetchOverview();
      expect(payload.totals.downloads).toBe(77);
      expect(payload.installs.usersTotal).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds map payload from worker snapshot outside Oracle window', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-02-21T12:00:00.000Z'));
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              ok: true,
              source: 'cloudflare-worker',
              generatedAt: 1771700000000,
              snapshotAtUtc: 1771699200000,
              totals: { downloads: 88, countries: 1 },
              countries: [{ countryCode: 'us', count: 88 }],
              schedule: {
                refreshHoursUtc: [3, 6, 9, 12, 15, 18, 21],
                activeHourUtc: 12,
                isRefreshWindow: true,
                lastRefreshAtUtc: 1771699200000,
                nextRefreshAtUtc: 1771702800000
              }
            }),
            { status: 200 }
          )
        )
      );

      const payload = await fetchMapData();
      expect(payload.totals.downloads).toBe(88);
      expect(payload.countries).toEqual([{ countryCode: 'US', count: 88 }]);
    } finally {
      vi.useRealTimers();
    }
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

describe('user-facing content APIs', () => {
  it('fetches and normalizes user changelog payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1700000000000,
            headline: "What's new for students",
            description: 'Simple updates',
            entries: [
              {
                id: 'release-136',
                version: '1.3.6',
                title: 'Stability improvements',
                summary: 'This release includes stability and security improvements.',
                highlights: ['Fewer errors', 'More reliable downloads'],
                releasedAtUtc: 1700000000001
              }
            ],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: 1700000000001
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchUserChangelog();
    expect(data.ok).toBe(true);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]?.version).toBe('1.3.6');
  });

  it('fetches and normalizes user privacy payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1700000000000,
            headline: 'Privacy in simple words',
            description: 'Simple privacy summary',
            sections: [
              {
                id: 'what-we-collect',
                title: 'What we collect',
                summary: 'Only aggregate usage signals.',
                bullets: ['No raw IP lists', 'No private files'],
                priority: 1
              }
            ],
            fullPrivacyUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md',
            lastUpdatedAtUtc: 1700000000001
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchUserPrivacy();
    expect(data.ok).toBe(true);
    expect(data.sections[0]?.title).toBe('What we collect');
  });
});
