import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveLanguage } from '../src/core/i18n/resolve';
import { TRANSLATIONS } from '../entrypoints/content/i18n';
import { EN_CLONE_LOCALES } from '../entrypoints/content/translations/completeness';

/**
 * Real-Google locale survey vs the extension's language resolver.
 *
 * tests/classroom-locale-survey.json was captured live from
 * classroom.google.com/?hl=<tag> (logged-in desktop session, 2026-09-19):
 * for every requested tag it records the document.documentElement.lang the
 * real page served — the exact value the extension's resolver must handle.
 * These tests pin the resolver and the TRANSLATIONS table to that reality.
 */
const survey = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/classroom-locale-survey.json'), 'utf8'),
) as {
  requestedToServed: Record<string, string>;
  keyFindings: string[];
};

const TABLE_KEYS = Object.keys(TRANSLATIONS);

describe('real Classroom locale survey vs resolver', () => {
  it('every docLang Google actually serves resolves to an existing table key', () => {
    const unresolved: string[] = [];
    for (const served of Object.values(survey.requestedToServed)) {
      const resolved = resolveLanguage(TABLE_KEYS, {
        pageLang: served,
        browserLanguages: [],
      });
      // The only acceptable terminal fallback is en, and only for the
      // en-US/en-GB-shaped tags; anything else must hit a real key.
      if (resolved === 'en' && !/^(en(-US|-GB)?)$/i.test(served)) {
        unresolved.push(served);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('Google serves legacy iw for Hebrew and the resolver maps it back to he', () => {
    expect(survey.requestedToServed['he']).toBe('iw');
    expect(
      resolveLanguage(TABLE_KEYS, { pageLang: 'iw', browserLanguages: [] })
    ).toBe('he');
  });

  it('region and regional tags Google serves all land on the right table keys', () => {
    const cases: Array<[string, string, string]> = [
      // [requested hl, docLang Google served, table key the resolver must pick]
      ['pt', 'pt-BR', 'pt'],
      ['pt-PT', 'pt-PT', 'pt-pt'],
      ['zh-CN', 'zh-CN', 'zh-cn'],
      ['zh-TW', 'zh-TW', 'zh-tw'],
      ['es-419', 'es-419', 'es'],
      ['gd', 'en-GB', 'en'],
    ];
    for (const [requested, served, expected] of cases) {
      expect(survey.requestedToServed[requested], requested).toBe(served);
      const resolved = resolveLanguage(TABLE_KEYS, {
        pageLang: served,
        browserLanguages: [],
      });
      expect(resolved, `served docLang ${served}`).toBe(expected);
    }
  });

  it('Google\u2019s regional fallbacks for unserved locales are pinned (spot checks)', () => {
    const expectedFallbacks: Record<string, string> = {
      // Francophone Africa falls back to French
      mg: 'fr', kg: 'fr', ln: 'fr', lua: 'fr', rw: 'fr', wo: 'fr',
      // Others
      su: 'id', jw: 'id', tg: 'ru', la: 'it', rm: 'de', fo: 'da', fy: 'nl',
      ay: 'es', gn: 'es', qu: 'es', gl: 'es', sa: 'hi', bho: 'hi', ku: 'tr',
      ckb: 'ar', nn: 'no', nb: 'no', bs: 'hr', ceb: 'fil', 'sr-Latn': 'sr',
      'zh-HK': 'zh-TW', 'zh-Hant': 'zh-TW', 'zh-Hans': 'zh-CN', 'zh-SG': 'zh-CN',
    };
    for (const [requested, served] of Object.entries(expectedFallbacks)) {
      expect(survey.requestedToServed[requested], requested).toBe(served);
    }
  });

  it('locales Google does not serve render en-US — the en-clone classification matches reality', () => {
    const enServed = new Set(
      Object.entries(survey.requestedToServed)
        .filter(([, served]) => /^en(-US|-GB)?$|^en$/i.test(served))
        .map(([requested]) => requested),
    );
    // Only check clones the survey actually requested; en-US/en fall back to
    // the shared en table by design either way.
    for (const clone of EN_CLONE_LOCALES) {
      if (!(clone in survey.requestedToServed)) continue;
      expect(enServed.has(clone), `clone ${clone} should be en-served`).toBe(true);
    }
  });

  it('script subtags are stripped by Google but the resolver still finds the table', () => {
    expect(survey.requestedToServed['sr-Latn']).toBe('sr');
    expect(
      resolveLanguage(TABLE_KEYS, { pageLang: 'sr', browserLanguages: [] })
    ).toBe('sr');
  });
});
