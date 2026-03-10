// filepath: extension/tests/v2-readiness-gate.test.ts
/**
 * Tests for the V2 Readiness Gate.
 *
 * Tests all 7 quality gates individually, combined readiness checks,
 * verdict history, consecutive ready counting, trend detection,
 * and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ReadinessGate,
  MIN_COMPARISONS,
} from '../src/v2/compat/readiness-gate';
import type { ReadinessAssessment, GateResult } from '../src/v2/compat/readiness-gate';
import type { ShadowDiffReport, DiffSummary } from '../src/v2/compat/shadow-diff-report';
import { COVERAGE_THRESHOLD, PRECISION_THRESHOLD } from '../src/v2/compat/shadow-diff-report';
import type { BudgetSnapshot } from '../src/v2/telemetry/budget-controller';
import type { PerformanceSummary, TimingPercentiles } from '../src/v2/telemetry/performance-monitor';

// ============================================================================
// HELPERS
// ============================================================================

function makeReport(overrides: Partial<ShadowDiffReport> = {}): ShadowDiffReport {
  return {
    generatedAt: Date.now(),
    comparisonCount: 10,
    timeSpan_ms: 60000,
    overallMatchPercentage: 100,
    totalPostsAnalyzed: 50,
    totalFilesCompared: 100,
    totalMismatches: 0,
    aggregateMismatchBreakdown: {
      FILE_FOUND_BY_V1_NOT_V2: 0,
      FILE_FOUND_BY_V2_NOT_V1: 0,
      FLAG_MISMATCH: 0,
      PLACEMENT_MISMATCH: 0,
      COUNT_MISMATCH: 0,
    },
    viewKindStats: [],
    duplicateInjections: 0,
    summary: {
      buttonCoveragePass: true,
      buttonCoverage: 100,
      flagPrecisionPass: true,
      flagPrecision: 100,
      zeroDuplicatesPass: true,
      duplicateCount: 0,
      allPass: true,
      failureReasons: [],
    },
    trend: 'stable',
    uniqueMismatches: [],
    ...overrides,
  };
}

function makeBudgetSnapshot(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
  return {
    fastPassAvg_ms: 3,
    fastPassP95_ms: 5,
    cpuPerSecond_ms: 20,
    postCount: 50,
    injectedElementCount: 100,
    currentDebounce_ms: 80,
    throttleLevel: 'normal',
    violations: [],
    hardCapHit: false,
    ...overrides,
  };
}

function makePerfSummary(overrides: Partial<PerformanceSummary> = {}): PerformanceSummary {
  return {
    scanTimings: {
      count: 10,
      min: 2,
      max: 8,
      mean: 4,
      p50: 4,
      p95: 6,
      p99: 7,
    },
    mutationTimings: null,
    flagTimings: null,
    validationTimings: null,
    injectedElementCount: 100,
    traceCount: 10,
    totalTimersStored: 20,
    uptime_ms: 60000,
    ...overrides,
  };
}

// ============================================================================
// SETUP
// ============================================================================

let gate: ReadinessGate;

beforeEach(() => {
  gate = new ReadinessGate();
});

afterEach(() => {
  gate.reset();
});

// ============================================================================
// GATE 1: DATA SUFFICIENCY
// ============================================================================

describe('Gate: data sufficiency', () => {
  it('fails when no report', () => {
    const assessment = gate.assess(null);
    expect(assessment.verdict).toBe('not-ready');
    const dataSufGate = assessment.gates.find(g => g.name === 'data_sufficiency');
    expect(dataSufGate?.passed).toBe(false);
  });

  it('fails when too few comparisons', () => {
    const report = makeReport({ comparisonCount: 2 });
    const assessment = gate.assess(report);
    expect(assessment.dataAvailable).toBe(false);
  });

  it('passes with enough comparisons', () => {
    const report = makeReport({ comparisonCount: MIN_COMPARISONS });
    const assessment = gate.assess(report);
    const dataSufGate = assessment.gates.find(g => g.name === 'data_sufficiency');
    // No data sufficiency gate should be added when we have enough data
    expect(dataSufGate).toBeUndefined();
  });
});

// ============================================================================
// GATE 2: BUTTON COVERAGE
// ============================================================================

describe('Gate: button coverage', () => {
  it('passes when coverage ≥ 99.5%', () => {
    const report = makeReport({ summary: { ...makeReport().summary, buttonCoveragePass: true, buttonCoverage: 99.8 } });
    const assessment = gate.assess(report);
    const coverageGate = assessment.gates.find(g => g.name === 'button_coverage');
    expect(coverageGate?.passed).toBe(true);
  });

  it('fails when coverage < 99.5%', () => {
    const report = makeReport({
      summary: { ...makeReport().summary, buttonCoveragePass: false, buttonCoverage: 98, allPass: false, failureReasons: ['Coverage 98.0% < 99.5%'] },
    });
    const assessment = gate.assess(report);
    const coverageGate = assessment.gates.find(g => g.name === 'button_coverage');
    expect(coverageGate?.passed).toBe(false);
  });
});

// ============================================================================
// GATE 3: FLAG PRECISION
// ============================================================================

describe('Gate: flag precision', () => {
  it('passes when precision ≥ 98%', () => {
    const assessment = gate.assess(makeReport());
    const precisionGate = assessment.gates.find(g => g.name === 'flag_precision');
    expect(precisionGate?.passed).toBe(true);
  });

  it('fails when precision < 98%', () => {
    const report = makeReport({
      summary: { ...makeReport().summary, flagPrecisionPass: false, flagPrecision: 95, allPass: false, failureReasons: ['Flag precision 95.0% < 98.0%'] },
    });
    const assessment = gate.assess(report);
    const precisionGate = assessment.gates.find(g => g.name === 'flag_precision');
    expect(precisionGate?.passed).toBe(false);
  });
});

// ============================================================================
// GATE 4: ZERO DUPLICATES
// ============================================================================

describe('Gate: zero duplicates', () => {
  it('passes with 0 duplicates', () => {
    const assessment = gate.assess(makeReport());
    const dupGate = assessment.gates.find(g => g.name === 'zero_duplicates');
    expect(dupGate?.passed).toBe(true);
  });

  it('fails with any duplicates', () => {
    const report = makeReport({
      summary: { ...makeReport().summary, zeroDuplicatesPass: false, duplicateCount: 3, allPass: false, failureReasons: ['3 duplicate injections'] },
    });
    const assessment = gate.assess(report);
    const dupGate = assessment.gates.find(g => g.name === 'zero_duplicates');
    expect(dupGate?.passed).toBe(false);
  });
});

// ============================================================================
// GATE 5: NO HARD CAP
// ============================================================================

describe('Gate: no hard cap', () => {
  it('passes when no hard cap hit', () => {
    const assessment = gate.assess(makeReport(), makeBudgetSnapshot());
    const hardCapGate = assessment.gates.find(g => g.name === 'no_hard_cap');
    expect(hardCapGate?.passed).toBe(true);
  });

  it('fails when hard cap hit', () => {
    const assessment = gate.assess(makeReport(), makeBudgetSnapshot({ hardCapHit: true }));
    const hardCapGate = assessment.gates.find(g => g.name === 'no_hard_cap');
    expect(hardCapGate?.passed).toBe(false);
  });

  it('skipped when no budget snapshot', () => {
    const assessment = gate.assess(makeReport());
    const hardCapGate = assessment.gates.find(g => g.name === 'no_hard_cap');
    expect(hardCapGate).toBeUndefined();
  });
});

// ============================================================================
// GATE 6: FAST PASS TIMING
// ============================================================================

describe('Gate: fast pass timing', () => {
  it('passes when p95 < warn threshold', () => {
    const assessment = gate.assess(makeReport(), null, makePerfSummary());
    const timingGate = assessment.gates.find(g => g.name === 'fast_pass_timing');
    expect(timingGate?.passed).toBe(true);
  });

  it('fails when p95 ≥ warn threshold', () => {
    const perf = makePerfSummary({
      scanTimings: { count: 10, min: 5, max: 20, mean: 10, p50: 9, p95: 15, p99: 18 },
    });
    const assessment = gate.assess(makeReport(), null, perf);
    const timingGate = assessment.gates.find(g => g.name === 'fast_pass_timing');
    expect(timingGate?.passed).toBe(false);
  });

  it('skipped when no perf summary', () => {
    const assessment = gate.assess(makeReport());
    const timingGate = assessment.gates.find(g => g.name === 'fast_pass_timing');
    expect(timingGate).toBeUndefined();
  });

  it('skipped when no scan timings', () => {
    const perf = makePerfSummary({ scanTimings: null });
    const assessment = gate.assess(makeReport(), null, perf);
    const timingGate = assessment.gates.find(g => g.name === 'fast_pass_timing');
    expect(timingGate).toBeUndefined();
  });
});

// ============================================================================
// GATE 7: TREND NOT DEGRADING
// ============================================================================

describe('Gate: trend not degrading', () => {
  it('passes when trend is stable', () => {
    const assessment = gate.assess(makeReport({ trend: 'stable' }));
    const trendGate = assessment.gates.find(g => g.name === 'trend_not_degrading');
    expect(trendGate?.passed).toBe(true);
  });

  it('passes when trend is improving', () => {
    const assessment = gate.assess(makeReport({ trend: 'improving' }));
    const trendGate = assessment.gates.find(g => g.name === 'trend_not_degrading');
    expect(trendGate?.passed).toBe(true);
  });

  it('fails when trend is degrading', () => {
    const assessment = gate.assess(makeReport({ trend: 'degrading' }));
    const trendGate = assessment.gates.find(g => g.name === 'trend_not_degrading');
    expect(trendGate?.passed).toBe(false);
  });
});

// ============================================================================
// COMBINED VERDICT
// ============================================================================

describe('Combined verdict', () => {
  it('ready when all gates pass', () => {
    const assessment = gate.assess(makeReport(), makeBudgetSnapshot(), makePerfSummary());
    expect(assessment.verdict).toBe('ready');
    expect(assessment.failureReasons).toHaveLength(0);
  });

  it('not-ready when any gate fails', () => {
    const report = makeReport({
      summary: { ...makeReport().summary, buttonCoveragePass: false, buttonCoverage: 90, allPass: false, failureReasons: ['Coverage < 99.5%'] },
    });
    const assessment = gate.assess(report, makeBudgetSnapshot(), makePerfSummary());
    expect(assessment.verdict).toBe('not-ready');
    expect(assessment.failureReasons.length).toBeGreaterThan(0);
  });

  it('not-ready when data insufficient', () => {
    const assessment = gate.assess(null);
    expect(assessment.verdict).toBe('not-ready');
    expect(assessment.dataAvailable).toBe(false);
  });

  it('tracks passedCount and totalGates', () => {
    const assessment = gate.assess(makeReport(), makeBudgetSnapshot(), makePerfSummary());
    expect(assessment.passedCount).toBe(assessment.totalGates);
    expect(assessment.totalGates).toBeGreaterThan(0);
  });
});

// ============================================================================
// HISTORY
// ============================================================================

describe('History', () => {
  it('records assessments in history', () => {
    gate.assess(makeReport());
    gate.assess(makeReport());
    expect(gate.getHistory()).toHaveLength(2);
  });

  it('getLatest returns last assessment', () => {
    gate.assess(makeReport());
    gate.assess(makeReport({ comparisonCount: 99 }));
    const latest = gate.getLatest();
    expect(latest).not.toBeNull();
  });

  it('getLatest returns null when empty', () => {
    expect(gate.getLatest()).toBeNull();
  });

  it('limits history to 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      gate.assess(makeReport());
    }
    expect(gate.getHistory().length).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// CONSECUTIVE READY
// ============================================================================

describe('Consecutive ready count', () => {
  it('starts at 0', () => {
    expect(gate.getConsecutiveReadyCount()).toBe(0);
  });

  it('increments on consecutive ready verdicts', () => {
    gate.assess(makeReport());
    gate.assess(makeReport());
    gate.assess(makeReport());
    expect(gate.getConsecutiveReadyCount()).toBe(3);
  });

  it('resets on not-ready verdict', () => {
    gate.assess(makeReport());
    gate.assess(makeReport());
    gate.assess(makeReport({ comparisonCount: 1 })); // Not ready (insufficient data)
    expect(gate.getConsecutiveReadyCount()).toBe(0);
  });

  it('isConsistentlyReady with threshold', () => {
    gate.assess(makeReport());
    gate.assess(makeReport());
    expect(gate.isConsistentlyReady(3)).toBe(false);

    gate.assess(makeReport());
    expect(gate.isConsistentlyReady(3)).toBe(true);
  });
});

// ============================================================================
// READINESS TREND
// ============================================================================

describe('Readiness trend', () => {
  it('unknown when < 4 assessments', () => {
    gate.assess(makeReport());
    expect(gate.getReadinessTrend()).toBe('unknown');
  });

  it('stable when pass rate is consistent', () => {
    for (let i = 0; i < 4; i++) {
      gate.assess(makeReport());
    }
    expect(gate.getReadinessTrend()).toBe('stable');
  });

  it('degrading when pass rate drops', () => {
    gate.assess(makeReport()); // All gates pass
    gate.assess(makeReport()); // All gates pass
    // Make gates fail for the last two
    gate.assess(makeReport({ comparisonCount: 1 })); // Not ready
    gate.assess(makeReport({ comparisonCount: 1 })); // Not ready
    expect(gate.getReadinessTrend()).toBe('degrading');
  });
});

// ============================================================================
// RESET
// ============================================================================

describe('Reset', () => {
  it('clears all history', () => {
    gate.assess(makeReport());
    gate.assess(makeReport());
    gate.reset();
    expect(gate.getHistory()).toHaveLength(0);
    expect(gate.getLatest()).toBeNull();
    expect(gate.getConsecutiveReadyCount()).toBe(0);
  });
});
