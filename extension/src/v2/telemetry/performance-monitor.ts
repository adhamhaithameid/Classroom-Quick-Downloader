// filepath: extension/src/v2/telemetry/performance-monitor.ts
/**
 * ============================================================================
 * PERFORMANCE MONITOR — Timing Histograms + Element Counting
 * ============================================================================
 *
 * V1 had zero performance monitoring. When users reported lag, we had
 * no data — just "it feels slow." V2 tracks EVERYTHING:
 *
 * - Every scan pass is timed (start/stop timer pairs)
 * - Scan durations stored in a ring buffer → p50/p95/p99 histograms
 * - Injected element count tracked in real-time
 * - Decision traces stored for debugging (ring buffer, max 50)
 *
 * All data is available via getPerformanceSummary() for the debug panel
 * and console.log diagnostics. Zero cost when not queried.
 *
 * @author Adham — can't optimize what you can't measure
 * @since v4.0.0
 */

import type { DecisionTrace } from '../../engines/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single timing record.
 */
interface TimingRecord {
  label: string;
  startTime: number;
  endTime: number;
  duration_ms: number;
}

/**
 * Percentile breakdown of timing data.
 */
export interface TimingPercentiles {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Full performance summary returned by getPerformanceSummary().
 */
export interface PerformanceSummary {
  /** Scan pass timing histogram */
  scanTimings: TimingPercentiles | null;
  /** Mutation handling timing histogram */
  mutationTimings: TimingPercentiles | null;
  /** Flag detection timing histogram */
  flagTimings: TimingPercentiles | null;
  /** Deep validation timing histogram */
  validationTimings: TimingPercentiles | null;
  /** Total injected CQD elements on the page */
  injectedElementCount: number;
  /** Number of decision traces stored */
  traceCount: number;
  /** Total timers stored across all categories */
  totalTimersStored: number;
  /** Uptime since monitor creation (ms) */
  uptime_ms: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max timing records per label (ring buffer) */
const MAX_TIMINGS_PER_LABEL = 100;

/** Max decision traces stored */
const MAX_TRACES = 50;

/** CSS selector for counting injected elements */
const INJECTED_SELECTOR = '[data-cqd-injected]';

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  /** Timing ring buffers keyed by label */
  private timings: Map<string, number[]> = new Map();

  /** Active timers (started but not stopped) */
  private activeTimers: Map<string, number> = new Map();

  /** Decision trace ring buffer */
  private traces: DecisionTrace[] = [];

  /** Monitor creation time */
  private createdAt: number = Date.now();

  // ========================================================================
  // TIMER API
  // ========================================================================

  /**
   * Start a named timer.
   *
   * Usage:
   *   monitor.startTimer('fullScan');
   *   // ... do work ...
   *   const elapsed = monitor.stopTimer('fullScan');
   */
  startTimer(label: string): void {
    this.activeTimers.set(label, performance.now());
  }

  /**
   * Stop a named timer and record the duration.
   *
   * @returns Duration in ms, or -1 if no matching startTimer was called.
   */
  stopTimer(label: string): number {
    const startTime = this.activeTimers.get(label);
    if (startTime === undefined) return -1;

    this.activeTimers.delete(label);
    const duration = performance.now() - startTime;

    // Add to ring buffer
    let buffer = this.timings.get(label);
    if (!buffer) {
      buffer = [];
      this.timings.set(label, buffer);
    }

    buffer.push(duration);
    if (buffer.length > MAX_TIMINGS_PER_LABEL) {
      buffer.shift();
    }

    return duration;
  }

  /**
   * Record a timing directly (when start/stop is not convenient).
   */
  recordTiming(label: string, duration_ms: number): void {
    let buffer = this.timings.get(label);
    if (!buffer) {
      buffer = [];
      this.timings.set(label, buffer);
    }

    buffer.push(duration_ms);
    if (buffer.length > MAX_TIMINGS_PER_LABEL) {
      buffer.shift();
    }
  }

  /**
   * Get percentile breakdown for a label.
   */
  getPercentiles(label: string): TimingPercentiles | null {
    const buffer = this.timings.get(label);
    if (!buffer || buffer.length === 0) return null;

    return computePercentiles(buffer);
  }

  /**
   * Get all timing labels that have data.
   */
  getTimingLabels(): string[] {
    return Array.from(this.timings.keys());
  }

  /**
   * Get the count of timings for a label.
   */
  getTimingCount(label: string): number {
    return this.timings.get(label)?.length ?? 0;
  }

  // ========================================================================
  // DECISION TRACE API
  // ========================================================================

  /**
   * Store a decision trace in the ring buffer.
   */
  addTrace(trace: DecisionTrace): void {
    this.traces.push(trace);
    if (this.traces.length > MAX_TRACES) {
      this.traces.shift();
    }
  }

  /**
   * Get all stored traces (most recent last).
   */
  getTraces(): readonly DecisionTrace[] {
    return this.traces;
  }

  /**
   * Get a specific trace by postId (most recent for that post).
   */
  getTraceByPostId(postId: string): DecisionTrace | null {
    // Search from end (most recent first)
    for (let i = this.traces.length - 1; i >= 0; i--) {
      if (this.traces[i].postId === postId) {
        return this.traces[i];
      }
    }
    return null;
  }

  /**
   * Get the number of stored traces.
   */
  get traceCount(): number {
    return this.traces.length;
  }

  // ========================================================================
  // ELEMENT COUNTING
  // ========================================================================

  /**
   * Count all CQD-injected elements on the page.
   * Uses querySelectorAll with the injected data attribute.
   */
  countInjectedElements(): number {
    if (typeof document === 'undefined') return 0;
    return document.querySelectorAll(INJECTED_SELECTOR).length;
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================

  /**
   * Get a full performance summary.
   * This is what the debug panel and console commands use.
   */
  getPerformanceSummary(): PerformanceSummary {
    let totalTimers = 0;
    for (const buffer of this.timings.values()) {
      totalTimers += buffer.length;
    }

    return {
      scanTimings: this.getPercentiles('fullScan'),
      mutationTimings: this.getPercentiles('handleMutations'),
      flagTimings: this.getPercentiles('flagDetection'),
      validationTimings: this.getPercentiles('deepValidation'),
      injectedElementCount: this.countInjectedElements(),
      traceCount: this.traces.length,
      totalTimersStored: totalTimers,
      uptime_ms: Date.now() - this.createdAt,
    };
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Reset all monitor state.
   * Called on engine destroy.
   */
  reset(): void {
    this.timings.clear();
    this.activeTimers.clear();
    this.traces = [];
    this.createdAt = Date.now();
  }
}

// ============================================================================
// PERCENTILE COMPUTATION
// ============================================================================

/**
 * Compute percentiles from an array of numbers.
 * Creates a sorted copy to avoid mutating the input.
 */
export function computePercentiles(values: number[]): TimingPercentiles {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    mean: sum / count,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

/**
 * Get a specific percentile from a sorted array.
 */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const idx = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);

  if (lower === upper) return sorted[lower];

  // Linear interpolation
  const fraction = idx - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}
