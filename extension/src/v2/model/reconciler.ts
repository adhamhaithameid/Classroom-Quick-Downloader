// filepath: extension/src/v2/model/reconciler.ts
/**
 * ============================================================================
 * RECONCILER — Diffing Old vs New (Our Own Mini React)
 * ============================================================================
 *
 * The reconciler is responsible for comparing a new scan result
 * against the current model and producing a minimal set of operations.
 *
 * Think of it like React's reconciler: it diffs the "virtual DOM"
 * (our model) against the "real DOM" (the scan results) and produces
 * a list of mutations to apply.
 *
 * The operations it produces:
 * - ADD_POST: A new post appeared on the page
 * - REMOVE_POST: A post was removed from the page
 * - UPDATE_POST: A post's structure changed (files added/removed)
 * - ADD_FILE: A new file was discovered in a post
 * - REMOVE_FILE: A file was removed from a post
 * - TOGGLE_VISIBILITY: A post's expanded/collapsed state changed
 * - STABLE: Nothing changed for this post (skip rendering)
 *
 * The "STABLE" result is key for performance. If a post hasn't changed
 * since the last scan, we don't do anything — no DOM writes, no renders,
 * no event handler re-attachment. This is why V2 can handle 100+ posts
 * without getting slow.
 *
 * The reconciler is also the integration point for shadow mode.
 * When running in shadow mode, the operations are logged but not
 * applied. The shadow-compare module then diffs V2's intended
 * operations against V1's actual DOM state.
 *
 * @author Adham — reading React's reconciler code inspired this whole thing
 * @since v4.0.0
 */

import type { CourseContext, PostModel, FileModel } from './entities';
import type { ScanResult, ScannedPost, ScannedFile } from './dom-scanner';
import { createPostModel, createFileModel, computeFingerprint } from './entities';

// ============================================================================
// RECONCILIATION OPERATIONS
// ============================================================================

/**
 * The types of changes the reconciler can detect.
 *
 * Each operation tells the renderer exactly what to do.
 * The renderer processes them in order and only touches
 * the specific elements that need updating.
 */
export type ReconcileOp =
  | { type: 'ADD_POST'; postId: string; post: ScannedPost }
  | { type: 'REMOVE_POST'; postId: string }
  | { type: 'UPDATE_POST'; postId: string; addedFiles: ScannedFile[]; removedFiles: string[] }
  | { type: 'ADD_FILE'; postId: string; file: ScannedFile }
  | { type: 'REMOVE_FILE'; postId: string; fileId: string }
  | { type: 'TOGGLE_VISIBILITY'; postId: string; isExpanded: boolean }
  | { type: 'STABLE'; postId: string };

/**
 * The full output of a reconciliation pass.
 *
 * Contains the operations to apply, plus metadata for logging.
 */
export interface ReconcileResult {
  /** Operations to apply (in order) */
  ops: ReconcileOp[];

  /** How many posts were unchanged (STABLE) */
  stableCount: number;

  /** How many posts were added */
  addedCount: number;

  /** How many posts were removed */
  removedCount: number;

  /** How many posts were updated (files changed) */
  updatedCount: number;

  /** How many visibility toggles (accordion changes) */
  toggleCount: number;

  /** Duration of the reconciliation in ms */
  duration_ms: number;
}

// ============================================================================
// RECONCILER
// ============================================================================

/**
 * Reconcile a scan result against the current model.
 *
 * This is the pure diff function — no side effects, no DOM writes.
 * It compares two data structures and produces a list of operations.
 *
 * The algorithm:
 * 1. For each scanned post:
 *    a. If it's NOT in the model → ADD_POST
 *    b. If it IS in the model and the fingerprint changed → UPDATE_POST
 *    c. If it IS in the model and the fingerprint is the same → STABLE
 *    d. If the expanded state changed → TOGGLE_VISIBILITY
 * 2. For each model post NOT in the scan → REMOVE_POST
 *
 * Fingerprints are the key optimization. Computing a fingerprint
 * (just counting children + files + checking a few attributes) is
 * WAY faster than deeply comparing all the post's properties.
 *
 * @param model - The current model (CourseContext)
 * @param scan - The new scan results
 * @returns ReconcileResult with operations to apply
 */
export function reconcile(
  model: CourseContext,
  scan: ScanResult,
): ReconcileResult {
  const startTime = performance.now();
  const ops: ReconcileOp[] = [];

  let stableCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  let updatedCount = 0;
  let toggleCount = 0;

  // Track which model posts we've seen in the scan
  // Any model posts NOT seen at the end will be REMOVE_POST'd
  const seenModelPosts = new Set<string>();

  // Process each scanned post
  for (const [postId, scannedPost] of scan.posts) {
    seenModelPosts.add(postId);

    const existingPost = model.posts.get(postId);

    if (!existingPost) {
      // NEW POST — not in the model yet
      ops.push({ type: 'ADD_POST', postId, post: scannedPost });
      addedCount++;
      continue;
    }

    // EXISTING POST — check for changes

    // Check if the element reference is still valid
    const existingEl = existingPost.elementRef.deref();
    if (!existingEl || !existingEl.isConnected) {
      // The old element is gone — treat as remove + add
      ops.push({ type: 'REMOVE_POST', postId });
      ops.push({ type: 'ADD_POST', postId, post: scannedPost });
      removedCount++;
      addedCount++;
      continue;
    }

    // Check accordion state change (visibility toggle)
    if (scannedPost.isExpanded !== existingPost.isExpanded) {
      ops.push({
        type: 'TOGGLE_VISIBILITY',
        postId,
        isExpanded: scannedPost.isExpanded,
      });
      toggleCount++;
    }

    // Check structural fingerprint
    if (scannedPost.fingerprint !== existingPost.fingerprint) {
      // Structure changed — diff the files
      const { addedFiles, removedFiles } = diffFiles(
        existingPost.files,
        scannedPost.files,
      );

      if (addedFiles.length > 0 || removedFiles.length > 0) {
        ops.push({
          type: 'UPDATE_POST',
          postId,
          addedFiles,
          removedFiles,
        });
        updatedCount++;
      } else {
        // Fingerprint changed but files are the same
        // This can happen when non-file elements are added/removed
        // (like a new comment count badge, or a UI element update)
        // We still need to update the fingerprint in the model
        ops.push({ type: 'STABLE', postId });
        stableCount++;
      }
    } else {
      // No structural change — completely stable
      ops.push({ type: 'STABLE', postId });
      stableCount++;
    }
  }

  // Find model posts that were NOT in the scan → they've been removed
  for (const [postId] of model.posts) {
    if (!seenModelPosts.has(postId)) {
      ops.push({ type: 'REMOVE_POST', postId });
      removedCount++;
    }
  }

  return {
    ops,
    stableCount,
    addedCount,
    removedCount,
    updatedCount,
    toggleCount,
    duration_ms: performance.now() - startTime,
  };
}

/**
 * Apply reconcile operations to update the model.
 *
 * This modifies the CourseContext in place (updating its posts map).
 * It does NOT touch the DOM — that's the renderer's job.
 *
 * The separation between model update and DOM update is crucial:
 * - In shadow mode, we update the model but skip DOM rendering
 * - In V2 mode, we update the model AND render to the DOM
 * - In both cases, the model is the source of truth
 */
export function applyOpsToModel(
  model: CourseContext,
  ops: ReconcileOp[],
  viewKind: ScanResult['viewKind'],
): void {
  for (const op of ops) {
    switch (op.type) {
      case 'ADD_POST': {
        const postModel = createPostModel(op.post.element, viewKind);

        // Add files
        for (const file of op.post.files) {
          const fileModel = createFileModel(
            file.element,
            file.canonicalId,
            file.idSource,
          );
          postModel.files.set(file.canonicalId, fileModel);
        }

        postModel.isExpanded = op.post.isExpanded;
        model.posts.set(op.postId, postModel);
        break;
      }

      case 'REMOVE_POST': {
        model.posts.delete(op.postId);
        break;
      }

      case 'UPDATE_POST': {
        const post = model.posts.get(op.postId);
        if (!post) break;

        // Remove old files
        for (const fileId of op.removedFiles) {
          post.files.delete(fileId);
        }

        // Add new files
        for (const file of op.addedFiles) {
          const fileModel = createFileModel(
            file.element,
            file.canonicalId,
            file.idSource,
          );
          post.files.set(file.canonicalId, fileModel);
        }

        // Update fingerprint
        const el = post.elementRef.deref();
        if (el) {
          post.fingerprint = computeFingerprint(el);
        }

        post.lastScannedAt = Date.now();
        post.stableScanCount = 0;
        break;
      }

      case 'TOGGLE_VISIBILITY': {
        const post = model.posts.get(op.postId);
        if (post) {
          post.isExpanded = op.isExpanded;
        }
        break;
      }

      case 'STABLE': {
        const post = model.posts.get(op.postId);
        if (post) {
          post.lastScannedAt = Date.now();
          post.stableScanCount++;
        }
        break;
      }
    }
  }

  model.lastScanAt = Date.now();
  model.scanCount++;
}

// ============================================================================
// FILE DIFFING
// ============================================================================

/**
 * Diff the files between the old model and the new scan.
 *
 * Uses canonical file IDs for comparison, so even if the DOM element
 * changed, we recognize the file by its canonical ID.
 *
 * This makes the extension resilient to Google re-rendering the DOM
 * without actually changing the file list.
 */
function diffFiles(
  existingFiles: Map<string, FileModel>,
  scannedFiles: ScannedFile[],
): { addedFiles: ScannedFile[]; removedFiles: string[] } {
  const scannedIds = new Set(scannedFiles.map(f => f.canonicalId));
  const existingIds = new Set(existingFiles.keys());

  // Files in scan but not in model → added
  const addedFiles = scannedFiles.filter(f => !existingIds.has(f.canonicalId));

  // Files in model but not in scan → removed
  const removedFiles = Array.from(existingIds).filter(id => !scannedIds.has(id));

  return { addedFiles, removedFiles };
}
