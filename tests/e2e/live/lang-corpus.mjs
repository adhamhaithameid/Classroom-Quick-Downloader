// filepath: tests/e2e/live/lang-corpus.mjs
/**
 * ============================================================================
 * LANGUAGE CORPUS — shared corpus schema, matching, and candidate filtering
 * ============================================================================
 *
 * Plain ESM (no TypeScript) so BOTH the capture tool (tools/*.mjs, plain node)
 * and the Playwright specs (transpiled TS) import the exact same logic — one
 * definition of "what a corpus entry looks like" and "does keyword X appear".
 *
 * A corpus is the structured, per-language inventory of REAL text Classroom
 * rendered:
 *
 *   {
 *     lang: "de",                 // requested language code
 *     htmlLang: "de-DE",          // rendered <html lang> (ground truth)
 *     capturedAt: ISO, source: "live" | "fixture",
 *     pages: { [pageName]: { url, texts: string[], ariaLabels: string[] } }
 *   }
 *
 * Consumers: language-reconcile.spec.ts (audits engine keyword lists against
 * it) and future keyword-loader updates (bead under 6jv).
 */

import fs from 'node:fs';
import path from 'node:path';

/** Joke/Chrome-only locales that real Classroom can never render. */
const NON_CLASSROOM_LANGUAGES = new Set([
  'xx-bork', 'xx-elmer', 'xx-hacker', 'xx-pirate', 'tlh',
  // Not offered as Google product UI languages (engine lists them for
  // completeness); the live probe skips them when Google rejects the code.
  'sa', 'bh', 'kri', 'pcm', 'crs', 'mfe', 'loz', 'chr', 'ia',
]);

/**
 * Candidate languages to capture: the engine's real-language scope minus
 * joke locales. The live capture additionally probes each one and records
 * which codes Classroom actually renders (htmlLang match), so this list is
 * the SUPERSET — the corpus manifest holds the empirical truth.
 */
export function candidateLanguages(supported) {
  const seen = new Set();
  const out = [];
  for (const lang of supported) {
    const key = String(lang).toLowerCase();
    if (NON_CLASSROOM_LANGUAGES.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(String(lang));
  }
  return out;
}

/** Whether a requested code is worth probing (not a joke locale). */
export function isProbeableLanguage(lang) {
  return !NON_CLASSROOM_LANGUAGES.has(String(lang).toLowerCase());
}

// ---------------------------------------------------------------------------
// Normalization + presence matching
// ---------------------------------------------------------------------------

/**
 * Corpus-grade normalization: unicode-normalize, casefold, strip combining
 * marks (Arabic harakat, Latin diacritics), collapse whitespace. Substring
 * presence on this form is the audit's match test — deliberately simpler
 * than the engine's token-aware matcher, because here we are checking
 * "did Classroom render this string", not "should this string classify".
 */
export function normalizeForCorpus(text) {
  return String(text)
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All searchable strings of a corpus page (texts + aria labels). */
export function corpusStrings(corpus) {
  const out = [];
  for (const page of Object.values(corpus?.pages ?? {})) {
    for (const t of page?.texts ?? []) out.push(t);
    for (const a of page?.ariaLabels ?? []) out.push(a);
  }
  return out;
}

/**
 * Audit ONE keyword group against a corpus.
 * Returns { verified: [{keyword, evidence}], missing: [keyword],
 *           unobserved: [keyword] } — verified = rendered somewhere;
 * missing = a DIFFERENT rendering exists that supersedes it is not knowable
 * here, so "missing" only means "not found in this corpus" and "unobserved"
 * means the corpus has no data at all for that page family.
 */
export function auditKeywords(corpus, keywords) {
  const strings = corpusStrings(corpus).map(normalizeForCorpus);
  const hasData = strings.length > 0;
  const verified = [];
  const missing = [];
  for (const keyword of keywords) {
    const needle = normalizeForCorpus(keyword);
    if (!needle) continue;
    const evidence = strings.find((hay) => hay.includes(needle));
    if (evidence !== undefined) verified.push({ keyword, evidence: evidence.slice(0, 120) });
    else missing.push(keyword);
  }
  if (!hasData) return { verified: [], missing: [], unobserved: [...missing], hasData };
  return { verified, missing, unobserved: [], hasData };
}

// ---------------------------------------------------------------------------
// Corpus building from raw HTML (fixture + offline paths, no DOM needed)
// ---------------------------------------------------------------------------

const MAX_TEXTS = 500;
const MAX_ARIA = 300;
const MAX_LINE = 200;

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Visible-ish text lines from raw HTML (script/style stripped, deduped). */
export function textLinesFromHtml(raw) {
  const withoutInvisible = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const lines = decodeEntities(withoutInvisible.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && l.length <= MAX_LINE);
  return [...new Set(lines)].slice(0, MAX_TEXTS);
}

/** aria-label values from raw HTML, deduped. */
export function ariaLabelsFromHtml(raw) {
  const labels = [...String(raw).matchAll(/aria-label="([^"]{2,200})"/gi)]
    .map((m) => decodeEntities(m[1]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(labels)].slice(0, MAX_ARIA);
}

/** Build a corpus entry from raw HTML captured on some page. */
export function corpusPageFromHtml(url, raw) {
  return { url, texts: textLinesFromHtml(raw), ariaLabels: ariaLabelsFromHtml(raw) };
}

/** html lang attribute from raw HTML. */
export function htmlLangFromHtml(raw) {
  const m = /<html[^>]*\slang="([^"]*)"/i.exec(String(raw));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Corpus store (qa-artifacts/live-languages/)
// ---------------------------------------------------------------------------

/**
 * Resolve a corpus file path under root with a hard boundary — names are
 * language codes read from a CLI list, and the boundary keeps the writer
 * inside the corpus directory regardless of what is passed in.
 */
export function corpusFileUnder(root, lang) {
  const safeName = path.basename(`${lang}.json`);
  const target = path.resolve(root, safeName);
  const boundary = path.resolve(root) + path.sep;
  if (!target.startsWith(boundary) || target === path.resolve(root)) {
    throw new Error(`corpus path escaped corpus root: ${target}`);
  }
  return target;
}

export function loadCorpus(root, lang) {
  try {
    return JSON.parse(fs.readFileSync(corpusFileUnder(root, lang), 'utf-8'));
  } catch {
    return null;
  }
}

export function saveCorpus(root, corpus) {
  fs.mkdirSync(root, { recursive: true });
  const file = corpusFileUnder(root, corpus.lang);
  fs.writeFileSync(file, `${JSON.stringify(corpus, null, 2)}\n`);
  return file;
}

/**
 * The in-page DOM collector source (evaluated inside the live page by the
 * capture tool). Kept here so specs can unit-test its shape decisions.
 * Returns { htmlLang, texts, ariaLabels }.
 */
export const IN_PAGE_COLLECTOR_SOURCE = `
  () => {
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
    const texts = new Set();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const el = node.parentElement;
        if (!el || skip.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length > 200) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(el);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode()) !== null && texts.size < 500) {
      const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text) texts.add(text);
    }
    const aria = new Set();
    for (const el of document.querySelectorAll('[aria-label]')) {
      const label = (el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
      if (label && label.length <= 200) aria.add(label);
      if (aria.size >= 300) break;
    }
    return {
      htmlLang: document.documentElement.lang || '',
      texts: [...texts],
      ariaLabels: [...aria],
    };
  }
`;
