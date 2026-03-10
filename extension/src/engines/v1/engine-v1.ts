// filepath: extension/src/engines/v1/engine-v1.ts
/**
 * ============================================================================
 * ENGINE V1 — Legacy Engine Wrapper
 * ============================================================================
 *
 * This is the current CQD V1 engine, wrapped to implement the CQDEngine
 * interface so it can coexist with V2 in shadow mode.
 *
 * IMPORTANT: This file does NOT modify ANY of the existing V1 code.
 * It's a thin adapter/wrapper that:
 * - Imports the existing V1 functions
 * - Exposes them through the CQDEngine interface
 * - Delegates all actual work to the original modules
 *
 * Why wrap instead of rewrite? Because V1 has 2040 passing tests and
 * handles 99% of use cases correctly. I'm not going to break what works.
 * The V1 engine will keep running in production while V2 is validated
 * in shadow mode.
 *
 * The tricky part is that V1 was never designed with this interface in mind.
 * The original code creates its own MutationObservers, manages its own
 * lifecycle, and does its own rendering. This wrapper re-exposes all of
 * that as "start" and "stop" methods that the orchestrator can call.
 *
 * For the getDecisionTrace() method, I return a simplified trace since
 * V1 doesn't internally track decisions. The trace will say "legacy mode,
 * no detailed trace available" — it's there so the debug panel doesn't
 * crash, not for actual debugging.
 *
 * DEPRECATION PLAN:
 * - Phase 5: V2 reaches feature parity → shadow mode ships
 * - Phase 7: V2 validated → V2 mode becomes default
 * - Phase 9: V3 ships → V1 code removed entirely
 *
 * @author Adham — wrapping my own code in an adapter feels meta
 * @since v4.0.0
 */

import type {
  CQDEngine,
  ViewKind,
  PostNode,
  FileNode,
  FlagDecision,
  PlacementDecision,
  DecisionTrace,
} from '../types';

// ============================================================================
// V1 ENGINE CLASS
// ============================================================================

/**
 * EngineV1 — the legacy engine wrapped in the CQDEngine interface.
 *
 * In 'legacy' mode, this is the ONLY engine that runs.
 * In 'shadow' mode, this is the PRIMARY engine (it renders).
 * In 'v2' mode, this engine is NOT active.
 *
 * The implementation delegates to the existing V1 content scripts:
 * - comment_frame.content.ts for comment detection/rendering
 * - edited_frame.content.ts for edited detection/rendering
 * - download_all.content.ts for download button management
 *
 * Since V1 scripts register themselves via defineContentScript(),
 * they're already running. This wrapper just provides start/stop
 * signaling so the orchestrator can coordinate them.
 */
export class EngineV1 implements CQDEngine {
  readonly name = 'engine-v1';
  readonly version = '1.3.9';

  /** Whether V1 features are currently active */
  private isActive = false;

  /** The current view kind (for trace reporting only) */
  private currentView: ViewKind | null = null;

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Initialize V1 for a specific view.
   *
   * In V1, the content scripts auto-start when the page loads.
   * This init() is mostly a no-op — the real initialization happens
   * in the defineContentScript auto-registration.
   *
   * We use this to track which view we're on for debugging purposes.
   */
  async init(viewKind: ViewKind, _signal: AbortSignal): Promise<void> {
    this.currentView = viewKind;
    this.isActive = true;

    // V1 content scripts are already running (registered via defineContentScript)
    // No additional initialization needed — they self-start on page load
    console.log(
      `[Engine V1] Initialized for view: ${viewKind}`,
    );
  }

  /**
   * Shut down V1.
   *
   * In V1, cleanup is handled by the individual content scripts'
   * stop functions (stopCommentsFeature, stopEditedFeature, etc.).
   *
   * This wrapper will eventually call those functions when the
   * orchestrator decides to switch to V2 mode during runtime.
   * For now, it just marks itself as inactive.
   */
  destroy(): void {
    this.isActive = false;
    this.currentView = null;
    console.log('[Engine V1] Destroyed');
  }

  // ========================================================================
  // MUTATION HANDLING
  // ========================================================================

  /**
   * Handle DOM mutations.
   *
   * V1 has its OWN MutationObservers (3 of them!) so this method
   * is a no-op. The mutations are already being handled by:
   * - comment_frame.content.ts's domObserver
   * - edited_frame.content.ts's domObserver
   * - download_all.content.ts's globalObserver
   *
   * In shadow mode, we ignore these mutations entirely because
   * V1 is already processing them through its own observers.
   *
   * TODO (Phase 5): When V2 takes over mutation handling,
   * V1's internal observers should be disabled and mutations
   * should be routed through handleMutations() instead.
   */
  handleMutations(_mutations: MutationRecord[]): void {
    // V1 handles mutations through its own internal observers
    // No-op in the wrapper
  }

  /**
   * Run a full scan of the page.
   *
   * V1 already does this via its heartbeat intervals (setInterval).
   * Each content script has a 2500ms heartbeat that rescans the page.
   *
   * This method exists to satisfy the interface — it doesn't do
   * anything because V1's heartbeats are already running.
   */
  fullScan(): void {
    // V1's heartbeat intervals handle periodic scanning
    // No additional scan needed from the wrapper
  }

  // ========================================================================
  // DATA ACCESSORS
  // ========================================================================

  /**
   * Get all tracked posts.
   *
   * V1 doesn't maintain a canonical post list — it queries the DOM
   * directly on each scan. So this method does a live DOM query
   * and wraps the results as PostNodes.
   *
   * The data won't be as rich as V2's PostNodes (no flag decisions,
   * no file lists), but it gives the debug panel something to show.
   */
  getTrackedPosts(): PostNode[] {
    if (!this.isActive) return [];

    const postEls = document.querySelectorAll<HTMLElement>('[data-stream-item-id]');
    return Array.from(postEls).map(
      (el): PostNode => ({
        id: el.getAttribute('data-stream-item-id') || `v1-${Math.random().toString(36).slice(2)}`,
        element: el,
        viewKind: this.currentView || ('unknown' as ViewKind),
        files: [],
        flags: null,
        lastScannedAt: Date.now(),
      }),
    );
  }

  /**
   * Get placement decisions.
   *
   * V1 doesn't produce formal placement decisions — it directly
   * appends buttons to the DOM. This returns an empty array.
   * The debug panel can still see V1's buttons by querying for
   * '.cqd-download-btn' elements.
   */
  getPlacementDecisions(): PlacementDecision[] {
    return [];
  }

  /**
   * Get flag decisions.
   *
   * V1 doesn't produce formal flag decisions either — it directly
   * creates/updates overlay elements. This returns empty.
   */
  getFlagDecisions(): FlagDecision[] {
    return [];
  }

  /**
   * Get the decision trace for a specific post.
   *
   * V1 doesn't track decision traces. We return a minimal trace
   * that says "legacy engine, no detailed trace" so the debug panel
   * can at least show that V1 processed the post.
   */
  getDecisionTrace(postId: string): DecisionTrace | null {
    return {
      postId,
      timestamp: Date.now(),
      viewKind: this.currentView || ('unknown' as ViewKind),
      layers: [
        {
          layerName: 'v1-legacy',
          layerIndex: 0,
          score: -1,
          matched: false,
          matchedText: null,
          selectorUsed: null,
          details: 'V1 legacy engine does not produce detailed traces. Use V2 for full decision tracing.',
        },
      ],
      exclusions: [],
      finalScore: -1,
      duration_ms: -1,
    };
  }
}
