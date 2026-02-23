/**
 * Deep coercion & edge-case tests for publicSite payload normalizers.
 * Complements the existing publicSite.test.ts which covers happy paths.
 */
import { describe, expect, it } from 'vitest';
import { coerceOverviewPayload, coerceMapPayload } from './publicSite';

// ────────────────────────────────────────────────
// coerceOverviewPayload edge cases
// ────────────────────────────────────────────────

describe('coerceOverviewPayload — edge cases', () => {
  it('handles null input', () => {
    const payload = coerceOverviewPayload(null);
    expect(payload.ok).toBe(false);
    expect(payload.totals.downloads).toBe(0);
  });

  it('handles undefined input', () => {
    const payload = coerceOverviewPayload(undefined);
    expect(payload.ok).toBe(false);
    expect(payload.installs.browsers).toEqual([]);
  });

  it('handles primitive input (number)', () => {
    const payload = coerceOverviewPayload(42);
    expect(payload.ok).toBe(false);
    expect(payload.totals.downloads).toBe(0);
  });

  it('handles string input', () => {
    const payload = coerceOverviewPayload('not an object');
    expect(payload.ok).toBe(false);
  });

  it('normalizes NaN and Infinity in numeric fields', () => {
    const payload = coerceOverviewPayload({
      totals: { downloads: NaN, success: Infinity, fail: -Infinity }
    });
    expect(payload.totals.downloads).toBe(0);
    expect(payload.totals.success).toBe(0);
    expect(payload.totals.fail).toBe(0);
  });

  it('normalizes boolean-as-number fields to 0', () => {
    const payload = coerceOverviewPayload({
      totals: { downloads: true, success: false }
    });
    expect(payload.totals.downloads).toBe(0);
    expect(payload.totals.success).toBe(0);
  });

  it('defaults workerHealth to "down" for invalid values', () => {
    const payload = coerceOverviewPayload({
      status: { workerHealth: 'exploding' }
    });
    expect(payload.status.workerHealth).toBe('down');
  });

  it('accepts all valid workerHealth values', () => {
    for (const health of ['up', 'degraded', 'down']) {
      const payload = coerceOverviewPayload({
        status: { workerHealth: health }
      });
      expect(payload.status.workerHealth).toBe(health);
    }
  });

  it('falls back to default STORE_LINKS when links are empty', () => {
    const payload = coerceOverviewPayload({ links: {} });
    expect(payload.links.chrome).toContain('chromewebstore.google.com');
    expect(payload.links.firefox).toContain('addons.mozilla.org');
    expect(payload.links.edge).toContain('microsoftedge.microsoft.com');
    expect(payload.links.github).toContain('github.com');
  });

  it('normalizes browser objects with missing fields', () => {
    const payload = coerceOverviewPayload({
      installs: {
        browsers: [
          { key: 'chrome' },
          {},
          { key: 'firefox', usersCount: 'not-a-number' }
        ]
      }
    });
    expect(payload.installs.browsers).toHaveLength(3);
    expect(payload.installs.browsers[0]?.key).toBe('chrome');
    expect(payload.installs.browsers[0]?.usersCount).toBe(0);
    expect(payload.installs.browsers[1]?.key).toBe('');
    expect(payload.installs.browsers[2]?.usersCount).toBe(0);
  });

  it('handles browsers being a non-array', () => {
    const payload = coerceOverviewPayload({
      installs: { browsers: 'not-an-array' }
    });
    expect(payload.installs.browsers).toEqual([]);
  });
});

// ────────────────────────────────────────────────
// coerceMapPayload edge cases
// ────────────────────────────────────────────────

describe('coerceMapPayload — edge cases', () => {
  it('handles null input', () => {
    const payload = coerceMapPayload(null);
    expect(payload.ok).toBe(false);
    expect(payload.countries).toEqual([]);
  });

  it('filters out countries with zero downloads', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: [
        { countryCode: 'US', count: 50 },
        { countryCode: 'GB', count: 0 },
        { countryCode: 'DE', count: -5 }
      ]
    });
    expect(payload.countries).toHaveLength(1);
    expect(payload.countries[0]?.countryCode).toBe('US');
  });

  it('uppercases all country codes', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: [
        { countryCode: 'us', count: 10 },
        { countryCode: 'Gb', count: 5 }
      ]
    });
    expect(payload.countries.map((c) => c.countryCode)).toEqual(['US', 'GB']);
  });

  it('filters out invalid country codes (not 2 chars)', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: [
        { countryCode: 'USA', count: 10 },
        { countryCode: 'U', count: 5 },
        { countryCode: 'DE', count: 8 },
        { countryCode: '', count: 3 }
      ]
    });
    expect(payload.countries).toHaveLength(1);
    expect(payload.countries[0]?.countryCode).toBe('DE');
  });

  it('always sets granularity to "country"', () => {
    const payload = coerceMapPayload({ granularity: 'city' });
    expect(payload.granularity).toBe('country');
  });

  it('handles countries being a non-array', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: 'invalid'
    });
    expect(payload.countries).toEqual([]);
  });

  it('handles country items with missing fields', () => {
    const payload = coerceMapPayload({
      ok: true,
      countries: [
        { countryCode: 'FR' },
        { count: 10 },
        null,
        undefined
      ]
    });
    // FR has no count (defaults to 0) → filtered out
    // second has no countryCode (defaults to '') → filtered out  
    expect(payload.countries).toEqual([]);
  });
});
