// filepath: extension/src/v2/decision/file-placement.ts
/**
 * ============================================================================
 * FILE PLACEMENT ENGINE — WHERE Do Download Buttons Go?
 * ============================================================================
 *
 * This is the V2 replacement for V1's hardcoded button placement logic.
 *
 * In V1, placement was a mess:
 * - `button-controller.ts` hardcoded `.N5dSp` and `.JZicYb` for headers
 * - `findThreeDots()` tried 5 different class selectors in sequence
 * - `observers.ts` just appended buttons to the attachment container
 * - No trace of WHY a button was placed where it was
 *
 * V2's approach is:
 * 1. Get the placement recipe for the current ViewKind
 * 2. Use SelectorScorer to find the anchor element (header, three-dots, etc.)
 * 3. Produce a PlacementDecision with confidence + reason codes
 * 4. The renderer uses the decision to inject — never decides on its own
 *
 * This separation is crucial for shadow mode: we can log placement decisions
 * without rendering anything, and compare V2 vs V1 decisions.
 *
 * The confidence scoring works like this:
 * - L1 (data-*) anchor found → confidence 95
 * - L2 (ARIA/semantic) anchor found → confidence 85
 * - L3 (structural) anchor found → confidence 70
 * - L4 (golden class) anchor found → confidence 55
 * - Post-root fallback → confidence 30
 *
 * @author Adham — this file took 3 iterations to get the API right
 * @since v4.0.0
 */

import type { PlacementDecision, ViewKind } from '../../engines/types';
import type { ScorerResult } from '../selectors/selector-scorer';
import { SelectorLevel } from '../selectors/selector-scorer';
import { createHeaderScorer } from '../selectors/selector-registry';
import {
  type PlacementRecipe,
  type AnchorStrategy,
  type InsertionPoint,
  getRecipe,
} from './placement-recipes';

// Import the ScannedPost and ScannedFile types from dom-scanner
import type { ScannedPost, ScannedFile } from '../model/dom-scanner';

// ============================================================================
// TYPES — Internal to the placement engine
// ============================================================================

/**
 * The result of finding an anchor point within a post.
 *
 * This is an internal type used by the placement engine. It wraps
 * the ScorerResult with additional metadata about what was found.
 */
export interface AnchorResult {
  /** The DOM element to use as the anchor point */
  element: HTMLElement;
  /** Which strategy was used to find it */
  strategy: AnchorStrategy;
  /** Confidence score (0-100) based on the selector level */
  confidence: number;
  /** The CSS selector that matched (for debugging) */
  selectorUsed: string;
  /** Whether this is a fallback (post-root or file-element) */
  isFallback: boolean;
  /** Full scorer trace (for debug panel) */
  scorerTrace: ScorerResult | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for each selector level.
 * Higher = more reliable placement.
 */
const LEVEL_CONFIDENCE: Record<SelectorLevel, number> = {
  [SelectorLevel.L1_DATA_ATTR]: 95,
  [SelectorLevel.L2_ARIA_SEMANTIC]: 85,
  [SelectorLevel.L3_STRUCTURAL]: 70,
  [SelectorLevel.L4_GOLDEN_CLASS]: 55,
  [SelectorLevel.L5_HEURISTIC]: 40,
};

/** Confidence score when we fall back to post-root */
const FALLBACK_CONFIDENCE = 30;

/** Attribute used to mark buttons with their file ID (for dedup) */
const FILE_ID_ATTR = 'data-cqd-file-id';

/** Attribute used to mark buttons as CQD-injected */
const INJECTED_ATTR = 'data-cqd-injected';

/**
 * Safe CSS.escape fallback for jsdom environments.
 * jsdom doesn't provide CSS.escape, so we fall back to a simple
 * string replacement that escapes characters invalid in CSS selectors.
 */
function safeCssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Minimal fallback: escape characters that break CSS attribute selectors
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Compute placement decisions for all files in a scanned post.
 *
 * This is the main entry point. Given a post and its view kind,
 * it produces a PlacementDecision for each file that needs a button,
 * plus optionally a decision for the "Download All" button.
 *
 * @param post - The scanned post with its files
 * @param viewKind - Current page type (determines which recipe to use)
 * @returns Array of PlacementDecisions for the renderer
 */
export function computePlacement(
  post: ScannedPost,
  viewKind: ViewKind,
): PlacementDecision[] {
  const recipe = getRecipe(viewKind);
  const decisions: PlacementDecision[] = [];

  // If accordion-based and post is collapsed, skip placement entirely
  // The renderer won't inject buttons for collapsed posts
  if (recipe.hideWhenCollapsed && !post.isExpanded) {
    return decisions;
  }

  // Find the anchor for single-file buttons
  // (usually the file element itself, sometimes the header)
  for (const file of post.files) {
    // Skip if a button for this file already exists
    if (isAlreadyPlaced(file.canonicalId, post.element)) {
      continue;
    }

    // Skip if below the minimum file count threshold
    // (some recipes might require 2+ files before showing individual buttons)
    if (post.files.length < recipe.singleButton.minFilesForButton) {
      continue;
    }

    const anchor = findAnchorForFile(
      post.element,
      file,
      recipe.singleButton.anchorStrategy,
      viewKind,
    );

    decisions.push({
      fileId: file.canonicalId,
      targetElement: anchor.element,
      insertionPoint: recipe.singleButton.insertionPoint,
      anchorSelector: anchor.selectorUsed,
      confidence: anchor.confidence,
      reasonCodes: buildReasonCodes(anchor, 'single', recipe),
      fallbackUsed: anchor.isFallback,
    });
  }

  // Compute Download All placement if enough files
  if (post.files.length >= recipe.downloadAll.minFilesForDownloadAll) {
    const downloadAllId = `download-all:${post.id}`;

    if (!isAlreadyPlaced(downloadAllId, post.element)) {
      const anchor = findAnchorForHeader(
        post.element,
        recipe.downloadAll.anchorStrategy,
        viewKind,
      );

      decisions.push({
        fileId: downloadAllId,
        targetElement: anchor.element,
        insertionPoint: recipe.downloadAll.insertionPoint,
        anchorSelector: anchor.selectorUsed,
        confidence: anchor.confidence,
        reasonCodes: buildReasonCodes(anchor, 'download-all', recipe),
        fallbackUsed: anchor.isFallback,
      });
    }
  }

  return decisions;
}

/**
 * Convenience: compute placement for just the Download All button.
 *
 * Used when we already have individual buttons placed but need to
 * add/update the Download All button (e.g., after file count changes).
 */
export function computeDownloadAllPlacement(
  post: ScannedPost,
  viewKind: ViewKind,
): PlacementDecision | null {
  const recipe = getRecipe(viewKind);

  if (post.files.length < recipe.downloadAll.minFilesForDownloadAll) {
    return null;
  }

  if (recipe.hideWhenCollapsed && !post.isExpanded) {
    return null;
  }

  const downloadAllId = `download-all:${post.id}`;

  if (isAlreadyPlaced(downloadAllId, post.element)) {
    return null;
  }

  const anchor = findAnchorForHeader(
    post.element,
    recipe.downloadAll.anchorStrategy,
    viewKind,
  );

  return {
    fileId: downloadAllId,
    targetElement: anchor.element,
    insertionPoint: recipe.downloadAll.insertionPoint,
    anchorSelector: anchor.selectorUsed,
    confidence: anchor.confidence,
    reasonCodes: buildReasonCodes(anchor, 'download-all', recipe),
    fallbackUsed: anchor.isFallback,
  };
}

// ============================================================================
// ANCHOR FINDING — Finding where to attach buttons
// ============================================================================

/**
 * Find the anchor element for a single-file button.
 *
 * Depending on the anchor strategy:
 * - 'file-element': use the file's own element as anchor
 * - 'header': find the post header using SelectorScorer
 * - 'post-root': use the post element directly
 */
function findAnchorForFile(
  postEl: HTMLElement,
  file: ScannedFile,
  strategy: AnchorStrategy,
  _viewKind: ViewKind,
): AnchorResult {
  switch (strategy) {
    case 'file-element':
      return {
        element: file.element,
        strategy: 'file-element',
        confidence: 90,
        selectorUsed: 'file-element-direct',
        isFallback: false,
        scorerTrace: null,
      };

    case 'header':
      return findHeaderAnchor(postEl);

    case 'post-root':
    default:
      return {
        element: postEl,
        strategy: 'post-root',
        confidence: FALLBACK_CONFIDENCE,
        selectorUsed: 'post-root-fallback',
        isFallback: true,
        scorerTrace: null,
      };
  }
}

/**
 * Find the anchor element for a "Download All" or header-based button.
 *
 * Depending on the anchor strategy:
 * - 'header': find the post header using SelectorScorer
 * - 'post-root': use the post element directly
 * - 'file-element': not valid for Download All — falls back to post-root
 */
function findAnchorForHeader(
  postEl: HTMLElement,
  strategy: AnchorStrategy,
  _viewKind: ViewKind,
): AnchorResult {
  switch (strategy) {
    case 'header':
      return findHeaderAnchor(postEl);

    case 'post-root':
    case 'file-element':
    default:
      return {
        element: postEl,
        strategy: 'post-root',
        confidence: FALLBACK_CONFIDENCE,
        selectorUsed: 'post-root-fallback',
        isFallback: true,
        scorerTrace: null,
      };
  }
}

/**
 * Use the header SelectorScorer to find the best anchor in a post.
 *
 * Tries HEADER_CANDIDATES in priority order (data-* → ARIA → structural → class).
 * If nothing matches, falls back to the post element itself.
 *
 * This is the KEY improvement over V1:
 * - V1: findHeaderContainer() → hardcoded `.N5dSp`, `.JZicYb`
 * - V2: SelectorScorer → tries 13 candidates across 3 levels, self-heals
 */
function findHeaderAnchor(postEl: HTMLElement): AnchorResult {
  const scorer = createHeaderScorer();
  const result = scorer.queryOne(postEl);

  if (result.element && result.winner) {
    const level = result.winnerLevel ?? SelectorLevel.L5_HEURISTIC;
    return {
      element: result.element,
      strategy: 'header',
      confidence: LEVEL_CONFIDENCE[level] ?? FALLBACK_CONFIDENCE,
      selectorUsed: result.winner.cssSelector ?? result.winner.id,
      isFallback: false,
      scorerTrace: result,
    };
  }

  // Scorer found nothing — fall back to the post element itself
  return {
    element: postEl,
    strategy: 'post-root',
    confidence: FALLBACK_CONFIDENCE,
    selectorUsed: 'post-root-fallback (header not found)',
    isFallback: true,
    scorerTrace: result,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a button for a specific file is already injected in the post.
 *
 * Uses the canonical file ID stored as data-cqd-file-id attribute.
 * This is the primary dedup mechanism — prevents duplicate buttons.
 */
export function isAlreadyPlaced(fileId: string, postEl: HTMLElement): boolean {
  // CSS.escape handles special characters in the file ID (like colons)
  const escapedId = safeCssEscape(fileId);
  return !!postEl.querySelector(`[${FILE_ID_ATTR}="${escapedId}"][${INJECTED_ATTR}]`);
}

/**
 * Build reason codes for a placement decision.
 *
 * Reason codes explain WHY the placement was made — useful for debugging
 * and for the shadow comparison reports.
 */
function buildReasonCodes(
  anchor: AnchorResult,
  buttonType: 'single' | 'download-all',
  recipe: PlacementRecipe,
): string[] {
  const codes: string[] = [];

  // Button type
  codes.push(buttonType === 'single' ? 'SINGLE_FILE_BUTTON' : 'DOWNLOAD_ALL_BUTTON');

  // Anchor strategy used
  codes.push(`ANCHOR_${anchor.strategy.toUpperCase().replace(/-/g, '_')}`);

  // View kind
  codes.push(`VIEW_${recipe.viewKind.toUpperCase()}`);

  // Selector level
  if (anchor.scorerTrace?.winnerLevel !== null && anchor.scorerTrace?.winnerLevel !== undefined) {
    const levelNames = ['L1_DATA', 'L2_ARIA', 'L3_STRUCTURAL', 'L4_GOLDEN', 'L5_HEURISTIC'];
    codes.push(levelNames[anchor.scorerTrace.winnerLevel] ?? 'UNKNOWN_LEVEL');
  }

  // Fallback indicator
  if (anchor.isFallback) {
    codes.push('FALLBACK_USED');
  }

  return codes;
}

/**
 * Get the file ID attribute name (for external use by renderers).
 */
export function getFileIdAttr(): string {
  return FILE_ID_ATTR;
}

/**
 * Get the injected attribute name (for external use by renderers).
 */
export function getInjectedAttr(): string {
  return INJECTED_ATTR;
}
