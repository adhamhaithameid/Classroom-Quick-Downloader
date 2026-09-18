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

  it('strips every BiDi class individually (S12)', () => {
    // Isolates U+2066-U+2069
    expect(normalizeText('\u2066a\u2067b\u2068c\u2069')).toBe('abc');
    // Arabic letter mark U+061C
    expect(normalizeText('\u061Cx')).toBe('x');
    // BOM U+FEFF
    expect(normalizeText('a\uFEFFb')).toBe('ab');
    // Soft hyphen U+00AD
    expect(normalizeText('x\u00ADy')).toBe('xy');
    // Zero-width joiners U+200B-U+200D
    expect(normalizeText('a\u200Bb\u200Cc\u200Dd')).toBe('abcd');
    // Directional embeddings/overrides U+202A-U+202E
    expect(normalizeText('\u202Ba\u202Eb')).toBe('ab');
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

  it('folds Arabic tashkeel vowel signs (D7)', () => {
    // fatha U+064E, sukun U+0652, kasra U+0650 inside تعليق
    expect(normalizeForComparison('تَعْلِيق')).toBe('تعليق');
    expect(normalizeForComparison('تَعْلِيقات')).toBe('تعليقات');
  });

  it('folds Arabic shadda and sukun (D7)', () => {
    // shadda U+0651 + kasra U+0650
    expect(normalizeForComparison('مُعَلِّم')).toBe('معلم');
  });

  it('folds the Arabic dagger alif (D7)', () => {
    // dagger alif U+0670
    expect(normalizeForComparison('رَحْمَٰن')).toBe('رحمن');
  });

  it('matches a tashkeel-spelled keyword against its bare table entry (D7)', () => {
    const tableEntry = normalizeForComparison('تعليق');
    const pageText = normalizeForComparison('تَعْلِيق الصف: ٣');
    expect(pageText.includes(tableEntry)).toBe(true);
  });
});
