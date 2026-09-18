// filepath: extension/src/roles/render-engine.ts
/**
 * ============================================================================
 * RENDER ENGINE ROLE — render output published on the page bus
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4, §9 (S5 "roles behind
 * the bus"). Like DetectEngine and ComputeEngine, this role replaces callers
 * reaching into an engine directly: it reads the render record and publishes
 * topics.
 *
 * Contract:
 * - Delegation only. No DOM, no globals, no logic beyond delegation +
 *   publish — one 'render:applied' per applied item, each payload carried
 *   VERBATIM (the source's own item object — no copy, no reshape). The
 *   engine's record is the single source of truth for what the last render
 *   cycle actually applied; this role never second-guesses it.
 * - An empty record publishes nothing: no render, no topic. Silence here is
 *   meaningful — it says the last cycle applied nothing to the DOM.
 * - Fault model (§9): the bus boundary is the fault boundary, so publishing
 *   needs no try/catch here — a throwing subscriber is isolated by the bus
 *   and reported via onError. Reading the SOURCE, however, happens inside
 *   this role: a source throw is isolated — caught, rethrown as nothing,
 *   nothing published that cycle. The next cycle reads again.
 */
import type { EventBus } from '../bus/event-bus';
import type { PageTopicMap } from '../contracts/topics';

/** What RenderEngine reads. Any engine exposing its render record qualifies. */
export interface RenderSource {
  getLastRenderApplied(): Array<{ postId: string; kind: 'button' | 'flag' | 'all' }>;
}

export class RenderEngine {
  constructor(
    private readonly bus: EventBus<PageTopicMap>,
    private readonly source: RenderSource,
  ) {}

  /** Call once after a render cycle settles. Reads the source VERBATIM. */
  onRenderApplied(): void {
    let applied: Array<{ postId: string; kind: 'button' | 'flag' | 'all' }>;
    try {
      applied = this.source.getLastRenderApplied();
    } catch {
      // Source throw is isolated: report nothing (nothing to publish it
      // against), publish nothing this cycle, never escape to the caller.
      return;
    }

    for (const item of applied) {
      this.bus.publish('render:applied', item);
    }
  }
}
