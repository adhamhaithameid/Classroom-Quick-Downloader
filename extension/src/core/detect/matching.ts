// filepath: extension/src/core/detect/matching.ts
/**
 * ============================================================================
 * KEYWORD MATCHING — the one shared matcher for keyword evidence (D6)
 * ============================================================================
 *
 * Every keyword path (V2 keyword-scoring, V1 smart-detector-comments and
 * smart-detector, and the V1 exclusion tables) used to decide "does this text
 * contain this keyword?" with `normalizedText.includes(keyword)`. Substring
 * containment is the wrong semantic for space-delimited scripts: 'comment'
 * matched inside 'commentary' and the generic Arabic phrase 'من الصف' ("from
 * the class") fired on ordinary body copy (D6).
 *
 * This module defines the semantics once, language-free:
 *
 *   - Phrase keywords (whitespace inside the keyword after normalization):
 *     the keyword's tokens must appear as CONSECUTIVE whole tokens in the
 *     text. Whole tokens keep 'من الصف' from matching 'من الصفوف' the same
 *     way 'comment' must not match 'commentary'.
 *   - Single-word keywords in space-delimited scripts: WHOLE-TOKEN equality
 *     only. The keyword tables already carry the inflected forms they need
 *     (singular/plural per language), so 'commentary' ≠ 'comment' and
 *     'комментария' is matched by its own plural table entry, not by a
 *     substring accident. No suffix or prefix heuristic is invented here on
 *     purpose — see the D6 task report.
 *   - Unspaced scripts (Han, Kana, Hangul, Thai, Khmer, Lao, Myanmar and
 *     friends): substring containment is kept. Whole tokens do not exist in
 *     an unspaced run, so the Japanese keyword 'コメント' must keep matching
 *     inside longer strings like '4件のコメント'.
 *
 * Tokenization mirrors the word-number parser (D2, detection-keywords
 * parseWordNumber): split the normalized text on whitespace, punctuation and
 * symbol boundaries. One token grammar for the whole engine.
 *
 * Pure functions over strings. The only import is the sibling core string
 * cleaner — no browser globals, no keyword tables, no language signal.
 */
import { normalizeForComparison } from './normalize';

/**
 * Characters from scripts written without spaces between words. A keyword or
 * a whitespace-free text run containing any of these falls back to substring
 * matching, because "whole token" is meaningless there.
 */
const UNSPACED_SCRIPT_CHARS: RegExp =
  /[\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\u{20000}-\u{2FA1F}]/u;

/** Whitespace, punctuation and symbol boundaries — the D2 token grammar. */
const TOKEN_BOUNDARIES: RegExp = /[\s\p{P}\p{S}]+/u;

/** True if the string carries at least one character from an unspaced script. */
export function hasUnspacedScriptChar(text: string): boolean {
  return !!text && UNSPACED_SCRIPT_CHARS.test(text);
}

/**
 * Split already-normalized text into whole tokens.
 *
 * Exported for callers that share one token list across many keyword checks
 * (the keyword loops normalize their text once and reuse it).
 */
export function comparisonTokens(normalizedText: string): string[] {
  if (!normalizedText) return [];
  return normalizedText.split(TOKEN_BOUNDARIES).filter(Boolean);
}

/**
 * Core containment check over ALREADY-NORMALIZED strings (normalizeForComparison
 * output on both sides). Split out so hot keyword loops can normalize the text
 * once and reuse it; matchesKeyword() below is the self-normalizing entry point.
 *
 * - Multi-token keyword: consecutive token-sequence containment.
 * - Single-token keyword in a space-delimited script on both sides:
 *   whole-token equality.
 * - Otherwise (either side unspaced): substring containment, the only
 *   meaningful containment for unspaced scripts.
 */
export function matchesNormalizedKeyword(
  normalizedText: string,
  normalizedKeyword: string,
): boolean {
  if (!normalizedText || !normalizedKeyword) return false;

  const keywordTokens = comparisonTokens(normalizedKeyword);

  if (keywordTokens.length > 1) {
    // Phrase keyword: the keyword's tokens must appear as a consecutive run
    // of whole tokens in the text.
    const textTokens = comparisonTokens(normalizedText);
    // Stryker disable next-line ArithmeticOperator: the upper bound is only a
    // loop cap — overrunning it compares undefined tokens, which never equal a
    // keyword token, so every mutant here is behaviorally identical.
    const lastStart = textTokens.length - keywordTokens.length;
    for (let start = 0; start <= lastStart; start++) {
      let matched = true;
      for (let offset = 0; offset < keywordTokens.length; offset++) {
        if (textTokens[start + offset] !== keywordTokens[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
    return false;
  }

  // Single-word keyword. Decide the semantics by script, never by language.
  const keywordUnspaced = hasUnspacedScriptChar(normalizedKeyword);
  const textUnspaced = !/\s/.test(normalizedText) && hasUnspacedScriptChar(normalizedText);
  if (keywordUnspaced || textUnspaced) {
    // Unspaced script: whole tokens do not exist, keep substring containment
    // so 'コメント' keeps matching inside '4件のコメント'.
    return normalizedText.includes(normalizedKeyword);
  }

  // Space-delimited script: whole-token equality only. The tables carry the
  // inflected forms; 'commentary' must not match 'comment'.
  return comparisonTokens(normalizedText).includes(normalizedKeyword);
}

/**
 * Does `text` contain `keyword` under the D6 semantics?
 *
 * The one entry point for keyword evidence. Both arguments may be raw page
 * text or table entries; both are normalized here. Callers that already hold
 * normalizeForComparison output may use matchesNormalizedKeyword() to skip
 * the repeated cleaning.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  return matchesNormalizedKeyword(
    normalizeForComparison(text),
    normalizeForComparison(keyword),
  );
}
