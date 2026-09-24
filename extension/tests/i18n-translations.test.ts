import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRANSLATIONS } from '../entrypoints/content/i18n';
import {
  COMPLETENESS_PATCH,
  DECLARED_EN_FALLBACKS,
  EN_CLONE_LOCALES,
  SHARED_VOCAB_ALLOWLIST,
} from '../entrypoints/content/translations/completeness';

/**
 * Per-language gates for the TRANSLATIONS table (147 locales). These tests
 * are the contract behind src/core/i18n/completeness.ts: every string a user
 * can see must be either a reviewed translation for its locale, an explicitly
 * declared English fallback, or an allowlisted word that is genuinely the
 * same word in that language. Silent English leakage and wrong-language
 * values fail here.
 */
const T = TRANSLATIONS;
const en = T.en;
const LOCALES = Object.keys(T);
const CONTENT_KEYS = Object.keys(en).filter((k) => !k.startsWith('popup'));

const ALLOWLIST = new Set(SHARED_VOCAB_ALLOWLIST.map(([l, k]) => `${l}:${k}`));
const DECLARED = new Set(
  Object.entries(DECLARED_EN_FALLBACKS).flatMap(([l, keys]) =>
    keys.map((k) => `${l}:${k}`),
  ),
);
const CLONES = new Set(EN_CLONE_LOCALES);

describe('TRANSLATIONS table shape', () => {
  it('en stays the reference: every content key present', () => {
    expect(CONTENT_KEYS).toContain('download');
    expect(CONTENT_KEYS).toContain('cancelAll');
    expect(CONTENT_KEYS).toContain('after_posting');
  });

  it('every locale has every content key (completeness)', () => {
    const incomplete = LOCALES.filter((l) =>
      CONTENT_KEYS.some((k) => typeof T[l][k] !== 'string' || T[l][k].length === 0),
    );
    expect(incomplete).toEqual([]);
  });

  it('patch only targets locales that exist in the base table', () => {
    const unknown = Object.keys(COMPLETENESS_PATCH).filter((l) => !(l in T));
    expect(unknown).toEqual([]);
  });
});

describe('no silent English leakage', () => {
  const leaks: string[] = [];
  for (const l of LOCALES) {
    if (l === 'en' || CLONES.has(l)) continue;
    for (const k of CONTENT_KEYS) {
      const v = T[l][k];
      if (v === en[k] && !ALLOWLIST.has(`${l}:${k}`) && !DECLARED.has(`${l}:${k}`)) {
        leaks.push(`${l}.${k} = "${v}"`);
      }
    }
  }

  it('every en-identical value outside the clone locales is declared or allowlisted', () => {
    expect(leaks).toEqual([]);
  });

  it('declared fallbacks point at real leaked keys, not reviewed translations', () => {
    // A declaration that no longer matches a leak is stale bookkeeping.
    const stale: string[] = [];
    for (const key of DECLARED) {
      const [l, k] = key.split(':');
      if (T[l]?.[k] !== en[k]) stale.push(key);
    }
    expect(stale).toEqual([]);
  });
});

describe('wrong-language regressions (verified defects)', () => {
  it('ukrainian cancel family is Ukrainian, not Russian', () => {
    expect(T.uk.cancel).toBe('Скасувати');
    expect(T.uk.cancelled).toBe('Скасовано');
    expect(T.uk.cancelAll).toBe('Скасувати всі');
  });

  it('portuguese uses "tudo", never the Spanish "todo"', () => {
    expect(T.pt.cancelAll).toBe('Cancelar tudo');
    expect(T['pt-pt'].cancelAll).toBe('Cancelar tudo');
    expect(T.pt.cancelAll).not.toContain('todo');
    expect(T['pt-pt'].cancelAll).not.toContain('todo');
  });

  it('bulgarian cancelAll does not borrow the Serbian "све"', () => {
    expect(T.bg.cancelAll).toBe('Откажи всички');
  });

  it('japanese follows Google wording, not "DL" abbreviations', () => {
    expect(T.ja.downloading).toBe('ダウンロード中…');
    expect(T.ja.downloadAll).toBe('すべてダウンロード');
  });

  it('korean failure message matches polite Google register', () => {
    expect(T.ko.failed).toBe('다운로드에 실패했습니다.');
  });

  it('mongolian trying has no typo', () => {
    expect(T.mn.trying).toBe('Оролдож байна…');
  });

  it('zulu downloaded has no stray diacritic', () => {
    expect(T.zu.downloaded).toBe('Ilandiwe');
  });

  it('latin-american style spanish "todo" stays in spanish/galician only', () => {
    expect(T.es.cancelAll).toBe('Cancelar todo');
    expect(T.gl.cancelAll).toBe('Cancelar todo');
  });
});

describe('script sanity for major locales', () => {
  const SCRIPT_BY_CODEPOINT = (s: string): Set<string> => {
    const scripts = new Set<string>();
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if (c >= 0x0400 && c <= 0x04ff) scripts.add('cyrillic');
      else if (c >= 0xac00 && c <= 0xd7af) scripts.add('hangul');
      else if (c >= 0x0600 && c <= 0x06ff) scripts.add('arabic');
      else if (c >= 0x0900 && c <= 0x097f) scripts.add('devanagari');
      else if (c >= 0x4e00 && c <= 0x9fff) scripts.add('han');
      else if (c >= 0x3040 && c <= 0x30ff) scripts.add('kana');
      else if (c >= 0x0e00 && c <= 0x0e7f) scripts.add('thai');
      else if (c >= 0x0590 && c <= 0x05ff) scripts.add('hebrew');
      else if (c >= 0x0370 && c <= 0x03ff) scripts.add('greek');
      else if (/[a-z]/i.test(ch)) scripts.add('latin');
    }
    return scripts;
  };

  const REQUIRED_SCRIPT: Record<string, string> = {
    uk: 'cyrillic', ru: 'cyrillic', sr: 'cyrillic', bg: 'cyrillic',
    ar: 'arabic', fa: 'arabic', ur: 'arabic',
    he: 'hebrew', el: 'greek', th: 'thai',
    ko: 'hangul',
    hi: 'devanagari', mr: 'devanagari', ne: 'devanagari',
  };

  it('button strings use the locale\u2019s own script', () => {
    const violations: string[] = [];
    for (const [locale, script] of Object.entries(REQUIRED_SCRIPT)) {
      for (const k of ['download', 'downloadAll', 'cancel', 'cancelAll', 'downloaded']) {
        const scripts = SCRIPT_BY_CODEPOINT(T[locale][k]);
        if (!scripts.has(script)) {
          violations.push(`${locale}.${k} = "${T[locale][k]}" (${[...scripts].join('+') || 'none'})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('japanese strings contain kana or kanji, never bare latin sentences', () => {
    for (const k of CONTENT_KEYS) {
      const scripts = SCRIPT_BY_CODEPOINT(T.ja[k]);
      expect(scripts.has('kana') || scripts.has('han') || ALLOWLIST.has(`ja:${k}`)).toBe(true);
    }
  });
});

describe('string hygiene across every locale', () => {
  it('no leading/trailing whitespace or double spaces', () => {
    const bad: string[] = [];
    for (const l of LOCALES) {
      for (const k of CONTENT_KEYS) {
        const v = T[l][k];
        if (v !== v.trim() || / {2,}/.test(v)) bad.push(`${l}.${k} = "${v}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ellipsis-bearing keys keep the ellipsis character', () => {
    const bad: string[] = [];
    for (const l of LOCALES) {
      for (const k of ['downloading', 'trying']) {
        if (en[k].endsWith('…') && !T[l][k].endsWith('…')) bad.push(`${l}.${k} = "${T[l][k]}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('chrome.i18n generation stays in sync', () => {
  it('the generated _locales tree exists', () => {
    expect(existsSync(resolve(process.cwd(), '_locales/en/messages.json'))).toBe(true);
  });
});
