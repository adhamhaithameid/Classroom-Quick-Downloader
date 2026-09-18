// filepath: extension/src/core/detect/numerals.ts
/**
 * ============================================================================
 * NUMERALS — language-free numeric parsing
 * ============================================================================
 *
 * Shared by every detector. A numeral is a numeral in every script, which is
 * what makes this safe for StructuralDetector to use. Imports the shared
 * ceilings from ./ceilings (D4) and the pure string cleaner from ./normalize —
 * no keyword table, no language signal, no page text conventions.
 *
 * NOT the same as the keyword layer's word-aware integer parser (it lives in
 * the V1 detection-keywords module). That one falls back to parsing WORD-
 * numbers ("واحد" = one, "اثنان" = two), which is language knowledge and
 * therefore belongs to the keyword layer. This module is digits only, on
 * purpose — see the last case in tests/detect/numerals.test.ts.
 */
import { PARSER_SANITY_CEILING, PLAUSIBLE_COMMENT_COUNT } from './ceilings';
import { normalizeText } from './normalize';

/** Unicode decimal digit, any script. */
const DIGIT = /\p{Nd}/u;

/** Invisible BiDi controls that Classroom sprinkles around RTL numerals. */
const BIDI_CONTROLS = /[​-‏‪-‮⁦-⁩]/g;

/** True if the character is a decimal digit in any script. */
export function isDigit(char: string): boolean {
  return char.length > 0 && DIGIT.test(char);
}

/** True if the text contains a decimal digit in any script. */
export function hasDigit(text: string): boolean {
  return !!text && DIGIT.test(text);
}

/**
 * Numeric value of a single digit character, in any script. -1 if not a digit.
 *
 * Derived rather than looked up. Every Unicode decimal-digit block is a
 * contiguous run of exactly ten codepoints, and the blocks are separated by
 * non-digit codepoints. So a character's value is simply how far it sits from
 * the start of its own run. That works for every `Nd` script — present and
 * future — with no table to fall out of date.
 */
export function digitValue(char: string): number {
  if (!isDigit(char)) return -1;
  const cp = char.codePointAt(0);
  // The guard above guarantees a digit, so cp is always defined here.
  // Stryker disable next-line ConditionalExpression,UnaryOperator
  if (cp === undefined) return -1;

  for (let value = 0; value <= 9; value++) {
    const previous = cp - value - 1;
    if (previous < 0 || !DIGIT.test(String.fromCodePoint(previous))) {
      return value;
    }
  }

  // Unreachable: every \p{Nd} run start sits within 9 codepoints of its own
  // digits, so the loop above always returns. Defensive fallback only.
  // Stryker disable next-line UnaryOperator
  return -1;
}

/**
 * Extract a count from text by reading its first run of digits.
 *
 * Returns null when there is no numeral, when the value is zero, or when it is
 * implausibly large. Zero is null rather than 0 because "0 comments" and "no
 * comments" mean the same thing to every caller here.
 */
export function extractDigitCount(text: string): number | null {
  if (!text) return null;

  const cleaned = text.replace(BIDI_CONTROLS, '');

  let result = 0;
  let started = false;

  for (const char of cleaned) {
    const value = digitValue(char);

    if (value >= 0) {
      started = true;
      result = result * 10 + value;
      if (result >= PARSER_SANITY_CEILING) return null;
    } else if (started) {
      break; // first run only
    }
  }

  if (!started || result <= 0) return null;

  return result;
}

// ============================================================================
// COUNT CHIP ACCEPTANCE (D5)
// ============================================================================

/**
 * Longest text a real comment-count chip carries. Google's badge holds the
 * numeral and nothing else; a stray paragraph that happens to contain a digit
 * is longer than this even after cleaning.
 */
export const MAX_COUNT_CHIP_LENGTH = 32;

/** A count chip is numerals and whitespace only — no separators, no words. */
const COUNT_CHIP_SHAPE = /^[\p{Nd}\s]*$/u;

/** An accepted chip: its count and its cleaned text. */
export interface CountChip {
  count: number;
  text: string;
}

/**
 * Read a Google count chip (`.huI6Cb` and friends) as a comment count — or
 * null when the chip is not one.
 *
 * The DOM-truth layers (keyword L0 and structural S0) used to trust ANY numeral
 * found in the chip (D5): an id-like 99999 slid under the parser ceiling, a
 * timestamp chip "12:34" read as 12, and either beat every other layer.
 * Acceptance now demands all of:
 *
 *   1. shape — after normalizeText (BiDi strip, whitespace collapse) the chip
 *      is pure numerals/whitespace and at most MAX_COUNT_CHIP_LENGTH chars;
 *   2. value — extractDigitCount parses it and the value is below
 *      PLAUSIBLE_COMMENT_COUNT, the bound every acceptance check shares (D4).
 *
 * One definition here, used by both chains, so they cannot drift apart again.
 */
export function parseCountChip(chipText: string): CountChip | null {
  const cleaned = normalizeText(chipText);
  if (!cleaned || cleaned.length > MAX_COUNT_CHIP_LENGTH) return null;
  if (!COUNT_CHIP_SHAPE.test(cleaned)) return null;

  const count = extractDigitCount(cleaned);
  if (count === null || count >= PLAUSIBLE_COMMENT_COUNT) return null;

  return { count, text: cleaned };
}
