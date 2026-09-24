// filepath: src/core/i18n/resolve.ts
/**
 * Shared language-tag resolution for every surface that must follow the
 * language the Google Classroom page is actually rendered in.
 *
 * One resolver, two consumers: `entrypoints/content/i18n.ts` (button strings
 * via `t()`) and `entrypoints/utils/language-controller.ts` (stored language
 * state). Before this module the controller truncated tags to their base
 * code (`zh-CN` -> `zh`) and i18n cached that code, which the TRANSLATIONS
 * table cannot resolve — Chinese / pt-PT / sr-Latn users got English strings.
 * This module is the single place that knows:
 *
 *   - candidate order: page full tag, page base tag, browser full tags, browser
 *     base tags, `en` — so the Classroom UI language always wins over the
 *     browser UI language;
 *   - legacy/alias mapping (Chrome shipped `iw`/`in`/`jv`/`ji` historically,
 *     macOS reports Bokmål as `nb`, Tagalog arrives as `tl`, Chinese regions
 *     collapse onto the two Classroom locales) applied at EVERY candidate
 *     step, not just the first.
 *
 * Pure data + functions: no DOM, no chrome APIs, no table import — callers
 * pass their own key set so content and controller stay decoupled.
 */

/**
 * Lowercase BCP-47 tags (or tag prefixes) that must resolve onto a different
 * canonical tag. Longest-prefix-wins: `zh-hant-tw` maps through `zh-hant`.
 */
export const LANGUAGE_TAG_ALIASES: Readonly<Record<string, string>> = {
  // Legacy ISO 639 codes Chrome used before switching to the modern set.
  iw: 'he',
  in: 'id',
  ji: 'yi',
  jv: 'jw',
  'jv-id': 'jw-id',
  // macOS reports Norwegian Bokmål as `nb`; the table ships `no`.
  nb: 'no',
  'nb-no': 'no',
  // Tagalog arrives as `tl`; the Filipino table is `fil`.
  tl: 'fil',
  'tl-ph': 'fil',
  // Chinese collapses onto the two locales Classroom renders.
  zh: 'zh-cn',
  'zh-cn': 'zh-cn',
  'zh-sg': 'zh-cn',
  'zh-my': 'zh-cn',
  'zh-hans': 'zh-cn',
  'zh-hans-cn': 'zh-cn',
  'zh-hans-sg': 'zh-cn',
  'zh-hk': 'zh-tw',
  'zh-mo': 'zh-tw',
  'zh-tw': 'zh-tw',
  'zh-hant': 'zh-tw',
  'zh-hant-tw': 'zh-tw',
  'zh-hant-hk': 'zh-tw',
};

/** Normalize a raw tag: lowercase, strip q-values/whitespace, `_` -> `-`. */
export function normalizeLanguageTag(raw: string): string {
  return raw.toLowerCase().split(';')[0].trim().replace(/_/g, '-');
}

/**
 * Expand one raw tag into the candidate sequence to try, most specific first:
 * the (aliased) full tag, then the (aliased) base tag. `en-US` -> `['en-us', 'en']`.
 */
export function expandLanguageCandidates(raw: string): string[] {
  const tag = normalizeLanguageTag(raw);
  if (!tag) return [];

  const base = tag.split('-')[0];
  const candidates: string[] = [];

  const aliasFull = LANGUAGE_TAG_ALIASES[tag];
  // Longest-prefix aliases (`zh-hant-tw`) also rewrite the base when the base
  // itself is aliased (`zh` -> `zh-cn`).
  const aliasedFull = aliasFull ?? tag;
  if (!candidates.includes(aliasedFull)) candidates.push(aliasedFull);

  const aliasBase = LANGUAGE_TAG_ALIASES[base];
  const aliasedBase = aliasBase ?? base;
  if (!candidates.includes(aliasedBase)) candidates.push(aliasedBase);

  return candidates;
}

export interface LanguageInput {
  /** `document.documentElement.lang` — the Classroom UI language. */
  pageLang: string;
  /** `navigator.language` first, then `navigator.languages`. */
  browserLanguages: readonly string[];
}

/**
 * Resolve the table key to use. Page language candidates outrank browser
 * candidates; every candidate runs through alias expansion; `en` is the
 * terminal fallback. Returns a key guaranteed to exist in `tableKeys` (or
 * `en`, which callers must ensure is present — the TRANSLATIONS table does).
 */
export function resolveLanguage(
  tableKeys: readonly string[],
  input: LanguageInput,
): string {
  const keys = new Set(tableKeys);

  const candidates: string[] = [];
  for (const raw of [input.pageLang, ...input.browserLanguages]) {
    for (const candidate of expandLanguageCandidates(raw)) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }
  candidates.push('en');

  for (const candidate of candidates) {
    if (keys.has(candidate)) return candidate;
  }
  return 'en';
}
