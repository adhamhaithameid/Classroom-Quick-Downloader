import { describe, it, expect } from 'vitest';
import {
  getMatchingRule,
  getRuleClasses,
  ChangelogConfig,
  NotificationRule
} from '../entrypoints/utils/changelog';

// ============================================================================
// getMatchingRule TESTS
// ============================================================================

describe('getMatchingRule', () => {
  const exactRule: NotificationRule = {
    id: 'rule-exact',
    target: '1.2.3',
    priority: 'major',
    effect: 'pulse'
  };

  const wildcardRule: NotificationRule = {
    id: 'rule-all',
    target: 'all',
    priority: 'normal',
    effect: 'glow'
  };

  const otherRule: NotificationRule = {
    id: 'rule-other',
    target: '2.0.0',
    priority: 'minor',
    effect: 'none'
  };

  it('should return null if config is undefined', () => {
    expect(getMatchingRule(undefined, '1.2.3')).toBeNull();
  });

  it('should return null if config rules are empty', () => {
    const config: ChangelogConfig = { rules: [] };
    expect(getMatchingRule(config, '1.2.3')).toBeNull();
  });

  it('should return null if config rules are undefined', () => {
    const config = { lastUpdated: 123 } as ChangelogConfig;
    expect(getMatchingRule(config, '1.2.3')).toBeNull();
  });

  it('should match an exact version', () => {
    const config: ChangelogConfig = { rules: [otherRule, exactRule] };
    expect(getMatchingRule(config, '1.2.3')).toEqual(exactRule);
  });

  it('should match wildcard "all" if no exact match', () => {
    const config: ChangelogConfig = { rules: [otherRule, wildcardRule] };
    expect(getMatchingRule(config, '1.5.0')).toEqual(wildcardRule);
  });

  it('should prioritize exact match over wildcard', () => {
    const config: ChangelogConfig = { rules: [wildcardRule, exactRule] };
    // Even if wildcard comes first in the array, exact match logic should run first
    expect(getMatchingRule(config, '1.2.3')).toEqual(exactRule);
  });

  it('should return null if no rule matches', () => {
    const config: ChangelogConfig = { rules: [otherRule] };
    expect(getMatchingRule(config, '1.5.0')).toBeNull();
  });
});

// ============================================================================
// getRuleClasses TESTS
// ============================================================================

describe('getRuleClasses', () => {
  const baseRule: NotificationRule = {
    id: 'test',
    target: 'all',
    priority: 'normal',
    effect: 'none'
  };

  it('should return empty string if rule is null', () => {
    expect(getRuleClasses(null, false)).toBe('');
  });

  it('should return empty string if notification is seen', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'major', effect: 'pulse' };
    expect(getRuleClasses(rule, true)).toBe('');
  });

  it('should return correct class for minor priority', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'minor' };
    expect(getRuleClasses(rule, false)).toBe('cqd-pill-minor');
  });

  it('should return correct class for major priority', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'major' };
    expect(getRuleClasses(rule, false)).toBe('cqd-pill-major');
  });

  it('should handle glow effect with minor priority (blue)', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'minor', effect: 'glow' };
    expect(getRuleClasses(rule, false)).toContain('cqd-pill-minor');
    expect(getRuleClasses(rule, false)).toContain('cqd-effect-glow-blue');
  });

  it('should handle glow effect with major priority (red)', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'major', effect: 'glow' };
    expect(getRuleClasses(rule, false)).toContain('cqd-pill-major');
    expect(getRuleClasses(rule, false)).toContain('cqd-effect-glow-red');
  });

  it('should handle pulse effect with minor priority (blue)', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'minor', effect: 'pulse' };
    expect(getRuleClasses(rule, false)).toContain('cqd-pill-minor');
    expect(getRuleClasses(rule, false)).toContain('cqd-effect-pulse-blue');
  });

  it('should handle pulse effect with major priority (red)', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'major', effect: 'pulse' };
    expect(getRuleClasses(rule, false)).toContain('cqd-pill-major');
    expect(getRuleClasses(rule, false)).toContain('cqd-effect-pulse-red');
  });

  it('should combine classes with space', () => {
    const rule: NotificationRule = { ...baseRule, priority: 'major', effect: 'pulse' };
    const classes = getRuleClasses(rule, false);
    expect(classes).toBe('cqd-pill-major cqd-effect-pulse-red');
  });
});
