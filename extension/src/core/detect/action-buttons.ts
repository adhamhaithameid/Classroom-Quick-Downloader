// filepath: extension/src/core/detect/action-buttons.ts
/**
 * ============================================================================
 * ACTION BUTTONS — the ONE canonical "Add comment" exclusion table (D3)
 * ============================================================================
 *
 * The same table used to live in three places and had drifted:
 *   - src/detect/keyword/keyword-scoring.ts (13 patterns)
 *   - entrypoints/content/smart-detector-comments.ts (15 patterns, with the
 *     Arabic alternation split into three single-form regexes)
 *   - src/v2/decision/exclusion-engine.ts (regex rules in its registry)
 *
 * ACTION_BUTTON_PATTERNS is the UNION of the two literal tables, deduped by
 * regex source, original flags preserved. keyword-scoring and
 * smart-detector-comments import it directly (their local copies are gone);
 * the exclusion engine keeps its per-rule metadata (penalty, reason, flag
 * types) but looks its regex patterns up here via findActionButtonPattern, so
 * the three consumers can never drift apart again.
 *
 * Pure data. No imports.
 */

/**
 * Canonical action-button patterns. A text chunk matching any of these is a
 * UI button ("Add class comment", "أضف تعليق", …), not a comment indicator.
 */
export const ACTION_BUTTON_PATTERNS: RegExp[] = [
  /add\s+(?:class\s+)?comment/i,
  /(?:اضافة|إضافة|أضف)\s+تعليق/i,
  /اضافة\s+تعليق/i,           // Arabic: Add comment
  /إضافة\s+تعليق/i,           // Arabic variant
  /أضف\s+تعليق/i,             // Arabic: Add comment (imperative)
  /добавить\s+комментарий/i,  // Russian
  /コメントを追加/i,            // Japanese
  /添加评论/i,                 // Chinese
  /ajouter.*commentaire/i,    // French
  /kommentar.*hinzufügen/i,   // German
  /añadir.*comentario/i,      // Spanish
  /write.*comment/i,
  /type.*comment/i,
  /post.*comment/i,
  /new\s+comment/i,
  /leave.*comment/i,
];

const CANONICAL_BY_SOURCE: ReadonlyMap<string, RegExp> = new Map(
  ACTION_BUTTON_PATTERNS.map((pattern) => [pattern.source, pattern]),
);

/**
 * Look up a canonical pattern by regex source.
 *
 * The exclusion engine carries richer metadata than this bare table can
 * express, so its rules reference the pattern objects here instead of
 * re-declaring them. A miss means a rule and the canonical table have
 * drifted apart — a programming error that must fail loudly.
 */
export function findActionButtonPattern(source: string): RegExp {
  const pattern = CANONICAL_BY_SOURCE.get(source);
  if (!pattern) {
    throw new Error(`action-button pattern is not in the canonical table: ${source}`);
  }
  return pattern;
}
