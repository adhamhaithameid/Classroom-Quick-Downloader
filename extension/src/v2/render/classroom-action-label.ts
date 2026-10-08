// filepath: extension/src/v2/render/classroom-action-label.ts
/**
 * ============================================================================
 * CLASSROOM_ACTION_LABEL — single source for the classroom action copy (2.7)
 * ============================================================================
 *
 * The classroom-wide action's copy lives in THIS constant only — every
 * render site (initial button text, terminal-state reset) reads it, so any
 * future rename stays a one-line change, pinned by
 * tests/classroom-action-label.test.ts.
 *
 * Phase 4 (direction A, owner ballot): the pending rename LANDED. The owner
 * picked "Download Classroom" (prototypes/components.html section D,
 * candidate 1 — names the object exactly, no shared word with the
 * post-level "Download All (N files)").
 *
 * Do NOT inline this string anywhere else. A future rename edits ONLY this
 * constant and its pin test.
 */

/** The rendered copy of the classroom-wide action (owner pick, "Download Classroom"). */
export const CLASSROOM_ACTION_LABEL = 'Download Classroom';
