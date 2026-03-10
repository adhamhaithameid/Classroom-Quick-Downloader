// filepath: extension/src/v2/decision/placement-recipes.ts
/**
 * ============================================================================
 * PLACEMENT RECIPES — Per-ViewKind Button Positioning Rules
 * ============================================================================
 *
 * This file defines WHERE buttons go for each type of Google Classroom page.
 *
 * The problem with V1 was that placement was hardcoded with brittle selectors
 * like `.N5dSp` and `.JZicYb`. When Google changed those class names, buttons
 * ended up in weird places or disappeared entirely.
 *
 * The new system uses "recipes" — declarative rules that describe the INTENT
 * of button placement, not the specific CSS class. The file-placement engine
 * uses these recipes + the SelectorScorer to find the actual DOM element.
 *
 * Each recipe has:
 * - singleButton: where to put individual file download buttons
 * - downloadAll: where to put the "Download All" button
 * - anchorStrategy: how to find the anchor element within the post
 *
 * The "anchorTarget" values reference scorer targets from selector-registry.ts:
 * - 'header': uses createHeaderScorer() → HEADER_CANDIDATES
 * - 'file-element': places directly on the file element itself
 * - 'post-root': appends to the post container as fallback
 *
 * @author Adham — defining placement rules took more thought than I expected
 * @since v4.0.0
 */

import { ViewKind } from '../../engines/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Defines where to insert a button relative to an anchor element.
 *
 * - 'before': insert as previous sibling of anchor
 * - 'after': insert as next sibling of anchor
 * - 'append': append as last child of anchor
 * - 'prepend': insert as first child of anchor
 */
export type InsertionPoint = 'before' | 'after' | 'append' | 'prepend';

/**
 * Strategy for finding the anchor element within a post.
 *
 * - 'header': uses the header scorer to find the post header/three-dots area
 * - 'file-element': places button directly adjacent to the file element
 * - 'post-root': uses the post container itself as the anchor
 */
export type AnchorStrategy = 'header' | 'file-element' | 'post-root';

/**
 * A placement recipe for a specific view kind.
 *
 * Contains the rules for where to put single-file buttons and
 * the Download All button within a post on a specific page type.
 */
export interface PlacementRecipe {
  /** Which view kind this recipe is for */
  viewKind: ViewKind;

  /** Rules for individual file download buttons */
  singleButton: {
    /** How to find the anchor element */
    anchorStrategy: AnchorStrategy;
    /** Where to insert relative to the anchor */
    insertionPoint: InsertionPoint;
    /** Minimum number of files before showing individual buttons */
    minFilesForButton: number;
    /** Additional CSS class to add to the button (view-specific styling) */
    extraClass?: string;
  };

  /** Rules for the "Download All" button */
  downloadAll: {
    /** How to find the anchor element */
    anchorStrategy: AnchorStrategy;
    /** Where to insert relative to the anchor */
    insertionPoint: InsertionPoint;
    /** Minimum number of files before showing Download All */
    minFilesForDownloadAll: number;
    /** Additional CSS class to add to the button */
    extraClass?: string;
  };

  /** Whether this view supports accordion state (expand/collapse) */
  supportsAccordion: boolean;

  /** Whether buttons should be hidden when the post is collapsed */
  hideWhenCollapsed: boolean;
}

// ============================================================================
// RECIPE DEFINITIONS
// ============================================================================

/**
 * Stream view (/c/{classId}) — announcements and posts.
 *
 * Stream posts have a header row with a three-dots menu on the right.
 * The Download All button goes TO THE LEFT of the three-dots menu.
 * Individual file buttons go on the file attachment container itself.
 *
 * Stream posts are always expanded — no accordion behavior.
 */
const STREAM_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.STREAM,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'before',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-in-header',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Classwork list view (/w/{classId}/t/all) — all assignments and materials.
 *
 * Classwork posts can be collapsed (accordion). When collapsed, buttons
 * should be hidden because the attachment area is not visible.
 *
 * The Download All button goes in the header area of the expanded item.
 * Individual buttons go on the file elements within the expanded content.
 */
const CLASSWORK_LIST_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.CLASSWORK_LIST,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'before',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-in-header',
  },
  supportsAccordion: true,
  hideWhenCollapsed: true,
};

/**
 * Topic classwork view (/w/{classId}/tc/{topicId}).
 *
 * Similar to classwork list, but filtered by topic.
 * Posts are always expanded in topic view — no accordion.
 */
const CLASSWORK_TOPIC_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.CLASSWORK_TOPIC,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'before',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-in-header',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Assignment details (/c/{classId}/a/{itemId}/details).
 *
 * Single assignment detail page. The "post" is the entire page content.
 * There's usually a header area at the top with the assignment title.
 * Download All goes in that header. Individual buttons on each attachment.
 */
const ASSIGNMENT_DETAILS_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.ASSIGNMENT_DETAILS,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'after',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-detail-download-all',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Material details (/c/{classId}/m/{itemId}/details).
 *
 * Very similar to assignment details — single material with attachments.
 */
const MATERIAL_DETAILS_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.MATERIAL_DETAILS,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'after',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-detail-download-all',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Student submissions (/c/{classId}/a/{itemId}/submissions/{studentId}).
 *
 * NEW IN V2 — V1 didn't support this page at all!
 * Shows a single student's submitted files. Buttons go on each file.
 * Download All goes at the post root since there's no header like other views.
 */
const STUDENT_SUBMISSIONS_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.STUDENT_SUBMISSIONS,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'post-root',
    insertionPoint: 'prepend',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-submissions-download-all',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Student work teacher view (/c/{classId}/a/{itemId}/submissions).
 *
 * NEW IN V2 — teacher sees all student submissions.
 * Each student's submission is like a mini-post. Buttons per file,
 * Download All per student block.
 */
const STUDENT_WORK_TEACHER_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.STUDENT_WORK_TEACHER,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'after',
    minFilesForDownloadAll: 2,
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Announcement detail (/c/{classId}/p/{postId}).
 *
 * Single announcement page. Similar to assignment details.
 */
const ANNOUNCEMENT_DETAIL_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.ANNOUNCEMENT_DETAIL,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'header',
    insertionPoint: 'after',
    minFilesForDownloadAll: 2,
    extraClass: 'cqd-detail-download-all',
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

/**
 * Unknown page type — safe fallback.
 *
 * Uses the most conservative placement: file-level buttons with
 * post-root Download All. This should work on any page structure
 * even if we can't identify the specific view kind.
 */
const UNKNOWN_RECIPE: PlacementRecipe = {
  viewKind: ViewKind.UNKNOWN,
  singleButton: {
    anchorStrategy: 'file-element',
    insertionPoint: 'append',
    minFilesForButton: 1,
  },
  downloadAll: {
    anchorStrategy: 'post-root',
    insertionPoint: 'append',
    minFilesForDownloadAll: 2,
  },
  supportsAccordion: false,
  hideWhenCollapsed: false,
};

// ============================================================================
// RECIPE REGISTRY — Map from ViewKind to Recipe
// ============================================================================

/**
 * Master registry of all placement recipes.
 *
 * Every ViewKind MUST have a recipe. If we add a new ViewKind in the
 * future and forget to add a recipe, getRecipe() will return the
 * UNKNOWN fallback — which works, just not optimally.
 */
const RECIPE_MAP = new Map<ViewKind, PlacementRecipe>([
  [ViewKind.STREAM, STREAM_RECIPE],
  [ViewKind.CLASSWORK_LIST, CLASSWORK_LIST_RECIPE],
  [ViewKind.CLASSWORK_TOPIC, CLASSWORK_TOPIC_RECIPE],
  [ViewKind.ASSIGNMENT_DETAILS, ASSIGNMENT_DETAILS_RECIPE],
  [ViewKind.MATERIAL_DETAILS, MATERIAL_DETAILS_RECIPE],
  [ViewKind.STUDENT_SUBMISSIONS, STUDENT_SUBMISSIONS_RECIPE],
  [ViewKind.STUDENT_WORK_TEACHER, STUDENT_WORK_TEACHER_RECIPE],
  [ViewKind.ANNOUNCEMENT_DETAIL, ANNOUNCEMENT_DETAIL_RECIPE],
  [ViewKind.UNKNOWN, UNKNOWN_RECIPE],
]);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the placement recipe for a specific view kind.
 *
 * If no recipe exists for the given view kind (shouldn't happen since
 * we cover all ViewKind values), returns the UNKNOWN fallback recipe.
 *
 * @param viewKind - The current page type
 * @returns The placement recipe for that page type
 */
export function getRecipe(viewKind: ViewKind): PlacementRecipe {
  return RECIPE_MAP.get(viewKind) ?? UNKNOWN_RECIPE;
}

/**
 * Get all registered recipes (for testing/debugging).
 */
export function getAllRecipes(): PlacementRecipe[] {
  return Array.from(RECIPE_MAP.values());
}

/**
 * Check if a view kind supports accordion (expand/collapse) behavior.
 * Convenience function so callers don't need to get the full recipe.
 */
export function viewSupportsAccordion(viewKind: ViewKind): boolean {
  return getRecipe(viewKind).supportsAccordion;
}

/**
 * Check if buttons should be hidden when a post is collapsed.
 * Only relevant for views that support accordion.
 */
export function shouldHideWhenCollapsed(viewKind: ViewKind): boolean {
  const recipe = getRecipe(viewKind);
  return recipe.supportsAccordion && recipe.hideWhenCollapsed;
}
