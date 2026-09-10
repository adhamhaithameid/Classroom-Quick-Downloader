import { describe, it, expect } from 'vitest';
import {
  isDigit,
  hasDigit,
  digitValue,
  extractDigitCount,
} from '../../../src/core/detect/numerals';
import { PARSER_SANITY_CEILING } from '../../../src/core/detect/ceilings';

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
  });
});
