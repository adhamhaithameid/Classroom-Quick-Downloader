// filepath: extension/src/v2/render/download-all-renderer.ts
/**
 * ============================================================================
 * DOWNLOAD ALL RENDERER — Multi-File Download Button
 * ============================================================================
 *
 * This is the V2 replacement for V1's `ensureDownloadAllButton()` in
 * `download-all/button-controller.ts`.
 *
 * V1's approach had several problems:
 * - Hardcoded `.N5dSp` and `.JZicYb` selectors for finding header
 * - Created a MutationObserver PER button to watch class changes
 * - JS-based mouseenter/mouseleave for cancel hover state
 * - No dedup — same post could get multiple Download All buttons
 *
 * V2's approach:
 * - Placement comes from file-placement.ts PlacementDecision (no selectors here)
 * - Template cloning from button-renderer.ts
 * - CSS-only hover states
 * - Dedup via data-cqd-file-id="download-all:{postId}"
 * - State management via class toggles
 *
 * This module provides higher-level helpers for the Download All workflow:
 * - Aggregating file states into download progress
 * - Updating the button UI based on progress
 * - Computing file counts and grouping
 *
 * @author Adham — Download All is the feature users love most
 * @since v4.0.0
 */

import type { ScannedFile } from '../model/dom-scanner';
import { getFileIdAttr } from '../decision/file-placement';

/**
 * Safe CSS.escape fallback for jsdom environments.
 * jsdom doesn't provide CSS.escape — same pattern as file-placement.ts.
 */
function safeCssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress state for a Download All operation.
 *
 * Tracks how many files have been downloaded, are in progress,
 * or have failed — so the button can show accurate progress.
 */
export interface DownloadAllProgress {
  /** Total files to download */
  total: number;
  /** Files that have completed successfully */
  completed: number;
  /** Files currently downloading */
  inProgress: number;
  /** Files that failed */
  failed: number;
  /** Files that haven't started yet */
  pending: number;
  /** Whether the user requested cancellation */
  cancelled: boolean;
}

/**
 * State of the Download All button.
 */
export type DownloadAllState = 'idle' | 'downloading' | 'success' | 'error' | 'cancelled' | 'partial';

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Create a fresh progress tracker for starting a Download All operation.
 *
 * @param fileCount - Number of files in this post
 * @returns Fresh progress state with all files pending
 */
export function createProgress(fileCount: number): DownloadAllProgress {
  return {
    total: fileCount,
    completed: 0,
    inProgress: 0,
    failed: 0,
    pending: fileCount,
    cancelled: false,
  };
}

/**
 * Compute the overall state from the progress.
 *
 * State priority:
 * - cancelled → user requested cancel
 * - downloading → any file in progress
 * - success → all completed, 0 failed
 * - partial → some completed, some failed
 * - error → all failed
 * - idle → nothing started
 */
export function getProgressState(progress: DownloadAllProgress): DownloadAllState {
  if (progress.cancelled) return 'cancelled';
  if (progress.inProgress > 0) return 'downloading';
  if (progress.completed === progress.total) return 'success';
  if (progress.completed > 0 && progress.failed > 0) return 'partial';
  if (progress.failed === progress.total) return 'error';
  if (progress.failed > 0 && progress.completed === 0 && progress.pending === 0) return 'error';
  return 'idle';
}

// ============================================================================
// BUTTON STATE MANAGEMENT
// ============================================================================

/**
 * Update the Download All button's visual state based on progress.
 *
 * Uses CSS class toggles — no direct style manipulation.
 * The actual visual changes come from button-styles.ts CSS.
 *
 * @param button - The Download All button element
 * @param progress - Current download progress
 */
export function updateDownloadAllUI(
  button: HTMLButtonElement,
  progress: DownloadAllProgress,
): void {
  const state = getProgressState(progress);

  // Clear all state classes
  button.classList.remove(
    'cqd-loading',
    'cqd-success',
    'cqd-error',
    'cqd-cancelled',
  );

  // Update label and count
  const label = button.querySelector<HTMLElement>('.cqd-v2-label');
  const countEl = button.querySelector<HTMLElement>('.cqd-v2-count');

  switch (state) {
    case 'idle':
      if (label) label.textContent = 'Download All';
      if (countEl) countEl.textContent = String(progress.total);
      break;

    case 'downloading':
      button.classList.add('cqd-loading');
      if (label) label.textContent = `Downloading`;
      if (countEl) countEl.textContent = `${progress.completed}/${progress.total}`;
      break;

    case 'success':
      button.classList.add('cqd-success');
      if (label) label.textContent = 'Downloaded';
      if (countEl) countEl.textContent = `${progress.total}`;
      break;

    case 'error':
      button.classList.add('cqd-error');
      if (label) label.textContent = 'Failed';
      if (countEl) countEl.textContent = `${progress.failed}`;
      break;

    case 'partial':
      button.classList.add('cqd-error');
      if (label) label.textContent = 'Partial';
      if (countEl) countEl.textContent = `${progress.completed}/${progress.total}`;
      break;

    case 'cancelled':
      button.classList.add('cqd-cancelled');
      if (label) label.textContent = 'Cancelled';
      if (countEl) countEl.textContent = `${progress.completed}/${progress.total}`;
      break;
  }
}

/**
 * Reset a Download All button to its idle state.
 *
 * Called when files change (post re-scan) or after a timeout
 * following successful/failed/cancelled downloads.
 *
 * @param button - The Download All button element
 * @param fileCount - Updated file count
 */
export function resetDownloadAllButton(
  button: HTMLButtonElement,
  fileCount: number,
): void {
  button.classList.remove(
    'cqd-loading',
    'cqd-success',
    'cqd-error',
    'cqd-cancelled',
  );

  const label = button.querySelector<HTMLElement>('.cqd-v2-label');
  const countEl = button.querySelector<HTMLElement>('.cqd-v2-count');

  if (label) label.textContent = 'Download All';
  if (countEl) countEl.textContent = String(fileCount);
}

// ============================================================================
// FILE GROUPING — Which files belong to which Download All group?
// ============================================================================

/**
 * Group files by their parent post ID.
 *
 * This is used to determine how many files each Download All button
 * should show, and to dispatch download requests to the right files.
 *
 * @param files - All scanned files from the current scan
 * @param postId - The post to get files for
 * @returns Array of files belonging to the specified post
 */
export function getFilesForPost(
  files: ScannedFile[],
  _postId: string,
): ScannedFile[] {
  // Files are already grouped by post in the scanning phase.
  // This function exists for clarity and to support future
  // ungrouped file discovery.
  return files;
}

/**
 * Find the Download All button in a post.
 *
 * @param postEl - The post element to search
 * @param postId - The post ID
 * @returns The Download All button, or null
 */
export function findDownloadAllButton(
  postEl: HTMLElement,
  postId: string,
): HTMLButtonElement | null {
  const fileId = `download-all:${postId}`;
  return postEl.querySelector<HTMLButtonElement>(
    `[${getFileIdAttr()}="${safeCssEscape(fileId)}"]`,
  );
}
