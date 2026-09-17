// filepath: extension/tests/core/detect/numerals-property.test.ts
/**
 * ============================================================================
 * NUMERALS PROPERTY TESTS — fast-check invariants over the pure numeral
 * parser (ADR-0008 / S12 T4)
 * ============================================================================
 *
 * The core numerals module is digits-only on purpose (word-number parsing is
 * language knowledge and lives in the keyword layer) — `extractDigitCount` is
 * the real name of the count parser. Machine-checked invariants:
 *
 *   N1 digitValue is the block-position derivation: for any digit in an
 *      isolated \p{Nd} run of ten codepoints, digitValue(char) === the
 *      char's value; non-digits are -1.
 *   N2 isDigit/hasDigit agree per character.
 *   N3 extractDigitCount returns the EXACT value of the first digit run
 *      (any script), whatever junk surrounds it — for every value under the
 *      parser ceiling; BiDi controls and unicode spaces around the run
 *      change nothing.
 *   N4 zero is "no count" (null); a run at or above PARSER_SANITY_CEILING is
 *      an id (null); digit-free text is null.
 *   N5 parseCountChip accepts exactly the whitespace/BiDi-padded numeral
 *      chips whose value is plausible ({count, text} with the cleaned text)
 *      and rejects wordy chips, implausible values and overlong chips.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  isDigit,
  hasDigit,
  digitValue,
  extractDigitCount,
  parseCountChip,
} from '../../../src/core/detect/numerals';
import { PARSER_SANITY_CEILING, PLAUSIBLE_COMMENT_COUNT } from '../../../src/core/detect/ceilings';

// ── Digit scripts ───────────────────────────────────────────────────────────

/** Contiguous ten-codepoint decimal-digit blocks (classic, well-known \p{Nd} runs). */
const DIGIT_BLOCKS = [
  { name: 'ASCII', base: 0x0030 },
  { name: 'Arabic-Indic', base: 0x0660 },
  { name: 'Devanagari', base: 0x0966 },
  { name: 'Bengali', base: 0x09e6 },
  { name: 'Thai', base: 0x0e50 },
] as const;

/**
 * The module derives digit values from block position, which is only sound
 * for an ISOLATED run of ten Nd codepoints. Filter with the module's own
 * isDigit so the properties below assert exactly what the derivation
 * guarantees; every classic block here must pass the guard.
 */
const SAFE_BLOCKS = DIGIT_BLOCKS.filter(
  ({ base }) =>
    !isDigit(String.fromCodePoint(base - 1)) && !isDigit(String.fromCodePoint(base + 10)),
);

const arbBlock = fc.constantFrom(...SAFE_BLOCKS);

/** Render n (a non-negative integer) in the given block's digits. */
function digitsIn(n: number, block: { base: number }): string {
  return String(n)
    .split('')
    .map((c) => String.fromCodePoint(block.base + (c.charCodeAt(0) - 0x30)))
    .join('');
}

interface Run {
  n: number;
  digits: string;
}

const arbRun = (min: number, max: number): fc.Arbitrary<Run> =>
  fc.record({ block: arbBlock, n: fc.integer({ min, max }) }).map(({ block, n }) => ({
    n,
    digits: digitsIn(n, block),
  }));

// ── Alphabets ───────────────────────────────────────────────────────────────

/** Build a string arbitrary over a fixed BMP alphabet. */
function chars(alphabet: string, minLen = 0, maxLen = 12): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...alphabet.split('')), { minLength: minLen, maxLength: maxLen })
    .map((parts) => parts.join(''));
}

/** Letters, punctuation, spaces and BiDi controls — no \p{Nd} anywhere. */
const NON_DIGIT_CHARS =
  'xXyZ .,!?:;-\t\n\u00a0\u2000\u200b\u200c\u200d\u200e\u200f\u202a\u202e\u2066\u2069\u061c\ufeff\u00ad\u0640\u064b\u05d0\u05d1\u0623\u062d\u0430\u0431\u65e5\u672c';

/**
 * Non-digit characters the numeral parser does NOT strip: a run genuinely
 * ends at the first one. (Stripped BiDi controls \u200C-\u200F, \u202A-\u202E
 * and \u2066-\u2069 do not end a run — '1\u200F2' parses as 12 — so they
 * cannot head the trailing-junk generator without the run merging into it.)
 */
const RUN_BREAKERS = 'xXyZ .,!?:;-\t\n\u00a0\u2000\u0640\u064b\u05d0\u05d1\u0623\u062d\u0430\u0431\u65e5\u672c';

/** Exactly the characters normalizeText strips or collapses to plain spaces. */
const PAD_CHARS = ' \t\n\u00a0\u2000\u2005\u202f\u205f\u3000\u200b\u200c\u200d\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\u061c\ufeff\u00ad';

// ── digitValue / isDigit / hasDigit ─────────────────────────────────────────

describe('core/detect numerals — digit classification properties', () => {
  it('N1: digitValue(char) === value for every digit of every isolated Nd block', () => {
    expect(SAFE_BLOCKS).toHaveLength(DIGIT_BLOCKS.length);
    fc.assert(
      fc.property(
        arbBlock,
        fc.integer({ min: 0, max: 9 }),
        (block, value) => {
          expect(digitValue(String.fromCodePoint(block.base + value))).toBe(value);
          expect(isDigit(String.fromCodePoint(block.base + value))).toBe(true);
          expect(hasDigit(String.fromCodePoint(block.base + value))).toBe(true);
        },
      ),
    );
  });

  it('N1: digitValue is -1 for every non-digit character', () => {
    fc.assert(
      fc.property(chars(NON_DIGIT_CHARS, 1, 1), (char) => {
        expect(digitValue(char)).toBe(-1);
        expect(isDigit(char)).toBe(false);
        expect(hasDigit(char)).toBe(false);
      }),
    );
  });

  it('N2: isDigit and hasDigit agree on every single character', () => {
    const mixed = NON_DIGIT_CHARS + SAFE_BLOCKS.map((b) => String.fromCodePoint(b.base)).join('');
    fc.assert(
      fc.property(chars(mixed, 1, 1), (char) => {
        expect(hasDigit(char)).toBe(isDigit(char));
      }),
    );
  });
});

// ── extractDigitCount ───────────────────────────────────────────────────────

describe('core/detect numerals — extractDigitCount properties', () => {
  it('N3: returns the exact first-run value under the ceiling, whatever digit-free junk precedes it and whatever follows', () => {
    fc.assert(
      fc.property(
        chars(NON_DIGIT_CHARS, 0, 8),
        arbRun(1, PARSER_SANITY_CEILING - 1),
        fc
          .tuple(fc.constantFrom(...RUN_BREAKERS.split('')), chars(NON_DIGIT_CHARS + '09', 0, 8))
          .map(([head, tail]) => head + tail),
        (prefix, { n, digits }, suffix) => {
          expect(extractDigitCount(prefix + digits + suffix)).toBe(n);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('N4: a zero run is "no count" in every script', () => {
    fc.assert(
      fc.property(arbBlock, (block) => {
        expect(extractDigitCount(digitsIn(0, block))).toBeNull();
      }),
    );
  });

  it('N4: any run at or above PARSER_SANITY_CEILING is rejected as an id', () => {
    fc.assert(
      fc.property(arbRun(PARSER_SANITY_CEILING, 9_999_999), ({ digits }) => {
        expect(extractDigitCount(digits)).toBeNull();
      }),
    );
  });

  it('N4: digit-free text (BiDi noise included) and the empty string are null', () => {
    fc.assert(
      fc.property(chars(NON_DIGIT_CHARS, 0, 24), (noise) => {
        expect(extractDigitCount(noise)).toBeNull();
      }),
    );
  });
});

// ── parseCountChip ──────────────────────────────────────────────────────────

describe('core/detect numerals — parseCountChip properties', () => {
  it('N5: accepts exactly the padded numeral chip: {count, text} with the cleaned text', () => {
    fc.assert(
      fc.property(
        chars(PAD_CHARS, 0, 4),
        arbRun(1, PLAUSIBLE_COMMENT_COUNT - 1),
        chars(PAD_CHARS, 0, 4),
        (padL, { n, digits }, padR) => {
          expect(parseCountChip(padL + digits + padR)).toEqual({ count: n, text: digits });
        },
      ),
      { numRuns: 300 },
    );
  });

  it('N5: rejects a well-shaped chip whose value reaches PLAUSIBLE_COMMENT_COUNT', () => {
    fc.assert(
      fc.property(arbRun(PLAUSIBLE_COMMENT_COUNT, PARSER_SANITY_CEILING - 1), ({ digits }) => {
        expect(parseCountChip(digits)).toBeNull();
      }),
    );
  });

  it('N5: rejects any chip carrying a word (shape is numerals and whitespace only)', () => {
    fc.assert(
      fc.property(
        arbRun(1, 999),
        chars('xyzABC\u0623\u062d', 1, 6),
        ({ digits }, word) => {
          expect(parseCountChip(digits + word)).toBeNull();
          expect(parseCountChip(word + digits)).toBeNull();
        },
      ),
    );
  });

  it('N5: rejects a chip longer than the count-chip ceiling even when the value is small', () => {
    fc.assert(
      fc.property(fc.integer({ min: 33, max: 48 }), (len) => {
        expect(parseCountChip('1'.repeat(len))).toBeNull();
      }),
    );
  });
});
