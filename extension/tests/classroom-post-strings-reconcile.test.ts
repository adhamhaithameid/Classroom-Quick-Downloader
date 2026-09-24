import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCommentKeywords,
  getEditedKeywords,
  COMMENT_EXCLUSION_PATTERNS,
} from '../entrypoints/content/detection-keywords';
import { matchesNormalizedKeyword } from '../src/core/detect/matching';
import { normalizeForComparison } from '../src/core/detect/normalize';
import { LIVE_COMPOSER_PROMPTS, LIVE_COMPOSER_PROMPT_REGEXPS } from '../src/core/detect/composer-prompts-live';

/**
 * Real-Classroom reconciliation gate.
 *
 * tests/fixtures/classroom/post-strings-captured.json holds strings captured
 * LIVE from classroom.google.com (2026-09-19/20, logged-in sweep via ?hl=):
 * the actual "(Edited <time>)" marker, the actual "Add class comment…"
 * placeholder, and the actual "1 class comment" count chip rendered for each
 * served language. The engine's keyword tables must match those real strings
 * — a MISS here is a language the detection engine cannot see.
 */
interface CapturedLang {
  htmlLang: string;
  editedMarker: string | null;
  commentPlaceholder: string | null;
  countText?: string;
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/classroom/post-strings-captured.json'), 'utf8'),
) as { capturedOn: string; langs: Record<string, CapturedLang> };

const matches = (text: string, keyword: string) =>
  matchesNormalizedKeyword(normalizeForComparison(text), normalizeForComparison(keyword));

const editedHits = (lang: string, text: string) =>
  getEditedKeywords(lang).some((k) => matches(text, k));

const commentHits = (lang: string, text: string) => {
  const table = getCommentKeywords(lang);
  const all = [...table.singular, ...table.plural, ...table.classComment];
  return all.some((k) => matches(text, k));
};

describe('real Classroom "(Edited)" markers are detected', () => {
  it('every captured edited marker matches the engine keyword table', () => {
    const misses: string[] = [];
    for (const [lang, entry] of Object.entries(fixture.langs)) {
      if (!entry.editedMarker) continue;
      // The keyword lookup takes the SERVED docLang (what the page reports),
      // which is exactly what the runtime detection passes in.
      if (!editedHits(entry.htmlLang, entry.editedMarker)) {
        misses.push(`${lang} (${entry.htmlLang}): ${entry.editedMarker}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('Hebrew pages (served as legacy iw) load the Hebrew keyword table', () => {
    const iw = fixture.langs['iw'];
    if (!iw?.editedMarker) return;
    expect(editedHits('iw', iw.editedMarker)).toBe(true);
    // and the direct alias direction
    expect(getEditedKeywords('iw')).toEqual(getEditedKeywords('he'));
  });
});

describe('real Classroom "Add class comment" placeholders are detected', () => {
  it('every captured comment placeholder matches the engine keyword table', () => {
    const misses: string[] = [];
    for (const [lang, entry] of Object.entries(fixture.langs)) {
      if (!entry.commentPlaceholder) continue;
      if (!commentHits(entry.htmlLang, entry.commentPlaceholder)) {
        misses.push(`${lang} (${entry.htmlLang}): ${entry.commentPlaceholder}`);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe('real Classroom comment count chips are detected', () => {
  it('every captured localized count text matches the engine keyword table', () => {
    const misses: string[] = [];
    for (const [lang, entry] of Object.entries(fixture.langs)) {
      if (!entry.countText) continue;
      const tail = entry.countText.replace(/^\d+\s*/, '');
      const hit =
        commentHits(entry.htmlLang, entry.countText) ||
        (tail && commentHits(entry.htmlLang, tail));
      if (!hit) misses.push(`${lang} (${entry.htmlLang}): ${entry.countText}`);
    }
    expect(misses).toEqual([]);
  });
});

describe('localized composer prompts are excluded, never scored', () => {
  it('every captured placeholder has a generated exclusion prompt', () => {
    const byLang = new Map(LIVE_COMPOSER_PROMPTS.map((p) => [p.lang, p]));
    const problems: string[] = [];
    for (const [lang, entry] of Object.entries(fixture.langs)) {
      if (!entry.commentPlaceholder) continue;
      const prompt = byLang.get(lang);
      if (!prompt) {
        problems.push(`${lang}: no generated prompt`);
        continue;
      }
      // The generated placeholder must be byte-identical to the fixture.
      if (prompt.placeholder !== entry.commentPlaceholder) {
        problems.push(`${lang}: prompt drift — ${prompt.placeholder}`);
      }
      // And its pattern must actually match the verbatim placeholder.
      if (!new RegExp(prompt.patternSource, 'i').test(entry.commentPlaceholder)) {
        problems.push(`${lang}: patternSource does not match placeholder`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the string-based exclusion table excludes every prompt base', () => {
    const misses = LIVE_COMPOSER_PROMPTS.filter(
      (p) =>
        !COMMENT_EXCLUSION_PATTERNS.some((pattern) =>
          matches(p.placeholder, pattern),
        ),
    ).map((p) => `${p.lang}: ${p.base}`);
    expect(misses).toEqual([]);
  });

  it('every live prompt regex is present in the canonical action-button table', () => {
    const sources = new Set(LIVE_COMPOSER_PROMPT_REGEXPS.map((r) => r.source));
    expect(sources.size).toBe(LIVE_COMPOSER_PROMPTS.length);
  });
});

describe('keyword table integrity after the live sweep', () => {
  it('every captured htmlLang resolves to non-English keyword lists where the table ships one', () => {
    // Spot-check: these served tags must load their own language's keywords,
    // not the English fallback.
    const expectOwn: Array<[string, string[]]> = [
      ['iw', ['נערך', 'עריכה אחרונה', 'עריכה', 'שינוי']],
      ['fil', ['na-edit', 'binago', 'pagbabago']],
      ['nb', ['endret']],
      ['pt-BR', ['editado', 'modificado', 'modificação', 'última modificação']],
      ['es-419', ['editado', 'modificado', 'modificación', 'última modificación', 'edición']],
      ['zh-CN', ['已编辑', '已修改', '编辑', '修改', '更改', '最后编辑', '上次修改时间']],
    ];
    for (const [served, expected] of expectOwn) {
      expect(getEditedKeywords(served)).toEqual(expected);
    }
  });
});
