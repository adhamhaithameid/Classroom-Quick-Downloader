// filepath: extension/src/core/detect/ceilings.ts
/**
 * ============================================================================
 * CEILINGS — the two numeric bounds every count check must share (D4)
 * ============================================================================
 *
 * Comment-count acceptance used to be written as ad-hoc literals (`< 1000`,
 * `< 10000`) that drifted apart between modules, so the same count could be
 * believed in one detector and rejected in another. There are exactly two
 * distinct questions, and each has one number:
 *
 *  - PARSER_SANITY_CEILING — can the numeral parser trust its own output at
 *    all? A digit run above this is an id, a timestamp or a coordinate, not a
 *    count. Used only inside the numeral parser.
 *  - PLAUSIBLE_COMMENT_COUNT — would Classroom ever display a comment count
 *    this large? Every comment-count acceptance check uses this bound, so a
 *    given count is believed (or doubted) identically in every detector.
 *
 * Pure data. No imports.
 */

/** Largest numeral the parser will believe. Above this it is an id, not a count. */
export const PARSER_SANITY_CEILING = 100_000;

/** Largest comment count any acceptance check will believe. */
export const PLAUSIBLE_COMMENT_COUNT = 10_000;
