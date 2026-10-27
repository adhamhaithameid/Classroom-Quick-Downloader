import { describe, expect, it } from 'vitest';
import { UPDATE_PILL_RULE, type NotificationRule } from '../entrypoints/utils/changelog';
import { updateTarget } from '../src/update/update-state';

const base: NotificationRule = {
  id: 'manual-rule',
  target: 'all',
  priority: 'minor',
  effect: 'glow',
};

/** The pill contract: UPDATE_PILL_RULE while the dot has a target. */
function pillFor(input: Parameters<typeof updateTarget>[0]): NotificationRule {
  const target = updateTarget(input);
  return target.version ? UPDATE_PILL_RULE : base;
}

describe('update pill (08fg.3)', () => {
  it('pulses for every update reason', () => {
    const installed = '1.9.3';
    const reasons: Array<Parameters<typeof updateTarget>[0]> = [
      // available: newer unseen live release
      { pendingVersion: null, latestVersion: '1.9.4', installedVersion: installed, seenVersions: {} },
      // updated: browser just applied an update
      { pendingVersion: '1.9.3', latestVersion: null, installedVersion: installed, seenVersions: {} },
      // scheduled: browser queued a newer version
      { pendingVersion: '1.9.5', latestVersion: '1.9.5', installedVersion: installed, seenVersions: {} },
    ];
    for (const input of reasons) {
      expect(pillFor(input)).toEqual(UPDATE_PILL_RULE);
      expect(UPDATE_PILL_RULE.effect).toBe('pulse');
      expect(UPDATE_PILL_RULE.priority).toBe('major');
    }
  });

  it('falls back to the base rule when dismissed, equal, or unknown', () => {
    const cases: Array<Parameters<typeof updateTarget>[0]> = [
      { pendingVersion: null, latestVersion: '1.9.4', installedVersion: '1.9.3', seenVersions: { '1.9.4': 'tok' } },
      { pendingVersion: '1.9.4', latestVersion: null, installedVersion: '1.9.4', seenVersions: { '1.9.4': 'tok' } },
      { pendingVersion: null, latestVersion: '1.9.3', installedVersion: '1.9.3', seenVersions: {} },
      { pendingVersion: null, latestVersion: null, installedVersion: '1.9.3', seenVersions: {} },
    ];
    for (const input of cases) expect(pillFor(input)).toBe(base);
  });
});
