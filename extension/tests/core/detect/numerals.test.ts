import { describe, it, expect } from 'vitest';
import {
  isDigit,
  hasDigit,
  digitValue,
  extractDigitCount,
  parseCountChip,
  MAX_COUNT_CHIP_LENGTH,
} from '../../../src/core/detect/numerals';
import { PARSER_SANITY_CEILING, PLAUSIBLE_COMMENT_COUNT } from '../../../src/core/detect/ceilings';

describe('core/detect/numerals', () => {
  it('recognises decimal digits in any script', () => {
    expect(isDigit('5')).toBe(true);
    expect(isDigit('٥')).toBe(true); // Arabic-Indic five
    expect(isDigit('५')).toBe(true); // Devanagari five
    expect(isDigit('x')).toBe(false);
    expect(hasDigit('no digits')).toBe(false);
    expect(hasDigit('٣ comments')).toBe(true);
  });

  it('derives digit values from the Unicode block position', () => {
    expect(digitValue('0')).toBe(0);
    expect(digitValue('٩')).toBe(9);
    expect(digitValue('५')).toBe(5);
    expect(digitValue('x')).toBe(-1);
  });

  it('extracts the first digit run and rejects zero', () => {
    expect(extractDigitCount('5 comments')).toBe(5);
    expect(extractDigitCount('abc 12 def 34')).toBe(12); // first run only
    expect(extractDigitCount('٠ comments')).toBeNull(); // zero means none
    expect(extractDigitCount('no count')).toBeNull();
    expect(extractDigitCount('')).toBeNull();
  });

  it('rejects implausibly large runs as ids, not counts', () => {
    const huge = '9'.repeat(10);
    expect(extractDigitCount(huge)).toBeNull();
    expect(extractDigitCount(String(PARSER_SANITY_CEILING - 1))).toBe(
      PARSER_SANITY_CEILING - 1,
    );
  });

  it('strips BiDi controls around RTL numerals before parsing', () => {
    expect(extractDigitCount('\u200F٥\u200E')).toBe(5);
    // A BiDi control AFTER the run starts must not split the run (S12).
    expect(extractDigitCount('1\u200F2')).toBe(12);
  });

  it('a run that lands exactly on the parser ceiling is still an id (S12)', () => {
    expect(extractDigitCount(String(PARSER_SANITY_CEILING))).toBeNull();
  });
});

describe('parseCountChip (D5 — chip acceptance for the DOM-truth layers)', () => {
  it('accepts a plain numeral chip in any script', () => {
    expect(parseCountChip('5')).toEqual({ count: 5, text: '5' });
    expect(parseCountChip('٨')).toEqual({ count: 8, text: '٨' });
  });

  it('accepts BiDi-wrapped and whitespace-padded numerals', () => {
    expect(parseCountChip('\u200F12\u200E')?.count).toBe(12);
    expect(parseCountChip('  7\u00A0')?.count).toBe(7);
  });

  it('rejects values at or above PLAUSIBLE_COMMENT_COUNT', () => {
    expect(parseCountChip(String(PLAUSIBLE_COMMENT_COUNT))).toBeNull();
    expect(parseCountChip('99999')).toBeNull();
    expect(parseCountChip(String(PARSER_SANITY_CEILING - 1))).toBeNull();
  });

  it('rejects chip text longer than MAX_COUNT_CHIP_LENGTH even with a small numeral', () => {
    const long = 'Reference 4821 was resolved in the helpdesk queue yesterday';
    expect(long.length).toBeGreaterThan(MAX_COUNT_CHIP_LENGTH);
    expect(parseCountChip(long)).toBeNull();
  });

  it('accepts a whitespace-padded numeral chip', () => {
    expect(parseCountChip('  9999 ')).toEqual({ count: 9999, text: '9999' });
  });

  it('rejects a digit run that fits the length limit but blows the value ceiling', () => {
    expect(parseCountChip('1'.repeat(MAX_COUNT_CHIP_LENGTH))).toBeNull();
  });

  it('rejects timestamp-shaped chips — separators are not chip shape', () => {
    expect(parseCountChip('12:34')).toBeNull();
  });

  it('rejects wordy chips — a count badge carries no words', () => {
    expect(parseCountChip('8 class comments')).toBeNull();
    expect(parseCountChip('٣ تعليقات')).toBeNull();
  });

  it('rejects empty and numeral-free chips', () => {
    expect(parseCountChip('')).toBeNull();
    expect(parseCountChip('   ')).toBeNull();
    expect(parseCountChip('No class comments')).toBeNull();
  });

  // ── Mutation hardening (S12) ──────────────────────────────────────────────

  it('a cleaned chip of exactly MAX_COUNT_CHIP_LENGTH chars is accepted when the value is plausible', () => {
    // 2-digit first run + 15 single digits + 15 separating spaces = 32 chars.
    const chip = '11 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6';
    expect(chip.length).toBe(MAX_COUNT_CHIP_LENGTH);
    const parsed = parseCountChip(chip);
    expect(parsed?.count).toBe(11);
  });

  it('a chip one char over the limit is rejected', () => {
    const chip = '111 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6';
    expect(chip.length).toBe(MAX_COUNT_CHIP_LENGTH + 1);
    expect(parseCountChip(chip)).toBeNull();
  });
  it('digitValue at a run start (zero) and run end (nine) in any script', () => {
    expect(digitValue('٠')).toBe(0); // Arabic-Indic zero
    expect(digitValue('۹')).toBe(9); // Extended Arabic-Indic nine
    expect(digitValue('०')).toBe(0); // Devanagari zero
  });
});
