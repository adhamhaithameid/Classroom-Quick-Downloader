import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOverview, fetchUserChangelog } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('public website acceptance contracts', () => {
  it('accepts a full overview payload from Oracle', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T22:10:00.000Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        )
      )
    );

    const payload = await fetchOverview();
    expect(payload.totals.downloads).toBe(1200);
    expect(payload.status.workerHealth).toBe('up');
  });

  it('accepts user changelog contract from Oracle', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
