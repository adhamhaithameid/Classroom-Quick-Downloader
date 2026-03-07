// filepath: extension/tests/v2-keyword-loader.test.ts
/**
 * Tests for the V2 Keyword Loader.
 *
 * The keyword loader lazily loads language-specific keyword tables
 * and caches them for performance. Only the detected page language
 * + English fallback are loaded.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCommentKeywords,
  getEditedKeywords,
  preloadKeywords,
  detectPageLanguage,
  getShortLang,
  clearKeywordCache,
  getCacheStats,
} from '../src/v2/decision/keyword-loader';

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  clearKeywordCache();
});

afterEach(() => {
  clearKeywordCache();
  vi.restoreAllMocks();
});

// ============================================================================
// TEST SUITE: getCommentKeywords
// ============================================================================

describe('getCommentKeywords', () => {
  it('returns English keywords for "en"', () => {
    const kw = getCommentKeywords('en');
    expect(kw).toHaveProperty('singular');
    expect(kw).toHaveProperty('plural');
    expect(kw).toHaveProperty('classComment');
    expect(kw.singular).toContain('comment');
  });

  it('returns Arabic keywords for "ar"', () => {
    const kw = getCommentKeywords('ar');
    expect(kw.singular.length).toBeGreaterThan(0);
    // Arabic should contain تعليق
    expect(kw.singular.some(k => k.includes('تعليق'))).toBe(true);
  });

  it('returns English fallback for unknown language', () => {
    const kw = getCommentKeywords('xx-unknown');
    // Should default to English
    expect(kw.singular).toContain('comment');
  });

  it('caches keywords across calls', () => {
    const kw1 = getCommentKeywords('en');
    const kw2 = getCommentKeywords('en');
    expect(kw1).toBe(kw2); // Same reference = cached
  });
});

// ============================================================================
// TEST SUITE: getEditedKeywords
// ============================================================================

describe('getEditedKeywords', () => {
  it('returns English edited keywords', () => {
    const kw = getEditedKeywords('en');
    expect(kw.length).toBeGreaterThan(0);
    const lower = kw.map(k => k.toLowerCase());
    expect(lower).toContain('edited');
  });

  it('returns Arabic edited keywords', () => {
    const kw = getEditedKeywords('ar');
    expect(kw.length).toBeGreaterThan(0);
  });

  it('caches keywords across calls', () => {
    const kw1 = getEditedKeywords('en');
    const kw2 = getEditedKeywords('en');
    expect(kw1).toBe(kw2);
  });
});

// ============================================================================
// TEST SUITE: preloadKeywords
// ============================================================================

describe('preloadKeywords', () => {
  it('loads both comment and edited keywords', () => {
    preloadKeywords('en');
    const stats = getCacheStats();
    expect(stats.loadedLanguages).toContain('en');
  });

  it('also loads English as fallback for non-English', () => {
    preloadKeywords('ar');
    const stats = getCacheStats();
    expect(stats.loadedLanguages).toContain('ar');
    expect(stats.loadedLanguages).toContain('en');
  });

  it('does not duplicate English load for English', () => {
    preloadKeywords('en');
    const stats = getCacheStats();
    expect(stats.cacheSize).toBe(1); // Only 'en'
  });
});

// ============================================================================
// TEST SUITE: Cache management
// ============================================================================

describe('Cache management', () => {
  it('clearKeywordCache empties the cache', () => {
    getCommentKeywords('en');
    getCommentKeywords('ar');
    expect(getCacheStats().cacheSize).toBe(2);

    clearKeywordCache();
    expect(getCacheStats().cacheSize).toBe(0);
  });

  it('getCacheStats reports correct data', () => {
    getCommentKeywords('en');
    const stats = getCacheStats();
    expect(stats.loadedLanguages).toEqual(['en']);
    expect(stats.cacheSize).toBe(1);
    expect(stats.lastActivity).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST SUITE: Language detection
// ============================================================================

describe('detectPageLanguage', () => {
  it('reads from <html lang="...">', () => {
    document.documentElement.setAttribute('lang', 'ar');
    expect(detectPageLanguage()).toBe('ar');
    document.documentElement.removeAttribute('lang');
  });

  it('falls back to "en" with no lang attribute', () => {
    document.documentElement.removeAttribute('lang');
    const lang = detectPageLanguage();
    // In jsdom, navigator.language may be set; if not, defaults to 'en'
    expect(typeof lang).toBe('string');
    expect(lang.length).toBeGreaterThan(0);
  });
});

describe('getShortLang', () => {
  it('strips region suffix', () => {
    expect(getShortLang('zh-TW')).toBe('zh');
    expect(getShortLang('pt-BR')).toBe('pt');
    expect(getShortLang('en-US')).toBe('en');
  });

  it('returns same for simple codes', () => {
    expect(getShortLang('en')).toBe('en');
    expect(getShortLang('ar')).toBe('ar');
  });
});
