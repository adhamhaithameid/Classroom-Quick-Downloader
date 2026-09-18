// filepath: extension/src/roles/harden-engine.ts
/**
 * ============================================================================
 * HARDEN ENGINE ROLE — budget throttle + corrections published on the page bus
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4, §9 (S5 "roles behind
 * the bus"). Like DetectEngine/ComputeEngine/RenderEngine, this role replaces
 * callers reaching into an engine directly: it watches the budget snapshot
 * and publishes throttle changes, and republishes corrections the engine
 * handles.
 *
 * Contract:
 * - Delegation only. No DOM, no globals, no logic beyond delta detection +
 *   publish. Payloads are carried VERBATIM: 'budget:throttle' carries the
 *   snapshot's own throttleLevel; 'correction:needed' wraps the exact
 *   CorrectionItem object the caller handed over (no copy, no reshape).
 * - 'budget:throttle' is edge-triggered: the first successful onCycleChecks()
 *   call establishes the baseline and publishes nothing; every later call
 *   publishes only when the level differs from the previous successful read.
 *   Stable snapshots are silent — silence says "unchanged".
 * - 'correction:needed' is event-triggered, never polled: QueueStats exposes
 *   no monotonic count that grows when corrections are queued (pending
 *   shrinks on process/flush, dedup makes re-enqueues invisible,
 *   processed/failed grow on outcomes, historySize is a 50-cap ring buffer),
 *   so onCycleChecks() synthesizes no correction events. The engine reports
 *   each handled correction through its optional onCorrectionSeen hook
 *   (additive, undefined by default) — assigned per cycle by
 *   Orchestrator.publishCycleTopics to this role's reportCorrection().
 * - Fault model (§9): the bus boundary is the fault boundary, so publishing
 *   needs no try/catch here — a throwing subscriber is isolated by the bus
 *   and reported via onError. Reading the SOURCE happens inside this role: a
 *   source throw is isolated — caught, nothing published that cycle, never
 *   escaping to the caller. The last observed level survives as the
 *   baseline, so a change made during a blind window is published on the
 *   next successful read instead of being lost.
 */
import type { EventBus } from '../bus/event-bus';
import type { CorrectionItem, PageTopicMap, ThrottleLevel } from '../contracts/topics';

// ============================================================================
// SOURCE TYPES — structural mirrors of the engine's real types
// ============================================================================

/** Mirror of v2/telemetry/budget-controller.ts ViolationLevel. */
export type ViolationLevel = 'warning' | 'critical' | 'fatal';

/** Mirror of v2/telemetry/budget-controller.ts BudgetViolation. */
export interface BudgetViolation {
  type: string;
  level: ViolationLevel;
  message: string;
  value: number;
  limit: number;
  timestamp: number;
}

/**
 * Mirror of v2/telemetry/budget-controller.ts BudgetSnapshot. Roles may not
 * import from src/v2 (fitness rule), so the shape is restated here; the
 * engine's real snapshot satisfies it structurally.
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

/** Mirror of v2/repair/deep-validator.ts CorrectionPriority. */
export type CorrectionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Mirror of v2/repair/correction-queue.ts QueueStats (same fitness rule).
 * Exposed on the source for observability; correction events are fed by
 * reportCorrection(), never polled from these stats.
 */
export interface QueueStats {
  pending: number;
  processed: number;
  failed: number;
  unstableSkipped: number;
  historySize: number;
  byPriority: Record<CorrectionPriority, number>;
}

/** What HardenEngine reads. EngineV2 (getBudgetSnapshot/getCorrectionStats)
 *  qualifies as-is. */
export interface HardenSource {
  getBudgetSnapshot(): BudgetSnapshot;
  getCorrectionStats(): QueueStats;
}

export class HardenEngine {
  /** Throttle level from the last successful read; undefined until the
   *  first one lands. A source throw leaves this untouched. */
  private lastLevel: ThrottleLevel | undefined;

  constructor(
    private readonly bus: EventBus<PageTopicMap>,
    private readonly source: HardenSource,
  ) {}

  /**
   * Call after each engine cycle. Emits 'budget:throttle' { level } on DELTA
   * since the previous successful call; the first successful call only
   * establishes the baseline and publishes nothing.
   */
  onCycleChecks(): void {
    let level: ThrottleLevel;
    try {
      level = this.source.getBudgetSnapshot().throttleLevel;
    } catch {
      // Source throw is isolated: nothing published this cycle, nothing
      // escapes to the caller, baseline survives. Next call reads again.
      return;
    }

    if (this.lastLevel === undefined) {
      this.lastLevel = level; // baseline call — silent by contract
      return;
    }
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.bus.publish('budget:throttle', { level });
    }
  }

  /**
   * Report one correction the engine is handling. Published VERBATIM as
   * 'correction:needed' { item }. Fed by the engine's onCorrectionSeen hook;
   * never synthesized from queue stats.
   */
  reportCorrection(item: CorrectionItem): void {
    this.bus.publish('correction:needed', { item });
  }
}
