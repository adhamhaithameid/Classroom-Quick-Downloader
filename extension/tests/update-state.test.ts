import { describe, expect, it } from 'vitest';
import {
  isNewerVersion,
  latestVersionFrom,
  updateTarget,
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

  it('targets a pending version (just updated) until it is seen', () => {
    expect(
      updateTarget({
        pendingVersion: '1.9.4',
        latestVersion: null,
        installedVersion: '1.9.4',
        seenVersions: {},
      }),
    ).toEqual({ version: '1.9.4', reason: 'updated' });
    expect(
      updateTarget({
        pendingVersion: '1.9.4',
        latestVersion: null,
        installedVersion: '1.9.4',
        seenVersions: { '1.9.4': 'tok' },
      }),
    ).toEqual({ version: null, reason: null });
  });

  it('targets a pending scheduled version that differs from the install', () => {
    expect(
      updateTarget({
        pendingVersion: '1.9.5',
        latestVersion: '1.9.5',
        installedVersion: '1.9.3',
        seenVersions: {},
      }),
    ).toEqual({ version: '1.9.5', reason: 'scheduled' });
  });

  it('falls through a seen pending version to a newer unseen live latest', () => {
    expect(
      updateTarget({
        pendingVersion: '1.9.4',
        latestVersion: '1.9.5',
        installedVersion: '1.9.3',
        seenVersions: { '1.9.4': 'tok' },
      }),
    ).toEqual({ version: '1.9.5', reason: 'available' });
  });

  it('targets the live latest only when newer and unseen', () => {
    expect(
      updateTarget({
        pendingVersion: null,
        latestVersion: '1.9.4',
        installedVersion: '1.9.3',
        seenVersions: {},
      }),
    ).toEqual({ version: '1.9.4', reason: 'available' });
    expect(
      updateTarget({
        pendingVersion: null,
        latestVersion: '1.9.3',
        installedVersion: '1.9.3',
        seenVersions: {},
      }),
    ).toEqual({ version: null, reason: null });
    expect(
      updateTarget({
        pendingVersion: null,
        latestVersion: '1.9.4',
        installedVersion: '1.9.3',
        seenVersions: { '1.9.4': 'tok' },
      }),
    ).toEqual({ version: null, reason: null });
    expect(
      updateTarget({
        pendingVersion: null,
        latestVersion: '1.9.2',
        installedVersion: '1.9.3',
        seenVersions: {},
      }),
    ).toEqual({ version: null, reason: null });
  });
});
