import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUserChangelog } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public website API regressions', () => {
  it('keeps changelog entries sorted by releasedAtUtc descending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            generatedAt: 1,
            headline: 'User Changelog',
            description: 'Latest updates',
            entries: [
              { id: 'old', version: '1.3.5', title: 'Old', summary: 'old', highlights: [], releasedAtUtc: 10 },
              { id: 'new', version: '1.3.7', title: 'New', summary: 'new', highlights: [], releasedAtUtc: 20 },
              { id: 'mid', version: '1.3.6', title: 'Mid', summary: 'mid', highlights: [], releasedAtUtc: 15 }
            ],
            fullChangelogUrl: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md',
            lastUpdatedAtUtc: 20
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
    );

    const payload = await fetchUserChangelog();
    expect(payload.entries.map((entry) => entry.id)).toEqual(['new', 'mid', 'old']);
  });
});
