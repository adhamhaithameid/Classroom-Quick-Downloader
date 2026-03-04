import { describe, expect, it } from 'vitest';
import { coerceMapPayload, coerceOverviewPayload } from './publicSite';

type OverviewCase = {
  input: unknown;
  expectedDownloads: number;
  expectedHealth: 'up' | 'degraded' | 'down';
};

const overviewCases: OverviewCase[] = Array.from({ length: 420 }, (_, idx) => {
  const downloads = idx * 17;
  const health = idx % 3 === 0 ? 'up' : idx % 3 === 1 ? 'degraded' : 'down';
  const browserUsers = idx % 2 === 0 ? downloads : `${downloads}`;
  return {
    input: {
      schemaVersion: idx % 5 === 0 ? 'invalid' : '1',
      ok: idx % 2 === 0,
      generatedAt: idx % 7 === 0 ? `bad-${idx}` : downloads,
      totals: {
        downloads,
        success: downloads - (idx % 11),
        fail: idx % 11
      },
      installs: {
        usersTotal: downloads + 5,
        lastSyncedAtUtc: 1_700_000_000_000 + idx * 1000,
        browsers: [
          {
            key: 'chrome',
            name: 'Chrome',
            usersCount: browserUsers,
            version: `1.${idx % 10}.${idx % 5}`,
            rating: '4.9',
            ratingCount: 100 + idx
          }
        ]
      },
      status: {
        systemLive: idx % 4 !== 0,
        liveSinceUtc: idx % 6 === 0 ? null : 1_700_000_000_000 + idx * 1000,
        workerHealth: health
      },
      links: idx % 9 === 0 ? {} : {
        chrome: 'https://chrome.example.com',
        firefox: 'https://firefox.example.com',
        edge: 'https://edge.example.com',
        github: 'https://github.example.com'
      }
    },
    expectedDownloads: downloads,
    expectedHealth: health
  };
});

const mapCases = Array.from({ length: 420 }, (_, idx) => {
  const primary = ['US', 'GB', 'EG', 'DE', 'FR', 'CA'][idx % 6];
  const secondary = ['JP', 'IN', 'BR', 'MX', 'IT', 'ES'][idx % 6];
  const base = idx + 1;
  const primaryCount = base + base + 1;
  const secondaryCount = base + 2;
  return {
    input: {
      schemaVersion: idx % 8 === 0 ? 'unknown' : '1',
      ok: idx % 3 === 0,
      generatedAt: 1_700_000_000_000 + idx * 5000,
      countries: [
        { countryCode: primary.toLowerCase(), count: base },
        { countryCode: primary, count: base + 1 },
        { countryCode: secondary, count: base + 2 },
        { countryCode: 'u1', count: 999 }, // invalid ISO2 -> dropped
        { countryCode: 'ZZZ', count: 100 }, // invalid ISO2 -> dropped
        { countryCode: 'CN', count: -10 } // invalid count -> dropped
      ],
      privacyNote: `privacy note ${idx}`
    },
    expectedPrimary: primary,
    expectedPrimaryCount: primaryCount,
    expectedSecondary: secondary,
    expectedSecondaryCount: secondaryCount,
    expectedDownloads: primaryCount + secondaryCount
  };
});

describe('publicSite coercion massive matrix', () => {
  it.each(overviewCases)('coerceOverviewPayload matrix #%#', ({ input, expectedDownloads, expectedHealth }) => {
    const payload = coerceOverviewPayload(input);

    expect(payload.schemaVersion).toBe('1');
    expect(payload.totals.downloads).toBe(expectedDownloads);
    expect(payload.status.workerHealth).toBe(expectedHealth);
    expect(payload.links.chrome.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.installs.browsers)).toBe(true);
    expect(payload.installs.browsers.length).toBe(1);
    expect(payload.installs.browsers[0].key).toBe('chrome');
    expect(payload.installs.browsers[0].usersCount).toBeTypeOf('number');
  });

  it.each(mapCases)('coerceMapPayload matrix #%#', ({
    input,
    expectedPrimary,
    expectedPrimaryCount,
    expectedSecondary,
    expectedSecondaryCount,
    expectedDownloads
  }) => {
    const payload = coerceMapPayload(input);

    expect(payload.schemaVersion).toBe('1');
    expect(payload.granularity).toBe('country');
    expect(payload.countries.length).toBe(2);
    expect(payload.countries).toContainEqual({ countryCode: expectedPrimary, count: expectedPrimaryCount });
    expect(payload.countries).toContainEqual({ countryCode: expectedSecondary, count: expectedSecondaryCount });
    expect(payload.totals.countries).toBe(2);
    expect(payload.totals.downloads).toBe(expectedDownloads);
  });
});
