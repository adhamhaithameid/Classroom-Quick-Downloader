// filepath: extension/tests/v2-shadow-diff-report.test.ts
/**
 * Tests for the V2 Shadow Diff Report generator.
 *
 * Tests report aggregation, quality gate summaries, per-ViewKind stats,
 * trend detection, mismatch deduplication, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDiffReport,
  serializeDiffReport,
  COVERAGE_THRESHOLD,
  PRECISION_THRESHOLD,
} from '../src/v2/compat/shadow-diff-report';
import type { ShadowDiffReport, DiffSummary } from '../src/v2/compat/shadow-diff-report';
import type {
  ShadowCompareResult,
  MismatchType,
  Mismatch,
} from '../src/v2/compat/shadow-compare';
import { ViewKind } from '../src/engines/types';

// ============================================================================
// HELPERS
// ============================================================================

function makeResult(overrides: Partial<ShadowCompareResult> = {}): ShadowCompareResult {
  return {
    timestamp: Date.now(),
    duration_ms: 5,
    postsAnalyzed: 10,
    filesCompared: 20,
    mismatchCount: 0,
    mismatchBreakdown: {
      FILE_FOUND_BY_V1_NOT_V2: 0,
      FILE_FOUND_BY_V2_NOT_V1: 0,
      FLAG_MISMATCH: 0,
      PLACEMENT_MISMATCH: 0,
      COUNT_MISMATCH: 0,
    },
    mismatches: [],
    matchPercentage: 100,
    ...overrides,
  };
}

function makeMismatch(overrides: Partial<Mismatch> = {}): Mismatch {
  return {
    type: 'FILE_FOUND_BY_V1_NOT_V2',
    postId: 'post-1',
    fileId: 'file-1',
    v1State: 'button present',
    v2State: 'no button',
    details: 'Test mismatch',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// EMPTY REPORTS
// ============================================================================

describe('Empty report', () => {
  it('returns empty report for no results', () => {
    const report = generateDiffReport([]);
    expect(report.comparisonCount).toBe(0);
    expect(report.summary.allPass).toBe(false);
    expect(report.summary.failureReasons).toContain('No comparison data available');
  });

  it('empty report has zero totals', () => {
    const report = generateDiffReport([]);
    expect(report.totalPostsAnalyzed).toBe(0);
    expect(report.totalFilesCompared).toBe(0);
    expect(report.totalMismatches).toBe(0);
  });

  it('empty report tracks duplicate count', () => {
    const report = generateDiffReport([], 3);
    expect(report.duplicateInjections).toBe(3);
    expect(report.summary.zeroDuplicatesPass).toBe(false);
    expect(report.summary.duplicateCount).toBe(3);
  });

  it('empty report with 0 duplicates passes that gate', () => {
    const report = generateDiffReport([], 0);
    expect(report.summary.zeroDuplicatesPass).toBe(true);
  });
});

// ============================================================================
// SINGLE RESULT REPORT
// ============================================================================

describe('Single result report', () => {
  it('generates report from one perfect result', () => {
    const result = makeResult({ matchPercentage: 100, postsAnalyzed: 5, filesCompared: 10 });
    const report = generateDiffReport([result]);

    expect(report.comparisonCount).toBe(1);
    expect(report.overallMatchPercentage).toBe(100);
    expect(report.totalPostsAnalyzed).toBe(5);
    expect(report.totalFilesCompared).toBe(10);
  });

  it('passes all gates for perfect result with 0 duplicates', () => {
    const result = makeResult({ matchPercentage: 100, postsAnalyzed: 5, filesCompared: 10 });
    const report = generateDiffReport([result], 0);

    expect(report.summary.buttonCoveragePass).toBe(true);
    expect(report.summary.flagPrecisionPass).toBe(true);
    expect(report.summary.zeroDuplicatesPass).toBe(true);
    expect(report.summary.allPass).toBe(true);
    expect(report.summary.failureReasons).toHaveLength(0);
  });
});

// ============================================================================
// AGGREGATED REPORTS
// ============================================================================

describe('Aggregated reports', () => {
  it('sums totals from multiple results', () => {
    const results = [
      makeResult({ postsAnalyzed: 5, filesCompared: 10 }),
      makeResult({ postsAnalyzed: 8, filesCompared: 15 }),
      makeResult({ postsAnalyzed: 3, filesCompared: 5 }),
    ];

    const report = generateDiffReport(results);
    expect(report.comparisonCount).toBe(3);
    expect(report.totalPostsAnalyzed).toBe(16);
    expect(report.totalFilesCompared).toBe(30);
  });

  it('averages match percentage', () => {
    const results = [
      makeResult({ matchPercentage: 100 }),
      makeResult({ matchPercentage: 98 }),
      makeResult({ matchPercentage: 96 }),
    ];

    const report = generateDiffReport(results);
    expect(report.overallMatchPercentage).toBeCloseTo(98, 0);
  });

  it('aggregates mismatch breakdowns', () => {
    const results = [
      makeResult({
        mismatchCount: 2,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 1, FILE_FOUND_BY_V2_NOT_V1: 1, FLAG_MISMATCH: 0, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
      }),
      makeResult({
        mismatchCount: 1,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 0, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 1, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
      }),
    ];

    const report = generateDiffReport(results);
    expect(report.aggregateMismatchBreakdown.FILE_FOUND_BY_V1_NOT_V2).toBe(1);
    expect(report.aggregateMismatchBreakdown.FILE_FOUND_BY_V2_NOT_V1).toBe(1);
    expect(report.aggregateMismatchBreakdown.FLAG_MISMATCH).toBe(1);
    expect(report.totalMismatches).toBe(3);
  });

  it('computes time span', () => {
    const results = [
      makeResult({ timestamp: 1000 }),
      makeResult({ timestamp: 5000 }),
      makeResult({ timestamp: 11000 }),
    ];

    const report = generateDiffReport(results);
    expect(report.timeSpan_ms).toBe(10000);
  });
});

// ============================================================================
// BUTTON COVERAGE
// ============================================================================

describe('Button coverage', () => {
  it('100% when no file mismatches', () => {
    const report = generateDiffReport([makeResult({ filesCompared: 50 })]);
    expect(report.summary.buttonCoverage).toBe(100);
    expect(report.summary.buttonCoveragePass).toBe(true);
  });

  it('drops with FILE_FOUND_BY_V1_NOT_V2 mismatches', () => {
    const report = generateDiffReport([
      makeResult({
        filesCompared: 100,
        mismatchCount: 2,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 2, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 0, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
      }),
    ]);
    expect(report.summary.buttonCoverage).toBe(98);
    expect(report.summary.buttonCoveragePass).toBe(false); // < 99.5%
  });

  it('drops with COUNT_MISMATCH', () => {
    const report = generateDiffReport([
      makeResult({
        filesCompared: 200,
        mismatchCount: 1,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 0, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 0, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 1 },
      }),
    ]);
    expect(report.summary.buttonCoverage).toBe(99.5);
    expect(report.summary.buttonCoveragePass).toBe(true); // exactly at threshold
  });
});

// ============================================================================
// FLAG PRECISION
// ============================================================================

describe('Flag precision', () => {
  it('100% when no flag mismatches', () => {
    const report = generateDiffReport([makeResult({ postsAnalyzed: 20 })]);
    expect(report.summary.flagPrecision).toBe(100);
    expect(report.summary.flagPrecisionPass).toBe(true);
  });

  it('drops with FLAG_MISMATCH', () => {
    const report = generateDiffReport([
      makeResult({
        postsAnalyzed: 50,
        mismatchCount: 2,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 0, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 2, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
      }),
    ]);
    expect(report.summary.flagPrecision).toBe(96);
    expect(report.summary.flagPrecisionPass).toBe(false); // < 98%
  });

  it('passes at 98% precision', () => {
    const report = generateDiffReport([
      makeResult({
        postsAnalyzed: 100,
        mismatchCount: 2,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 0, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 2, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
      }),
    ]);
    expect(report.summary.flagPrecision).toBe(98);
    expect(report.summary.flagPrecisionPass).toBe(true);
  });
});

// ============================================================================
// DUPLICATES
// ============================================================================

describe('Duplicates', () => {
  it('passes with 0 duplicates', () => {
    const report = generateDiffReport([makeResult()], 0);
    expect(report.summary.zeroDuplicatesPass).toBe(true);
  });

  it('fails with any duplicates', () => {
    const report = generateDiffReport([makeResult()], 1);
    expect(report.summary.zeroDuplicatesPass).toBe(false);
    expect(report.summary.allPass).toBe(false);
    expect(report.summary.failureReasons).toContain('1 duplicate injection(s) found');
  });
});

// ============================================================================
// DIFF SUMMARY (allPass)
// ============================================================================

describe('DiffSummary allPass', () => {
  it('allPass true when all gates pass', () => {
    const report = generateDiffReport([makeResult({ postsAnalyzed: 10, filesCompared: 50 })], 0);
    expect(report.summary.allPass).toBe(true);
  });

  it('allPass false when coverage fails', () => {
    const report = generateDiffReport([
      makeResult({
        filesCompared: 10,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 5, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 0, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
        mismatchCount: 5,
      }),
    ], 0);
    expect(report.summary.allPass).toBe(false);
  });

  it('allPass false when precision fails', () => {
    const report = generateDiffReport([
      makeResult({
        postsAnalyzed: 10,
        mismatchBreakdown: { FILE_FOUND_BY_V1_NOT_V2: 0, FILE_FOUND_BY_V2_NOT_V1: 0, FLAG_MISMATCH: 5, PLACEMENT_MISMATCH: 0, COUNT_MISMATCH: 0 },
        mismatchCount: 5,
      }),
    ], 0);
    expect(report.summary.allPass).toBe(false);
  });
});

// ============================================================================
// TREND DETECTION
// ============================================================================

describe('Trend detection', () => {
  it('stable for < 4 results', () => {
    const report = generateDiffReport([makeResult(), makeResult()]);
    expect(report.trend).toBe('stable');
  });

  it('improving when second half has higher match %', () => {
    const results = [
      makeResult({ matchPercentage: 90 }),
      makeResult({ matchPercentage: 92 }),
      makeResult({ matchPercentage: 98 }),
      makeResult({ matchPercentage: 99 }),
    ];
    const report = generateDiffReport(results);
    expect(report.trend).toBe('improving');
  });

  it('degrading when second half has lower match %', () => {
    const results = [
      makeResult({ matchPercentage: 99 }),
      makeResult({ matchPercentage: 98 }),
      makeResult({ matchPercentage: 90 }),
      makeResult({ matchPercentage: 88 }),
    ];
    const report = generateDiffReport(results);
    expect(report.trend).toBe('degrading');
  });

  it('stable when match % is consistent', () => {
    const results = [
      makeResult({ matchPercentage: 99 }),
      makeResult({ matchPercentage: 99 }),
      makeResult({ matchPercentage: 99 }),
      makeResult({ matchPercentage: 99 }),
    ];
    const report = generateDiffReport(results);
    expect(report.trend).toBe('stable');
  });
});

// ============================================================================
// MISMATCH DEDUP
// ============================================================================

describe('Mismatch deduplication', () => {
  it('deduplicates by postId + type + fileId', () => {
    const m1 = makeMismatch({ postId: 'p1', type: 'FLAG_MISMATCH', fileId: null, timestamp: 1000 });
    const m2 = makeMismatch({ postId: 'p1', type: 'FLAG_MISMATCH', fileId: null, timestamp: 2000 });

    const result = makeResult({ mismatches: [m1, m2], mismatchCount: 2 });
    const report = generateDiffReport([result]);
    expect(report.uniqueMismatches).toHaveLength(1);
    expect(report.uniqueMismatches[0].timestamp).toBe(2000); // Most recent
  });

  it('keeps mismatches for different posts', () => {
    const m1 = makeMismatch({ postId: 'p1', type: 'FLAG_MISMATCH' });
    const m2 = makeMismatch({ postId: 'p2', type: 'FLAG_MISMATCH' });

    const result = makeResult({ mismatches: [m1, m2] });
    const report = generateDiffReport([result]);
    expect(report.uniqueMismatches).toHaveLength(2);
  });

  it('keeps mismatches for different types on same post', () => {
    const m1 = makeMismatch({ postId: 'p1', type: 'FLAG_MISMATCH' });
    const m2 = makeMismatch({ postId: 'p1', type: 'COUNT_MISMATCH' });

    const result = makeResult({ mismatches: [m1, m2] });
    const report = generateDiffReport([result]);
    expect(report.uniqueMismatches).toHaveLength(2);
  });
});

// ============================================================================
// PER-VIEWKIND STATS
// ============================================================================

describe('Per-ViewKind stats', () => {
  it('includes ViewKind stats when provided', () => {
    const report = generateDiffReport([makeResult()], 0, ViewKind.STREAM);
    expect(report.viewKindStats).toHaveLength(1);
    expect(report.viewKindStats[0].viewKind).toBe(ViewKind.STREAM);
  });

  it('has empty viewKindStats when no viewKind provided', () => {
    const report = generateDiffReport([makeResult()], 0);
    expect(report.viewKindStats).toHaveLength(0);
  });
});

// ============================================================================
// SERIALIZATION
// ============================================================================

describe('Serialization', () => {
  it('serializes report to valid JSON', () => {
    const report = generateDiffReport([makeResult()], 0);
    const json = serializeDiffReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.comparisonCount).toBe(1);
    expect(parsed.summary).toBeDefined();
  });

  it('round-trips through JSON', () => {
    const report = generateDiffReport([makeResult({ postsAnalyzed: 42 })], 0, ViewKind.CLASSWORK_LIST);
    const json = serializeDiffReport(report);
    const parsed = JSON.parse(json) as ShadowDiffReport;
    expect(parsed.totalPostsAnalyzed).toBe(42);
    expect(parsed.viewKindStats[0].viewKind).toBe(ViewKind.CLASSWORK_LIST);
  });
});

// ============================================================================
// CONSTANTS
// ============================================================================

describe('Constants', () => {
  it('COVERAGE_THRESHOLD is 99.5', () => {
    expect(COVERAGE_THRESHOLD).toBe(99.5);
  });

  it('PRECISION_THRESHOLD is 98.0', () => {
    expect(PRECISION_THRESHOLD).toBe(98.0);
  });
});
