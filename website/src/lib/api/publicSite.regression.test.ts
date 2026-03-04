import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUserChangelog } from './publicSite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public website API regressions', () => {
  it('keeps manual changelog order stable (latest first) without network dependency', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchUserChangelog();
    expect(payload.entries.map((entry) => entry.version)).toEqual(['1.3.9', '1.3.8', '1.3.7']);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
