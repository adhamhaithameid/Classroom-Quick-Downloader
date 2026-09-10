import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  normalizeForComparison,
} from '../../../src/core/detect/normalize';

describe('core/detect/normalize', () => {
  it('strips invisible BiDi control characters', () => {
    const dirty = '\u200E5\u200F comments\u202A\u202C';
    expect(normalizeText(dirty)).toBe('5 comments');
  });

  it('collapses exotic whitespace variants to plain spaces', () => {
    expect(normalizeText('a\u00A0b\u2003c\u3000d')).toBe('a b c d');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(normalizeText('  5   comments  ')).toBe('5 comments');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('lowercases and strips punctuation for comparison', () => {
    expect(normalizeForComparison('Hello, World!')).toBe('hello world');
    expect(normalizeForComparison('(5) comments:')).toBe('5 comments');
    // Arabic comma is punctuation too.
    expect(normalizeForComparison('تعليق، واحد')).toBe('تعليق واحد');
  });
});
