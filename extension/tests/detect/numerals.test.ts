// filepath: extension/tests/detect/numerals.test.ts
/**
 * Language-free numeral parsing.
 *
 * Every case here must hold WITHOUT any language hint. If a test in this file
 * ever needs to know what language the page is in, the primitive is not
 * language-free and does not belong in src/detect/shared/.
 */
import { describe, it, expect } from 'vitest';
import { hasDigit, digitValue, extractDigitCount } from '../../src/detect/shared/numerals';

describe('digitValue', () => {
  it('reads ASCII digits', () => {
    expect(digitValue('0')).toBe(0);
    expect(digitValue('5')).toBe(5);
    expect(digitValue('9')).toBe(9);
  });

  it('reads Arabic-Indic digits', () => {
    expect(digitValue('٠')).toBe(0);
    expect(digitValue('٥')).toBe(5);
    expect(digitValue('٩')).toBe(9);
  });

  it('reads Extended Arabic-Indic (Persian) digits', () => {
    expect(digitValue('۵')).toBe(5);
  });

  it('reads Devanagari digits', () => {
    expect(digitValue('५')).toBe(5);
  });

  it('reads Bengali digits', () => {
    expect(digitValue('৫')).toBe(5);
  });

  it('reads Thai digits', () => {
    expect(digitValue('๕')).toBe(5);
  });

  it('rejects non-digits', () => {
    expect(digitValue('a')).toBe(-1);
    expect(digitValue('٫')).toBe(-1);
    expect(digitValue('')).toBe(-1);
  });

  it('derives every value in a block without a hardcoded table', () => {
    // Arabic-Indic zero is U+0660. Walk the whole block.
    for (let i = 0; i <= 9; i++) {
      expect(digitValue(String.fromCodePoint(0x0660 + i))).toBe(i);
    }
  });
});

describe('hasDigit', () => {
  it('is true for any script', () => {
    expect(hasDigit('5 comments')).toBe(true);
    expect(hasDigit('٥ تعليقات')).toBe(true);
    expect(hasDigit('५ टिप्पणियाँ')).toBe(true);
  });

  it('is false when there is no numeral', () => {
    expect(hasDigit('No class comments')).toBe(false);
    expect(hasDigit('لا توجد تعليقات')).toBe(false);
    expect(hasDigit('')).toBe(false);
  });
});

describe('extractDigitCount', () => {
  it('pulls the count out of an English phrase', () => {
    expect(extractDigitCount('5 class comments')).toBe(5);
  });

  it('pulls the count out of an Arabic phrase', () => {
    expect(extractDigitCount('٥ تعليقات صفية')).toBe(5);
  });

  it('handles multi-digit counts', () => {
    expect(extractDigitCount('42 comments')).toBe(42);
    expect(extractDigitCount('١٢ تعليقا')).toBe(12);
  });

  it('returns null when the phrase has no numeral', () => {
    expect(extractDigitCount('No class comments')).toBeNull();
  });

  it('gives the same answer for the same number in different scripts', () => {
    expect(extractDigitCount('٣ تعليقات')).toBe(extractDigitCount('3 comments'));
    expect(extractDigitCount('७ comments')).toBe(extractDigitCount('7 comments'));
  });

  it('takes the first numeral run when several are present', () => {
    expect(extractDigitCount('3 of 10 comments')).toBe(3);
  });

  it('rejects zero and implausibly large counts', () => {
    expect(extractDigitCount('0 comments')).toBeNull();
    expect(extractDigitCount('999999 comments')).toBeNull();
  });

  it('ignores BiDi control characters around the numeral', () => {
    expect(extractDigitCount('‏٥‎ تعليقات')).toBe(5);
  });

  it('does not parse word-numbers — that is the keyword layer’s job', () => {
    // "واحد" is Arabic for "one". A language-free primitive must not know that.
    expect(extractDigitCount('واحد تعليق')).toBeNull();
    expect(extractDigitCount('one comment')).toBeNull();
  });
});
