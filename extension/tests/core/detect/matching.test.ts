// filepath: extension/tests/core/detect/matching.test.ts
/**
 * Unit tests for the shared D6 matcher (src/core/detect/matching.ts).
 *
 * The brief pins five behaviors: whole-token hit, 'commentary' miss, phrase
 * consecutive tokens, CJK substring kept, and the unspaced-text-with-spaced-
 * keyword edge. Everything else here pins the semantics the corpus relies on.
 */
import { describe, it, expect } from 'vitest';
import {
  matchesKeyword,
  matchesNormalizedKeyword,
  comparisonTokens,
  hasUnspacedScriptChar,
} from '../../../src/core/detect/matching';
import { normalizeForComparison } from '../../../src/core/detect/normalize';

describe('matchesKeyword() — whole-token semantics (D6)', () => {
  it('matches a single-word keyword as a whole token', () => {
    expect(matchesKeyword('3 comments', 'comments')).toBe(true);
    expect(matchesKeyword('See the comment below', 'comment')).toBe(true);
    expect(matchesKeyword('5 تعليقات صفية', 'تعليقات')).toBe(true);
  });

  it('misses when the keyword only appears inside a longer word (D6)', () => {
    // The corpus case: 'comment' must not fire inside 'commentary'.
    expect(matchesKeyword('Read the commentary on chapter 4', 'comment')).toBe(false);
    expect(matchesKeyword('Commentary on the reading is due', 'comment')).toBe(false);
    // Inflected forms must come from the tables, not from a substring accident.
    expect(matchesKeyword('٣ تعليقات في الصف', 'تعليق')).toBe(false);
    expect(matchesKeyword('комментария', 'комментарий')).toBe(false);
  });

  it('stays case- and punctuation-tolerant through normalization', () => {
    expect(matchesKeyword('Posted Mar 1 (Edited Mar 10)', 'edited')).toBe(true);
    expect(matchesKeyword('Jan 20, 2026 (edited)', '(edited)')).toBe(true);
    expect(matchesKeyword('«Kommentare»', 'kommentare')).toBe(true);
  });

  it('tokenizes on punctuation and symbols, like the D2 word-number parser', () => {
    expect(matchesKeyword('edited-by-moderator', 'edited')).toBe(true);
    expect(matchesKeyword('edited/by/admin', 'edited')).toBe(true);
    // ...but a letter-embedded run is still one token.
    expect(matchesKeyword('coeditedly', 'edited')).toBe(false);
  });
});

describe('matchesKeyword() — phrase semantics', () => {
  it('matches a phrase as consecutive whole tokens', () => {
    expect(matchesKeyword('٣ تعليقات من الصف', 'من الصف')).toBe(true);
    expect(matchesKeyword('٢ تعليقات من الصف', 'تعليقات من الصف')).toBe(true);
    expect(matchesKeyword('2 class comments', 'class comments')).toBe(true);
    expect(matchesKeyword('bình luận lớp học', 'lớp học')).toBe(true);
  });

  it('misses when the phrase tokens are not consecutive', () => {
    expect(matchesKeyword('من هنا والصف', 'من الصف')).toBe(false);
    expect(matchesKeyword('من الصفوف الخامسة', 'من الصف')).toBe(false);
    expect(matchesKeyword('class silly comments', 'class comments')).toBe(false);
  });

  it('misses when a phrase token appears only inside a longer word', () => {
    expect(matchesKeyword('classy comments', 'class comments')).toBe(false);
  });
});

describe('matchesKeyword() — unspaced scripts keep substring containment', () => {
  it('keeps the Japanese keyword matching inside longer strings', () => {
    expect(matchesKeyword('4件のコメント', 'コメント')).toBe(true);
    expect(matchesKeyword('コメント一覧', 'コメント')).toBe(true);
    expect(matchesKeyword('クラスのコメント 4', 'クラスのコメント')).toBe(true);
  });

  it('keeps Chinese, Korean and Thai keywords on substring', () => {
    expect(matchesKeyword('2条评论', '评论')).toBe(true);
    expect(matchesKeyword('6개의 댓글', '댓글')).toBe(true);
    expect(matchesKeyword('ความคิดเห็นของชั้นเรียน', 'ความคิดเห็น')).toBe(true);
  });

  it('unspaced-text-with-spaced-keyword edge: falls back to substring', () => {
    // A whitespace-free run in an unspaced script has no whole tokens, so a
    // space-delimited keyword keeps the conservative pre-fix substring
    // behavior against it.
    expect(matchesKeyword('日本語comment語', 'comment')).toBe(true);
    // ...and the same run does not fabricate a token match for a keyword it
    // merely contains letter-wise in a spaced context elsewhere.
    expect(matchesKeyword('コメントeditedなし', 'edited')).toBe(true);
  });

  it('still token-matches a spaced keyword when the mixed text has whitespace', () => {
    // Whitespace exists, so the text is tokenizable: 'commentary' is a
    // different token from 'comment' even with CJK neighbors.
    expect(matchesKeyword('commentary コメント', 'comment')).toBe(false);
    expect(matchesKeyword('comment コメント', 'comment')).toBe(true);
  });
});

describe('matchesNormalizedKeyword() — pre-normalized fast path', () => {
  it('agrees with matchesKeyword()', () => {
    const text = normalizeForComparison('Read the commentary on chapter 4');
    const keyword = normalizeForComparison('comment');
    expect(matchesNormalizedKeyword(text, keyword)).toBe(false);
    expect(
      matchesNormalizedKeyword(normalizeForComparison('5 class comments'), normalizeForComparison('class comments')),
    ).toBe(true);
  });

  it('returns false on empty input', () => {
    expect(matchesNormalizedKeyword('', 'comment')).toBe(false);
    expect(matchesNormalizedKeyword('comment', '')).toBe(false);
  });
});

describe('helpers', () => {
  it('detects unspaced-script characters', () => {
    expect(hasUnspacedScriptChar('コメント')).toBe(true);
    expect(hasUnspacedScriptChar('评论')).toBe(true);
    expect(hasUnspacedScriptChar('댓글')).toBe(true);
    expect(hasUnspacedScriptChar('ความคิดเห็น')).toBe(true);
    expect(hasUnspacedScriptChar('plain english')).toBe(false);
    expect(hasUnspacedScriptChar('تعليقات من الصف')).toBe(false); // Arabic is space-delimited
  });

  it('splits normalized text into whole tokens', () => {
    expect(comparisonTokens(normalizeForComparison('Posted Mar 1 (Edited Mar 10)'))).toEqual([
      'posted', 'mar', '1', 'edited', 'mar', '10',
    ]);
    expect(comparisonTokens('')).toEqual([]);
  });
});
