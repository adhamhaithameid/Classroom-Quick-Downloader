// filepath: extension/src/v2/render/classroom-action-label.ts
/**
 * ============================================================================
 * CLASSROOM_ACTION_LABEL — single source for the classroom action copy (2.7)
 * ============================================================================
 *
 * The classroom-wide action must not be permanently named "Download all
 * classroom files": the action's scope is set to change, and a rename is
 * pending the owner's finalist pick. Until that decision lands, THIS
 * constant is the only place the copy is written — every render site
 * (initial button text, terminal-state reset) must read it so the eventual
 * rename is a one-line change, pinned by tests/classroom-action-label.test.ts.
 *
 * Do NOT inline this string anywhere else and do NOT rename it here.
 */

/** The CURRENT rendered copy of the classroom-wide action (rename pending). */
export const CLASSROOM_ACTION_LABEL = 'Download all classroom files';
