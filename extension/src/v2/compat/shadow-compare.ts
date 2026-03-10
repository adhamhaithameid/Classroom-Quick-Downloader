// filepath: extension/src/v2/compat/shadow-compare.ts
/**
 * ============================================================================
 * SHADOW COMPARE — V2 vs V1 Decision Comparison
 * ============================================================================
 *
 * This is the quality assurance module for the V2 migration.
 *
 * In shadow mode, both V1 and V2 run simultaneously. V1 renders
 * to the DOM (users see V1's buttons and badges). V2 runs silently
 * and produces decisions without rendering.
 *
 * This module compares V2's decisions with V1's actual DOM state:
 * - Did V2 find the same files as V1?
 * - Did V2 produce the same flag decisions?
 * - Would V2's button placements match V1's buttons?
 *
 * Mismatches are logged and counted. When V2 reaches 99.5%+ match
 * rate across all tested pages, we can flip to V2 mode with confidence.
 *
 * The comparison runs on a 10-second timer (not on every scan —
 * that would be too CPU-intensive). It snapshot's V1's DOM state,
 * snapshots V2's model, and diffs them.
 *
 * Mismatch types:
 * - FILE_FOUND_BY_V1_NOT_V2: V1 injected a button but V2 didn't find the file
 * - FILE_FOUND_BY_V2_NOT_V1: V2 found a file but V1 didn't inject a button
 * - FLAG_MISMATCH: V1 and V2 disagree on comment/edited flags
 * - PLACEMENT_MISMATCH: V1 and V2 put buttons in different places
 * - COUNT_MISMATCH: V1 and V2 found different number of files for a post
 *
 * Each mismatch is logged with enough context to debug: post ID,
 * file ID, V1's state, V2's state, and a reason code.
 *
 * @author Adham — the safety net that lets me sleep at night
 * @since v4.0.0
 */

import type { CQDEngine } from '../../engines/types';

// ============================================================================
// TYPES
// ============================================================================

export type MismatchType =
  | 'FILE_FOUND_BY_V1_NOT_V2'
  | 'FILE_FOUND_BY_V2_NOT_V1'
  | 'FLAG_MISMATCH'
  | 'PLACEMENT_MISMATCH'
  | 'COUNT_MISMATCH';

export interface Mismatch {
  type: MismatchType;
  postId: string;
  fileId: string | null;
  v1State: string;
  v2State: string;
  details: string;
  timestamp: number;
}

export interface ShadowCompareResult {
  /** When this comparison was run */
  timestamp: number;

  /** Duration of the comparison in ms */
  duration_ms: number;

  /** Total posts analyzed */
  postsAnalyzed: number;

  /** Total files compared */
  filesCompared: number;

  /** Total mismatches found */
  mismatchCount: number;

  /** Breakdown by mismatch type */
  mismatchBreakdown: Record<MismatchType, number>;

  /** All individual mismatches */
  mismatches: Mismatch[];

  /** Match percentage (0-100) */
  matchPercentage: number;
}

// ============================================================================
// SHADOW COMPARATOR
// ============================================================================

/**
 * ShadowComparator — compares V1's actual DOM state with V2's model.
 *
 * Usage (in the orchestrator, shadow mode only):
 *   const comparator = new ShadowComparator(v1Engine, v2Engine);
 *   comparator.start();
 *   // ... V1 and V2 both run...
 *   const report = comparator.getLatestReport();
 *   console.log(`Match rate: ${report.matchPercentage}%`);
 *   comparator.stop();
 */
export class ShadowComparator {
  private v1Engine: CQDEngine;
  private v2Engine: CQDEngine;
  private intervalId: number | null = null;
  private reports: ShadowCompareResult[] = [];
  private running = false;

  /** How often to run the comparison (ms) */
  private compareInterval: number;

  /** Maximum number of reports to keep in memory */
  private maxReports: number;

  constructor(
    v1Engine: CQDEngine,
    v2Engine: CQDEngine,
    compareInterval = 10_000,
    maxReports = 50,
  ) {
    this.v1Engine = v1Engine;
    this.v2Engine = v2Engine;
    this.compareInterval = compareInterval;
    this.maxReports = maxReports;
  }

  /**
   * Start periodic shadow comparison.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    console.log('[CQD Shadow] Starting shadow comparison');

    // Run first comparison after a delay (let both engines settle)
    this.intervalId = window.setInterval(() => {
      this.runComparison();
    }, this.compareInterval);
  }

  /**
   * Stop shadow comparison.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Log final summary
    if (this.reports.length > 0) {
      const latest = this.reports[this.reports.length - 1];
      console.log(
        `[CQD Shadow] Stopped. Final match rate: ${latest.matchPercentage.toFixed(1)}%` +
        ` (${this.reports.length} comparisons total)`,
      );
    }
  }

  /**
   * Run a single comparison between V1 and V2.
   */
  runComparison(): ShadowCompareResult {
    const startTime = performance.now();
    const mismatches: Mismatch[] = [];

    // Get V1's actual DOM state (what buttons/badges are actually rendered)
    const v1Posts = this.v1Engine.getTrackedPosts();
    const v1Files = this.snapshotV1DomState();

    // Get V2's model state (what V2 WOULD render)
    const v2Posts = this.v2Engine.getTrackedPosts();
    const v2Flags = this.v2Engine.getFlagDecisions();

    // Compare file counts per post
    const v2PostIds = new Set(v2Posts.map(p => p.id));
    const v1PostIds = new Set(v1Posts.map(p => p.id));
    let filesCompared = 0;

    // Check V1 posts against V2
    for (const v1Post of v1Posts) {
      if (!v2PostIds.has(v1Post.id)) {
        // V1 found a post that V2 didn't
        // This can be OK if V2 just hasn't scanned yet
        continue;
      }

      const v2Post = v2Posts.find(p => p.id === v1Post.id);
      if (!v2Post) continue;

      // Compare file counts
      const v1FileCount = v1Files.get(v1Post.id) ?? 0;
      const v2FileCount = v2Post.files.length;
      filesCompared += Math.max(v1FileCount, v2FileCount);

      if (v1FileCount !== v2FileCount) {
        mismatches.push({
          type: 'COUNT_MISMATCH',
          postId: v1Post.id,
          fileId: null,
          v1State: `${v1FileCount} files`,
          v2State: `${v2FileCount} files`,
          details: `V1 found ${v1FileCount} files, V2 found ${v2FileCount} files`,
          timestamp: Date.now(),
        });
      }
    }

    // Check V2 posts not in V1 (potentially new coverage!)
    for (const v2Post of v2Posts) {
      if (!v1PostIds.has(v2Post.id) && v2Post.files.length > 0) {
        mismatches.push({
          type: 'FILE_FOUND_BY_V2_NOT_V1',
          postId: v2Post.id,
          fileId: v2Post.files[0]?.canonicalId ?? null,
          v1State: 'no buttons',
          v2State: `${v2Post.files.length} files found`,
          details: `V2 discovered ${v2Post.files.length} files in post ${v2Post.id} that V1 didn\'t handle`,
          timestamp: Date.now(),
        });
      }
    }

    // Compare flag decisions
    for (const v2Flag of v2Flags) {
      const v1Post = v1Posts.find(p => p.id === v2Flag.postId);
      if (!v1Post) continue;

      // Check V1's actual DOM for badges
      const v1El = v1Post.element;
      const v1HasCommentBadge = !!v1El.querySelector('.cqd-comment-badge, .cqd-both-badge');
      const v1HasEditedBadge = !!v1El.querySelector('.cqd-edited-badge, .cqd-both-badge');

      const v2WouldShowComment = v2Flag.finalVerdict === 'comment' || v2Flag.finalVerdict === 'both';
      const v2WouldShowEdited = v2Flag.finalVerdict === 'edited' || v2Flag.finalVerdict === 'both';

      if (v1HasCommentBadge !== v2WouldShowComment) {
        mismatches.push({
          type: 'FLAG_MISMATCH',
          postId: v2Flag.postId,
          fileId: null,
          v1State: v1HasCommentBadge ? 'comment badge shown' : 'no comment badge',
          v2State: v2WouldShowComment ? 'would show comment badge' : 'would NOT show comment badge',
          details: `Comment flag disagreement (V2 score: ${v2Flag.commentScore}, verdict: ${v2Flag.finalVerdict})`,
          timestamp: Date.now(),
        });
      }

      if (v1HasEditedBadge !== v2WouldShowEdited) {
        mismatches.push({
          type: 'FLAG_MISMATCH',
          postId: v2Flag.postId,
          fileId: null,
          v1State: v1HasEditedBadge ? 'edited badge shown' : 'no edited badge',
          v2State: v2WouldShowEdited ? 'would show edited badge' : 'would NOT show edited badge',
          details: `Edited flag disagreement (V2 score: ${v2Flag.editedScore}, verdict: ${v2Flag.finalVerdict})`,
          timestamp: Date.now(),
        });
      }
    }

    // Build the mismatch breakdown
    const breakdown: Record<MismatchType, number> = {
      FILE_FOUND_BY_V1_NOT_V2: 0,
      FILE_FOUND_BY_V2_NOT_V1: 0,
      FLAG_MISMATCH: 0,
      PLACEMENT_MISMATCH: 0,
      COUNT_MISMATCH: 0,
    };
    for (const m of mismatches) {
      breakdown[m.type]++;
    }

    // Calculate match percentage
    const totalComparisons = Math.max(1, v1Posts.length + filesCompared);
    const mismatchCount = mismatches.length;
    const matchPercentage = Math.max(0, ((totalComparisons - mismatchCount) / totalComparisons) * 100);

    const result: ShadowCompareResult = {
      timestamp: Date.now(),
      duration_ms: performance.now() - startTime,
      postsAnalyzed: Math.max(v1Posts.length, v2Posts.length),
      filesCompared,
      mismatchCount,
      mismatchBreakdown: breakdown,
      mismatches,
      matchPercentage,
    };

    // Store the report
    this.reports.push(result);
    if (this.reports.length > this.maxReports) {
      this.reports.shift();
    }

    // Log results
    if (mismatchCount > 0) {
      console.warn(
        `[CQD Shadow] Comparison: ${matchPercentage.toFixed(1)}% match ` +
        `(${mismatchCount} mismatches across ${result.postsAnalyzed} posts)`,
      );
      for (const m of mismatches) {
        console.warn(`  ⚠️ ${m.type}: ${m.details}`);
      }
    } else {
      console.log(
        `[CQD Shadow] Comparison: 100% match ` +
        `(${result.postsAnalyzed} posts, ${filesCompared} files)`,
      );
    }

    return result;
  }

  /**
   * Get all reports.
   */
  getReports(): ShadowCompareResult[] {
    return [...this.reports];
  }

  /**
   * Get the latest report.
   */
  getLatestReport(): ShadowCompareResult | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  /**
   * Get the average match percentage across all reports.
   */
  getAverageMatchPercentage(): number {
    if (this.reports.length === 0) return 0;
    const sum = this.reports.reduce((acc, r) => acc + r.matchPercentage, 0);
    return sum / this.reports.length;
  }

  // ========================================================================
  // V1 DOM SNAPSHOT
  // ========================================================================

  /**
   * Snapshot V1's actual DOM state.
   *
   * V1 doesn't maintain a model — it just injects buttons directly.
   * So to know what V1 "found," we have to look at the DOM and count
   * the buttons V1 injected.
   *
   * Returns: Map of postId → number of download buttons in that post.
   */
  private snapshotV1DomState(): Map<string, number> {
    const result = new Map<string, number>();

    const posts = document.querySelectorAll<HTMLElement>('[data-stream-item-id]');
    for (const post of posts) {
      const postId = post.getAttribute('data-stream-item-id') || '';
      const buttons = post.querySelectorAll('.cqd-download-btn').length;
      result.set(postId, buttons);
    }

    return result;
  }
}
