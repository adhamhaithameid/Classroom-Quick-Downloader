// filepath: extension/src/v2/orchestrator/orchestrator.ts
/**
 * ============================================================================
 * ORCHESTRATOR — The Brain That Runs Everything
 * ============================================================================
 *
 * The orchestrator is the single entry point for the V2 runtime.
 * It replaces the three independent content scripts from V1 with
 * one unified lifecycle manager.
 *
 * What it does:
 * 1. Watches for URL changes (via RouteWatcher)
 * 2. Classifies the page type (via classifyRoute)
 * 3. Initializes the correct engine(s) for the current mode
 * 4. Sets up ONE MutationObserver that feeds ALL engines
 * 5. Manages cleanup on navigation (via AbortController)
 *
 * The V1 system had 3 MutationObservers, 3 heartbeat intervals,
 * 3 URL watchers, and 3 scroll listeners — all running simultaneously.
 * That's 12 "tickers" burning CPU continuously.
 *
 * The V2 orchestrator has: 1 MutationObserver, 1 RouteWatcher.
 * That's it. Two tickers. The engine itself has no timers.
 *
 * Performance target: <6ms for handleMutations (p95).
 * Real-world measurement: we log every 10th scan to see if we're hitting it.
 *
 * Lifecycle:
 *   orchestrator.start()
 *     → RouteWatcher detects page
 *     → classifyRoute() returns ViewKind
 *     → engine.init(viewKind, signal)
 *     → MutationObserver feeds engine.handleMutations()
 *     → ... user navigates ...
 *     → AbortController cancels previous signal
 *     → Start again for new page
 *   orchestrator.stop()
 *     → Kill everything, restore a clean state
 *
 * AbortController is the unsung hero here. In V1, when the user
 * navigated to a new page, the old observers and intervals
 * kept running until the stopXxxFeature() functions were called.
 * Sometimes they weren't called, and we got zombie listeners.
 * With AbortController, aborting the signal automatically cancels
 * everything that was listening to it. Cleaner, safer, simpler.
 *
 * @author Adham — took 3 rewrites to get the lifecycle right
 * @since v4.0.0
 */

import { ViewKind, type CQDEngine } from '../../engines/types';
import { engineRegistry } from '../../engines/engine-registry';
import { RouteWatcher, isClassroomUrl } from '../context/route-classifier';
import { ShadowComparator, type ShadowCompareResult } from '../compat/shadow-compare';
import { createEventBus, type EventBus } from '../../bus/event-bus';
import type { CorrectionItem, PageTopicMap } from '../../contracts/topics';
import { getPageDomPort } from '../../adapters/dom/mutation-observer-dom-port';
import { DetectEngine } from '../../roles/detect-engine';
import { ComputeEngine } from '../../roles/compute-engine';
import { RenderEngine } from '../../roles/render-engine';
import { HardenEngine, type BudgetSnapshot, type QueueStats } from '../../roles/harden-engine';

/**
 * CQDEngine plus the S5 additive members that only some engines expose.
 * EngineV2 implements all of them; EngineV1 implements none — every use is
 * guarded (`typeof` for the getters, `in` for the hook — see
 * publishCycleTopics) so legacy mode can never break.
 */
type S5CapableEngine = CQDEngine & {
  getLastRenderApplied?: () => Array<{ postId: string; kind: 'button' | 'flag' | 'all' }>;
  getBudgetSnapshot?: () => BudgetSnapshot;
  getCorrectionStats?: () => QueueStats;
  /**
   * S5 final-review fix: optional per-correction publish hook. EngineV2
   * DECLARES this field (an own property, undefined until wired — define
   * semantics under the ESNext target); EngineV1 has no such field. The
   * orchestrator assigns it once per scan cycle in publishCycleTopics,
   * pointing it at HardenEngine.reportCorrection.
   */
  onCorrectionSeen?: (item: CorrectionItem) => void;
};

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class Orchestrator {
  /** Whether the orchestrator is currently running */
  private running = false;

  /** Watches for URL changes in the Classroom SPA */
  private routeWatcher: RouteWatcher | null = null;

  /**
   * The orchestrator's subscription on the shared page DomPort (S10).
   * The ONE platform MutationObserver lives on the port (window singleton);
   * the orchestrator only holds the Unsubscribe handle. Page aborts
   * unsubscribe; only stop() disposes the port itself.
   */
  private domUnsubscribe: (() => void) | null = null;

  /**
   * AbortController for the current page's lifecycle.
   * When the user navigates, we abort this controller, which
   * cancels any pending work (async init, waitForContentReady, etc.)
   * and then create a new one for the next page.
   */
  private pageAbortController: AbortController | null = null;

  /** The current view kind (for debugging) */
  private currentView: ViewKind | null = null;

  /** Currently active engine instances */
  private activeEngines: CQDEngine[] = [];

  /** Shadow comparator — runs periodic V1 vs V2 comparisons in shadow mode */
  private shadowComparator: ShadowComparator | null = null;

  /** Latest shadow comparison report (for debug panel) */
  private latestShadowReport: ShadowCompareResult | null = null;

  /** The page-scoped event bus (S5). Roles subscribe/publish here only. */
  private pageBus: EventBus<PageTopicMap> = createEventBus<PageTopicMap>();

  /**
   * The four S5 roles (design §4, "roles behind the bus"). Built once in
   * start() against the page bus; their sources resolve the PRIMARY engine
   * lazily per read (engineRegistry.getPrimaryEngine()), so mode changes are
   * honored without rebuilding them. Null before start() / after stop().
   */
  private roles: {
    detect: DetectEngine;
    compute: ComputeEngine;
    render: RenderEngine;
    harden: HardenEngine;
  } | null = null;

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Start the orchestrator.
   *
   * This is called once when the content script loads.
   * It sets up the RouteWatcher and the mode change listener.
   *
   * The actual engine initialization happens when the RouteWatcher
   * detects a valid Classroom URL. Until then, nothing runs.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    console.log('[CQD Orchestrator] Starting...');

    // Construct the S5 roles against the page bus. Their sources read the
    // primary engine lazily per cycle, so a later mode change needs no rebuild.
    this.constructRoles();

    // Listen for mode changes (from popup, debug panel, storage sync)
    // When the mode changes, we need to tear down current engines
    // and set up new ones for the new mode.
    engineRegistry.setModeChangeCallback((newMode) => {
      console.log(`[CQD Orchestrator] Mode changed to: ${newMode}`);
      // Re-initialize with the new mode's engines
      if (this.currentView !== null && this.currentView !== ViewKind.UNKNOWN) {
        this.handleViewChange(this.currentView, null, window.location.href);
      }
    });

    // Start watching for URL changes
    this.routeWatcher = new RouteWatcher(
      (newView, previousView, url) => this.handleViewChange(newView, previousView, url),
    );
    this.routeWatcher.start();

    console.log('[CQD Orchestrator] Started');
  }

  /**
   * Stop the orchestrator completely.
   *
   * This is called when:
   * - The global enabled toggle is turned off
   * - The extension is unloaded (rare)
   * - Something goes catastrophically wrong
   *
   * It tears down EVERYTHING — engines, observers, watchers.
   * The page should be completely clean after this returns.
   */
  stop(): void {
    if (!this.running) return;

    console.log('[CQD Orchestrator] Stopping...');

    // 1. Stop watching for URL changes
    if (this.routeWatcher) {
      this.routeWatcher.stop();
      this.routeWatcher = null;
    }

    // 2. Abort current page lifecycle (unsubscribes the dom subscription)
    this.abortCurrentPage();

    // 3. Tear down the shared page port itself. Every v2 subscription
    // (orchestrator dom, title fallback, engine transients) has been
    // removed above; dispose() drops the platform observer. The window
    // singleton revives cleanly if the orchestrator starts again.
    getPageDomPort().dispose();

    // 4. Destroy all active engines
    for (const engine of this.activeEngines) {
      try {
        engine.destroy();
      } catch (e) {
        console.error(`[CQD Orchestrator] Error destroying ${engine.name}:`, e);
      }
    }
    this.activeEngines = [];

    // 5. Drop the S5 roles — rebuilt by the next start(). They are stateless
    // over the bus, so page navigations (abortCurrentPage) leave them alive.
    this.roles = null;

    this.currentView = null;
    this.running = false;

    console.log('[CQD Orchestrator] Stopped');
  }

  // ========================================================================
  // VIEW CHANGE HANDLING
  // ========================================================================

  /**
   * Handle a view change (URL navigation within Classroom).
   *
   * This is the main lifecycle method. It:
   * 1. Aborts the previous page's work
   * 2. Gets the new set of engines from the registry
   * 3. Initializes each engine for the new view
   * 4. Sets up the shared MutationObserver
   *
   * The abort-then-init pattern ensures we never have two pages'
   * worth of engines running simultaneously. The AbortController
   * makes this safe — any async work from the previous page gets
   * cancelled automatically.
   */
  private async handleViewChange(
    newView: ViewKind,
    _previousView: ViewKind | null,
    url: string,
  ): Promise<void> {
    if (!this.running) return;

    // Skip non-Classroom URLs and unknown views
    if (!isClassroomUrl(url) || newView === ViewKind.UNKNOWN) {
      console.log(`[CQD Orchestrator] Ignoring view: ${newView} (${url})`);
      this.abortCurrentPage();
      return;
    }

    // Publish the accepted view change on the page bus (S5). This sits after
    // the guard and before the engines-empty early return so every accepted
    // view is announced, even when no engines are active to handle it.
    this.pageBus.publish('route:changed', { view: newView, url });

    console.log(`[CQD Orchestrator] View change: ${this.currentView || 'none'} → ${newView}`);

    // 1. Abort previous page's work
    this.abortCurrentPage();

    // 2. Create new abort controller for this page
    this.pageAbortController = new AbortController();
    const signal = this.pageAbortController.signal;

    // 3. Get active engines from registry
    this.activeEngines = engineRegistry.getActiveEngines();
    this.currentView = newView;

    if (this.activeEngines.length === 0) {
      console.warn('[CQD Orchestrator] No active engines! Check registry setup.');
      return;
    }

    // 4. Initialize each engine
    for (const engine of this.activeEngines) {
      if (signal.aborted) return;
      try {
        await engine.init(newView, signal);
      } catch (e) {
        console.error(`[CQD Orchestrator] Failed to init ${engine.name}:`, e);
      }
    }

    // 5. Set up the shared MutationObserver
    if (!signal.aborted) {
      this.setupDomObserver();
    }

    // 6. Start shadow comparison if in shadow mode
    if (!signal.aborted && engineRegistry.getMode() === 'shadow') {
      this.startShadowComparison();
    }
  }

  /**
   * Start the ShadowComparator for V1 vs V2 comparison.
   * Only runs in shadow mode. Logs mismatch reports to console.
   */
  private startShadowComparison(): void {
    this.stopShadowComparison();

    const v1 = engineRegistry.getEngine('engine-v1');
    const v2 = engineRegistry.getEngine('engine-v2');
    if (!v1 || !v2) {
      console.warn('[CQD Orchestrator] Cannot start shadow comparison: missing V1 or V2 engine');
      return;
    }

    this.shadowComparator = new ShadowComparator(v1, v2, 10_000, 50);

    // Override the comparator's internal interval to also log reports
    const originalRunComparison = this.shadowComparator.runComparison.bind(this.shadowComparator);
    const self = this;
    this.shadowComparator.runComparison = function() {
      const report = originalRunComparison();
      self.latestShadowReport = report;

      if (report.mismatchCount > 0) {
        console.warn(
          `[CQD-SHADOW] Mismatches: ${report.mismatchCount} / ${report.postsAnalyzed} posts ` +
          `(${report.matchPercentage.toFixed(1)}% match) — ` +
          `flags: ${report.mismatchBreakdown.FLAG_MISMATCH || 0}, ` +
          `placements: ${report.mismatchBreakdown.PLACEMENT_MISMATCH || 0}, ` +
          `counts: ${report.mismatchBreakdown.COUNT_MISMATCH || 0}`,
        );
      } else if (report.postsAnalyzed > 0) {
        console.log(
          `[CQD-SHADOW] ✓ All ${report.postsAnalyzed} posts match (${report.duration_ms}ms)`,
        );
      }

      return report;
    };

    this.shadowComparator.start();
    console.log('[CQD Orchestrator] Shadow comparator started (10s interval)');
  }

  /**
   * Stop the shadow comparator.
   */
  private stopShadowComparison(): void {
    if (this.shadowComparator) {
      this.shadowComparator.stop();
      this.shadowComparator = null;
    }
  }

  // ========================================================================
  // DOM OBSERVATION
  // ========================================================================

  /**
   * Subscribe to the shared page DomPort (S10).
   *
   * ONE platform MutationObserver for the whole page — the orchestrator's
   * subscription is multiplexed on it alongside the RouteWatcher title
   * fallback and any engine transient (waitForContentReady).
   *
   * The subscription asks for childList and attributes on the document with
   * subtree, with the same attribute filter the dedicated observer used:
   * - data-stream-item-id: post added/changed
   * - data-drive-id: file reference changed
   * - aria-expanded: accordion state changed
   * - aria-label: accessibility text changed (comment count, etc.)
   * - class: class names changed (state changes)
   * - style: visibility changes
   *
   * The port delivers every batch that contains at least one matching
   * record; the callback body already handles arbitrary batches, so the
   * multiplexed behavior is identical to the old dedicated observer.
   * characterData is NOT requested — text-only batches never reach engines.
   */
  private setupDomObserver(): void {
    // Drop any previous page's subscription first (idempotent).
    if (this.domUnsubscribe) {
      this.domUnsubscribe();
      this.domUnsubscribe = null;
    }

    this.domUnsubscribe = getPageDomPort().observe(
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'data-stream-item-id',
          'data-drive-id',
          'aria-expanded',
          'aria-label',
          'class',
          'style',
        ],
      },
      (mutations) => {
        if (!this.running) return;

        // Feed mutations to ALL active engines
        for (const engine of this.activeEngines) {
          try {
            engine.handleMutations(mutations);
          } catch (e) {
            console.error(
              `[CQD Orchestrator] Error in ${engine.name}.handleMutations:`, e,
            );
          }
        }

        // Publish this cycle's topics through the S5 roles (page bus).
        this.publishCycleTopics();
      },
    );
  }

  // ========================================================================
  // CYCLE TOPIC PUBLISHING (S5 — roles behind the bus)
  // ========================================================================

  /**
   * Build the four S5 roles against the page bus (once per start()).
   *
   * Role sources are thin adapters over the registry: they resolve the
   * PRIMARY engine at read time, so switching modes (legacy → shadow → v2)
   * is honored without rebuilding. EngineV1 lacks the render/harden getters;
   * the adapters surface that as an isolated no-op inside the role (design
   * §9 fault model) rather than letting a TypeError escape.
   */
  private constructRoles(): void {
    this.roles = {
      detect: new DetectEngine(this.pageBus, {
        getTrackedPosts: () =>
          engineRegistry.getPrimaryEngine()?.getTrackedPosts() ?? [],
      }),
      compute: new ComputeEngine(this.pageBus, {
        getFlagDecisions: () =>
          engineRegistry.getPrimaryEngine()?.getFlagDecisions() ?? [],
        getPlacementDecisions: () =>
          engineRegistry.getPrimaryEngine()?.getPlacementDecisions() ?? [],
      }),
      render: new RenderEngine(this.pageBus, {
        getLastRenderApplied: () =>
          (engineRegistry.getPrimaryEngine() as S5CapableEngine | null)
            ?.getLastRenderApplied?.() ?? [],
      }),
      harden: new HardenEngine(this.pageBus, {
        getBudgetSnapshot: () => {
          const primary: S5CapableEngine | null = engineRegistry.getPrimaryEngine();
          if (!primary || typeof primary.getBudgetSnapshot !== 'function') {
            // EngineV1 has no budget snapshot. Throwing here is safe: the
            // role isolates source throws and keeps its baseline.
            throw new Error('[CQD Orchestrator] primary engine exposes no budget snapshot');
          }
          return primary.getBudgetSnapshot();
        },
        getCorrectionStats: () => {
          const primary: S5CapableEngine | null = engineRegistry.getPrimaryEngine();
          if (!primary || typeof primary.getCorrectionStats !== 'function') {
            throw new Error('[CQD Orchestrator] primary engine exposes no correction stats');
          }
          return primary.getCorrectionStats();
        },
      }),
    };
  }

  /**
   * Publish one scan cycle's worth of topics through the S5 roles.
   *
   * Called at the tail of the shared MutationObserver callback, after all
   * engines have handled the mutations. Reads the PRIMARY engine only and
   * bails when nothing is active or no view is current. Publish order is
   * pinned by test: render → detect → compute → harden. EngineV1 lacks the
   * render/harden getters, so those two role calls are skipped for it; its
   * live-DOM getTrackedPosts and empty decision arrays still publish
   * real-but-empty detect/compute topics — correct verbatim behavior.
   */
  private publishCycleTopics(): void {
    const primary: S5CapableEngine | null = engineRegistry.getPrimaryEngine();
    if (!primary || !this.currentView) return;

    // S5 final-review fix: point the primary's optional correction hook at the
    // harden role, so EngineV2.handleCorrection's `onCorrectionSeen?.(item)`
    // fires land on the bus as 'correction:needed' via reportCorrection().
    // Re-assigned every cycle — idempotent, and a mode swap that installs a
    // fresh primary is re-wired on its next scan cycle. The `in` guard (not a
    // `typeof === 'function'` check) is deliberate: EngineV2 DECLARES the hook
    // as an own field that is undefined until wired, while EngineV1 has no
    // such field at all — `in` skips exactly the engines that lack the slot.
    if ('onCorrectionSeen' in primary) {
      primary.onCorrectionSeen = (item) => this.roles?.harden.reportCorrection(item);
    }

    if (typeof primary.getLastRenderApplied === 'function') {
      this.roles?.render.onRenderApplied();
    }
    this.roles?.detect.onScanComplete();
    this.roles?.compute.onDecisionsComputed();
    if (
      typeof primary.getBudgetSnapshot === 'function' &&
      typeof primary.getCorrectionStats === 'function'
    ) {
      this.roles?.harden.onCycleChecks();
    }
  }

  // ========================================================================
  // ABORT MANAGEMENT
  // ========================================================================

  /**
   * Abort the current page's lifecycle.
   *
   * This is called when:
   * - The user navigates to a different page
   * - The mode changes
   * - The orchestrator is stopped
   *
   * The AbortController signal is propagated to all async work:
   * - Engine init (if it's doing async waiting)
   * - Any fetch/API calls (V3)
   * - Timers and delayed operations
   */
  private abortCurrentPage(): void {
    // 0. Stop shadow comparison first
    this.stopShadowComparison();

    // 1. Abort the signal
    if (this.pageAbortController) {
      this.pageAbortController.abort();
      this.pageAbortController = null;
    }

    // 2. Unsubscribe the orchestrator's dom subscription. The shared port
    //    itself stays alive — the title fallback and engine transients are
    //    multiplexed on it too. Only stop() disposes the port.
    if (this.domUnsubscribe) {
      this.domUnsubscribe();
      this.domUnsubscribe = null;
    }

    // 3. Destroy active engines
    for (const engine of this.activeEngines) {
      try {
        engine.destroy();
      } catch (e) {
        console.error(`[CQD Orchestrator] Error destroying ${engine.name}:`, e);
      }
    }
    this.activeEngines = [];
  }

  // ========================================================================
  // DEBUG ACCESSORS
  // ========================================================================

  /**
   * Get a summary of the orchestrator's current state.
   * Used by the debug panel and console debugging.
   */
  getSummary(): string {
    const lines: string[] = [
      `Orchestrator:`,
      `  Running: ${this.running}`,
      `  Current View: ${this.currentView || 'none'}`,
      `  Active Engines: ${this.activeEngines.map(e => `${e.name} v${e.version}`).join(', ') || 'none'}`,
      `  DOM Observer: ${this.domUnsubscribe ? 'connected' : 'disconnected'}`,
      `  Page Signal: ${this.pageAbortController ? (this.pageAbortController.signal.aborted ? 'aborted' : 'active') : 'none'}`,
      '',
      engineRegistry.getSummary(),
    ];

    return lines.join('\n');
  }

  /**
   * Get the current view kind (for external use).
   */
  getCurrentView(): ViewKind | null {
    return this.currentView;
  }

  /**
   * The page bus. Roles and debug tooling get it here — never a global.
   */
  getBus(): EventBus<PageTopicMap> {
    return this.pageBus;
  }

  /**
   * Get active engines (for external use / debug panel).
   */
  getActiveEngines(): CQDEngine[] {
    return this.activeEngines;
  }

  /**
   * Get the latest shadow comparison report (for debug panel).
   */
  getShadowReport(): ShadowCompareResult | null {
    return this.latestShadowReport;
  }

  /**
   * Get all shadow reports (for debug panel history).
   */
  getShadowReports(): ShadowCompareResult[] {
    return this.shadowComparator?.getReports() ?? [];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

/**
 * The global orchestrator instance.
 *
 * Same reasoning as the EngineRegistry singleton — there's only ever
 * one orchestrator per tab, and it needs to be accessible from multiple
 * places (content script main(), debug panel, popup messages).
 */
export const orchestrator = new Orchestrator();
