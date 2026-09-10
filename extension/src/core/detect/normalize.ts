// filepath: extension/src/core/detect/normalize.ts
/**
 * ============================================================================
 * TEXT NORMALIZATION — the shared string cleaner for every detector
 * ============================================================================
 *
 * Moved verbatim from entrypoints/content/detection-keywords.ts (Engine V4 S4
 * core extraction). ALL scanning must pass through normalizeText() before
 * matching: Classroom sprinkles invisible BiDi control characters around RTL
 * text and uses non-ASCII space variants, both of which break naive matching.
 *
 * Pure functions over strings. No imports.
 */

// ============================================================================
// BIDI CONTROL CHARACTERS TO STRIP
// ============================================================================

/** Invisible directionality and zero-width characters that corrupt matching. */
export const BIDI_CONTROL_CHARS: RegExp = new RegExp(
  '[' +
    '\u200B\u200C\u200D' + // Zero-width spaces/joiners
    '\u200E\u200F' +       // LTR/RTL marks
    '\u202A-\u202E' +      // Directional embeddings/overrides
    '\u2066-\u2069' +      // Isolates
    '\u061C' +             // Arabic Letter Mark
    '\uFEFF' +             // BOM
    '\u00AD' +             // Soft hyphen
  ']',
  'gu'
);

/** Unicode space variants Classroom renders alongside the ASCII space. */
export const WHITESPACE_VARIANTS: RegExp = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu;

// ============================================================================
// TEXT NORMALIZATION ENGINE
// ============================================================================

/**
 * Normalizes text by stripping invisible BiDi control characters.
 * ALL scanning MUST pass through this function.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(BIDI_CONTROL_CHARS, '')
    .replace(WHITESPACE_VARIANTS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aggressive normalization for comparison (lowercase, no punctuation).
 */
export function normalizeForComparison(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[()[\]{}.,،!?:;'"]/g, '')
    .trim();
}
