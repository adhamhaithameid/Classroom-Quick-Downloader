// filepath: extension/src/roles/compute-engine.ts
/**
 * ============================================================================
 * COMPUTE ENGINE ROLE — decision output published on the page bus
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4, §9 (S5 "roles behind
 * the bus"). Like DetectEngine, this role replaces callers reaching into an
 * engine directly: it reads decision state and publishes topics.
 *
 * Contract:
 * - Delegation only. No DOM, no globals, no logic beyond delegation +
 *   publish — the source's arrays are carried VERBATIM (same references —
 *   no copy, no filter, no reshape).
 * - One cycle publishes both topics: 'decision:flags' then
 *   'decision:placement'. The arrays are read before either topic is
 *   published, so a source throw leaves the cycle with nothing published
 *   rather than a half-cycle.
 * - Fault model (§9): the bus boundary is the fault boundary, so publishing
 *   needs no try/catch here — a throwing subscriber is isolated by the bus
 *   and reported via onError. Reading the SOURCE, however, happens inside
 *   this role: a source throw is isolated — caught, rethrown as nothing,
 *   nothing published that cycle. The next cycle reads again.
 */
import type { EventBus } from '../bus/event-bus';
import type { PageTopicMap } from '../contracts/topics';
import type { FlagDecision, PlacementDecision } from '../engines/types';

/** What ComputeEngine reads. Any engine exposing its decisions qualifies. */
export interface ComputeSource {
  getFlagDecisions(): FlagDecision[];
  getPlacementDecisions(): PlacementDecision[];
}

export class ComputeEngine {
  constructor(
    private readonly bus: EventBus<PageTopicMap>,
    private readonly source: ComputeSource,
  ) {}

  /** Call once after a decision cycle settles. Reads the source VERBATIM. */
  onDecisionsComputed(): void {
    let flags: FlagDecision[];
    let placements: PlacementDecision[];
    try {
      flags = this.source.getFlagDecisions();
      placements = this.source.getPlacementDecisions();
    } catch {
      // Source throw is isolated: report nothing (nothing to publish it
      // against), publish nothing this cycle, never escape to the caller.
      return;
    }

    this.bus.publish('decision:flags', { decisions: flags });
    this.bus.publish('decision:placement', { decisions: placements });
  }
}
