import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expandLanguageCandidates,
  resolveLanguage,
} from '../src/core/i18n/resolve';
import { TRANSLATIONS } from '../entrypoints/content/i18n';

const TABLE_KEYS = Object.keys(TRANSLATIONS);

describe('expandLanguageCandidates', () => {
  it('emits full tag before base tag', () => {
    expect(expandLanguageCandidates('en-US')).toEqual(['en-us', 'en']);
  });

  it('normalizes underscores and q-values', () => {
    expect(expandLanguageCandidates('pt_PT')).toEqual(['pt-pt', 'pt']);
  });

  it('maps legacy Chrome tags to their canonical table keys', () => {
    expect(expandLanguageCandidates('iw')[0]).toBe('he');
    expect(expandLanguageCandidates('in')[0]).toBe('id');
    expect(expandLanguageCandidates('jv-ID')[0]).toBe('jw-id');
    expect(expandLanguageCandidates('ji')[0]).toBe('yi');
    expect(expandLanguageCandidates('tl')[0]).toBe('fil');
  });

  it('maps macOS Bokmål and Chinese region variants onto table keys', () => {
    expect(expandLanguageCandidates('nb')[0]).toBe('no');
    expect(expandLanguageCandidates('zh-HK')[0]).toBe('zh-tw');
    expect(expandLanguageCandidates('zh-Hant-TW')[0]).toBe('zh-tw');
    expect(expandLanguageCandidates('zh-Hans')[0]).toBe('zh-cn');
    expect(expandLanguageCandidates('zh-SG')[0]).toBe('zh-cn');
  });

  it('keeps bare region-less tags intact', () => {
    expect(expandLanguageCandidates('fr')).toEqual(['fr']);
  });
});

describe('resolveLanguage', () => {
  it('prefers the page language over the browser language', () => {
    const resolved = resolveLanguage(TABLE_KEYS, {
      pageLang: 'de-DE',
      browserLanguages: ['es-ES', 'es'],
    });
    expect(resolved).toBe('de');
  });

  it('resolves a region page tag onto the exact regional table key', () => {
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'zh-CN', browserLanguages: [] })).toBe('zh-cn');
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'zh-TW', browserLanguages: [] })).toBe('zh-tw');
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'pt-PT', browserLanguages: [] })).toBe('pt-pt');
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'sr-Latn', browserLanguages: [] })).toBe('sr-latn');
  });

  it('falls through an unknown page language to the browser language', () => {
    const resolved = resolveLanguage(TABLE_KEYS, {
      pageLang: 'xx-Unknown',
      browserLanguages: ['ja-JP', 'ja'],
    });
    expect(resolved).toBe('ja');
  });

  it('applies aliases at every candidate step, not just the first', () => {
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'iw-IL', browserLanguages: [] })).toBe('he');
    expect(resolveLanguage(TABLE_KEYS, { pageLang: 'nb-NO', browserLanguages: [] })).toBe('no');
  });

  it('resolves to en when nothing matches', () => {
    expect(
      resolveLanguage(TABLE_KEYS, { pageLang: 'xx', browserLanguages: ['yy-ZZ'] })
    ).toBe('en');
  });

  it('handles missing page language and empty browser lists', () => {
    expect(resolveLanguage(TABLE_KEYS, { pageLang: '', browserLanguages: [] })).toBe('en');
  });
});

describe('content/i18n uses the shared resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = '';
  });

  async function loadI18nModule() {
    vi.resetModules();
    return import('../entrypoints/content/i18n');
  }

  it('resolves a legacy Hebrew tag onto the he table', async () => {
    document.documentElement.lang = 'iw';
    const mod = await loadI18nModule();
    expect(mod.getCurrentCachedLanguage()).toBe('he');
  });

  it('never caches an unresolvable controller language over a good sync detection', async () => {
    // Simulates the controller handing back a truncated base code like 'zh'
    // (the historical bug: TRANSLATIONS has no 'zh', so t() fell back to en).
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = {
      ...(originalChrome ?? {}),
      storage: {
        local: {
          get: async () => ({
            cqd_language_state: {
              mode: 'auto',
              detectedLang: 'zh',
              cachedPageLang: 'zh-CN',
              timestamp: Date.now(),
            },
          }),
          set: async () => {},
        },
      },
    };
    document.documentElement.lang = 'zh-CN';
    try {
      const mod = await loadI18nModule();
      // Global fake timers (tests/setup.ts): advance them so the module's
      // async controller adoption actually runs.
      await vi.advanceTimersByTimeAsync(50);
      expect(mod.getCurrentCachedLanguage()).toBe('zh-cn');
      expect(mod.t('download')).toBe(TRANSLATIONS['zh-cn'].download);
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('honors the english-only mode once the controller resolves', async () => {
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = {
      ...(originalChrome ?? {}),
      storage: {
        local: {
          get: async () => ({
            cqd_language_state: {
              mode: 'english',
              detectedLang: 'en',
              cachedPageLang: '',
              timestamp: Date.now(),
            },
          }),
          set: async () => {},
        },
      },
    };
    document.documentElement.lang = 'de';
    try {
      const mod = await loadI18nModule();
      await vi.advanceTimersByTimeAsync(50);
      expect(mod.getCurrentCachedLanguage()).toBe('en');
      expect(mod.t('download')).toBe('Download');
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });
});
