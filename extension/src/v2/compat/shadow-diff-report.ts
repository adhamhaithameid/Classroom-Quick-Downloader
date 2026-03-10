// filepath: extension/src/v2/compat/shadow-diff-report.ts
/**
 * ============================================================================
 * SHADOW DIFF REPORT — Structured Multi-Page Comparison Reports
 * ============================================================================
 *
 * The ShadowComparator produces individual comparison results at 10s
 * intervals. But for launch readiness, we need aggregated metrics:
 *
 * - What's our button coverage across ALL page types?
 * - What's our flag precision per ViewKind?
 * - How many duplicate injections have we seen?
 * - Is the trend improving or degrading?
 *
 * This module aggregates ShadowCompareResult[] into a structured
 * ShadowDiffReport that the readiness-gate can evaluate.
 *
 * @author Adham — the reporting layer that decides if V2 is ready
 * @since v4.0.0
 */

import type { ViewKind } from '../../engines/types';
import type {
  ShadowCompareResult,
  MismatchType,
  Mismatch,
} from './shadow-compare';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Per-ViewKind coverage and precision stats.
 */
export interface ViewKindStats {
  viewKind: ViewKind;
  comparisons: number;
  postsAnalyzed: number;
  filesCompared: number;
  totalMismatches: number;
  matchPercentage: number;
  /** Breakdown by mismatch type */
  mismatchBreakdown: Record<MismatchType, number>;
}

/**
 * Summary of whether each quality gate passes or fails.
 */
export interface DiffSummary {
  /** Does button coverage meet the ≥99.5% threshold? */
  buttonCoveragePass: boolean;
  /** Button coverage percentage */
  buttonCoverage: number;

  /** Does flag precision meet the ≥98% threshold? */
  flagPrecisionPass: boolean;
  /** Flag precision percentage */
  flagPrecision: number;

  /** Are there 0 duplicate injections? */
  zeroDuplicatesPass: boolean;
  /** Number of duplicate injections found */
  duplicateCount: number;

  /** Overall pass — all gates passed */
  allPass: boolean;

  /** Human-readable reason(s) for failure */
  failureReasons: string[];
}

/**
 * Full aggregated diff report.
 */
export interface ShadowDiffReport {
  /** When this report was generated */
  generatedAt: number;

  /** Number of individual comparisons aggregated */
  comparisonCount: number;

  /** Time span covered (first to last comparison) */
  timeSpan_ms: number;

  /** Aggregate match percentage across all comparisons */
  overallMatchPercentage: number;

  /** Total posts analyzed across all comparisons */
  totalPostsAnalyzed: number;

  /** Total files compared across all comparisons */
  totalFilesCompared: number;

  /** Total mismatches across all comparisons */
  totalMismatches: number;

  /** Aggregate mismatch breakdown */
  aggregateMismatchBreakdown: Record<MismatchType, number>;

  /** Per-ViewKind stats (when viewKind info is available) */
  viewKindStats: ViewKindStats[];

  /** Number of duplicate injections detected */
  duplicateInjections: number;

  /** Quality gate summary */
  summary: DiffSummary;

  /** Trend direction based on last 5 comparisons vs previous 5 */
  trend: 'improving' | 'stable' | 'degrading';

  /** All unique mismatches (deduped by postId + type) */
  uniqueMismatches: Mismatch[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Button coverage threshold for readiness */
export const COVERAGE_THRESHOLD = 99.5;

/** Flag precision threshold for readiness */
export const PRECISION_THRESHOLD = 98.0;

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate a structured diff report from ShadowCompareResult[].
 *
 * @param results - Array of ShadowCompareResults from ShadowComparator
 * @param duplicateCount - Number of duplicate injections (from engine)
 * @param viewKind - Optional current ViewKind for per-view stats
 */
export function generateDiffReport(
  results: ShadowCompareResult[],
  duplicateCount: number = 0,
  viewKind?: ViewKind,
): ShadowDiffReport {
  if (results.length === 0) {
    return emptyReport(duplicateCount);
  }

  // Aggregate totals
  let totalPosts = 0;
  let totalFiles = 0;
  let totalMismatches = 0;
  let matchSum = 0;

  const aggregateBreakdown: Record<MismatchType, number> = {
    FILE_FOUND_BY_V1_NOT_V2: 0,
    FILE_FOUND_BY_V2_NOT_V1: 0,
    FLAG_MISMATCH: 0,
    PLACEMENT_MISMATCH: 0,
    COUNT_MISMATCH: 0,
  };

  const allMismatches: Mismatch[] = [];

  for (const r of results) {
    totalPosts += r.postsAnalyzed;
    totalFiles += r.filesCompared;
    totalMismatches += r.mismatchCount;
    matchSum += r.matchPercentage;

    for (const [type, count] of Object.entries(r.mismatchBreakdown)) {
      aggregateBreakdown[type as MismatchType] += count;
    }

    allMismatches.push(...r.mismatches);
  }

  const overallMatch = matchSum / results.length;

  // Compute button coverage
  // V1 files not found by V2 = coverage gap
  const fileGaps = aggregateBreakdown.FILE_FOUND_BY_V1_NOT_V2 + aggregateBreakdown.COUNT_MISMATCH;
  const buttonCoverage = totalFiles > 0
    ? Math.max(0, ((totalFiles - fileGaps) / totalFiles) * 100)
    : 100;

  // Compute flag precision
  // Flag mismatches = precision gap
  const flagComparisons = totalPosts; // Each post can have flags
  const flagMismatches = aggregateBreakdown.FLAG_MISMATCH;
  const flagPrecision = flagComparisons > 0
    ? Math.max(0, ((flagComparisons - flagMismatches) / flagComparisons) * 100)
    : 100;

  // Dedup mismatches by postId + type
  const uniqueMismatches = dedupMismatches(allMismatches);

  // Compute trend
  const trend = computeTrend(results);

  // Build per-ViewKind stats
  const viewKindStats: ViewKindStats[] = [];
  if (viewKind) {
    viewKindStats.push({
      viewKind,
      comparisons: results.length,
      postsAnalyzed: totalPosts,
      filesCompared: totalFiles,
      totalMismatches,
      matchPercentage: overallMatch,
      mismatchBreakdown: { ...aggregateBreakdown },
    });
  }

  // Build summary
  const buttonCoveragePass = buttonCoverage >= COVERAGE_THRESHOLD;
  const flagPrecisionPass = flagPrecision >= PRECISION_THRESHOLD;
  const zeroDuplicatesPass = duplicateCount === 0;
  const allPass = buttonCoveragePass && flagPrecisionPass && zeroDuplicatesPass;

  const failureReasons: string[] = [];
  if (!buttonCoveragePass) {
    failureReasons.push(`Button coverage ${buttonCoverage.toFixed(1)}% < ${COVERAGE_THRESHOLD}%`);
  }
  if (!flagPrecisionPass) {
    failureReasons.push(`Flag precision ${flagPrecision.toFixed(1)}% < ${PRECISION_THRESHOLD}%`);
  }
  if (!zeroDuplicatesPass) {
    failureReasons.push(`${duplicateCount} duplicate injection(s) found`);
  }

  const summary: DiffSummary = {
    buttonCoveragePass,
    buttonCoverage,
    flagPrecisionPass,
    flagPrecision,
    zeroDuplicatesPass,
    duplicateCount,
    allPass,
    failureReasons,
  };

  // Compute time span
  const timestamps = results.map(r => r.timestamp);
  const timeSpan = timestamps.length > 1
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;

  return {
    generatedAt: Date.now(),
    comparisonCount: results.length,
    timeSpan_ms: timeSpan,
    overallMatchPercentage: overallMatch,
    totalPostsAnalyzed: totalPosts,
    totalFilesCompared: totalFiles,
    totalMismatches,
    aggregateMismatchBreakdown: aggregateBreakdown,
    viewKindStats,
    duplicateInjections: duplicateCount,
    summary,
    trend,
    uniqueMismatches,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Deduplicate mismatches by postId + type (keep the most recent).
 */
function dedupMismatches(mismatches: Mismatch[]): Mismatch[] {
  const seen = new Map<string, Mismatch>();
  for (const m of mismatches) {
    const key = `${m.postId}:${m.type}:${m.fileId ?? ''}`;
    const existing = seen.get(key);
    if (!existing || m.timestamp > existing.timestamp) {
      seen.set(key, m);
    }
  }
  return Array.from(seen.values());
}

/**
 * Compute trend by comparing last N/2 comparisons vs first N/2.
 */
function computeTrend(results: ShadowCompareResult[]): 'improving' | 'stable' | 'degrading' {
  if (results.length < 4) return 'stable';

  const mid = Math.floor(results.length / 2);
  const firstHalf = results.slice(0, mid);
  const secondHalf = results.slice(mid);

  const avgFirst = firstHalf.reduce((s, r) => s + r.matchPercentage, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, r) => s + r.matchPercentage, 0) / secondHalf.length;

  const delta = avgSecond - avgFirst;
  if (delta > 1) return 'improving';
  if (delta < -1) return 'degrading';
  return 'stable';
}

/**
 * Create an empty report when no comparison data is available.
 */
function emptyReport(duplicateCount: number): ShadowDiffReport {
  return {
    generatedAt: Date.now(),
    comparisonCount: 0,
    timeSpan_ms: 0,
    overallMatchPercentage: 0,
    totalPostsAnalyzed: 0,
    totalFilesCompared: 0,
    totalMismatches: 0,
    aggregateMismatchBreakdown: {
      FILE_FOUND_BY_V1_NOT_V2: 0,
      FILE_FOUND_BY_V2_NOT_V1: 0,
      FLAG_MISMATCH: 0,
      PLACEMENT_MISMATCH: 0,
      COUNT_MISMATCH: 0,
    },
    viewKindStats: [],
    duplicateInjections: duplicateCount,
    summary: {
      buttonCoveragePass: false,
      buttonCoverage: 0,
      flagPrecisionPass: false,
      flagPrecision: 0,
      zeroDuplicatesPass: duplicateCount === 0,
      duplicateCount,
      allPass: false,
      failureReasons: ['No comparison data available'],
    },
    trend: 'stable',
    uniqueMismatches: [],
  };
}

/**
 * Serialize a ShadowDiffReport to JSON (for storage / analytics).
 */
export function serializeDiffReport(report: ShadowDiffReport): string {
  return JSON.stringify(report, null, 2);
}
