// W3: uninstall URL stats params — pure builders extracted into flush.ts so
// the 500-char cap logic is testable without chrome. The background entrypoint
// stays a thin caller (loadStats + buildUninstallUrl + setUninstallURL).
import { describe, expect, it } from 'vitest';
import {
  buildUninstallStatsParams,
  buildUninstallUrl,
} from '../entrypoints/utils/analytics/flush';

describe('buildUninstallStatsParams', () => {
  it('includes d/a params from stats', () => {
    const params = buildUninstallStatsParams({ total: 42, attempts: 57 });
    expect(params.get('d')).toBe('42');
    expect(params.get('a')).toBe('57');
  });

  it('emits d=0&a=0 for missing/undefined stats', () => {
    expect(buildUninstallStatsParams({}).get('d')).toBe('0');
    expect(buildUninstallStatsParams({}).get('a')).toBe('0');
    expect(buildUninstallStatsParams({ total: undefined, attempts: undefined }).get('d')).toBe('0');
  });

  it('coerces NaN and negatives to 0 and floors floats', () => {
    const params = buildUninstallStatsParams({
      total: Number.NaN,
      attempts: -3,
    });
    expect(params.get('d')).toBe('0');
    expect(params.get('a')).toBe('0');

    const floatParams = buildUninstallStatsParams({ total: 7.9, attempts: -0.5 });
    expect(floatParams.get('d')).toBe('7');
    expect(floatParams.get('a')).toBe('0');
  });
});

describe('buildUninstallUrl', () => {
  const BASE = 'https://example.com/uninstall';

  it('assembles source/browser/version plus stats params', () => {
    const url = new URL(
      buildUninstallUrl(BASE, {
        source: 'extension',
        browser: 'chrome',
        version: '1.3.0',
        stats: { total: 12, attempts: 15 },
      })
    );
    expect(url.origin + url.pathname).toBe(BASE);
    expect(url.searchParams.get('source')).toBe('extension');
    expect(url.searchParams.get('browser')).toBe('chrome');
    expect(url.searchParams.get('version')).toBe('1.3.0');
    expect(url.searchParams.get('d')).toBe('12');
    expect(url.searchParams.get('a')).toBe('15');
  });

  it('keeps d/a when the final URL is within the 500-char cap', () => {
    const url = new URL(
      buildUninstallUrl(BASE, {
        source: 'extension',
        browser: 'firefox',
        version: '1.2.3',
        stats: { total: 3, attempts: 4 },
      })
    );
    expect(url.toString().length).toBeLessThanOrEqual(500);
    expect(url.searchParams.get('d')).toBe('3');
    expect(url.searchParams.get('a')).toBe('4');
  });

  it('drops only d/a when the final URL exceeds 500 chars; source/browser/version survive', () => {
    // A pathologically long version string pushes the URL past the cap.
    const longVersion = 'v'.repeat(480);
    const full = buildUninstallUrl(BASE, {
      source: 'extension',
      browser: 'edge',
      version: longVersion,
      stats: { total: 99, attempts: 100 },
    });
    expect(full.length).toBeGreaterThan(500);

    const url = new URL(full);
    expect(url.searchParams.get('source')).toBe('extension');
    expect(url.searchParams.get('browser')).toBe('edge');
    expect(url.searchParams.get('version')).toBe(longVersion);
    expect(url.searchParams.has('d')).toBe(false);
    expect(url.searchParams.has('a')).toBe(false);
  });

  it('treats missing stats as zeros without breaking the URL', () => {
    const url = new URL(
      buildUninstallUrl(BASE, {
        source: 'extension',
        browser: 'chrome',
        version: '1.0.0',
      })
    );
    expect(url.searchParams.get('d')).toBe('0');
    expect(url.searchParams.get('a')).toBe('0');
  });
});
