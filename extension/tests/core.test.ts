/**
 * CORE LOGIC UNIT TESTS
 * 
 * Tests for:
 * - Text normalization (Unicode digits, BiDi, whitespace)
 * - Integer parsing (Arabic numerals, word-numbers)
 * - Date parsing (localized strings)
 * - Time difference calculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeText,
  normalizeForComparison,
  parseUnicodeInteger,
  parseUnicodeDate,
  getCommentKeywords,
  getEditedKeywords,
  isExcludedCommentPattern,
  isExcludedEditedPattern,
} from '../entrypoints/content/detection-keywords';
import { NORMALIZATION_TEST_DATA, DATE_PARSING_TEST_DATA } from './fixtures';

// ============================================================================
// NORMALIZATION TESTS
// ============================================================================

describe('normalizeText()', () => {
  describe('Unicode Digit Normalization', () => {
    NORMALIZATION_TEST_DATA.unicodeDigits.forEach(({ input, expected, description }) => {
      it(`should normalize ${description}: "${input}" → "${expected}"`, () => {
        const result = normalizeText(input);
        // Check that the text is properly normalized
        expect(result.length).toBeGreaterThanOrEqual(1);
        // parseUnicodeInteger should extract the expected value
        const parsed = parseUnicodeInteger(result);
        expect(parsed).toBe(expected);
      });
    });
  });

  describe('BiDi Control Characters Removal', () => {
    NORMALIZATION_TEST_DATA.bidiText.forEach(({ input, expected, description }) => {
      it(`should strip ${description}`, () => {
        const result = normalizeText(input);
        expect(result).toBe(expected);
      });
    });
  });

  it('should handle empty strings', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText('   ')).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    // @ts-expect-error - Testing edge case
    expect(normalizeText(null)).toBe('');
    // @ts-expect-error - Testing edge case
    expect(normalizeText(undefined)).toBe('');
  });

  it('should preserve RTL text content', () => {
    const arabicText = 'تعليقات';
    const result = normalizeText(arabicText);
    expect(result).toContain('تعليقات');
  });
});

describe('normalizeForComparison()', () => {
  it('should lowercase text', () => {
    expect(normalizeForComparison('HELLO')).toBe('hello');
  });

  it('should handle mixed case RTL', () => {
    const result = normalizeForComparison('تعليق صف');
    expect(result).toBe('تعليق صف');
  });

  it('should strip extra whitespace', () => {
    expect(normalizeForComparison('hello   world')).toBe('hello world');
  });
});

// ============================================================================
// INTEGER PARSING TESTS
// ============================================================================

describe('parseUnicodeInteger()', () => {
  describe('Unicode Digit Parsing', () => {
    NORMALIZATION_TEST_DATA.unicodeDigits.forEach(({ input, expected, description }) => {
      it(`should parse ${description}: "${input}" = ${expected}`, () => {
        const result = parseUnicodeInteger(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Word-Number Parsing', () => {
    NORMALIZATION_TEST_DATA.wordNumbers.forEach(({ input, expected, description }) => {
      it(`should parse ${description}: "${input}" = ${expected}`, () => {
        const result = parseUnicodeInteger(input);
        expect(result).toBe(expected);
      });
    });
  });

  it('should return null for non-numeric text', () => {
    expect(parseUnicodeInteger('hello world')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseUnicodeInteger('')).toBeNull();
  });

  it('should handle mixed text with number', () => {
    expect(parseUnicodeInteger('5 comments')).toBe(5);
    expect(parseUnicodeInteger('comments: 10')).toBe(10);
    expect(parseUnicodeInteger('٥ تعليقات')).toBe(5);
  });

  it('should extract from Arabic comment text', () => {
    expect(parseUnicodeInteger('تعليق واحد من الصف')).toBe(1);
  });
});

// ============================================================================
// KEYWORD TESTS
// ============================================================================

describe('getCommentKeywords()', () => {
  it('should return English keywords', () => {
    const keywords = getCommentKeywords('en');
    expect(keywords.singular).toContain('comment');
    expect(keywords.plural).toContain('comments');
  });

  it('should return Arabic keywords', () => {
    const keywords = getCommentKeywords('ar');
    expect(keywords.singular).toContain('تعليق');
    expect(keywords.plural).toContain('تعليقات');
  });

  it('should return Japanese keywords', () => {
    const keywords = getCommentKeywords('ja');
    expect(keywords.singular).toContain('コメント');
  });

  it('should fallback to English for unknown languages', () => {
    const keywords = getCommentKeywords('xx-unknown');
    expect(keywords.singular).toContain('comment');
  });
});

describe('getEditedKeywords()', () => {
  it('should return English edited keywords', () => {
    const keywords = getEditedKeywords('en');
    expect(keywords).toContain('edited');
  });

  it('should return Arabic edited keywords', () => {
    const keywords = getEditedKeywords('ar');
    expect(keywords).toContain('تم تعديله');
  });

  it('should return Japanese edited keywords', () => {
    const keywords = getEditedKeywords('ja');
    expect(keywords).toContain('編集済み');
  });

  it('should return Hacker/1337 keywords', () => {
    const keywords = getEditedKeywords('xx-hacker');
    expect(keywords).toContain('3d1t3d');
  });
});

// ============================================================================
// EXCLUSION PATTERN TESTS
// ============================================================================

describe('isExcludedCommentPattern()', () => {
  describe('English Exclusions', () => {
    it('should exclude "Add class comment"', () => {
      expect(isExcludedCommentPattern('Add class comment')).toBe(true);
    });

    it('should exclude "add comment"', () => {
      expect(isExcludedCommentPattern('add comment')).toBe(true);
    });

    it('should NOT exclude "5 class comments"', () => {
      expect(isExcludedCommentPattern('5 class comments')).toBe(false);
    });
  });

  describe('Arabic Exclusions', () => {
    it('should exclude "إضافة تعليق"', () => {
      expect(isExcludedCommentPattern('إضافة تعليق')).toBe(true);
    });

    it('should exclude "اضافة تعليق صف"', () => {
      expect(isExcludedCommentPattern('اضافة تعليق صف')).toBe(true);
    });

    it('should NOT exclude "٥ تعليقات"', () => {
      expect(isExcludedCommentPattern('٥ تعليقات')).toBe(false);
    });
  });

  describe('French Exclusions', () => {
    it('should exclude "Ajouter un commentaire"', () => {
      expect(isExcludedCommentPattern('Ajouter un commentaire')).toBe(true);
    });
  });
});

describe('isExcludedEditedPattern()', () => {
  it('should exclude "can be edited"', () => {
    expect(isExcludedEditedPattern('can be edited by user')).toBe(true);
  });

  it('should exclude "i edited"', () => {
    expect(isExcludedEditedPattern('i edited the document')).toBe(true);
  });

  it('should NOT exclude standalone "edited"', () => {
    expect(isExcludedEditedPattern('(edited)')).toBe(false);
  });

  it('should NOT exclude "Last edited" (it indicates post was edited)', () => {
    // This is correct - "Last edited" means the post WAS edited
    expect(isExcludedEditedPattern('Last edited')).toBe(false);
  });
});

// ============================================================================
// DATE PARSING TESTS
// ============================================================================

describe('parseUnicodeDate()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  it('should parse ISO format dates', () => {
    const result = parseUnicodeDate('2026-01-20');
    expect(result).not.toBeNull();
    expect(result?.date).toBeInstanceOf(Date);
    expect(result?.date.getUTCFullYear()).toBe(2026);
    expect(result?.date.getUTCMonth()).toBe(0); // January
    expect(result?.date.getUTCDate()).toBe(20);
    expect(result?.confidence).toBe('high');
  });

  it('should parse "Jan 20, 2026" format', () => {
    const result = parseUnicodeDate('Jan 20, 2026');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.date.getUTCFullYear()).toBe(2026);
      expect(result.raw).toBe('Jan 20, 2026');
    }
  });

  it('should return null for invalid dates', () => {
    expect(parseUnicodeDate('not a date')).toBeNull();
    expect(parseUnicodeDate('')).toBeNull();
  });
});

// ============================================================================
// TIME DIFFERENCE CALCULATION TESTS
// ============================================================================

describe('Time Difference Calculations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  /**
   * Helper to calculate diff string from two dates
   */
  function calculateDiffString(editDate: Date, createDate: Date): string {
    const diffMs = editDate.getTime() - createDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    
    if (days > 0 && hours > 0) {
      return `${days}d ${hours}h`;
    } else if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    }
    return '<1h';
  }

  it('should calculate "2d 5h" difference', () => {
    const createDate = new Date('2026-01-20T03:00:00.000Z');
    const editDate = new Date('2026-01-22T08:00:00.000Z');
    const result = calculateDiffString(editDate, createDate);
    expect(result).toBe('2d 5h');
  });

  it('should calculate "0d" as just hours', () => {
    const createDate = new Date('2026-01-24T03:00:00.000Z');
    const editDate = new Date('2026-01-24T08:00:00.000Z');
    const result = calculateDiffString(editDate, createDate);
    expect(result).toBe('5h');
  });

  it('should handle same day edit', () => {
    const createDate = new Date('2026-01-24T07:30:00.000Z');
    const editDate = new Date('2026-01-24T08:00:00.000Z');
    const result = calculateDiffString(editDate, createDate);
    expect(result).toBe('<1h');
  });

  it('should handle multi-day difference', () => {
    const createDate = new Date('2026-01-01T00:00:00.000Z');
    const editDate = new Date('2026-01-10T12:00:00.000Z');
    const result = calculateDiffString(editDate, createDate);
    expect(result).toBe('9d 12h');
  });
});
