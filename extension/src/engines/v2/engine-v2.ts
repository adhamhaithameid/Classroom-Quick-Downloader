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
  SelectorStats,
} from '../types';
import {
  createPostScorer,
  createFileAnchorScorer,
  createCommentFlagScorer,
  createDateContainerScorer,
  createHeaderScorer,
  createExclusionScorer,
} from '../../v2/selectors/selector-registry';
import { engineRegistry } from '../engine-registry';
import type { SelectorScorer } from '../../v2/selectors/selector-scorer';
import { computePlacement } from '../../v2/decision/file-placement';
import { scoreFlagsForPost } from '../../v2/decision/flag-scoring';
import { keywordDetector } from '../../detect/keyword/keyword-detector';
import { runComparison, installCompareGlobals } from '../../compare/compare-runner';
import type { ScannedPost, ScannedFile } from '../../v2/model/dom-scanner';
import { renderBatch, removeStaleButtons, removeAllV2Buttons } from '../../v2/render/button-renderer';
import { ensurePostClickWiring, resetDownloadController } from '../../v2/render/download-controller';
import { resetDownloadAllController } from '../../v2/render/download-all-controller';
import { resolveDownloadUrl } from '../../v2/decision/download-url';
import { sanitizeFileName } from '../../core/name/sanitize';
import { injectV2Styles, removeV2Styles } from '../../v2/render/button-styles';
import { renderFlagBadge, removeAllV2Badges } from '../../v2/render/flag-renderer';
import { removeFlagStyles } from '../../v2/render/flag-styles';
import { validateBatch, clearInstabilityState } from '../../v2/repair/deep-validator';
import { getPageDomPort } from '../../adapters/dom/mutation-observer-dom-port';
import { CorrectionQueue } from '../../v2/repair/correction-queue';
import { BudgetController } from '../../v2/telemetry/budget-controller';
import { PerformanceMonitor } from '../../v2/telemetry/performance-monitor';
import type { BudgetSnapshot } from '../../v2/telemetry/budget-controller';
import type { PerformanceSummary, TimingPercentiles } from '../../v2/telemetry/performance-monitor';

// ============================================================================
// TARGETED MUTATION SCAN BOUND (S11, gate G5)
// ============================================================================

/**
 * Maximum number of post cards a single mutation batch may touch before the
 * batch escalates from a targeted scan to a full page scan.
 *
 * A targeted per-post pass costs ~0.3-0.5ms; eight posts keep the worst
 * targeted batch safely under the 6ms FAST_PASS_TARGET while still covering
 * every realistic interactive batch (one card appended, one attachment
 * added, one accordion toggled). Batches beyond the bound — initial page
 * render, SPA view swap, a Classroom re-render of the whole stream — are
 * exactly the cases where a full page scan is the efficient move anyway.
 */
export const TARGETED_SCAN_MAX_POSTS = 8;

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

  /** S5 additive: what the last render cycle applied, for the RenderEngine role. */
  private lastRenderApplied: Array<{ postId: string; kind: 'button' | 'flag' | 'all' }> = [];

  // -- Performance tracking --
  private scanCount = 0;
  private totalScanMs = 0;

  // -- Phase 5: Repair + Telemetry --
  private correctionQueue = new CorrectionQueue();
  private budgetController = new BudgetController();
  private performanceMonitor = new PerformanceMonitor();
  private deepValidationScheduled = false;

  /** S5 additive: optional publish hook — fires once per correction this
   *  engine actually handles, for the HardenEngine role to publish
   *  'correction:needed'. Undefined by default: with no listener wired this
   *  field is never invoked and behavior is unchanged. */
  onCorrectionSeen?: (item: import('../../v2/repair/deep-validator').CorrectionItem) => void;

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  async init(viewKind: ViewKind, signal: AbortSignal): Promise<void> {
    this.currentView = viewKind;
    this.signal = signal;
    this.isActive = true;

    // Compare build only — installs window.__cqd. Folded away in production.
    if (import.meta.env.MODE === 'compare') {
      installCompareGlobals();
    }

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

    // Let the detector drop whatever it cached for this page, to free memory
    keywordDetector.reset();

    // Drop in-flight download state (pending buttons died with the page)
    resetDownloadController();
    resetDownloadAllController();

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
   * S11 (gate G5): when a relevant batch can be resolved to specific post
   * cards, ONLY those posts run through the per-post pipeline
   * (targetedScan) — reusing the exact ingest/render functions fullScan
   * uses per post, so detection semantics are unchanged. The full page
   * scan remains for view changes/init and as the bounded escalation for
   * batches that are too large or unresolvable. Target: <6ms p95.
   */
  handleMutations(mutations: MutationRecord[]): void {
    if (!this.isActive || !this.postScorer) return;

    // S11: time the REAL mutation handling — the relevance scan plus any
    // scan dispatch — into the 'handleMutations' histogram, using the
    // same startTimer/stopTimer pattern fullScan uses for 'fullScan'. The
    // early return above stays untimed (nothing was handled), mirroring how
    // fullScan excludes its own guards. p95 of this label is the fast-pass
    // budget metric (<6ms, budget-controller FAST_PASS_TARGET).
    this.performanceMonitor.startTimer('handleMutations');
    const startTime = performance.now();

    // Resolve which post cards this batch actually touches. null means the
    // batch is relevant but cannot be scoped (or exceeds the targeted
    // bound) — the bounded escalation is the full page scan.
    const affected = this.resolveAffectedPosts(mutations);

    if (affected === null) {
      this.fullScan();
    } else if (affected.posts.size > 0 || affected.hadRemovals) {
      this.targetedScan(affected.posts, affected.hadRemovals);
    }
    // else: every record in the batch was irrelevant — nothing to scan.

    const elapsed = performance.now() - startTime;
    this.totalScanMs += elapsed;
    this.performanceMonitor.stopTimer('handleMutations');
  }

  // ========================================================================
  // TARGETED MUTATION SCANNING (S11)
  // ========================================================================

  /**
   * Resolve the post cards a mutation batch touches.
   *
   * Relevance rules are IDENTICAL to the pre-S11 gate (isRelevantNode on
   * added/removed nodes; the same four attribute names) — this function
   * only adds resolution of WHICH post cards were touched:
   *
   * - added node → itself (if it is a post card), its containing post card
   *   (attachment landed inside one), and any post cards it contains
   *   (a container rendered several posts at once).
   * - removed node → the containing post card re-scans (its file set
   *   shrank); removed post cards are dropped by targetedScan's
   *   connectivity sweep.
   * - attribute change → the post card the changed element belongs to.
   *
   * Returns null — escalate to fullScan — when a relevant record resolves
   * to no post card (e.g. a Drive anchor added outside any post) or when
   * the touched-post count exceeds TARGETED_SCAN_MAX_POSTS.
   */
  private resolveAffectedPosts(
    mutations: MutationRecord[],
  ): { posts: Set<HTMLElement>; hadRemovals: boolean } | null {
    const posts = new Set<HTMLElement>();
    let hadRemovals = false;

    for (const mutation of mutations) {
      // Skip mutations on our own injected elements
      // (Otherwise we'd trigger infinite rescan loops)
      const target = mutation.target as HTMLElement;
      if (target.hasAttribute?.('data-cqd-injected')) continue;

      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node as HTMLElement;
          if (!this.isRelevantNode(el)) continue;
          const before = posts.size;
          this.collectTouchedPosts(el, posts);
          // Relevant but resolves to no post card — the old behavior
          // (full page scan) is the safe escalation.
          if (posts.size === before) return null;
          if (posts.size > TARGETED_SCAN_MAX_POSTS) return null;
        }
        for (const node of mutation.removedNodes) {
          if (node.nodeType !== 1) continue;
          if (!this.isRelevantNode(node as HTMLElement)) continue;
          hadRemovals = true;
          // The removed node is already detached (closest() can't reach
          // it), but the post card that HELD it is still connected and its
          // file set just shrank — re-scan that card. Removed post cards
          // themselves are dropped by the connectivity sweep.
          const containing = target.closest?.('[data-stream-item-id]') as HTMLElement | null;
          if (containing) this.collectTouchedPosts(containing, posts);
        }
      } else if (mutation.type === 'attributes') {
        // Only care about specific attribute changes (same list as before S11)
        const attr = mutation.attributeName;
        if (
          attr === 'data-stream-item-id' ||
          attr === 'data-drive-id' ||
          attr === 'aria-expanded' ||
          attr === 'aria-label'
        ) {
          const before = posts.size;
          this.collectTouchedPosts(target, posts);
          if (posts.size === before) return null;
          if (posts.size > TARGETED_SCAN_MAX_POSTS) return null;
        }
      }

      if (posts.size > TARGETED_SCAN_MAX_POSTS) return null;
    }

    return { posts, hadRemovals };
  }

  /**
   * Add the post card(s) an element belongs to or contains to the touched
   * set. Applies the same nested-card skip fullScan uses (material cards
   * nested inside assignment cards) so only top-level cards are ingested.
   */
  private collectTouchedPosts(el: HTMLElement, posts: Set<HTMLElement>): void {
    if (posts.size > TARGETED_SCAN_MAX_POSTS) return; // escalation already decided

    if (el.hasAttribute?.('data-stream-item-id')) {
      if (!el.parentElement?.closest('[data-stream-item-id]')) {
        posts.add(el);
      }
    }

    const containing = el.closest?.('[data-stream-item-id]') as HTMLElement | null;
    if (containing && containing !== el) {
      if (!containing.parentElement?.closest('[data-stream-item-id]')) {
        posts.add(containing);
      }
    }

    if (el.querySelectorAll) {
      for (const nested of el.querySelectorAll('[data-stream-item-id]')) {
        if (posts.size > TARGETED_SCAN_MAX_POSTS) return;
        this.collectTouchedPosts(nested as HTMLElement, posts);
      }
    }
  }

  /**
   * Scan ONLY the posts a mutation batch touched, through the same
   * per-post pipeline fullScan runs (ingestPost → discoverFiles +
   * detectFlags, then the same render seam). Everything about per-post
   * semantics — PostNode map, fallback ids, flag decision recording, render
   * dedup — is the shared code; the only difference is the loop bound.
   *
   * Removal parity: fullScan drops tracked posts that vanished from the
   * DOM; a targeted batch cannot rebuild the seen-set, but the same
   * liveness test (element.isConnected) drops exactly those posts.
   */
  private targetedScan(affectedPosts: Set<HTMLElement>, hadRemovals: boolean): void {
    if (!this.isActive || !this.postScorer || !this.fileScorer) return;

    // Budget gate: skip if hard cap hit (same gate as fullScan)
    if (this.budgetController.isHardCapHit()) return;

    this.performanceMonitor.startTimer('targetedScan');
    const startTime = performance.now();
    this.scanCount++;

    // 1. INGEST the touched posts (same per-post pipeline as fullScan).
    for (const postEl of affectedPosts) {
      this.ingestPost(postEl);
    }

    // 2. CLEANUP — drop posts whose element left the DOM (removal parity
    //    with fullScan's seen-set cleanup).
    if (hadRemovals) {
      for (const [postId, post] of this.postMap.entries()) {
        if (!post.element.isConnected) {
          this.postMap.delete(postId);
          this.flagDecisions.delete(postId);
          this.decisionTraces.delete(postId);
        }
      }
    }

    // 3. RENDER — flags, placements and buttons, scoped to the touched posts.
    this.renderAffectedPosts(affectedPosts);

    const elapsed = performance.now() - startTime;
    this.totalScanMs += elapsed;

    // 4. RECORD TIMING + BUDGET CHECK — a targeted scan IS a fast pass.
    this.performanceMonitor.stopTimer('targetedScan');
    this.budgetController.recordFastPass(elapsed);
    this.budgetController.updatePostCount(this.postMap.size);

    // 5. SCHEDULE DEEP VALIDATION (idle time, self-throttling — same as fullScan)
    this.scheduleDeepValidation();
  }

  /**
   * Render phase for a targeted scan: flag badges, placement decisions and
   * buttons for the touched posts only.
   *
   * Mirrors the fullScan render seam exactly — same mode gate for flags,
   * same ungated button path, same lastRenderApplied cycle record — with
   * the loop bound narrowed to the affected posts. The tracked
   * placementDecisions array stays coherent: the affected posts' old
   * decisions (re-planned here) and any decisions whose target detached
   * from the DOM (removed files/posts) are replaced by the fresh ones.
   */
  private renderAffectedPosts(affectedPosts: Set<HTMLElement>): void {
    // Same cycle-record semantics as fullScan: the render phase starts by
    // resetting what the last render cycle applied.
    this.lastRenderApplied = [];

    // Flags — same mode gate as renderDetectedFlags.
    const mode = engineRegistry.getMode();
    if (mode === 'v2' || mode === 'v3') {
      for (const postEl of affectedPosts) {
        const postId = postEl.getAttribute('data-stream-item-id');
        if (!postId) continue;
        const decision = this.flagDecisions.get(postId);
        if (decision) this.renderFlagForPost(postId, decision);
      }
    }

    // PLAN — only the touched posts, through the same per-post placement
    // engine fullScan uses.
    const affectedNodes: PostNode[] = [];
    for (const postEl of affectedPosts) {
      const postId = postEl.getAttribute('data-stream-item-id');
      const post = postId ? this.postMap.get(postId) : undefined;
      if (post) affectedNodes.push(post);
    }

    const freshDecisions: PlacementDecision[] = [];
    for (const post of affectedNodes) {
      freshDecisions.push(...this.planPlacementForPost(post));
    }

    // MERGE — keep every decision that is still live and does not belong to
    // a touched post; drop detached targets (files/posts removed since the
    // decision was planned) and the touched posts' old decisions (re-planned
    // above). fullScan rebuilds this array wholesale; this is the targeted
    // equivalent.
    const kept = this.placementDecisions.filter((d) => {
      if (!d.targetElement.isConnected) return false;
      for (const postEl of affectedPosts) {
        if (postEl.contains(d.targetElement)) return false;
      }
      return true;
    });
    this.placementDecisions = [...kept, ...freshDecisions];

    // RENDER buttons for the fresh decisions only (ungated, mirroring
    // renderPlacedButtons), then scoped stale-button cleanup + click wiring.
    if (freshDecisions.length > 0) {
      const fileMap = this.buildFileMap();
      renderBatch(freshDecisions, fileMap);
      this.recordRenderedButtons(freshDecisions);
    }
    this.cleanupAndWirePosts(affectedNodes);
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

      seenPostIds.add(this.ingestPost(postEl));
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

    // 4b. RENDER — through the render strategy. The strategy self-gates on
    // mode: as the PRIMARY engine ('v2'/'v3') V2 renders its own flags and
    // buttons; as the shadow secondary ('legacy'/'shadow') it is a no-op and
    // V1 keeps handling all visuals (D8: a primary that renders nothing is
    // the Liskov failure that made 'v2' mode a black hole).
    this.renderDetectedFlags();
    this.renderPlacedButtons();

    const elapsed = performance.now() - startTime;
    this.totalScanMs += elapsed;

    // Count results for logging
    const flagCount = [...this.flagDecisions.values()].filter(
      d => d.finalVerdict !== 'none',
    ).length;
    const fileCount = [...this.postMap.values()].reduce(
      (sum, p) => sum + p.files.length,
      0,
    );

    // 5. RECORD TIMING + BUDGET CHECK
    this.performanceMonitor.stopTimer('fullScan');
    const budgetResult = this.budgetController.recordFastPass(elapsed);
    this.budgetController.updatePostCount(this.postMap.size);

    // 6. SCHEDULE DEEP VALIDATION (idle time)
    this.scheduleDeepValidation();

    // Log pipeline results — verbose for first 3 scans, then every 10th
    const shouldLog = this.scanCount <= 3 || this.scanCount % 10 === 0;
    if (shouldLog) {
      console.log(
        `[Engine V2] Scan #${this.scanCount} [${this.currentView}]: ` +
        `${postElements.length} posts, ${fileCount} files, ${flagCount} flags, ` +
        `${this.placementDecisions.length} placements — ` +
        `${elapsed.toFixed(1)}ms (detection-only)` +
        `${budgetResult !== 'ok' ? ` [BUDGET: ${budgetResult}]` : ''}`,
      );

      // Engine Combiner: Compare V2 detection vs legacy data attributes
      if (flagCount > 0) {
        const lines: string[] = ['[Engine V2] Detection Report (V2 vs Legacy):'];
        for (const [postId, decision] of this.flagDecisions) {
          if (decision.finalVerdict === 'none') continue;
          const post = this.postMap.get(postId);
          if (!post?.element) continue;

          const el = post.element;
          // What legacy has set on this post
          const legacyComment = el.hasAttribute('data-cqd-comments-processed');
          const legacyEdited = el.hasAttribute('data-cqd-edited-processed');

          // What V2 detected
          const v2Flags: string[] = [];
          if (decision.finalVerdict === 'comment' || decision.finalVerdict === 'both') {
            v2Flags.push(`comment(${decision.commentCount ?? '?'})`);
          }
          if (decision.finalVerdict === 'edited' || decision.finalVerdict === 'both') {
            v2Flags.push('edited');
          }

          const legacyFlags: string[] = [];
          if (legacyComment) legacyFlags.push('comment ✓');
          if (legacyEdited) legacyFlags.push('edited ✓');

          // Get a readable title
          const title = el.querySelector('h2')?.textContent?.trim().slice(0, 40) || postId;
          lines.push(
            `  "${title}" — V2: ${v2Flags.join(' + ')} | Legacy: ${legacyFlags.join(' + ') || '(none yet)'}`,
          );
        }
        console.log(lines.join('\n'));
      }
    }
  }

  // ========================================================================
  // PER-POST PIPELINE (shared by fullScan and targetedScan)
  // ========================================================================

  /**
   * Run one post element through the per-post pipeline: resolve/create its
   * PostNode, extract files, detect flags. This is the EXACT work
   * fullScan performs per post — targetedScan reuses it verbatim so
   * detection semantics cannot drift between the two scan paths.
   *
   * @returns The post id the element was ingested under (caller adds it to
   * its seen-set; fullScan uses it for removal cleanup).
   */
  private ingestPost(postEl: HTMLElement): string {
    const postId =
      postEl.getAttribute('data-stream-item-id') ||
      `v2-fallback-${Math.random().toString(36).slice(2)}`;

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

    // EXTRACT FILES from this post
    post.files = this.discoverFiles(postEl);

    // DETECT FLAGS for this post
    post.flags = this.detectFlags(postEl, postId);

    return postId;
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

    // z57 S2: the UNION across candidates — one post routinely mixes Drive
    // and Docs attachments, each matched by a different candidate at the same
    // priority, and queryAll's single-winner semantics would drop every kind
    // but the best candidate's.
    const fileResult = this.fileScorer.queryAllCandidates(postEl);
    const files: FileNode[] = [];
    const seenIds = new Set<string>();
    const seenElements = new Set<HTMLElement>();

    for (const el of fileResult.allElements) {
      if (seenElements.has(el)) continue;
      seenElements.add(el);
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
    // Determine the source URL — Drive AND Docs anchors qualify (z57 S2).
    const href = el.tagName === 'A'
      ? (el as HTMLAnchorElement).href
      : el.querySelector<HTMLAnchorElement>(
          'a[href*="drive.google.com"], a[href*="docs.google.com"], a[href*="classroom.google.com/drive"]',
        )?.href;

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

    // Try aria-label first (most complete name). Classroom prefixes
    // attachment aria-labels with "Attachment: " — V1's text-based extraction
    // never carried the prefix, so strip it to keep data-cqd-name identical.
    const ariaLabel = el.getAttribute('aria-label') ||
      el.querySelector('[aria-label]')?.getAttribute('aria-label');
    if (ariaLabel) {
      name = ariaLabel.replace(/^attachment:\s*/i, '').trim() || ariaLabel;
    }

    // Fall back to the anchor's visible text (first non-empty line), mirroring
    // V1's extractFileMeta text fallback.
    if (!name) {
      const line = (el.textContent || '').split('\n').map(l => l.trim()).find(Boolean);
      if (line) name = line;
    }

    // Try to extract extension from the URL or name
    const extMatch = (name || href).match(/\.([a-zA-Z0-9]{1,10})(?:\?|$)/);
    if (extMatch) {
      ext = extMatch[1].toLowerCase();
    }

    return {
      canonicalId,
      name: name ? sanitizeFileName(name) : 'Untitled',
      ext,
      // The model carries the CONVERTED direct-download URL (docs → Drive
      // byte-serving endpoint), so every downstream consumer (button dataset,
      // click request, group enumeration) sees one canonical URL.
      downloadUrl: resolveDownloadUrl(href),
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

      // Compare build only — dead-code-eliminated from production bundles.
      // The literal comparison — not a re-exported constant — is what lets Vite
      // substitute import.meta.env.MODE and fold this to `if (false)`, so the
      // whole compare tree is tree-shaken out of production bundles.
      if (import.meta.env.MODE === 'compare') {
        runComparison(postEl, { postId, viewKind: this.currentView });
      }

      // Shadow mode decision trace logging — enables debugging wrong decisions
      // via DevTools console. Filter console by [CQD-V2-SHADOW] to see only these.
      if (decision.finalVerdict !== 'none') {
        console.log(
          `[CQD-V2-SHADOW] Flag: post=${postId} verdict=${decision.finalVerdict} ` +
          `comment=${decision.commentScore} edited=${decision.editedScore} ` +
          `confidence=${decision.confidence} ` +
          `exclusions=${decision.exclusionPenalties.length > 0
            ? decision.exclusionPenalties.map((e) => e.ruleId).join(',')
            : 'none'}`,
        );
      }

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
   *
   * ONLY renders when V2 is the primary engine ('v2' or 'v3' mode).
   * In 'shadow' mode, V1 (legacy) handles all rendering — V2 is
   * detection-only and this method is a no-op.
   */
  private renderDetectedFlags(): void {
    // S5 additive: the render cycle starts here — renderDetectedFlags runs
    // first in every fullScan, so resetting at its start gives both render
    // strategies one shared per-cycle record (buttons append after flags).
    this.lastRenderApplied = [];

    // Only render when V2 is the primary engine
    const mode = engineRegistry.getMode();
    if (mode !== 'v2' && mode !== 'v3') {
      // Shadow/legacy mode — V1 handles rendering, V2 is detection-only
      return;
    }

    for (const [postId, decision] of this.flagDecisions) {
      this.renderFlagForPost(postId, decision);
    }
  }

  /**
   * Render the flag badge for ONE post (per-post body of
   * renderDetectedFlags — shared with the S11 targeted render path).
   */
  private renderFlagForPost(postId: string, decision: FlagDecision): void {
    const postNode = this.postMap.get(postId);
    if (!postNode?.element || !postNode.element.isConnected) {
      // Post was removed from DOM — skip rendering
      return;
    }

    try {
      renderFlagBadge(decision, postNode.element);
      // S5 additive: the flag is on the DOM — record it (inside the try,
      // so a failed render is not recorded as applied).
      this.lastRenderApplied.push({ postId, kind: 'flag' });
    } catch (err) {
      console.warn(`[Engine V2] Flag render failed for post ${postId}:`, err);
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

    // S5 additive: publish hook for the HardenEngine role — one call per
    // correction actually handled, before any op-specific repair runs.
    this.onCorrectionSeen?.(item);

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
          // V2 is detection-only — flag rendering handled by legacy
          return true;
        }

        case 'remove-flag': {
          const post = this.postMap.get(item.postId);
          if (!post) return false;
          // z57 S4: flag artifacts carry the V2 marker attribute.
          for (const el of Array.from(post.element.querySelectorAll('[data-cqd-v2-flag]'))) {
            el.remove();
          }
          return true;
        }

        case 'fix-overlay': {
          // V2 is detection-only — overlay rendering handled by legacy
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
      allDecisions.push(...this.planPlacementForPost(post));
    }

    return allDecisions;
  }

  /**
   * Compute placement decisions for ONE post (per-post body of
   * planPlacements — shared with the S11 targeted render path).
   */
  private planPlacementForPost(post: PostNode): PlacementDecision[] {
    if (!this.currentView) return [];

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
    return computePlacement(scannedPost, this.currentView);
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

    // Render all buttons in one batch
    const fileMap = this.buildFileMap();
    renderBatch(this.placementDecisions, fileMap);

    // S5 additive: record what the batch applied (see recordRenderedButtons).
    this.recordRenderedButtons(this.placementDecisions);

    // Clean up stale buttons (files removed since last scan) + click wiring.
    this.cleanupAndWirePosts(this.postMap.values());
  }

  /**
   * Build the canonical file-id → ScannedFile map the batch renderer
   * resolves decisions by (per-post body extracted for the S11 targeted
   * render path; pure in-memory work over the post map).
   */
  private buildFileMap(): Map<string, ScannedFile> {
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
    return fileMap;
  }

  /**
   * Record which placement decisions the last render batch applied (S5
   * additive — runs only after renderBatch returns, so a batch that throws
   * leaves the cycle with no button entries). postId is resolved without
   * DOM: a download-all decision carries it in its fileId, a single-file
   * decision maps through the post's own file list. Decisions whose post
   * cannot be resolved were not rendered by the batch either, so they are
   * not recorded as applied.
   */
  private recordRenderedButtons(decisions: PlacementDecision[]): void {
    const fileToPost = new Map<string, string>();
    for (const [pid, post] of this.postMap) {
      for (const f of post.files) fileToPost.set(f.canonicalId, pid);
      fileToPost.set(`download-all:${pid}`, pid);
    }
    for (const decision of decisions) {
      const pid = fileToPost.get(decision.fileId);
      if (pid !== undefined) {
        this.lastRenderApplied.push({ postId: pid, kind: 'button' });
      }
    }
  }

  /**
   * Remove stale buttons (files that no longer exist in the post) and
   * ensure the delegated click wiring, for the given posts. Per-post body
   * extracted from renderPlacedButtons so the S11 targeted path applies
   * the same lifecycle to just the touched posts.
   */
  private cleanupAndWirePosts(posts: Iterable<PostNode>): void {
    // Materialize once: the caller may pass a live Map iterator
    // (renderPlacedButtons passes postMap.values()), and this function walks
    // the posts twice — stale-button cleanup first, then click wiring. A
    // consumed iterator would silently skip the wiring pass and leave every
    // button dead (caught by qa-02/06/08, 2026-09-17).
    const postList = Array.from(posts);

    for (const post of postList) {
      const validIds = new Set(post.files.map(f => f.canonicalId));
      // Also keep the Download All button
      validIds.add(`download-all:${post.id}`);
      removeStaleButtons(post.element, validIds);
    }

    // z57 S1: the render seam owns the button lifecycle, so the delegated
    // click wiring lives here too — every rendered post root gets the one
    // delegated handler routing clicks into the download pipeline.
    for (const post of postList) {
      try {
        ensurePostClickWiring(post.element);
      } catch (err) {
        console.warn(`[Engine V2] Click wiring failed for post ${post.id}:`, err);
      }
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

  /** S5 additive: what the last render cycle applied, for the RenderEngine role. */
  getLastRenderApplied(): Array<{ postId: string; kind: 'button' | 'flag' | 'all' }> {
    return this.lastRenderApplied;
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
   * Get the handleMutations timing histogram (S11 additive).
   *
   * The p95 of this label is the fast-pass budget metric (<6ms per mutation
   * batch, budget-controller FAST_PASS_TARGET). The qa-perf journey reads it
   * through the `window.__cqdPerfSnapshot()` debug probe, and the debug panel
   * can read it here without reaching into the private monitor.
   */
  getMutationTimings(): TimingPercentiles | null {
    return this.performanceMonitor.getPercentiles('handleMutations');
  }

  /**
   * S11 #615 selector audit: how the CURRENT file map's canonical ids
   * resolved. `extractFileNode` resolves ids through a priority chain
   * (data-drive-id → URL parse → data-id combo → URL hash); url-hash is the
   * last-resort fallback that depends on volatile URL text, so a rising
   * hashIdRate is the early warning that Classroom changed its attachment
   * markup (ENGINE_V4_SYSTEM_DESIGN §5 rule 1). Exposed through the
   * `window.__cqdPerfSnapshot()` debug probe alongside the timings.
   */
  getSelectorStats(): SelectorStats {
    let totalFiles = 0;
    let hashIdCount = 0;
    for (const post of this.postMap.values()) {
      for (const file of post.files) {
        totalFiles++;
        if (file.idSource === 'url-hash') hashIdCount++;
      }
    }
    return {
      hashIdCount,
      totalFiles,
      hashIdRate: totalFiles > 0 ? hashIdCount / totalFiles : 0,
    };
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
      const badges = post.element.querySelectorAll('[data-cqd-v2-flag="badge"]');
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

      const badge = post.element.querySelector('[data-cqd-v2-flag="badge"]');
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
      el.querySelector?.('a[href*="drive.google.com"]') ||
      el.querySelector?.('a[href*="docs.google.com"]')
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
   *
   * S10: the wait rides the shared page DomPort as a transient
   * subscription instead of constructing a dedicated MutationObserver.
   * The port delivers batches containing childList records; each of the
   * three exit paths (ready, timeout, abort) owns its unsubscribe.
   */
  private waitForContentReady(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      // Check if content is already ready
      if (document.querySelector('[data-stream-item-id]')) {
        resolve();
        return;
      }

      // Transient subscription on the shared page observer
      const unsubscribe = getPageDomPort().observe(
        { childList: true, subtree: true },
        () => {
          if (document.querySelector('[data-stream-item-id]')) {
            unsubscribe();
            clearTimeout(timeout);
            resolve();
          }
        },
      );

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve();
      }, 5000);

      // If the signal is aborted, clean up
      signal.addEventListener('abort', () => {
        unsubscribe();
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }
}
