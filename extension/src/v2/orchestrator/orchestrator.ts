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

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class Orchestrator {
  /** Whether the orchestrator is currently running */
  private running = false;

  /** Watches for URL changes in the Classroom SPA */
  private routeWatcher: RouteWatcher | null = null;

  /** The single MutationObserver that feeds all active engines */
  private domObserver: MutationObserver | null = null;

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

    // 2. Abort current page lifecycle
    this.abortCurrentPage();

    // 3. Disconnect DOM observer
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    // 4. Destroy all active engines
    for (const engine of this.activeEngines) {
      try {
        engine.destroy();
      } catch (e) {
        console.error(`[CQD Orchestrator] Error destroying ${engine.name}:`, e);
      }
    }
    this.activeEngines = [];

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
   * Set up the single shared MutationObserver.
   *
   * ONE observer for ALL engines. This is the key performance improvement
   * over V1's three independent observers.
   *
   * We observe childList and attributes on document.body with subtree.
   * The attribute filter is tuned to only catch changes we care about:
   * - data-stream-item-id: post added/changed
   * - data-drive-id: file reference changed
   * - aria-expanded: accordion state changed
   * - aria-label: accessibility text changed (comment count, etc.)
   * - class: class names changed (state changes)
   * - style: visibility changes
   *
   * We DON'T observe characterData because text changes within existing
   * elements rarely affect our decisions. If we need to catch text changes
   * in the future, we can add it, but for now it saves a lot of noise.
   */
  private setupDomObserver(): void {
    // Disconnect any existing observer
    if (this.domObserver) {
      this.domObserver.disconnect();
    }

    // Create the shared observer
    this.domObserver = new MutationObserver((mutations) => {
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
    });

    // Start observing
    if (document.body) {
      this.domObserver.observe(document.body, {
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
      });
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

    // 2. Disconnect DOM observer
    if (this.domObserver) {
      this.domObserver.disconnect();
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
      `  DOM Observer: ${this.domObserver ? 'connected' : 'disconnected'}`,
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
