// filepath: extension/src/engines/v3/engine-v3.ts
/**
 * ============================================================================
 * ENGINE V3 — API-Enhanced Engine (Future)
 * ============================================================================
 *
 * V3 extends V2 with Google Classroom API integration for file discovery.
 *
 * The idea is simple but POWERFUL:
 * - V2 discovers files by scanning the DOM (which can miss things)
 * - V3 ALSO queries the Classroom API for the assignment's file list
 * - If the API returns files that V2 didn't find in the DOM, V3 knows
 *   there are hidden/lazy-loaded files and can handle them
 *
 * This solves the #1 frustration with the current system: files that
 * are "there" but not visible until you scroll down or click "Show more."
 *
 * CURRENT STATUS: activation-gated assist (S13). The registry activates this
 * engine ONLY when isApiConfigured() (see api/config.ts) AND the user
 * explicitly selected the 'API (beta)' Engine Mode (consent, #398). Once
 * active, EngineV3 is the COMPOSITION ROOT for the ApiDetector
 * (src/strategies/detect/api-detector.ts): it wires the real token provider
 * and its own discovery service into the detector's deps, pre-resolves the
 * token+snapshot cache during init on student-work views (the refresh
 * contract — observe never fetches), and runs the detector's observe pass
 * over V2's tracked posts to publish the 'api-corroboration' LayerTraces on
 * the debug/explanation surface (getApiCorroborationTrace).
 *
 * SCOPING (honest): the corroboration floor does NOT yet alter V2's rendered
 * flags — V2's per-post pipeline (ingestPost → detectFlags →
 * scoreFlagsForPost) is a private, decision-shaped stack that a
 * PostObservation-shaped detector cannot be injected into without rewriting
 * its semantics. So the detector runs REAL end-to-end here (token, snapshot,
 * per-post observe, traces) and its output is surfaced for debugging, while
 * wiring the floor into the rendered decisions is the documented follow-up
 * once the owner OAuth credential step ships (docs/engine/api-assist-setup.md).
 *
 * PRIVACY (#398): token acquisition is non-interactive and happens ONLY on
 * student-work views while v3 is active — never on other views, never in the
 * background. The full privacy model lives in docs/engine/api-assist-setup.md.
 *
 * Still required for full API-enhanced discovery (Phase 8-9):
 * 1. Owner OAuth setup (identity permission + oauth2 client_id — setup doc)
 * 2. Rate limiting (Google API quotas are strict)
 *
 * @author Adham — planning for the future while building the present
 * @since v4.2.1 (planned)
 */

import {
  ViewKind,
  type CQDEngine,
  type PostNode,
  type FlagDecision,
  type PlacementDecision,
  type DecisionTrace,
  type LayerTrace,
} from '../types';
import type { DetectContext, PostObservation } from '../../contracts/detection';
import { ApiDetector } from '../../strategies/detect/api-detector';
import { keywordDetector } from '../../detect/keyword/keyword-detector';
import { EngineV2 } from '../v2/engine-v2';
import type { ClassroomApiSnapshot, ClassroomApiTokenProvider } from './api';
import { ChromeIdentityTokenProvider } from './api/token-provider';
import {
  createDefaultApiDiscoveryService,
  publishStudentWorkApiSnapshot,
  resolveClassroomApiRouteContext,
  sharedClassroomRateLimiter,
  type ApiDiscoveryService,
} from './api';
import {
  ensureClassroomButton,
  removeClassroomButton,
} from '../../v2/render/classroom-download-controller';

// ============================================================================
// V3 ENGINE — Extends V2 with API integration
// ============================================================================

/**
 * EngineV3 — V2 + Google Classroom API.
 *
 * This EXTENDS V2 rather than replacing it. All DOM-based functionality
 * comes from V2. V3 adds an API correlation layer on top.
 */
export class EngineV3 implements CQDEngine {
  readonly name = 'engine-v3';
  readonly version = '4.2.1-stub';

  /**
   * The V2 engine that handles all DOM-based functionality.
   * V3 delegates to V2 for everything except API-enhanced discovery.
   */
  private v2: EngineV2;
  private apiDiscovery: ApiDiscoveryService;
  private latestApiSnapshot: ClassroomApiSnapshot | null = null;
  private currentView: ViewKind | null = null;

  /**
   * The S13 API-assist detector, composed here (composition root — see the
   * header). Base detector: the shared keywordDetector (stateless, the same
   * instance V2 resets on teardown). deps feed off this engine's own token
   * provider and discovery result, so refresh() adds NO extra network
   * round-trip for the snapshot — only the (Chrome-cached, non-interactive)
   * token check.
   */
  private apiDetector: ApiDetector;
  private tokenProvider: ClassroomApiTokenProvider;

  /** Per-post ApiDetector observations from the latest corroboration pass. */
  private apiCorroboration: Map<string, PostObservation> = new Map();

  constructor() {
    this.v2 = new EngineV2();
    this.apiDiscovery = createDefaultApiDiscoveryService();
    this.tokenProvider = new ChromeIdentityTokenProvider();
    this.apiDetector = new ApiDetector(keywordDetector, {
      getToken: () => this.tokenProvider.getAccessToken(false),
      getSnapshot: async () => this.latestApiSnapshot,
    });
  }

  // ========================================================================
  // LIFECYCLE (delegated to V2)
  // ========================================================================

  async init(viewKind: ViewKind, signal: AbortSignal): Promise<void> {
    await this.v2.init(viewKind, signal);
    this.currentView = viewKind;
    await this.refreshApiSnapshot(signal);
    // Corroborate whatever posts V2's init scan already tracked. On a live
    // signal this is the real init scan; on an aborted one (tests, teardown
    // races) it is a no-op and fullScan picks the posts up instead.
    this.runApiCorroborationPass();
    // csaa.6: the whole-classroom button is a v3-only feature — this call is
    // the GATE (v3 mode ⇒ configured ⇒ API-beta consented). The controller
    // itself removes it when the route is not classwork.
    ensureClassroomButton();

    console.log(
      `[Engine V3] Initialized for view: ${viewKind} (API assist: ${this.latestApiSnapshot ? 'snapshot ready' : 'fallback to DOM'})`,
    );
  }

  destroy(): void {
    this.v2.destroy();
    this.apiDiscovery.clear();
    this.apiDetector.reset();
    this.latestApiSnapshot = null;
    this.currentView = null;
    this.apiCorroboration.clear();
    publishStudentWorkApiSnapshot(null);
    sharedClassroomRateLimiter.reset();
    removeClassroomButton();
    console.log('[Engine V3] Destroyed');
  }

  // ========================================================================
  // MUTATIONS & SCANNING (delegated to V2)
  // ========================================================================

  handleMutations(mutations: MutationRecord[]): void {
    this.v2.handleMutations(mutations);
  }

  fullScan(): void {
    this.v2.fullScan();
    // Re-check the button on every scan — SPA navigation between classes
    // keeps this engine alive but changes the route context underneath it.
    ensureClassroomButton();
    if (this.currentView && isStudentWorkView(this.currentView)) {
      // Refresh the cache, THEN corroborate the posts V2 just tracked — the
      // pass reads the detector's cache, so it must not race the refresh.
      void this.refreshApiSnapshot().then(() => this.runApiCorroborationPass());
    }
  }

  // ========================================================================
  // DATA ACCESSORS (delegated to V2)
  // ========================================================================

  getTrackedPosts(): PostNode[] {
    return this.v2.getTrackedPosts();
  }

  getPlacementDecisions(): PlacementDecision[] {
    return this.v2.getPlacementDecisions();
  }

  getFlagDecisions(): FlagDecision[] {
    return this.v2.getFlagDecisions();
  }

  getDecisionTrace(postId: string): DecisionTrace | null {
    return this.v2.getDecisionTrace(postId);
  }

  getLatestApiSnapshot(): ClassroomApiSnapshot | null {
    return this.latestApiSnapshot;
  }

  /**
   * The 'api-corroboration' LayerTrace ApiDetector produced for this post on
   * the last corroboration pass, or null when the API had nothing to add
   * (denied token, no snapshot, post never observed). Debug/explanation
   * surface only — see the scoping note in the header.
   */
  getApiCorroborationTrace(postId: string): LayerTrace | null {
    const observation = this.apiCorroboration.get(postId);
    if (!observation?.debug) return null;
    return observation.debug.find((t) => t.layerName === 'api-corroboration') ?? null;
  }

  private async refreshApiSnapshot(signal?: AbortSignal): Promise<void> {
    if (!this.currentView || !isStudentWorkView(this.currentView)) {
      this.latestApiSnapshot = null;
      this.apiDetector.reset();
      publishStudentWorkApiSnapshot(null);
      return;
    }

    const context = resolveClassroomApiRouteContext(window.location.href);
    if (!context) {
      this.latestApiSnapshot = null;
      this.apiDetector.reset();
      publishStudentWorkApiSnapshot(null);
      return;
    }

    try {
      this.latestApiSnapshot = await this.apiDiscovery.discover(context, { signal });
      publishStudentWorkApiSnapshot(this.latestApiSnapshot);
      // The refresh contract: pre-resolve the detector cache AFTER the
      // snapshot exists. deps.getSnapshot returns the already-fetched
      // snapshot, so this adds no second discovery request.
      await this.apiDetector.refresh();
    } catch (error) {
      if (signal?.aborted) return;
      console.warn('[Engine V3] API base discovery failed:', error);
    }
  }

  /**
   * Run ApiDetector.observe over every post V2 currently tracks. The
   * detector falls back to the base keyword observation verbatim whenever
   * the API has nothing usable (token denied, snapshot missing/stale, route
   * mismatch) — the pass is silent by construction. Results feed
   * getApiCorroborationTrace.
   */
  private runApiCorroborationPass(): void {
    if (!this.currentView || !isStudentWorkView(this.currentView)) return;

    for (const post of this.v2.getTrackedPosts()) {
      const ctx: DetectContext = { postId: post.id, viewKind: this.currentView };
      this.apiCorroboration.set(post.id, this.apiDetector.observe(post.element, ctx));
    }
  }

  // ========================================================================
  // API INTEGRATION STUBS (Phase 8-9)
  // ========================================================================

  /**
   * Query the Google Classroom API for course materials.
   *
   * STUB — will be implemented in Phase 8.
   *
   * The plan:
   * 1. Extract the courseId from the current URL
   * 2. Call courses.courseWork.list to get all assignments
   * 3. For each assignment, get the materials[] array
   * 4. Compare with V2's DOM-discovered files
   * 5. Create FileNodes for any files found via API but not DOM
   *
   * Rate limiting: Max 10 API calls per page load, cached for 5 min.
   *
   * @throws Error - Not yet implemented
   */
  // private async correlateWithApi(
  //   _viewKind: ViewKind,
  //   _signal: AbortSignal,
  // ): Promise<void> {
  //   throw new Error('[Engine V3] API integration not yet implemented');
  // }
}

function isStudentWorkView(viewKind: ViewKind): boolean {
  return viewKind === ViewKind.STUDENT_WORK_TEACHER ||
    viewKind === ViewKind.STUDENT_SUBMISSIONS;
}
