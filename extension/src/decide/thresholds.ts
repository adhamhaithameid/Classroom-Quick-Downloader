// filepath: extension/src/decide/thresholds.ts
/**
 * Thresholds for flag verdicts.
 * These come from the refactor plan (§7.4).
 * Do NOT change these without running the full test suite.
 *
 * Moved verbatim from src/v2/decision/flag-scoring.ts when the Detect/Decide
 * seam was extracted. Deliberately NOT `as const`: the original was a plain
 * object literal, and `getThresholds(): typeof THRESHOLDS` is part of the
 * public surface that must keep its exact type.
 */
export const THRESHOLDS = {
  comment_show: 40,
  comment_high_confidence: 70,
  edited_show: 35,
  edited_high_confidence: 65,
  both_minimum_each: 30,
};

export type Thresholds = typeof THRESHOLDS;
