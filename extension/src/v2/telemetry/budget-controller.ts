// filepath: extension/src/v2/telemetry/budget-controller.ts
/**
 * ============================================================================
 * BUDGET CONTROLLER — CPU/Memory Budget Enforcement
 * ============================================================================
 *
 * The extension must be invisible to the user's system. This controller
 * tracks resource usage and enforces the budgets from §9.6-§9.7:
 *
 * CPU Budgets:
 * - Fast pass (per mutation batch): <6ms p95, warn at 8ms, abort at 15ms
 * - Deep pass (per idle slice): ≤25ms
 * - Total CPU/second (steady state): <50ms/s (5% CPU)
 *
 * Memory Budgets:
 * - Tracked posts: <500 warn, <1000 hard cap
 * - Injected DOM elements: <2000, warn at 1500
 *
 * Dynamic Throttling:
 * - 100+ posts on page → increase mutation debounce from 80ms to 200ms
 * - CPU budget exceeded → escalate throttle
 *
 * @author Adham — the guardian that prevents the extension from
 *   hogging CPU on students' low-end Chromebooks
 * @since v4.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Violation severity levels.
 */
export type ViolationLevel = 'warning' | 'critical' | 'fatal';

/**
 * A budget violation record.
 */
export interface BudgetViolation {
  type: string;
  level: ViolationLevel;
  message: string;
  value: number;
  limit: number;
  timestamp: number;
}

/**
 * Snapshot of current budget state.
 */
export interface BudgetSnapshot {
  /** Moving average of fast pass durations (ms) */
  fastPassAvg_ms: number;
  /** Current fast pass p95 (ms) */
  fastPassP95_ms: number;
  /** Moving average of CPU ms per second */
  cpuPerSecond_ms: number;
  /** Current post count */
  postCount: number;
  /** Current injected element count */
  injectedElementCount: number;
  /** Current mutation debounce value (ms) */
  currentDebounce_ms: number;
  /** Current throttle level */
  throttleLevel: ThrottleLevel;
  /** Recent violations */
  violations: BudgetViolation[];
  /** Whether the hard cap has been hit */
  hardCapHit: boolean;
}

/**
 * Throttle escalation levels.
 */
export type ThrottleLevel = 'normal' | 'elevated' | 'high' | 'critical';

// ============================================================================
// CONSTANTS — Budget limits from refactor-plan §9.6 and §9.7
// ============================================================================

export const CPU_BUDGETS = {
  /** Fast pass per mutation batch (ms) */
  FAST_PASS_WARN: 8,
  FAST_PASS_ABORT: 15,
  FAST_PASS_TARGET: 6,

  /** Deep pass per idle slice (ms) */
  DEEP_PASS_MAX: 25,

  /** Total CPU per second */
  CPU_PER_SECOND_MAX: 50,
} as const;

export const MEMORY_BUDGETS = {
  /** Post count limits */
  POST_COUNT_WARN: 500,
  POST_COUNT_HARD_CAP: 1000,

  /** Injected element limits */
  INJECTED_WARN: 1500,
  INJECTED_HARD_CAP: 2000,
} as const;

export const THROTTLE = {
  /** Default mutation debounce (ms) */
  DEBOUNCE_DEFAULT: 80,
  /** Elevated debounce for 100+ posts */
  DEBOUNCE_ELEVATED: 200,
  /** High throttle debounce */
  DEBOUNCE_HIGH: 400,
  /** Critical throttle debounce */
  DEBOUNCE_CRITICAL: 800,
  /** Post count threshold for elevated debounce */
  POST_COUNT_THRESHOLD: 100,
} as const;

// ============================================================================
// BUDGET CONTROLLER CLASS
// ============================================================================

export class BudgetController {
  /** Moving average of fast pass durations (last 20) */
  private fastPassBuffer: number[] = [];

  /** Moving average of CPU usage per second (last 10 seconds) */
  private cpuPerSecondBuffer: number[] = [];

  /** Accumulated CPU ms in the current second */
  private cpuThisSecond = 0;

  /** Timestamp of the current second's start */
  private currentSecondStart = 0;

  /** Current throttle level */
  private throttleLevel: ThrottleLevel = 'normal';

  /** Recent violations (ring buffer, max 20) */
  private violations: BudgetViolation[] = [];

  /** Whether hard cap has been hit */
  private hardCapActive = false;

  /** Current post count (updated externally) */
  private postCount = 0;

  /** Controller creation time */
  private createdAt: number = Date.now();

  private static readonly FAST_PASS_BUFFER_SIZE = 20;
  private static readonly CPU_SECOND_BUFFER_SIZE = 10;
  private static readonly MAX_VIOLATIONS = 20;

  // ========================================================================
  // FAST PASS TRACKING
  // ========================================================================

  /**
   * Record a fast pass (fullScan/handleMutations) duration.
   *
   * @returns 'ok' | 'warn' | 'abort' based on budget
   */
  recordFastPass(duration_ms: number): 'ok' | 'warn' | 'abort' {
    // Add to moving average buffer
    this.fastPassBuffer.push(duration_ms);
    if (this.fastPassBuffer.length > BudgetController.FAST_PASS_BUFFER_SIZE) {
      this.fastPassBuffer.shift();
    }

    // Track CPU per second
    this._addCpuTime(duration_ms);

    // Check budget
    if (duration_ms >= CPU_BUDGETS.FAST_PASS_ABORT) {
      this._addViolation({
        type: 'fast_pass_abort',
        level: 'critical',
        message: `Fast pass took ${duration_ms.toFixed(1)}ms (abort threshold: ${CPU_BUDGETS.FAST_PASS_ABORT}ms)`,
        value: duration_ms,
        limit: CPU_BUDGETS.FAST_PASS_ABORT,
        timestamp: Date.now(),
      });
      this._escalateThrottle();
      return 'abort';
    }

    if (duration_ms >= CPU_BUDGETS.FAST_PASS_WARN) {
      this._addViolation({
        type: 'fast_pass_warn',
        level: 'warning',
        message: `Fast pass took ${duration_ms.toFixed(1)}ms (warn threshold: ${CPU_BUDGETS.FAST_PASS_WARN}ms)`,
        value: duration_ms,
        limit: CPU_BUDGETS.FAST_PASS_WARN,
        timestamp: Date.now(),
      });
      return 'warn';
    }

    return 'ok';
  }

  /**
   * Record a deep pass (validation) duration.
   *
   * @returns true if within budget, false if exceeded
   */
  recordDeepPass(duration_ms: number): boolean {
    this._addCpuTime(duration_ms);

    if (duration_ms > CPU_BUDGETS.DEEP_PASS_MAX) {
      this._addViolation({
        type: 'deep_pass_exceeded',
        level: 'warning',
        message: `Deep pass took ${duration_ms.toFixed(1)}ms (limit: ${CPU_BUDGETS.DEEP_PASS_MAX}ms)`,
        value: duration_ms,
        limit: CPU_BUDGETS.DEEP_PASS_MAX,
        timestamp: Date.now(),
      });
      return false;
    }

    return true;
  }

  // ========================================================================
  // MEMORY TRACKING
  // ========================================================================

  /**
   * Update the current post count and check memory budget.
   *
   * @returns 'ok' | 'warn' | 'cap' based on budget
   */
  updatePostCount(count: number): 'ok' | 'warn' | 'cap' {
    this.postCount = count;

    // Dynamic throttle: 100+ posts → elevated debounce
    if (count >= THROTTLE.POST_COUNT_THRESHOLD && this.throttleLevel === 'normal') {
      this.throttleLevel = 'elevated';
    }

    if (count >= MEMORY_BUDGETS.POST_COUNT_HARD_CAP) {
      this.hardCapActive = true;
      this._addViolation({
        type: 'post_count_cap',
        level: 'fatal',
        message: `Post count ${count} exceeds hard cap ${MEMORY_BUDGETS.POST_COUNT_HARD_CAP}`,
        value: count,
        limit: MEMORY_BUDGETS.POST_COUNT_HARD_CAP,
        timestamp: Date.now(),
      });
      return 'cap';
    }

    if (count >= MEMORY_BUDGETS.POST_COUNT_WARN) {
      this._addViolation({
        type: 'post_count_warn',
        level: 'warning',
        message: `Post count ${count} exceeds warning threshold ${MEMORY_BUDGETS.POST_COUNT_WARN}`,
        value: count,
        limit: MEMORY_BUDGETS.POST_COUNT_WARN,
        timestamp: Date.now(),
      });
      return 'warn';
    }

    return 'ok';
  }

  /**
   * Check injected element count against budget.
   *
   * @returns 'ok' | 'warn' | 'cap'
   */
  checkInjectedElements(count: number): 'ok' | 'warn' | 'cap' {
    if (count >= MEMORY_BUDGETS.INJECTED_HARD_CAP) {
      this._addViolation({
        type: 'injected_cap',
        level: 'fatal',
        message: `Injected element count ${count} exceeds hard cap ${MEMORY_BUDGETS.INJECTED_HARD_CAP}`,
        value: count,
        limit: MEMORY_BUDGETS.INJECTED_HARD_CAP,
        timestamp: Date.now(),
      });
      return 'cap';
    }

    if (count >= MEMORY_BUDGETS.INJECTED_WARN) {
      this._addViolation({
        type: 'injected_warn',
        level: 'warning',
        message: `Injected element count ${count} exceeds warning threshold ${MEMORY_BUDGETS.INJECTED_WARN}`,
        value: count,
        limit: MEMORY_BUDGETS.INJECTED_WARN,
        timestamp: Date.now(),
      });
      return 'warn';
    }

    return 'ok';
  }

  /**
   * Whether the hard cap has been hit (stop processing new posts).
   */
  isHardCapHit(): boolean {
    return this.hardCapActive;
  }

  // ========================================================================
  // THROTTLE CONTROL
  // ========================================================================

  /**
   * Get the current mutation debounce value.
   * This increases with throttle level.
   */
  getDebounceMs(): number {
    switch (this.throttleLevel) {
      case 'normal': return THROTTLE.DEBOUNCE_DEFAULT;
      case 'elevated': return THROTTLE.DEBOUNCE_ELEVATED;
      case 'high': return THROTTLE.DEBOUNCE_HIGH;
      case 'critical': return THROTTLE.DEBOUNCE_CRITICAL;
    }
  }

  /**
   * Get the current throttle level.
   */
  getThrottleLevel(): ThrottleLevel {
    return this.throttleLevel;
  }

  /**
   * Manually set throttle level (for testing).
   */
  setThrottleLevel(level: ThrottleLevel): void {
    this.throttleLevel = level;
  }

  // ========================================================================
  // BUDGET SNAPSHOT
  // ========================================================================

  /**
   * Get a snapshot of the current budget state.
   */
  getBudgetSnapshot(): BudgetSnapshot {
    return {
      fastPassAvg_ms: this._computeAverage(this.fastPassBuffer),
      fastPassP95_ms: this._computeP95(this.fastPassBuffer),
      cpuPerSecond_ms: this._computeAverage(this.cpuPerSecondBuffer),
      postCount: this.postCount,
      injectedElementCount: typeof document !== 'undefined'
        ? document.querySelectorAll('[data-cqd-injected]').length
        : 0,
      currentDebounce_ms: this.getDebounceMs(),
      throttleLevel: this.throttleLevel,
      violations: [...this.violations],
      hardCapHit: this.hardCapActive,
    };
  }

  /**
   * Get recent violations.
   */
  getViolations(): readonly BudgetViolation[] {
    return this.violations;
  }

  /**
   * Check if a fast pass should proceed based on current budget.
   */
  shouldProceedFastPass(): boolean {
    return !this.hardCapActive;
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Reset all budget state.
   * Called on engine destroy.
   */
  reset(): void {
    this.fastPassBuffer = [];
    this.cpuPerSecondBuffer = [];
    this.cpuThisSecond = 0;
    this.currentSecondStart = 0;
    this.throttleLevel = 'normal';
    this.violations = [];
    this.hardCapActive = false;
    this.postCount = 0;
    this.createdAt = Date.now();
  }

  // ========================================================================
  // INTERNAL
  // ========================================================================

  /** Track CPU time for per-second budgeting */
  private _addCpuTime(duration_ms: number): void {
    const now = Date.now();

    // Check if we've moved to a new second
    if (now - this.currentSecondStart >= 1000) {
      // Store previous second's total
      if (this.currentSecondStart > 0) {
        this.cpuPerSecondBuffer.push(this.cpuThisSecond);
        if (this.cpuPerSecondBuffer.length > BudgetController.CPU_SECOND_BUFFER_SIZE) {
          this.cpuPerSecondBuffer.shift();
        }

        // Check per-second budget
        if (this.cpuThisSecond > CPU_BUDGETS.CPU_PER_SECOND_MAX) {
          this._addViolation({
            type: 'cpu_per_second',
            level: 'critical',
            message: `CPU usage ${this.cpuThisSecond.toFixed(1)}ms/s exceeds ${CPU_BUDGETS.CPU_PER_SECOND_MAX}ms/s`,
            value: this.cpuThisSecond,
            limit: CPU_BUDGETS.CPU_PER_SECOND_MAX,
            timestamp: now,
          });
          this._escalateThrottle();
        }
      }

      this.cpuThisSecond = 0;
      this.currentSecondStart = now;
    }

    this.cpuThisSecond += duration_ms;
  }

  /** Escalate throttle level by one step */
  private _escalateThrottle(): void {
    switch (this.throttleLevel) {
      case 'normal': this.throttleLevel = 'elevated'; break;
      case 'elevated': this.throttleLevel = 'high'; break;
      case 'high': this.throttleLevel = 'critical'; break;
      case 'critical': break; // Already at max
    }
  }

  /** Add a violation to the ring buffer */
  private _addViolation(violation: BudgetViolation): void {
    this.violations.push(violation);
    if (this.violations.length > BudgetController.MAX_VIOLATIONS) {
      this.violations.shift();
    }
  }

  /** Compute average of an array */
  private _computeAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /** Compute p95 of an array */
  private _computeP95(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}
