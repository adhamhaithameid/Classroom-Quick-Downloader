import { describe, expect, it, vi } from 'vitest';
import { resolveUpdatePill, type NotificationRule } from '../entrypoints/utils/changelog';

const base: NotificationRule = {
  id: 'manual-rule',
  target: 'all',
  priority: 'minor',
  effect: 'glow',
};

describe('resolveUpdatePill (08fg.3)', () => {
  it('returns a major pulse while a newer version is unseen', () => {
    const rule = resolveUpdatePill({
      latestVersion: '1.9.4',
      installedVersion: '1.9.3',
      latestSeen: false,
      baseRule: base,
    });
    expect(rule).toEqual({
      id: 'update-available',
      target: 'all',
      priority: 'major',
      effect: 'pulse',
    });
  });

  it('falls back to the base rule when dismissed, equal, or unknown', () => {
    const cases: Array<Parameters<typeof resolveUpdatePill>[0]> = [
      {
        latestVersion: '1.9.4',
        installedVersion: '1.9.3',
        latestSeen: true,
        baseRule: base,
      },
      {
        latestVersion: '1.9.3',
        installedVersion: '1.9.3',
        latestSeen: false,
        baseRule: base,
      },
      {
        latestVersion: null,
        installedVersion: '1.9.3',
        latestSeen: false,
        baseRule: base,
      },
    ];
    for (const input of cases) expect(resolveUpdatePill(input)).toBe(base);
  });
});
