import { describe, expect, it } from 'vitest';
import { parseUninstallStatsParams } from './uninstallParams';

// W3: the extension appends compact download totals (d/a) to the uninstall
// URL; the uninstall page parses them back into the telemetry event meta.
describe('uninstall stats params parsing', () => {
  it('parses d/a into downloads and attempts', () => {
    const parsed = parseUninstallStatsParams(new URLSearchParams('d=42&a=57'));
    expect(parsed).toEqual({ downloads: 42, attempts: 57 });
  });

  it('defaults missing params to zero', () => {
    expect(parseUninstallStatsParams(new URLSearchParams(''))).toEqual({
      downloads: 0,
      attempts: 0
    });
    expect(parseUninstallStatsParams(new URLSearchParams('d=7'))).toEqual({
      downloads: 7,
      attempts: 0
    });
  });

  it('coerces non-numeric, negative, and float values to safe integers', () => {
    expect(parseUninstallStatsParams(new URLSearchParams('d=abc&a=-5'))).toEqual({
      downloads: 0,
      attempts: 0
    });
    expect(parseUninstallStatsParams(new URLSearchParams('d=3.9&a=-0.5'))).toEqual({
      downloads: 3,
      attempts: 0
    });
  });
});
