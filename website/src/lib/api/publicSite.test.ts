import { describe, expect, it } from 'vitest';
import { coerceMapPayload, coerceOverviewPayload } from './publicSite';

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
