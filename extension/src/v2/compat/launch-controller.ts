// filepath: extension/src/v2/compat/launch-controller.ts
/**
 * ============================================================================
 * LAUNCH CONTROLLER — Mode Transition + Rollback
 * ============================================================================
 *
 * This is the final piece of the V2 launch pipeline:
 *
 *   ShadowComparator → ShadowDiffReport → ReadinessGate → LaunchController
 *                                                              ↓
 *                                                      setMode('v2')
 *
 * The launch controller orchestrates the full lifecycle:
 * 1. Shadow validating — collecting comparison data
 * 2. Readiness check — all quality gates must pass
 * 3. Promotion — switch mode from legacy/shadow to v2
 * 4. Post-launch monitoring — auto-rollback if match % drops
 *
 * Safety guardrails:
 * - Will NOT promote if readiness gate fails
 * - Requires N consecutive "ready" verdicts (default: 3)
 * - Auto-rollback if post-launch match % drops below threshold
 * - Manual rollback always available
 *
 * @author Adham — the switch that makes it all real
 * @since v4.0.0
 */

import type { EngineMode } from '../../engines/types';
import type { ShadowDiffReport } from './shadow-diff-report';
import type { ReadinessAssessment } from './readiness-gate';
import { ReadinessGate } from './readiness-gate';
import type { BudgetSnapshot } from '../telemetry/budget-controller';
import type { PerformanceSummary } from '../telemetry/performance-monitor';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Launch lifecycle states.
 */
export type LaunchState =
  | 'pre-launch'
  | 'shadow-validating'
  | 'ready'
  | 'launched'
  | 'rolled-back';

/**
 * A log entry for the launch timeline.
 */
export interface LaunchEvent {
  type: 'state-change' | 'assessment' | 'promote' | 'rollback' | 'auto-rollback';
  from: LaunchState;
  to: LaunchState;
  reason: string;
  timestamp: number;
}

/**
 * Summary of the launch controller's current status.
 */
export interface LaunchStatus {
  state: LaunchState;
  readinessVerdict: 'ready' | 'not-ready' | 'unknown';
  consecutiveReady: number;
  requiredConsecutive: number;
  launchedAt: number | null;
  rolledBackAt: number | null;
  eventCount: number;
  postLaunchMatchPct: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of consecutive "ready" verdicts required before promotion */
const DEFAULT_REQUIRED_CONSECUTIVE = 3;

/** Post-launch match % below which auto-rollback triggers */
const AUTO_ROLLBACK_THRESHOLD = 95.0;

/** Maximum events in the timeline */
const MAX_EVENTS = 100;

// ============================================================================
// LAUNCH CONTROLLER CLASS
// ============================================================================

export class LaunchController {
  /** Current lifecycle state */
  private state: LaunchState = 'pre-launch';

  /** The readiness gate for quality checks */
  private gate: ReadinessGate;

  /** Mode change function — injected so we don't depend on chrome APIs */
  private setModeFn: ((mode: EngineMode) => Promise<void>) | null = null;

  /** Event timeline */
  private events: LaunchEvent[] = [];

  /** Number of consecutive "ready" verdicts required */
  private requiredConsecutive: number;

  /** When V2 was launched (null if not launched) */
  private launchedAt: number | null = null;

  /** When rollback happened (null if no rollback) */
  private rolledBackAt: number | null = null;

  /** Latest post-launch match percentage */
  private postLaunchMatchPct: number | null = null;

  constructor(
    gate?: ReadinessGate,
    requiredConsecutive: number = DEFAULT_REQUIRED_CONSECUTIVE,
  ) {
    this.gate = gate ?? new ReadinessGate();
    this.requiredConsecutive = requiredConsecutive;
  }

  // ========================================================================
  // SETUP
  // ========================================================================

  /**
   * Set the mode change function.
   * This is injected so the controller doesn't depend on chrome APIs.
   */
  setModeFunction(fn: (mode: EngineMode) => Promise<void>): void {
    this.setModeFn = fn;
  }

  // ========================================================================
  // STATE MACHINE
  // ========================================================================

  /**
   * Start shadow validation.
   * Transitions from pre-launch to shadow-validating.
   */
  startValidation(): boolean {
    if (this.state !== 'pre-launch' && this.state !== 'rolled-back') return false;

    this._transition('shadow-validating', 'Starting shadow validation');
    return true;
  }

  /**
   * Evaluate readiness with the latest data.
   *
   * @returns The readiness assessment
   */
  evaluateReadiness(
    diffReport: ShadowDiffReport | null,
    budgetSnapshot?: BudgetSnapshot | null,
    perfSummary?: PerformanceSummary | null,
  ): ReadinessAssessment {
    const assessment = this.gate.assess(diffReport, budgetSnapshot, perfSummary);

    // Log assessment event
    this._addEvent({
      type: 'assessment',
      from: this.state,
      to: this.state,
      reason: `Verdict: ${assessment.verdict} (${assessment.passedCount}/${assessment.totalGates} gates)`,
      timestamp: Date.now(),
    });

    // Auto-transition to ready if consistently ready
    if (
      this.state === 'shadow-validating' &&
      assessment.verdict === 'ready' &&
      this.gate.isConsistentlyReady(this.requiredConsecutive)
    ) {
      this._transition('ready', `${this.requiredConsecutive} consecutive ready verdicts`);
    }

    // Auto-transition back to shadow-validating if lost readiness
    if (this.state === 'ready' && assessment.verdict === 'not-ready') {
      this._transition('shadow-validating', 'Readiness lost — back to validation');
    }

    return assessment;
  }

  /**
   * Promote to V2 mode (switch from legacy/shadow to v2).
   *
   * Safety: will NOT promote if readiness gate fails.
   *
   * @returns true if promotion succeeded, false if blocked
   */
  async promote(): Promise<boolean> {
    // Must be in 'ready' state
    if (this.state !== 'ready') {
      console.warn(`[LaunchController] Cannot promote — state is ${this.state}, need 'ready'`);
      return false;
    }

    // Must have mode change function
    if (!this.setModeFn) {
      console.warn('[LaunchController] Cannot promote — no mode change function set');
      return false;
    }

    // Double-check readiness
    if (!this.gate.isConsistentlyReady(this.requiredConsecutive)) {
      console.warn('[LaunchController] Cannot promote — not consistently ready');
      return false;
    }

    try {
      await this.setModeFn('v2');
      this.launchedAt = Date.now();
      this._transition('launched', 'Promoted to V2 mode');
      return true;
    } catch (err) {
      console.error('[LaunchController] Promotion failed:', err);
      return false;
    }
  }

  /**
   * Roll back to legacy mode.
   *
   * Can be called at any time — always succeeds (best effort).
   */
  async rollback(reason: string = 'Manual rollback'): Promise<boolean> {
    if (!this.setModeFn) {
      console.warn('[LaunchController] Cannot rollback — no mode change function set');
      return false;
    }

    try {
      await this.setModeFn('legacy');
      this.rolledBackAt = Date.now();
      this._transition('rolled-back', reason);
      return true;
    } catch (err) {
      console.error('[LaunchController] Rollback failed:', err);
      return false;
    }
  }

  /**
   * Monitor post-launch performance.
   * If match % drops below threshold, auto-rollback.
   */
  async monitorPostLaunch(matchPercentage: number): Promise<boolean> {
    if (this.state !== 'launched') return false;

    this.postLaunchMatchPct = matchPercentage;

    if (matchPercentage < AUTO_ROLLBACK_THRESHOLD) {
      console.warn(
        `[LaunchController] Auto-rollback triggered: match ${matchPercentage.toFixed(1)}% ` +
        `< ${AUTO_ROLLBACK_THRESHOLD}%`,
      );

      this._addEvent({
        type: 'auto-rollback',
        from: 'launched',
        to: 'rolled-back',
        reason: `Match % dropped to ${matchPercentage.toFixed(1)}% (threshold: ${AUTO_ROLLBACK_THRESHOLD}%)`,
        timestamp: Date.now(),
      });

      return this.rollback(
        `Auto-rollback: match ${matchPercentage.toFixed(1)}% < ${AUTO_ROLLBACK_THRESHOLD}%`,
      );
    }

    return false;
  }

  // ========================================================================
  // STATUS
  // ========================================================================

  /**
   * Get the current launch state.
   */
  getState(): LaunchState {
    return this.state;
  }

  /**
   * Get a structured status summary.
   */
  getStatus(): LaunchStatus {
    const latest = this.gate.getLatest();

    return {
      state: this.state,
      readinessVerdict: latest?.verdict ?? 'unknown',
      consecutiveReady: this.gate.getConsecutiveReadyCount(),
      requiredConsecutive: this.requiredConsecutive,
      launchedAt: this.launchedAt,
      rolledBackAt: this.rolledBackAt,
      eventCount: this.events.length,
      postLaunchMatchPct: this.postLaunchMatchPct,
    };
  }

  /**
   * Get the event timeline.
   */
  getEvents(): LaunchEvent[] {
    return [...this.events];
  }

  /**
   * Get the readiness gate (for direct access to history).
   */
  getGate(): ReadinessGate {
    return this.gate;
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Reset the controller to pre-launch state.
   */
  reset(): void {
    this.state = 'pre-launch';
    this.events = [];
    this.launchedAt = null;
    this.rolledBackAt = null;
    this.postLaunchMatchPct = null;
    this.gate.reset();
  }

  // ========================================================================
  // INTERNAL
  // ========================================================================

  /** Transition to a new state and log the event */
  private _transition(to: LaunchState, reason: string): void {
    const from = this.state;
    this.state = to;

    this._addEvent({
      type: 'state-change',
      from,
      to,
      reason,
      timestamp: Date.now(),
    });
  }

  /** Add an event to the timeline */
  private _addEvent(event: LaunchEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }
}
