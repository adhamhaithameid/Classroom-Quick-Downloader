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
 * CURRENT STATUS: This is a STUB. The full implementation requires:
 * 1. OAuth2 authentication (extension already has the permission)
 * 2. Classroom API client (courses.courseWork.list, etc.)
 * 3. Rate limiting (Google API quotas are strict)
 * 4. Caching (don't re-query on every scan)
 *
 * The plan is:
 * - Phase 7: Build the API client and authentication
 * - Phase 8: Integrate API discovery with V2's DOM discovery
 * - Phase 9: Ship as V3 mode
 *
 * @author Adham — planning for the future while building the present
 * @since v4.2.1 (planned)
 */

import type {
  CQDEngine,
  ViewKind,
  PostNode,
  FlagDecision,
  PlacementDecision,
  DecisionTrace,
} from '../types';
import { EngineV2 } from '../v2/engine-v2';
import type { ClassroomApiSnapshot } from './api';
import {
  createDefaultApiDiscoveryService,
  resolveClassroomApiRouteContext,
  type ApiDiscoveryService,
} from './api';

// ============================================================================
// V3 ENGINE — Extends V2 with API integration
// ============================================================================

/**
 * EngineV3 — V2 + Google Classroom API.
 *
 * This EXTENDS V2 rather than replacing it. All DOM-based functionality
 * comes from V2. V3 adds an API correlation layer on top.
 *
 * Current status: STUB — delegates everything to V2's implementation.
 * The API integration methods are defined but throw "not yet implemented"
 * to make it clear they need work.
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

  constructor() {
    this.v2 = new EngineV2();
    this.apiDiscovery = createDefaultApiDiscoveryService();
  }

  // ========================================================================
  // LIFECYCLE (delegated to V2)
  // ========================================================================

  async init(viewKind: ViewKind, signal: AbortSignal): Promise<void> {
    await this.v2.init(viewKind, signal);
    await this.refreshApiSnapshot(signal);

    // TODO (Phase 8): After V2 init, also query the Classroom API
    // for the course's assignments and materials. Compare the API's
    // file list with V2's DOM-discovered files. Any API files not
    // found in the DOM are "hidden" files we need to handle.
    //
    // await this.correlateWithApi(viewKind, signal);

    console.log(
      `[Engine V3] Initialized for view: ${viewKind} (API integration: STUB)`,
    );
  }

  destroy(): void {
    this.v2.destroy();
    this.apiDiscovery.clear();
    this.latestApiSnapshot = null;
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
    void this.refreshApiSnapshot();

    // TODO (Phase 8): After V2's DOM scan, cross-reference with
    // cached API data. If API shows files not in the DOM, create
    // "phantom" PostNodes for them.
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

  private async refreshApiSnapshot(signal?: AbortSignal): Promise<void> {
    const context = resolveClassroomApiRouteContext(window.location.href);
    if (!context) {
      this.latestApiSnapshot = null;
      return;
    }

    try {
      this.latestApiSnapshot = await this.apiDiscovery.discover(context, { signal });
    } catch (error) {
      if (signal?.aborted) return;
      console.warn('[Engine V3] API base discovery failed:', error);
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
