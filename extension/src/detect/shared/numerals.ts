// filepath: extension/src/detect/shared/numerals.ts
/**
 * ============================================================================
 * NUMERALS — language-free numeric parsing
 * ============================================================================
 *
 * Shared by every detector. Imports nothing: no keyword table, no language
 * signal, no page text conventions. A numeral is a numeral in every script,
 * which is what makes this safe for StructuralDetector to use.
 *
 * NOT the same as `parseUnicodeInteger` in
 * `entrypoints/content/detection-keywords.ts`. That one falls back to parsing
 * WORD-numbers ("واحد" = one, "اثنان" = two), which is language knowledge and
 * therefore belongs to the keyword layer. This module is digits only, on
 * purpose — see the last case in tests/detect/numerals.test.ts.
 */

/** Unicode decimal digit, any script. */
const DIGIT = /\p{Nd}/u;

/** Invisible BiDi controls that Classroom sprinkles around RTL numerals. */
const BIDI_CONTROLS = /[​-‏‪-‮⁦-⁩]/g;

/** Largest count we will believe. Above this it is an id, not a comment count. */
const MAX_PLAUSIBLE_COUNT = 100000;

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
  if (cp === undefined) return -1;

  for (let value = 0; value <= 9; value++) {
    const previous = cp - value - 1;
    if (previous < 0 || !DIGIT.test(String.fromCodePoint(previous))) {
      return value;
    }
  }

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
      if (result >= MAX_PLAUSIBLE_COUNT) return null;
    } else if (started) {
      break; // first run only
    }
  }

  if (!started || result <= 0) return null;

  return result;
}
