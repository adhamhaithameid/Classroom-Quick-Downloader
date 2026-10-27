import { describe, expect, it } from 'vitest';
import {
  isNewerVersion,
  latestVersionFrom,
  shouldShowDot,
} from '../src/update/update-state';

describe('update-state', () => {
  it('compares versions numerically and tolerates a v prefix', () => {
    expect(isNewerVersion('1.9.4', '1.9.3')).toBe(true);
    expect(isNewerVersion('v1.9.4', '1.9.3')).toBe(true);
    expect(isNewerVersion('1.9.3', '1.9.3')).toBe(false);
    expect(isNewerVersion('1.9.2', '1.9.10')).toBe(false);
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
  });

  it('picks the newest entry version and handles junk entries', () => {
    expect(
      latestVersionFrom([{ version: '1.9.1' }, { version: '1.9.4' }, { version: '1.9.3' }]),
    ).toBe('1.9.4');
    expect(latestVersionFrom([{ version: '' }, {} as { version: string }])).toBeNull();
    expect(latestVersionFrom([])).toBeNull();
  });

  it('shows the dot only for a newer, unseen latest version', () => {
    expect(
      shouldShowDot({ latestVersion: '1.9.4', installedVersion: '1.9.3', seenVersions: {} }),
    ).toBe(true);
    expect(
      shouldShowDot({ latestVersion: '1.9.3', installedVersion: '1.9.3', seenVersions: {} }),
    ).toBe(false);
    expect(
      shouldShowDot({ latestVersion: '1.9.2', installedVersion: '1.9.3', seenVersions: {} }),
    ).toBe(false);
    // The user opened the changelog for the latest version → dismissed.
    expect(
      shouldShowDot({
        latestVersion: '1.9.4',
        installedVersion: '1.9.3',
        seenVersions: { '1.9.4': 'tok' },
      }),
    ).toBe(false);
    // Seeing an OLDER version does not dismiss the latest.
    expect(
      shouldShowDot({
        latestVersion: '1.9.4',
        installedVersion: '1.9.3',
        seenVersions: { '1.9.3': 'tok' },
      }),
    ).toBe(true);
    expect(
      shouldShowDot({ latestVersion: null, installedVersion: '1.9.3', seenVersions: {} }),
    ).toBe(false);
  });
});
