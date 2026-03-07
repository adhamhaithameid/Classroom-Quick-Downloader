// filepath: extension/src/engines/v2/engine-v2.ts
/**
 * ============================================================================
 * ENGINE V2 — The New Unified DOM-Only Engine
 * ============================================================================
 *
 * This is where the magic happens. The V2 engine is the entire reason
 * for the refactor — it replaces the tangled mess of 3 independent content
 * scripts with a single, unified, testable engine.
 *
 * What makes V2 different from V1:
 *
 * 1. SINGLE OBSERVER — V1 had 3 MutationObservers + 3 heartbeats (6 sources
 *    of scanning). V2 has ONE observer in the orchestrator that feeds
 *    mutations to this engine. Less CPU, less battery, less bugs.
 *
 * 2. CANONICAL DATA MODEL — V1 queried the DOM on every scan, with no
 *    memory of what it found before. V2 maintains a PostNodeMap that
 *    tracks every post and its files. If a post was already scanned
 *    and nothing changed, we skip it. Huge performance win.
 *
 * 3. DECISION TRACING — Every decision (download button placement, flag
 *    detection) is recorded with a full trace. When something goes wrong,
 *    we can see *exactly* why. V1 was basically `if (found) append(button)`.
 *
 * 4. SMART SELECTORS — V1 used hardcoded CSS selectors that broke on
 *    Google deploys. V2 uses the SelectorScorer from selector-scorer.ts
 *    which tries 5 priority levels before giving up.
 *
 * 5. PROPER CLEANUP — V1 leaked event listeners and timers because each
 *    content script managed its own lifecycle. V2 uses a single
 *    AbortController that cancels everything on navigation.
 *
 * Architecture:
 *
 *   Orchestrator
 *       ↓ handleMutations()
 *   Engine V2
 *       ↓ 1. Discovery (find posts & files)
 *       ↓ 2. Flag Detection (comment & edited scoring)
 *       ↓ 3. Placement (decide where buttons go)
 *       ↓ 4. Rendering (create DOM elements) ← only in V2/primary mode
 *       ↓ 5. Repair (fix broken references)
 *
 * In shadow mode, step 4 (rendering) is SKIPPED. V2 just produces
 * decisions that get compared to V1's actual rendering. This is how
 * we validate V2 without risking the user experience.
 *
 * @author Adham — 5 months of work condensed into one engine class
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
import {
  createPostScorer,
  createFileAnchorScorer,
  createCommentFlagScorer,
  createDateContainerScorer,
  createHeaderScorer,
  createExclusionScorer,
} from '../../v2/selectors/selector-registry';
import type { SelectorScorer } from '../../v2/selectors/selector-scorer';
import { computePlacement } from '../../v2/decision/file-placement';
import { scoreFlagsForPost } from '../../v2/decision/flag-scoring';
import { clearKeywordCache } from '../../v2/decision/keyword-loader';
import type { ScannedPost, ScannedFile } from '../../v2/model/dom-scanner';
import { renderBatch, removeStaleButtons, removeAllV2Buttons } from '../../v2/render/button-renderer';
import { injectV2Styles, removeV2Styles } from '../../v2/render/button-styles';
import { renderFlagBadge, removeAllV2Badges } from '../../v2/render/flag-renderer';
import { removeFlagStyles } from '../../v2/render/flag-styles';
import { validateBatch, clearInstabilityState } from '../../v2/repair/deep-validator';
import { CorrectionQueue } from '../../v2/repair/correction-queue';
import { BudgetController } from '../../v2/telemetry/budget-controller';
import { PerformanceMonitor } from '../../v2/telemetry/performance-monitor';
import type { BudgetSnapshot } from '../../v2/telemetry/budget-controller';
import type { PerformanceSummary } from '../../v2/telemetry/performance-monitor';

// ============================================================================
// V2 ENGINE CLASS
// ============================================================================

export class EngineV2 implements CQDEngine {
  readonly name = 'engine-v2';
  readonly version = '4.0.0-alpha';

  // -- State --
  private isActive = false;
  private currentView: ViewKind | null = null;
  private signal: AbortSignal | null = null;

  // -- Post tracking --
  // WeakMap so posts get GC'd when their DOM elements are removed
  // This is something V1 never did — it just queried the DOM every time
  // which is why V1 sometimes showed stale data for removed posts
  private postMap: Map<string, PostNode> = new Map();
  private elementToPostId: WeakMap<HTMLElement, string> = new WeakMap();

  // -- Scorers (created fresh on each init to reset failure counts) --
  private postScorer: SelectorScorer | null = null;
  private fileScorer: SelectorScorer | null = null;
  private commentScorer: SelectorScorer | null = null;
  private dateScorer: SelectorScorer | null = null;
  private headerScorer: SelectorScorer | null = null;
  private exclusionScorer: SelectorScorer | null = null;

  // -- Decision history --
  private flagDecisions: Map<string, FlagDecision> = new Map();
  private placementDecisions: PlacementDecision[] = [];
  private decisionTraces: Map<string, DecisionTrace> = new Map();

  // -- Performance tracking --
  private scanCount = 0;
  private totalScanMs = 0;

  // -- Phase 5: Repair + Telemetry --
  private correctionQueue = new CorrectionQueue();
  private budgetController = new BudgetController();
  private performanceMonitor = new PerformanceMonitor();
  private deepValidationScheduled = false;

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  async init(viewKind: ViewKind, signal: AbortSignal): Promise<void> {
    this.currentView = viewKind;
    this.signal = signal;
    this.isActive = true;

    // Create fresh scorers for each page load
    // This resets failure counts so selectors get a clean slate
    this.postScorer = createPostScorer();
    this.fileScorer = createFileAnchorScorer();
    this.commentScorer = createCommentFlagScorer();
    this.dateScorer = createDateContainerScorer();
    this.headerScorer = createHeaderScorer();
    this.exclusionScorer = createExclusionScorer();

    // Clear previous state
    this.postMap.clear();
    this.flagDecisions.clear();
    this.placementDecisions = [];
    this.decisionTraces.clear();
    this.scanCount = 0;
    this.totalScanMs = 0;

    // Reset Phase 5 systems
    this.correctionQueue.flush();
    this.budgetController.reset();
    this.performanceMonitor.reset();
    clearInstabilityState();

    // Set up correction handler
    this.correctionQueue.setHandler((item) => this.handleCorrection(item));

    console.log(
      `[Engine V2] Initialized for view: ${viewKind}`,
    );

    // Run initial full scan after a short delay to let the DOM settle
    // Google Classroom takes a moment to render the page after navigation
    if (!signal.aborted) {
      await this.waitForContentReady(signal);
      if (!signal.aborted) {
        this.fullScan();
      }
    }
  }

  destroy(): void {
    this.isActive = false;
    this.currentView = null;
    this.signal = null;

    // Remove all V2-injected buttons from the DOM
    // This is important — V1 leaked buttons on navigation, V2 cleans up
    removeAllV2Buttons();
    removeV2Styles();

    // Remove all V2-injected flag badges from the DOM
    removeAllV2Badges();
    removeFlagStyles();

    // Clear keyword cache to free memory
    clearKeywordCache();

    // Flush Phase 5 systems
    this.correctionQueue.flush();
    clearInstabilityState();
    this.deepValidationScheduled = false;

    // Clear all state
    this.postMap.clear();
    this.flagDecisions.clear();
    this.placementDecisions = [];
    this.decisionTraces.clear();

    // Null out scorers to free memory
    this.postScorer = null;
    this.fileScorer = null;
    this.commentScorer = null;
    this.dateScorer = null;
    this.headerScorer = null;
    this.exclusionScorer = null;

    // Log final stats
    const summary = this.performanceMonitor.getPerformanceSummary();
    console.log(
      `[Engine V2] Destroyed (${this.scanCount} scans, avg ${
        this.scanCount > 0 ? (this.totalScanMs / this.scanCount).toFixed(1) : 0
      }ms, injected: ${summary.injectedElementCount})`,
    );
  }

  // ========================================================================
  // MUTATION HANDLING
  // ========================================================================

  /**
   * Process a batch of DOM mutations.
   *
   * This is called by the orchestrator's single MutationObserver.
   * The key insight is: we DON'T need to process every mutation.
   * We only care about mutations that:
   * 1. Add or remove post containers (data-stream-item-id elements)
   * 2. Add or remove file attachments (Drive anchors)
   * 3. Change attributes on flag-related elements
   *
   * Everything else is ignored. This makes handleMutations() FAST.
   * Target: <6ms p95.
   */
  handleMutations(mutations: MutationRecord[]): void {
    if (!this.isActive || !this.postScorer) return;

    const startTime = performance.now();
    let needsRescan = false;

    for (const mutation of mutations) {
      // Skip mutations on our own injected elements
      // (Otherwise we'd trigger infinite rescan loops)
      const target = mutation.target as HTMLElement;
      if (target.hasAttribute?.('data-cqd-injected')) continue;

      if (mutation.type === 'childList') {
        // Check if any added/removed nodes contain posts or files
        for (const node of mutation.addedNodes) {
          if (this.isRelevantNode(node)) {
            needsRescan = true;
            break;
          }
        }
        if (!needsRescan) {
          for (const node of mutation.removedNodes) {
            if (this.isRelevantNode(node)) {
              needsRescan = true;
              break;
            }
          }
        }
      } else if (mutation.type === 'attributes') {
        // Only care about specific attribute changes
        const attr = mutation.attributeName;
        if (
          attr === 'data-stream-item-id' ||
          attr === 'data-drive-id' ||
          attr === 'aria-expanded' ||
          attr === 'aria-label'
        ) {
          needsRescan = true;
        }
      }

      if (needsRescan) break;
    }

    if (needsRescan) {
      this.fullScan();
    }

    const elapsed = performance.now() - startTime;
    this.totalScanMs += elapsed;
  }

  // ========================================================================
  // FULL SCAN
  // ========================================================================

  /**
   * Run a complete scan of the page.
   *
   * This is the heart of V2. It goes through a pipeline:
   * 1. DISCOVER — Find all post elements on the page
   * 2. EXTRACT — For each post, find its file attachments
   * 3. DETECT — For each post, run flag detection (comments, edited)
   * 4. PLAN — Generate placement decisions for buttons
   *
   * Each step uses the SelectorScorer for resilient element finding.
   * Each step produces traced decisions for debugging.
   */
  fullScan(): void {
    if (!this.isActive || !this.postScorer || !this.fileScorer) return;

    // Budget gate: skip if hard cap hit
    if (this.budgetController.isHardCapHit()) return;

    this.performanceMonitor.startTimer('fullScan');
    const startTime = performance.now();
    this.scanCount++;

    // 1. DISCOVER POSTS
    // Use the smart scorer to find post elements
    // The scorer tries L1 (data-attr) first, falls back through L2-L5
    const postResult = this.postScorer.queryAll(document.body);
    const postElements = postResult.allElements;

    // Track which posts we've seen this scan (for cleanup)
    const seenPostIds = new Set<string>();

    // 2. PROCESS EACH POST
    for (const postEl of postElements) {
      // Skip nested posts (posts inside posts)
      // This happens in some Classroom views where material cards
      // are nested inside assignment cards
      if (postEl.parentElement?.closest('[data-stream-item-id]')) continue;

      const postId =
        postEl.getAttribute('data-stream-item-id') ||
        `v2-fallback-${Math.random().toString(36).slice(2)}`;
      seenPostIds.add(postId);

      // Get or create the PostNode
      let post = this.postMap.get(postId);
      if (!post) {
        post = {
          id: postId,
          element: postEl,
          viewKind: this.currentView || ('unknown' as ViewKind),
          files: [],
          flags: null,
          lastScannedAt: 0,
        };
        this.postMap.set(postId, post);
        this.elementToPostId.set(postEl, postId);
      }

      // Update element reference (it might have been re-rendered)
      post.element = postEl;
      post.lastScannedAt = Date.now();

      // 2a. EXTRACT FILES from this post
      post.files = this.discoverFiles(postEl);

      // 2b. DETECT FLAGS for this post
      post.flags = this.detectFlags(postEl, postId);
    }

    // 3. CLEANUP — Remove posts that are no longer in the DOM
    for (const [postId, post] of this.postMap.entries()) {
      if (!seenPostIds.has(postId) || !post.element.isConnected) {
        this.postMap.delete(postId);
        this.flagDecisions.delete(postId);
        this.decisionTraces.delete(postId);
      }
    }

    // 4. PLAN PLACEMENTS
    this.placementDecisions = this.planPlacements();

    // 5. RENDER FLAG BADGES
    this.renderDetectedFlags();

    const elapsed = performance.now() - startTime;
    this.totalScanMs += elapsed;

    // 6. RECORD TIMING + BUDGET CHECK
    this.performanceMonitor.stopTimer('fullScan');
    const budgetResult = this.budgetController.recordFastPass(elapsed);
    this.budgetController.updatePostCount(this.postMap.size);

    // 7. SCHEDULE DEEP VALIDATION (idle time)
    this.scheduleDeepValidation();

    // Log performance every 10th scan
    if (this.scanCount % 10 === 0) {
      console.log(
        `[Engine V2] Scan #${this.scanCount}: ${postElements.length} posts, ` +
        `${elapsed.toFixed(1)}ms, avg ${(this.totalScanMs / this.scanCount).toFixed(1)}ms` +
        `${budgetResult !== 'ok' ? ` [BUDGET: ${budgetResult}]` : ''}`,
      );
    }
  }

  // ========================================================================
  // FILE DISCOVERY
  // ========================================================================

  /**
   * Find all downloadable files within a post element.
   *
   * Uses the file anchor scorer (selector-registry.ts) to find
   * Drive links and file containers. Deduplicates by canonical file ID.
   *
   * The canonical ID extraction priority:
   * 1. data-drive-id attribute (Google's own identifier)
   * 2. Drive file ID from URL regex (/file/d/{id}/)
   * 3. data-id + data-item-id combination
   * 4. URL hash (fallback for weird URLs)
   */
  private discoverFiles(postEl: HTMLElement): FileNode[] {
    if (!this.fileScorer) return [];

    const fileResult = this.fileScorer.queryAll(postEl);
    const files: FileNode[] = [];
    const seenIds = new Set<string>();

    for (const el of fileResult.allElements) {
      const file = this.extractFileNode(el);
      if (file && !seenIds.has(file.canonicalId)) {
        seenIds.add(file.canonicalId);
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Extract a FileNode from a DOM element.
   *
   * This is where the canonical ID logic lives. It's the key to
   * deduplication — the same file appearing with different URLs
   * (due to authuser, hl params) will get the same canonical ID.
   */
  private extractFileNode(el: HTMLElement): FileNode | null {
    // Determine the source URL
    const href = el.tagName === 'A'
      ? (el as HTMLAnchorElement).href
      : el.querySelector<HTMLAnchorElement>('a[href*="drive.google.com"]')?.href;

    if (!href) return null;

    // Extract canonical ID using priority chain
    let canonicalId: string;
    let idSource: FileNode['idSource'];

    // Priority 1: data-drive-id
    const driveId = el.getAttribute('data-drive-id') ||
      el.closest('[data-drive-id]')?.getAttribute('data-drive-id');
    if (driveId) {
      canonicalId = `drive-${driveId}`;
      idSource = 'data-drive-id';
    } else {
      // Priority 2: URL-based Drive file ID
      const urlMatch = href.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
      if (urlMatch) {
        canonicalId = `drive-${urlMatch[1]}`;
        idSource = 'url-parse';
      } else {
        // Priority 3: data-id + data-item-id
        const dataId = el.getAttribute('data-id');
        const itemId = el.getAttribute('data-item-id');
        if (dataId && itemId) {
          canonicalId = `dataid-${dataId}-${itemId}`;
          idSource = 'data-id-combo';
        } else {
          // Priority 4: URL hash
          try {
            const url = new URL(href);
            url.searchParams.delete('authuser');
            url.searchParams.delete('u');
            url.searchParams.delete('hl');
            canonicalId = `url-${url.toString()}`;
            idSource = 'url-hash';
          } catch {
            return null;
          }
        }
      }
    }

    // Extract file name and extension
    let name = '';
    let ext = '';

    // Try aria-label first (most complete name)
    const ariaLabel = el.getAttribute('aria-label') ||
      el.querySelector('[aria-label]')?.getAttribute('aria-label');
    if (ariaLabel) {
      name = ariaLabel;
    }

    // Try to extract extension from the URL or name
    const extMatch = (name || href).match(/\.([a-zA-Z0-9]{1,10})(?:\?|$)/);
    if (extMatch) {
      ext = extMatch[1].toLowerCase();
    }

    return {
      canonicalId,
      name: name || 'Untitled',
      ext,
      downloadUrl: href,
      element: el,
      idSource,
    };
  }

  // ========================================================================
  // FLAG DETECTION — Phase 4 Unified Flag Scoring Engine
  // ========================================================================

  /**
   * Detect comment and edited flags for a post.
   *
   * Phase 4 implementation: delegates to the unified flag-scoring engine
   * (scoreFlagsForPost) which runs the full 5-layer comment detection +
   * 4-layer edited detection pipeline with exclusion engine and
   * lazy-loaded keyword tables.
   *
   * Every decision is recorded with a full DecisionTrace for debugging.
   */
  private detectFlags(postEl: HTMLElement, postId: string): FlagDecision | null {
    if (!this.currentView) return null;

    try {
      const decision = scoreFlagsForPost(
        postEl,
        postId,
        this.currentView,
      );

      this.flagDecisions.set(postId, decision);
      this.decisionTraces.set(postId, decision.trace);

      return decision;
    } catch (err) {
      console.warn(`[Engine V2] Flag detection failed for post ${postId}:`, err);
      return null;
    }
  }

  /**
   * Render flag badges for all posts with flag decisions.
   *
   * Called after flag detection + placement planning in fullScan().
   * Each post with a non-'none' verdict gets a badge injected.
   */
  private renderDetectedFlags(): void {
    for (const [postId, decision] of this.flagDecisions) {
      const post = this.postMap.get(postId);
      if (!post || !post.element.isConnected) continue;

      renderFlagBadge(decision, post.element);
    }
  }

  // ========================================================================
  // DEEP VALIDATION — Phase 5 Idle-Time Repair
  // ========================================================================

  /**
   * Schedule deep validation via requestIdleCallback.
   *
   * Only schedules if not already scheduled. The validation runs in
   * idle time and produces CorrectionItems which are enqueued for
   * processing.
   */
  private scheduleDeepValidation(): void {
    if (this.deepValidationScheduled || !this.isActive) return;
    this.deepValidationScheduled = true;

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback((deadline) => {
        this.deepValidationScheduled = false;
        if (!this.isActive) return;

        this.runDeepValidation(() => deadline.timeRemaining());
      });
    } else {
      // Fallback for environments without requestIdleCallback
      setTimeout(() => {
        this.deepValidationScheduled = false;
        if (!this.isActive) return;

        this.runDeepValidation(() => 16);
      }, 0);
    }
  }

  /**
   * Run deep validation and enqueue corrections.
   */
  private runDeepValidation(timeRemaining: () => number): void {
    this.performanceMonitor.startTimer('deepValidation');

    const result = validateBatch(
      this.getTrackedPosts(),
      this.flagDecisions,
      this.placementDecisions,
      undefined, // viewport zone getter (would come from orchestrator)
      timeRemaining,
      this.signal ?? undefined,
    );

    const elapsed = this.performanceMonitor.stopTimer('deepValidation');
    this.budgetController.recordDeepPass(elapsed >= 0 ? elapsed : 0);

    // Enqueue corrections
    if (result.corrections.length > 0) {
      this.correctionQueue.enqueueAll(result.corrections);
      this.correctionQueue.scheduleProcessing();
    }
  }

  /**
   * Handle a single correction from the correction queue.
   * Returns true if correction was successful.
   */
  private handleCorrection(item: import('../../v2/repair/deep-validator').CorrectionItem): boolean {
    if (!this.isActive) return false;

    try {
      switch (item.op) {
        case 'inject-button': {
          // Re-run file discovery for this post
          const post = this.postMap.get(item.postId);
          if (!post) return false;
          post.files = this.discoverFiles(post.element);
          return true;
        }

        case 'remove-button': {
          if (item.element.isConnected) {
            item.element.remove();
          }
          return true;
        }

        case 'update-flag': {
          const decision = this.flagDecisions.get(item.postId);
          const post = this.postMap.get(item.postId);
          if (!decision || !post) return false;
          renderFlagBadge(decision, post.element);
          return true;
        }

        case 'remove-flag': {
          const post = this.postMap.get(item.postId);
          if (!post) return false;
          const badge = post.element.querySelector('.cqd-v2-flag');
          if (badge) badge.remove();
          const overlay = post.element.querySelector('.cqd-v2-overlay');
          if (overlay) overlay.remove();
          post.element.removeAttribute('data-cqd-v2-flag');
          post.element.removeAttribute('data-cqd-v2-flag-verdict');
          return true;
        }

        case 'fix-overlay': {
          const decision2 = this.flagDecisions.get(item.postId);
          const post2 = this.postMap.get(item.postId);
          if (!decision2 || !post2) return false;
          renderFlagBadge(decision2, post2.element);
          return true;
        }

        case 'full-rescan': {
          this.fullScan();
          return true;
        }

        default:
          return false;
      }
    } catch (err) {
      console.warn(`[Engine V2] Correction failed for ${item.id}:`, err);
      return false;
    }
  }

  // ========================================================================
  // PLACEMENT PLANNING — Phase 3 Deterministic Button Placement
  // ========================================================================

  /**
   * Generate placement decisions for all tracked files.
   *
   * Uses the Phase 3 placement engine which:
   * 1. Gets the placement recipe for the current ViewKind
   * 2. Runs SelectorScorer to find anchor elements (header, three-dots, etc.)
   * 3. Produces PlacementDecisions with confidence scores and reason codes
   * 4. Deduplicates — skips files that already have buttons
   *
   * This replaced the old stub that just appended everything to the file element.
   * Now we have proper anchor scoring, per-view recipes, and full audit trails.
   */
  private planPlacements(): PlacementDecision[] {
    if (!this.currentView) return [];

    const allDecisions: PlacementDecision[] = [];

    for (const post of this.postMap.values()) {
      // Convert PostNode → ScannedPost for the placement engine
      // The placement engine uses ScannedPost/ScannedFile types from dom-scanner
      // which are structurally compatible with PostNode/FileNode
      const scannedPost: ScannedPost = {
        id: post.id,
        element: post.element,
        fingerprint: `${post.id}-${post.files.length}-${post.lastScannedAt}`,
        files: post.files.map((f): ScannedFile => ({
          canonicalId: f.canonicalId,
          element: f.element,
          idSource: f.idSource,
          name: f.name,
          ext: f.ext,
          downloadUrl: f.downloadUrl,
        })),
        isExpanded: true, // Default to expanded — accordion check done by recipe
        isConnected: post.element.isConnected,
      };

      // Check accordion state for classwork views
      // If the post has an aria-expanded attribute, use its value
      const expandToggle = post.element.querySelector('[aria-expanded]');
      if (expandToggle) {
        scannedPost.isExpanded = expandToggle.getAttribute('aria-expanded') === 'true';
      }

      // Compute placement decisions for this post
      const postDecisions = computePlacement(scannedPost, this.currentView);
      allDecisions.push(...postDecisions);
    }

    return allDecisions;
  }

  /**
   * Render buttons based on placement decisions.
   *
   * This is only called when the engine is in active (non-shadow) mode.
   * In shadow mode, we compute decisions but don't render — the decisions
   * are logged for comparison with V1's actual rendering.
   *
   * Uses the V2 renderer which provides:
   * - Template cloning (~10× faster than createElement)
   * - CSS-only hover states (zero JS on mouseenter)
   * - Delegated click handlers (one per post root)
   */
  private renderPlacedButtons(): void {
    if (this.placementDecisions.length === 0) return;

    // Build a file map for the renderer
    const fileMap = new Map<string, ScannedFile>();
    for (const post of this.postMap.values()) {
      for (const file of post.files) {
        fileMap.set(file.canonicalId, {
          canonicalId: file.canonicalId,
          element: file.element,
          idSource: file.idSource,
          name: file.name,
          ext: file.ext,
          downloadUrl: file.downloadUrl,
        });
      }
    }

    // Render all buttons in one batch
    renderBatch(this.placementDecisions, fileMap);

    // Clean up stale buttons (files that were removed since last scan)
    for (const post of this.postMap.values()) {
      const validIds = new Set(post.files.map(f => f.canonicalId));
      // Also keep the Download All button
      validIds.add(`download-all:${post.id}`);
      removeStaleButtons(post.element, validIds);
    }
  }

  // ========================================================================
  // DATA ACCESSORS (CQDEngine interface)
  // ========================================================================

  getTrackedPosts(): PostNode[] {
    return Array.from(this.postMap.values());
  }

  getPlacementDecisions(): PlacementDecision[] {
    return this.placementDecisions;
  }

  getFlagDecisions(): FlagDecision[] {
    return Array.from(this.flagDecisions.values());
  }

  getDecisionTrace(postId: string): DecisionTrace | null {
    return this.decisionTraces.get(postId) ?? null;
  }

  // ========================================================================
  // PHASE 5 PUBLIC API — Telemetry + Repair
  // ========================================================================

  /**
   * Get a full performance summary (for debug panel).
   */
  getPerformanceSummary(): PerformanceSummary {
    return this.performanceMonitor.getPerformanceSummary();
  }

  /**
   * Get a budget snapshot (for debug panel).
   */
  getBudgetSnapshot(): BudgetSnapshot {
    return this.budgetController.getBudgetSnapshot();
  }

  /**
   * Get correction queue stats (for debug panel).
   */
  getCorrectionStats(): import('../../v2/repair/correction-queue').QueueStats {
    return this.correctionQueue.getStats();
  }

  // ========================================================================
  // PHASE 6 PUBLIC API — Shadow Validation Metrics
  // ========================================================================

  /**
   * Count duplicate injections in the DOM.
   *
   * Checks for:
   * - Duplicate download buttons (same file-id in same post)
   * - Duplicate flag badges (2+ badges in same post)
   *
   * @returns Total number of duplicates found
   */
  getDuplicateCount(): number {
    let duplicates = 0;

    for (const post of this.postMap.values()) {
      // Check duplicate buttons per file
      const fileIds = new Set<string>();
      const buttons = post.element.querySelectorAll('[data-cqd-injected][data-cqd-file-id]');
      for (const btn of buttons) {
        const fileId = (btn as HTMLElement).getAttribute('data-cqd-file-id') ?? '';
        if (fileIds.has(fileId)) {
          duplicates++;
        } else {
          fileIds.add(fileId);
        }
      }

      // Check duplicate badges
      const badges = post.element.querySelectorAll('.cqd-v2-flag');
      if (badges.length > 1) {
        duplicates += badges.length - 1;
      }
    }

    return duplicates;
  }

  /**
   * Get coverage stats for shadow validation.
   *
   * @returns Button coverage percentage and flag precision percentage
   */
  getCoverageStats(): { buttonCoverage: number; flagPrecision: number; totalFiles: number; totalPosts: number } {
    let totalFiles = 0;
    let filesWithButtons = 0;

    for (const post of this.postMap.values()) {
      for (const file of post.files) {
        totalFiles++;
        const btn = post.element.querySelector(`[data-cqd-file-id="${file.canonicalId}"]`);
        if (btn) filesWithButtons++;
      }
    }

    const buttonCoverage = totalFiles > 0 ? (filesWithButtons / totalFiles) * 100 : 100;

    // Flag precision: how many flag decisions have matching DOM badges
    let flagChecks = 0;
    let flagMatches = 0;
    for (const [postId, decision] of this.flagDecisions) {
      const post = this.postMap.get(postId);
      if (!post) continue;
      flagChecks++;

      const badge = post.element.querySelector('.cqd-v2-flag');
      const hasBadge = !!badge;
      const wantsBadge = decision.finalVerdict !== 'none';

      if (hasBadge === wantsBadge) flagMatches++;
    }

    const flagPrecision = flagChecks > 0 ? (flagMatches / flagChecks) * 100 : 100;

    return {
      buttonCoverage,
      flagPrecision,
      totalFiles,
      totalPosts: this.postMap.size,
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Check if a DOM node is "relevant" — i.e., might contain posts or files
   * that we care about.
   *
   * This is the key performance optimization for handleMutations().
   * Instead of re-scanning on EVERY mutation, we only rescan when
   * a mutation involves elements we actually care about.
   */
  private isRelevantNode(node: Node): boolean {
    // Note: using literal 1 instead of Node.ELEMENT_NODE because
    // Node isn't available as a global in all test environments (jsdom)
    if (node.nodeType !== 1) return false;

    const el = node as HTMLElement;

    // Direct hit — the added/removed node IS a post or file
    if (
      el.hasAttribute('data-stream-item-id') ||
      el.hasAttribute('data-drive-id') ||
      el.tagName === 'A'
    ) {
      return true;
    }

    // Subtree hit — the added/removed node CONTAINS posts or files
    // We use a quick querySelector check rather than walking the tree
    if (
      el.querySelector?.('[data-stream-item-id]') ||
      el.querySelector?.('[data-drive-id]') ||
      el.querySelector?.('a[href*="drive.google.com"]')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Wait for Classroom content to be ready.
   *
   * Google Classroom uses lazy rendering — the DOM might be mostly
   * empty right after navigation because the content is loaded
   * asynchronously. We wait for a post to appear before scanning.
   *
   * Timeout: 5 seconds max. If no posts appear, we scan anyway
   * (the page might genuinely have no posts).
   */
  private waitForContentReady(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      // Check if content is already ready
      if (document.querySelector('[data-stream-item-id]')) {
        resolve();
        return;
      }

      // Set up a MutationObserver to wait for posts
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-stream-item-id]')) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve();
        }
      });

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);

      // If the signal is aborted, clean up
      signal.addEventListener('abort', () => {
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }
}
