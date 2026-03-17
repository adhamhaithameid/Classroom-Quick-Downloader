import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUserChangelog } from './publicSite';
import { WEBSITE_MANUAL_CHANGELOG } from '$lib/content/changelog.manual.generated';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public website API regressions', () => {
  it('keeps manual changelog order stable (latest first) without network dependency', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchUserChangelog();
    const versions = payload.entries.map((entry) => entry.version);
    const expectedTopVersions = WEBSITE_MANUAL_CHANGELOG.entries
      .map((entry) => String(entry?.version ?? '').replace(/^v/i, ''))
      .filter((version) => version.length > 0)
      .slice(0, 3);

    // Guard the visible top releases while allowing the full-history list to grow.
    expect(versions.slice(0, 3)).toEqual(expectedTopVersions);

    // Regression guard: manual list must stay sorted from newest to oldest.
    const toTuple = (version: string): [number, number, number] => {
      const [major = '0', minor = '0', patch = '0'] = version.split('.');
      return [Number.parseInt(major, 10), Number.parseInt(minor, 10), Number.parseInt(patch, 10)];
    };
    const isGreaterOrEqual = (left: [number, number, number], right: [number, number, number]): boolean => {
      if (left[0] !== right[0]) return left[0] > right[0];
      if (left[1] !== right[1]) return left[1] > right[1];
      return left[2] >= right[2];
    };
    for (let index = 0; index < versions.length - 1; index += 1) {
      const current = toTuple(versions[index]);
      const next = toTuple(versions[index + 1]);
      expect(isGreaterOrEqual(current, next)).toBe(true);
    }

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
