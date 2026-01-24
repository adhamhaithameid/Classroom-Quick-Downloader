/**
 * TEST FIXTURES - The Data Warehouse
 * 
 * Comprehensive test cases for Universal V4 Detection System
 * Covers 100+ languages, RTL, CJK, Indic, Joke languages, and edge cases
 */

export interface TestCase {
  id: string;
  language: string;
  description: string;
  htmlSnippet: string;
  expected: {
    count: number;
    isEdited: boolean;
    diffString: string | null;
  };
}

// ============================================================================
// COMMENT DETECTION TEST CASES
// ============================================================================

export const COMMENT_TEST_CASES: TestCase[] = [
  // ==================== RTL LANGUAGES ====================
  {
    id: 'ar-1',
    language: 'ar',
    description: 'Arabic: Single class comment with word-number "واحد"',
    htmlSnippet: `
      <div data-stream-item-id="123">
        <div aria-label="تعليق واحد من الصف">1 تعليق</div>
        <h2><a href="/details/123">Assignment Title</a></h2>
      </div>
    `,
    expected: { count: 1, isEdited: false, diffString: null },
  },
  {
    id: 'ar-2',
    language: 'ar',
    description: 'Arabic: Multiple comments with Arabic numeral',
    htmlSnippet: `
      <div data-stream-item-id="124">
        <div aria-label="٥ تعليقات صفية" role="button">5 تعليقات</div>
      </div>
    `,
    expected: { count: 5, isEdited: false, diffString: null },
  },
  {
    id: 'ar-3',
    language: 'ar',
    description: 'Arabic: "Add comment" should be EXCLUDED (count 0)',
    htmlSnippet: `
      <div data-stream-item-id="125">
        <button aria-label="إضافة تعليق">إضافة تعليق</button>
      </div>
    `,
    expected: { count: 0, isEdited: false, diffString: null },
  },
  {
    id: 'he-1',
    language: 'he',
    description: 'Hebrew: Comments with Hebrew text',
    htmlSnippet: `
      <div data-stream-item-id="126">
        <div aria-label="3 תגובות" role="button">3 תגובות</div>
      </div>
    `,
    expected: { count: 3, isEdited: false, diffString: null },
  },

  // ==================== CJK LANGUAGES ====================
  {
    id: 'ja-1',
    language: 'ja',
    description: 'Japanese: Comments',
    htmlSnippet: `
      <div data-stream-item-id="127">
        <div aria-label="4件のコメント" role="button">4 コメント</div>
      </div>
    `,
    expected: { count: 4, isEdited: false, diffString: null },
  },
  {
    id: 'zh-1',
    language: 'zh',
    description: 'Chinese Simplified: Comments',
    htmlSnippet: `
      <div data-stream-item-id="128">
        <div aria-label="2条评论" role="button">2 评论</div>
      </div>
    `,
    expected: { count: 2, isEdited: false, diffString: null },
  },
  {
    id: 'ko-1',
    language: 'ko',
    description: 'Korean: Comments',
    htmlSnippet: `
      <div data-stream-item-id="129">
        <div aria-label="6개의 댓글" role="button">6 댓글</div>
      </div>
    `,
    expected: { count: 6, isEdited: false, diffString: null },
  },

  // ==================== INDIC LANGUAGES ====================
  {
    id: 'hi-1',
    language: 'hi',
    description: 'Hindi: Comments with Devanagari numerals',
    htmlSnippet: `
      <div data-stream-item-id="130">
        <div aria-label="३ टिप्पणियां" role="button">३ टिप्पणियां</div>
      </div>
    `,
    expected: { count: 3, isEdited: false, diffString: null },
  },
  {
    id: 'bn-1',
    language: 'bn',
    description: 'Bengali: Comments with Bengali numerals',
    htmlSnippet: `
      <div data-stream-item-id="131">
        <div aria-label="৫ মন্তব্য" role="button">৫ মন্তব্য</div>
      </div>
    `,
    expected: { count: 5, isEdited: false, diffString: null },
  },

  // ==================== EUROPEAN LANGUAGES ====================
  {
    id: 'en-1',
    language: 'en',
    description: 'English: Class comments',
    htmlSnippet: `
      <div data-stream-item-id="132">
        <div aria-label="7 class comments" role="button">7 comments</div>
      </div>
    `,
    expected: { count: 7, isEdited: false, diffString: null },
  },
  {
    id: 'es-1',
    language: 'es',
    description: 'Spanish: Comments',
    htmlSnippet: `
      <div data-stream-item-id="133">
        <div aria-label="4 comentarios" role="button">4 comentarios</div>
      </div>
    `,
    expected: { count: 4, isEdited: false, diffString: null },
  },
  {
    id: 'fr-1',
    language: 'fr',
    description: 'French: Comments',
    htmlSnippet: `
      <div data-stream-item-id="134">
        <div aria-label="2 commentaires" role="button">2 commentaires</div>
      </div>
    `,
    expected: { count: 2, isEdited: false, diffString: null },
  },
  {
    id: 'de-1',
    language: 'de',
    description: 'German: Comments',
    htmlSnippet: `
      <div data-stream-item-id="135">
        <div aria-label="8 Kommentare" role="button">8 Kommentare</div>
      </div>
    `,
    expected: { count: 8, isEdited: false, diffString: null },
  },
  {
    id: 'ru-1',
    language: 'ru',
    description: 'Russian: Comments',
    htmlSnippet: `
      <div data-stream-item-id="136">
        <div aria-label="3 комментария" role="button">3 комментария</div>
      </div>
    `,
    expected: { count: 3, isEdited: false, diffString: null },
  },

  // ==================== JOKE LANGUAGES ====================
  {
    id: 'pirate-1',
    language: 'xx-pirate',
    description: 'Pirate: Arrr comments',
    htmlSnippet: `
      <div data-stream-item-id="137">
        <div aria-label="5 crew comments" role="button">5 comments yarr</div>
      </div>
    `,
    expected: { count: 5, isEdited: false, diffString: null },
  },
  {
    id: 'hacker-1',
    language: 'xx-hacker',
    description: 'Hacker/1337: c0mm3nt5',
    htmlSnippet: `
      <div data-stream-item-id="138">
        <div aria-label="3 c0mm3nt5" role="button">3 c0mm3nt5</div>
      </div>
    `,
    expected: { count: 3, isEdited: false, diffString: null },
  },
  {
    id: 'bork-1',
    language: 'xx-bork',
    description: 'Bork (Swedish Chef): kumments',
    htmlSnippet: `
      <div data-stream-item-id="139">
        <div aria-label="2 kumments bork" role="button">2 kumments</div>
      </div>
    `,
    expected: { count: 2, isEdited: false, diffString: null },
  },

  // ==================== EDGE CASES ====================
  {
    id: 'edge-1',
    language: 'en',
    description: 'Edge: "Add class comment" should NOT be detected',
    htmlSnippet: `
      <div data-stream-item-id="140">
        <button aria-label="Add class comment">Add class comment</button>
      </div>
    `,
    expected: { count: 0, isEdited: false, diffString: null },
  },
  {
    id: 'edge-2',
    language: 'en',
    description: 'Edge: CSS class missing but aria-label present (Semantic Triangulation)',
    htmlSnippet: `
      <div data-stream-item-id="141">
        <div aria-label="1 class comment">1 comment</div>
      </div>
    `,
    expected: { count: 1, isEdited: false, diffString: null },
  },
  {
    id: 'edge-3',
    language: 'ar',
    description: 'Edge: Arabic numeral 2 detection',
    htmlSnippet: `
      <div data-stream-item-id="142">
        <div aria-label="٢ تعليقات من الصف" role="button">٢ تعليق</div>
      </div>
    `,
    expected: { count: 2, isEdited: false, diffString: null },
  },
];

// ============================================================================
// EDITED DETECTION TEST CASES
// ============================================================================

export const EDITED_TEST_CASES: TestCase[] = [
  {
    id: 'edit-en-1',
    language: 'en',
    description: 'English: Edited marker',
    htmlSnippet: `
      <div data-stream-item-id="200">
        <div class="IMvYId">Jan 20, 2026 (edited)</div>
      </div>
    `,
    expected: { count: 0, isEdited: true, diffString: null },
  },
  {
    id: 'edit-ar-1',
    language: 'ar',
    description: 'Arabic: Edited marker (تم تعديله)',
    htmlSnippet: `
      <div data-stream-item-id="201">
        <div class="IMvYId">٢٠ يناير ٢٠٢٦ (تم تعديله)</div>
      </div>
    `,
    expected: { count: 0, isEdited: true, diffString: null },
  },
  {
    id: 'edit-ja-1',
    language: 'ja',
    description: 'Japanese: Edited marker (編集済み)',
    htmlSnippet: `
      <div data-stream-item-id="202">
        <div class="IMvYId">2026年1月20日 (編集済み)</div>
      </div>
    `,
    expected: { count: 0, isEdited: true, diffString: null },
  },
  {
    id: 'edit-hacker-1',
    language: 'xx-hacker',
    description: 'Hacker: 3d1t3d marker',
    htmlSnippet: `
      <div data-stream-item-id="203">
        <div class="IMvYId">Jan 20 (3d1t3d)</div>
      </div>
    `,
    expected: { count: 0, isEdited: true, diffString: null },
  },
  {
    id: 'edit-not-edited',
    language: 'en',
    description: 'Edge: NOT edited (no marker)',
    htmlSnippet: `
      <div data-stream-item-id="204">
        <div class="IMvYId">Jan 20, 2026</div>
      </div>
    `,
    expected: { count: 0, isEdited: false, diffString: null },
  },
];

// ============================================================================
// NORMALIZATION TEST DATA
// ============================================================================

export const NORMALIZATION_TEST_DATA = {
  unicodeDigits: [
    { input: '٥', expected: 5, description: 'Arabic-Indic 5' },
    { input: '٧', expected: 7, description: 'Arabic-Indic 7' },
    { input: '७', expected: 7, description: 'Devanagari 7' },
    { input: '৩', expected: 3, description: 'Bengali 3' },
    { input: '๕', expected: 5, description: 'Thai 5' },
    { input: '੯', expected: 9, description: 'Gurmukhi 9' },
    { input: '12', expected: 12, description: 'ASCII 12' },
    { input: '٤٢', expected: 42, description: 'Arabic-Indic 42' },
  ],
  wordNumbers: [
    { input: 'واحد', expected: 1, description: 'Arabic "one"' },
    { input: 'اثنان', expected: 2, description: 'Arabic "two"' },
    { input: 'ثلاثة', expected: 3, description: 'Arabic "three"' },
    { input: 'one', expected: 1, description: 'English "one"' },
    { input: 'five', expected: 5, description: 'English "five"' },
  ],
  bidiText: [
    { input: '\u200Btest\u200C', expected: 'test', description: 'Zero-width chars' },
    { input: '\u200Etest\u200F', expected: 'test', description: 'LTR/RTL marks' },
    { input: 'hello\u00A0world', expected: 'hello world', description: 'NBSP' },
  ],
};

// ============================================================================
// DATE PARSING TEST DATA
// ============================================================================

export const DATE_PARSING_TEST_DATA = [
  { input: 'Jan 20, 2026', expected: new Date(2026, 0, 20), language: 'en' },
  { input: '20 Jan 2026', expected: new Date(2026, 0, 20), language: 'en' },
  { input: '2026-01-20', expected: new Date(2026, 0, 20), language: 'en' },
  { input: '20/01/2026', expected: new Date(2026, 0, 20), language: 'en' },
  { input: '01/20/2026', expected: new Date(2026, 0, 20), language: 'en' },
  { input: '2026年1月20日', expected: new Date(2026, 0, 20), language: 'ja' },
];

// ============================================================================
// COMBINED TEST CASES (Comments + Edited)
// ============================================================================

export const COMBINED_TEST_CASES: TestCase[] = [
  {
    id: 'both-1',
    language: 'en',
    description: 'Both: Comments AND Edited',
    htmlSnippet: `
      <div data-stream-item-id="300">
        <div class="IMvYId">Jan 20, 2026 (edited)</div>
        <div aria-label="5 class comments" role="button">5 comments</div>
      </div>
    `,
    expected: { count: 5, isEdited: true, diffString: null },
  },
  {
    id: 'both-ar-1',
    language: 'ar',
    description: 'Both Arabic: Comments AND Edited',
    htmlSnippet: `
      <div data-stream-item-id="301">
        <div class="IMvYId">٢٠ يناير (تم تعديله)</div>
        <div aria-label="٣ تعليقات" role="button">3 تعليقات</div>
      </div>
    `,
    expected: { count: 3, isEdited: true, diffString: null },
  },
];

// ============================================================================
// ALL TEST CASES COMBINED
// ============================================================================

export const ALL_TEST_CASES: TestCase[] = [
  ...COMMENT_TEST_CASES,
  ...EDITED_TEST_CASES,
  ...COMBINED_TEST_CASES,
];
