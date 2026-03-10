// filepath: extension/tests/v2-budget-controller.test.ts
/**
 * Tests for the V2 Budget Controller.
 *
 * Tests CPU budgets, memory budgets, dynamic throttling,
 * violation tracking, and budget snapshots.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BudgetController,
  CPU_BUDGETS,
  MEMORY_BUDGETS,
  THROTTLE,
} from '../src/v2/telemetry/budget-controller';
import type { BudgetSnapshot, ThrottleLevel, BudgetViolation } from '../src/v2/telemetry/budget-controller';

// ============================================================================
// SETUP
// ============================================================================

let bc: BudgetController;

beforeEach(() => {
  bc = new BudgetController();
});

afterEach(() => {
  bc.reset();
});

// ============================================================================
// FAST PASS BUDGET
// ============================================================================

describe('Fast pass budget', () => {
  it('returns "ok" for durations under warn threshold', () => {
    expect(bc.recordFastPass(3)).toBe('ok');
    expect(bc.recordFastPass(5)).toBe('ok');
  });

  it('returns "warn" for durations at warn threshold', () => {
    expect(bc.recordFastPass(CPU_BUDGETS.FAST_PASS_WARN)).toBe('warn');
  });

  it('returns "warn" for durations between warn and abort', () => {
    expect(bc.recordFastPass(10)).toBe('warn');
    expect(bc.recordFastPass(14)).toBe('warn');
  });

  it('returns "abort" for durations at abort threshold', () => {
    expect(bc.recordFastPass(CPU_BUDGETS.FAST_PASS_ABORT)).toBe('abort');
  });

  it('returns "abort" for durations above abort threshold', () => {
    expect(bc.recordFastPass(20)).toBe('abort');
  });

  it('records violation for warn', () => {
    bc.recordFastPass(10);
    const violations = bc.getViolations();
    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe('fast_pass_warn');
    expect(violations[0].level).toBe('warning');
  });

  it('records violation for abort', () => {
    bc.recordFastPass(20);
    const violations = bc.getViolations();
    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe('fast_pass_abort');
    expect(violations[0].level).toBe('critical');
  });

  it('no violation for ok', () => {
    bc.recordFastPass(3);
    expect(bc.getViolations().length).toBe(0);
  });
});

// ============================================================================
// DEEP PASS BUDGET
// ============================================================================

describe('Deep pass budget', () => {
  it('returns true when within budget', () => {
    expect(bc.recordDeepPass(15)).toBe(true);
    expect(bc.recordDeepPass(25)).toBe(true);
  });

  it('returns false when exceeding budget', () => {
    expect(bc.recordDeepPass(30)).toBe(false);
  });

  it('records violation when exceeded', () => {
    bc.recordDeepPass(30);
    const violation = bc.getViolations().find(v => v.type === 'deep_pass_exceeded');
    expect(violation).toBeDefined();
  });
});

// ============================================================================
// MEMORY BUDGET — Post Count
// ============================================================================

describe('Memory budget — post count', () => {
  it('returns "ok" for low post counts', () => {
    expect(bc.updatePostCount(100)).toBe('ok');
    expect(bc.updatePostCount(499)).toBe('ok');
  });

  it('returns "warn" at warning threshold', () => {
    expect(bc.updatePostCount(500)).toBe('warn');
  });

  it('returns "warn" between warn and hard cap', () => {
    expect(bc.updatePostCount(750)).toBe('warn');
  });

  it('returns "cap" at hard cap', () => {
    expect(bc.updatePostCount(1000)).toBe('cap');
  });

  it('sets hard cap flag', () => {
    bc.updatePostCount(1000);
    expect(bc.isHardCapHit()).toBe(true);
  });

  it('hard cap is NOT set at warning level', () => {
    bc.updatePostCount(500);
    expect(bc.isHardCapHit()).toBe(false);
  });
});

// ============================================================================
// MEMORY BUDGET — Injected Elements
// ============================================================================

describe('Memory budget — injected elements', () => {
  it('returns "ok" for low counts', () => {
    expect(bc.checkInjectedElements(100)).toBe('ok');
    expect(bc.checkInjectedElements(1499)).toBe('ok');
  });

  it('returns "warn" at warning threshold', () => {
    expect(bc.checkInjectedElements(1500)).toBe('warn');
  });

  it('returns "cap" at hard cap', () => {
    expect(bc.checkInjectedElements(2000)).toBe('cap');
  });
});

// ============================================================================
// DYNAMIC THROTTLING
// ============================================================================

describe('Dynamic throttling', () => {
  it('starts at normal throttle level', () => {
    expect(bc.getThrottleLevel()).toBe('normal');
    expect(bc.getDebounceMs()).toBe(THROTTLE.DEBOUNCE_DEFAULT);
  });

  it('elevates throttle at 100+ posts', () => {
    bc.updatePostCount(100);
    expect(bc.getThrottleLevel()).toBe('elevated');
    expect(bc.getDebounceMs()).toBe(THROTTLE.DEBOUNCE_ELEVATED);
  });

  it('escalates on fast pass abort', () => {
    bc.recordFastPass(20); // Abort triggers escalation
    expect(bc.getThrottleLevel()).toBe('elevated');
  });

  it('escalates step by step', () => {
    bc.setThrottleLevel('normal');
    bc.recordFastPass(20); // → elevated
    expect(bc.getThrottleLevel()).toBe('elevated');

    bc.recordFastPass(20); // → high
    expect(bc.getThrottleLevel()).toBe('high');

    bc.recordFastPass(20); // → critical
    expect(bc.getThrottleLevel()).toBe('critical');

    bc.recordFastPass(20); // → stays critical
    expect(bc.getThrottleLevel()).toBe('critical');
  });

  it('debounce increases with throttle level', () => {
    bc.setThrottleLevel('normal');
    expect(bc.getDebounceMs()).toBe(80);

    bc.setThrottleLevel('elevated');
    expect(bc.getDebounceMs()).toBe(200);

    bc.setThrottleLevel('high');
    expect(bc.getDebounceMs()).toBe(400);

    bc.setThrottleLevel('critical');
    expect(bc.getDebounceMs()).toBe(800);
  });
});

// ============================================================================
// BUDGET SNAPSHOT
// ============================================================================

describe('Budget snapshot', () => {
  it('returns all fields', () => {
    const snapshot = bc.getBudgetSnapshot();
    expect(snapshot).toHaveProperty('fastPassAvg_ms');
    expect(snapshot).toHaveProperty('fastPassP95_ms');
    expect(snapshot).toHaveProperty('cpuPerSecond_ms');
    expect(snapshot).toHaveProperty('postCount');
    expect(snapshot).toHaveProperty('injectedElementCount');
    expect(snapshot).toHaveProperty('currentDebounce_ms');
    expect(snapshot).toHaveProperty('throttleLevel');
    expect(snapshot).toHaveProperty('violations');
    expect(snapshot).toHaveProperty('hardCapHit');
  });

  it('reflects current state', () => {
    bc.recordFastPass(5);
    bc.recordFastPass(7);
    bc.updatePostCount(200);

    const snapshot = bc.getBudgetSnapshot();
    expect(snapshot.fastPassAvg_ms).toBe(6);
    expect(snapshot.postCount).toBe(200);
    expect(snapshot.throttleLevel).toBe('elevated');
  });

  it('includes violations', () => {
    bc.recordFastPass(20);
    const snapshot = bc.getBudgetSnapshot();
    expect(snapshot.violations.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// shouldProceedFastPass
// ============================================================================

describe('shouldProceedFastPass', () => {
  it('returns true normally', () => {
    expect(bc.shouldProceedFastPass()).toBe(true);
  });

  it('returns false when hard cap hit', () => {
    bc.updatePostCount(1000);
    expect(bc.shouldProceedFastPass()).toBe(false);
  });
});

// ============================================================================
// RESET
// ============================================================================

describe('Reset', () => {
  it('resets all state', () => {
    bc.recordFastPass(20);
    bc.updatePostCount(1000);

    bc.reset();

    expect(bc.getThrottleLevel()).toBe('normal');
    expect(bc.isHardCapHit()).toBe(false);
    expect(bc.getViolations().length).toBe(0);
    expect(bc.shouldProceedFastPass()).toBe(true);

    const snapshot = bc.getBudgetSnapshot();
    expect(snapshot.fastPassAvg_ms).toBe(0);
    expect(snapshot.postCount).toBe(0);
  });
});

// ============================================================================
// CONSTANTS ACCESS
// ============================================================================

describe('Constants', () => {
  it('CPU_BUDGETS has expected values', () => {
    expect(CPU_BUDGETS.FAST_PASS_WARN).toBe(8);
    expect(CPU_BUDGETS.FAST_PASS_ABORT).toBe(15);
    expect(CPU_BUDGETS.FAST_PASS_TARGET).toBe(6);
    expect(CPU_BUDGETS.DEEP_PASS_MAX).toBe(25);
    expect(CPU_BUDGETS.CPU_PER_SECOND_MAX).toBe(50);
  });

  it('MEMORY_BUDGETS has expected values', () => {
    expect(MEMORY_BUDGETS.POST_COUNT_WARN).toBe(500);
    expect(MEMORY_BUDGETS.POST_COUNT_HARD_CAP).toBe(1000);
    expect(MEMORY_BUDGETS.INJECTED_WARN).toBe(1500);
    expect(MEMORY_BUDGETS.INJECTED_HARD_CAP).toBe(2000);
  });

  it('THROTTLE has expected values', () => {
    expect(THROTTLE.DEBOUNCE_DEFAULT).toBe(80);
    expect(THROTTLE.DEBOUNCE_ELEVATED).toBe(200);
    expect(THROTTLE.POST_COUNT_THRESHOLD).toBe(100);
  });
});
