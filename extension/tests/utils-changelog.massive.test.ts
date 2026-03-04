import { describe, expect, it } from 'vitest';
import type { ChangelogConfig, NotificationRule } from '../entrypoints/utils/changelog';
import { getMatchingRule, getRuleClasses } from '../entrypoints/utils/changelog';

function makeRule(id: string, target: string, priority: NotificationRule['priority'], effect: NotificationRule['effect']): NotificationRule {
  return { id, target, priority, effect };
}

const matchingCases = Array.from({ length: 520 }, (_, idx) => {
  const major = `1.${Math.floor(idx / 10)}.${idx % 10}`;
  const exactRule = makeRule(`exact-${idx}`, major, idx % 2 === 0 ? 'major' : 'minor', idx % 3 === 0 ? 'pulse' : 'glow');
  const allRule = makeRule(`all-${idx}`, 'all', 'normal', 'none');
  const cfg: ChangelogConfig = { rules: [exactRule, allRule] };
  return { cfg, version: major, expected: exactRule.id };
});

const fallbackCases = Array.from({ length: 520 }, (_, idx) => {
  const major = `9.${Math.floor(idx / 10)}.${idx % 10}`;
  const cfg: ChangelogConfig = {
    rules: [
      makeRule(`exact-${idx}`, `1.${Math.floor(idx / 10)}.${idx % 10}`, 'major', 'pulse'),
      makeRule(`all-${idx}`, 'all', 'minor', 'glow'),
    ],
  };
  return { cfg, version: major, expected: `all-${idx}` };
});

const classCases = Array.from({ length: 520 }, (_, idx) => {
  const priority: NotificationRule['priority'] = idx % 3 === 0 ? 'major' : idx % 3 === 1 ? 'minor' : 'normal';
  const effect: NotificationRule['effect'] = idx % 2 === 0 ? 'pulse' : 'glow';
  return {
    rule: makeRule(`rule-${idx}`, 'all', priority, effect),
    seen: idx % 11 === 0,
    expects: {
      major: priority === 'major',
      minor: priority === 'minor',
      pulse: effect === 'pulse' && priority === 'major',
      glow: effect === 'glow' && priority === 'major',
    },
  };
});

describe('changelog utils massive matrix', () => {
  it.each(matchingCases)('selects exact version rule #%#', ({ cfg, version, expected }) => {
    expect(getMatchingRule(cfg, version)?.id).toBe(expected);
  });

  it.each(fallbackCases)('falls back to all rule #%#', ({ cfg, version, expected }) => {
    expect(getMatchingRule(cfg, version)?.id).toBe(expected);
  });

  it.each(classCases)('builds rule classes deterministically #%#', ({ rule, seen, expects }) => {
    const classes = getRuleClasses(rule, seen);
    if (seen) {
      expect(classes).toBe('');
      return;
    }
    if (expects.major) expect(classes).toContain('cqd-pill-major');
    if (expects.minor) expect(classes).toContain('cqd-pill-minor');
    if (expects.pulse) expect(classes).toContain('cqd-effect-pulse-red');
    if (expects.glow) expect(classes).toContain('cqd-effect-glow-red');
    if (!expects.major && !expects.minor) expect(classes.includes('cqd-pill-')).toBe(false);
  });
});
