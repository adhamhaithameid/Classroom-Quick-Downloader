// filepath: extension/src/v2/compat/readiness-gate.ts
/**
 * ============================================================================
 * READINESS GATE — Quality Gates for V2 Launch
 * ============================================================================
 *
 * Before flipping from legacy to V2 mode, we need confidence that
 * V2 won't regress the user experience. This module enforces the
 * quality gates from the refactor plan:
 *
 * 1. Button coverage ≥99.5% — V2 finds at least as many files as V1
 * 2. Flag precision ≥98% — V2's flag decisions match V1's
 * 3. 0 duplicate injections — no double buttons or badges
 * 4. All performance budgets pass — CPU/memory within limits
 *
 * The gate consumes data from:
 * - ShadowDiffReport (coverage + precision)
 * - BudgetSnapshot (CPU/memory budgets)
 * - PerformanceSummary (timing histograms)
 *
 * @author Adham — no launch without all gates green
 * @since v4.0.0
 */

import type { ShadowDiffReport, DiffSummary } from './shadow-diff-report';
import type { BudgetSnapshot } from '../telemetry/budget-controller';
import type { PerformanceSummary } from '../telemetry/performance-monitor';
import { COVERAGE_THRESHOLD, PRECISION_THRESHOLD } from './shadow-diff-report';
import { CPU_BUDGETS, MEMORY_BUDGETS } from '../telemetry/budget-controller';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Overall readiness verdict.
 */
export type ReadinessVerdict = 'ready' | 'not-ready';

/**
 * Individual quality gate result.
 */
export interface GateResult {
  name: string;
  passed: boolean;
  value: number;
  threshold: number;
  message: string;
}

/**
 * Complete readiness assessment.
 */
export interface ReadinessAssessment {
  /** Overall verdict */
  verdict: ReadinessVerdict;
  /** When this assessment was generated */
  timestamp: number;
  /** Individual gate results */
  gates: GateResult[];
  /** Number of gates that passed */
  passedCount: number;
  /** Total number of gates */
  totalGates: number;
  /** Failure reasons (empty if ready) */
  failureReasons: string[];
  /** Whether data was sufficient for assessment */
  dataAvailable: boolean;
}

/**
 * A point in the readiness history.
 */
export interface ReadinessHistoryEntry {
  assessment: ReadinessAssessment;
  diffReport: ShadowDiffReport | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum history entries to keep */
const MAX_HISTORY = 20;

/** Minimum comparisons needed for a valid assessment */
export const MIN_COMPARISONS = 5;

/** CPU budget targets (from §9.7) */
const FAST_PASS_P95_THRESHOLD = CPU_BUDGETS.FAST_PASS_WARN; // 8ms

// ============================================================================
// READINESS GATE CLASS
// ============================================================================

export class ReadinessGate {
  /** History of assessments (ring buffer) */
  private history: ReadinessHistoryEntry[] = [];

  // ========================================================================
  // CORE API
  // ========================================================================

  /**
   * Run a full readiness assessment.
   *
   * @param diffReport - ShadowDiffReport with coverage metrics
   * @param budgetSnapshot - Optional BudgetSnapshot for performance gates
   * @param perfSummary - Optional PerformanceSummary for timing gates
   * @returns ReadinessAssessment with verdict and gate details
   */
  assess(
    diffReport: ShadowDiffReport | null,
    budgetSnapshot?: BudgetSnapshot | null,
    perfSummary?: PerformanceSummary | null,
  ): ReadinessAssessment {
    const gates: GateResult[] = [];
    let dataAvailable = true;

    // GATE 1: Data sufficiency
    if (!diffReport || diffReport.comparisonCount < MIN_COMPARISONS) {
      dataAvailable = false;
      gates.push({
        name: 'data_sufficiency',
        passed: false,
        value: diffReport?.comparisonCount ?? 0,
        threshold: MIN_COMPARISONS,
        message: `Need ${MIN_COMPARISONS} comparisons, have ${diffReport?.comparisonCount ?? 0}`,
      });
    }

    // GATE 2: Button coverage
    if (diffReport) {
      gates.push({
        name: 'button_coverage',
        passed: diffReport.summary.buttonCoveragePass,
        value: diffReport.summary.buttonCoverage,
        threshold: COVERAGE_THRESHOLD,
        message: diffReport.summary.buttonCoveragePass
          ? `Coverage ${diffReport.summary.buttonCoverage.toFixed(1)}% ≥ ${COVERAGE_THRESHOLD}%`
          : `Coverage ${diffReport.summary.buttonCoverage.toFixed(1)}% < ${COVERAGE_THRESHOLD}%`,
      });
    }

    // GATE 3: Flag precision
    if (diffReport) {
      gates.push({
        name: 'flag_precision',
        passed: diffReport.summary.flagPrecisionPass,
        value: diffReport.summary.flagPrecision,
        threshold: PRECISION_THRESHOLD,
        message: diffReport.summary.flagPrecisionPass
          ? `Precision ${diffReport.summary.flagPrecision.toFixed(1)}% ≥ ${PRECISION_THRESHOLD}%`
          : `Precision ${diffReport.summary.flagPrecision.toFixed(1)}% < ${PRECISION_THRESHOLD}%`,
      });
    }

    // GATE 4: Zero duplicates
    if (diffReport) {
      gates.push({
        name: 'zero_duplicates',
        passed: diffReport.summary.zeroDuplicatesPass,
        value: diffReport.summary.duplicateCount,
        threshold: 0,
        message: diffReport.summary.zeroDuplicatesPass
          ? 'No duplicate injections'
          : `${diffReport.summary.duplicateCount} duplicate injection(s)`,
      });
    }

    // GATE 5: No hard cap violations
    if (budgetSnapshot) {
      gates.push({
        name: 'no_hard_cap',
        passed: !budgetSnapshot.hardCapHit,
        value: budgetSnapshot.hardCapHit ? 1 : 0,
        threshold: 0,
        message: budgetSnapshot.hardCapHit
          ? 'Memory hard cap has been hit'
          : 'No hard cap violations',
      });
    }

    // GATE 6: Fast pass timing (p95 < warn threshold)
    if (perfSummary?.scanTimings) {
      const p95 = perfSummary.scanTimings.p95;
      const passed = p95 < FAST_PASS_P95_THRESHOLD;
      gates.push({
        name: 'fast_pass_timing',
        passed,
        value: p95,
        threshold: FAST_PASS_P95_THRESHOLD,
        message: passed
          ? `Scan p95 ${p95.toFixed(1)}ms < ${FAST_PASS_P95_THRESHOLD}ms`
          : `Scan p95 ${p95.toFixed(1)}ms ≥ ${FAST_PASS_P95_THRESHOLD}ms`,
      });
    }

    // GATE 7: Trend not degrading
    if (diffReport) {
      const trendPass = diffReport.trend !== 'degrading';
      gates.push({
        name: 'trend_not_degrading',
        passed: trendPass,
        value: diffReport.trend === 'improving' ? 1 : diffReport.trend === 'stable' ? 0 : -1,
        threshold: 0,
        message: trendPass
          ? `Trend: ${diffReport.trend}`
          : 'Match percentage is degrading',
      });
    }

    // Compute verdict
    const passedCount = gates.filter(g => g.passed).length;
    const allPassed = gates.length > 0 && gates.every(g => g.passed) && dataAvailable;
    const failureReasons = gates
      .filter(g => !g.passed)
      .map(g => g.message);

    const assessment: ReadinessAssessment = {
      verdict: allPassed ? 'ready' : 'not-ready',
      timestamp: Date.now(),
      gates,
      passedCount,
      totalGates: gates.length,
      failureReasons,
      dataAvailable,
    };

    // Store in history
    this.history.push({ assessment, diffReport });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    return assessment;
  }

  // ========================================================================
  // HISTORY
  // ========================================================================

  /**
   * Get the full readiness history.
   */
  getHistory(): ReadinessHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get the latest assessment.
   */
  getLatest(): ReadinessAssessment | null {
    if (this.history.length === 0) return null;
    return this.history[this.history.length - 1].assessment;
  }

  /**
   * Get the count of consecutive "ready" verdicts.
   */
  getConsecutiveReadyCount(): number {
    let count = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].assessment.verdict === 'ready') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Check if we've been consistently ready for N assessments.
   */
  isConsistentlyReady(minConsecutive: number = 3): boolean {
    return this.getConsecutiveReadyCount() >= minConsecutive;
  }

  /**
   * Get the readiness trend over the last N assessments.
   */
  getReadinessTrend(): 'improving' | 'stable' | 'degrading' | 'unknown' {
    if (this.history.length < 4) return 'unknown';

    const recent = this.history.slice(-4);
    const recentPassRates = recent.map(h =>
      h.assessment.totalGates > 0
        ? h.assessment.passedCount / h.assessment.totalGates
        : 0,
    );

    const first = (recentPassRates[0] + recentPassRates[1]) / 2;
    const second = (recentPassRates[2] + recentPassRates[3]) / 2;

    const delta = second - first;
    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'degrading';
    return 'stable';
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Clear all history.
   */
  reset(): void {
    this.history = [];
  }
}
