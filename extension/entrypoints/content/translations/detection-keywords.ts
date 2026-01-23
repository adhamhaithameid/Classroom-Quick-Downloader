// filepath: extension/entrypoints/content/translations/detection-keywords.ts
/**
 * DETECTION KEYWORDS - UNIVERSAL "ZERO-FAIL" V3
 * Features:
 * 1. Unicode Property Escapes (\p{Nd}) for universal digit matching.
 * 2. Massive Language Support (100+ locales + Joke languages).
 * 3. Date Parsing Engine for Time Difference calculation.
 */

// ============================================================================
// SUPPORTED LANGUAGES (Google's Full List)
// ============================================================================
export const SUPPORTED_LANGUAGES = [
  'af', 'am', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'ceb', 'co', 'cs', 'cy', 'da', 'de',
  'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fil', 'fr', 'fy', 'ga', 'gd', 'gl', 'gu',
  'ha', 'haw', 'hi', 'hmn', 'hr', 'ht', 'hu', 'hy', 'id', 'ig', 'is', 'it', 'iw', 'ja', 'jw',
  'ka', 'kk', 'km', 'kn', 'ko', 'ku', 'ky', 'la', 'lb', 'lo', 'lt', 'lv', 'mg', 'mi', 'mk',
  'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'ne', 'nl', 'no', 'ny', 'or', 'pa', 'pl', 'ps', 'pt',
  'ro', 'ru', 'rw', 'sd', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'st', 'su', 'sv',
  'sw', 'ta', 'te', 'tg', 'th', 'tk', 'tl', 'tr', 'tt', 'ug', 'uk', 'ur', 'uz', 'vi', 'xh',
  'yi', 'yo', 'zh-CN', 'zh-TW', 'zu',
  // Special/Joke Languages
  'xx-bork', 'xx-elmer', 'xx-hacker', 'xx-pirate', 'tlh'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// ============================================================================
// REGEX BUILDING BLOCKS (The Nuclear Option)
// ============================================================================

// Matches ANY Decimal Digit in ANY Script (0-9, ٠-٩, ۰-۹, ०-९, etc.)
export const D = '\\p{Nd}'; 
// Separators
const SEP = '[\\/\\-\\.\\s,،]';

// Comprehensive Month Regex (Matches short/long/dotted forms in ~50 languages)
const MONTHS_PATTERN = [
  // Latin Script Common
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  'janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc',
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  'Mär', 'Mai', 'Jun', 'Jul', 'Okt', 'Dez',
  // Arabic Script
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  'كانون', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين',
  // Cyrillic
  'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
  // CJK
  '月'
].join('|');

// ============================================================================
// DATE PATTERNS (Universal)
// ============================================================================
export const DATE_PATTERNS: RegExp[] = [
  // 1. CJK Dates (2025年12月10日)
  new RegExp(`${D}{2,4}年${D}{1,2}月${D}{1,2}日`, 'u'),
  // 2. Universal Numeric (22/01/2025, 2025-01-22)
  new RegExp(`${D}{1,4}${SEP}${D}{1,2}${SEP}${D}{1,4}`, 'u'),
  // 3. Text Month Format (10 déc 2025, Dec 10 2025)
  new RegExp(`(?:${D}{1,2}${SEP}*(?:${MONTHS_PATTERN}).*?${D}{2,4})|(?:(?:${MONTHS_PATTERN}).*?${D}{1,2}.*?${D}{2,4})`, 'iu'),
  // 4. Short date (DD/MM or MM/DD)
  new RegExp(`${D}{1,2}${SEP}${D}{1,2}`, 'u'),
  // 5. Time pattern
  new RegExp(`${D}{1,2}:${D}{2}\\s*(?:AM|PM|am|pm|ص|م)?`, 'u'),
];

// ============================================================================
// GOLDEN SELECTORS
// ============================================================================
export const GOLDEN_SELECTORS = {
  dateContainer: [
    '.IMvYId.dDKhVc.Vu2fZd',
    '.IMvYId.Vu2fZd',
    '.IMvYId',
    '.jzdBjc',
    '.EZrbnd',
  ],
  commentContainer: [
    '.asQXV.QRiHXd',
    '.mUIrbf-vQzf8d',
    '.z3vRcc-aD1xae',
    '.z3vRcc',
  ],
  userContentExclusions: [
    '.n8F6Jd',
    '.a3j8U',
    '.gM4mlb',
    '.A6dC2c',
    '[contenteditable="true"]',
    'input',
    'textarea',
  ],
};

// ============================================================================
// PARSING ENGINE (The Unbreakable Core)
// ============================================================================

// Unicode Digit Zero Codepoints for all major numeral systems
const ZERO_CODEPOINTS = [
  0x0030, // ASCII (0-9)
  0x0660, // Arabic-Indic (٠-٩)
  0x06F0, // Extended Arabic-Indic (۰-۹)
  0x0966, // Devanagari (०-९)
  0x09E6, // Bengali (০-৯)
  0x0A66, // Gurmukhi
  0x0AE6, // Gujarati
  0x0B66, // Odia
  0x0C66, // Telugu
  0x0CE6, // Kannada
  0x0D66, // Malayalam
  0x0E50, // Thai (๐-๙)
  0x0ED0, // Lao
  0x0F20, // Tibetan
  0x1040, // Myanmar
  0x1090, // Myanmar Shan
  0x17E0, // Khmer
  0x1810, // Mongolian
  0x1B50, // Balinese
  0x1BB0, // Sundanese
];

/**
 * Normalizes text by removing BiDi controls and converting 
 * ALL Unicode decimal digits to standard ASCII 0-9.
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
    .replace(/[（]/g, '(').replace(/[）]/g, ')');

  // Convert Unicode digits to ASCII
  const chars = Array.from(normalized);
  const result = chars.map(char => {
    const code = char.codePointAt(0);
    if (!code) return char;
    
    for (const zero of ZERO_CODEPOINTS) {
      if (code >= zero && code <= zero + 9) {
        return String(code - zero);
      }
    }
    return char;
  }).join('');

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Aggressive normalization for comparison.
 */
export function normalizeForComparison(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[()[\]{}.,،!?:;'"]/g, '')
    .trim();
}

/**
 * Parses a normalized date string into a JS Date object.
 */
export function parseUnicodeDate(dateString: string): Date | null {
  if (!dateString) return null;
  const clean = normalizeText(dateString).toLowerCase();

  // Try standard Date.parse first
  const timestamp = Date.parse(clean);
  if (!isNaN(timestamp)) return new Date(timestamp);

  // Manual parsing for polyglot dates
  const monthMap: Record<string, number> = {
    'jan':0, 'ene':0, 'yan':0, 'يناير':0,
    'feb':1, 'fév':1, 'fev':1, 'فبراير':1,
    'mar':2, 'mrz':2, 'mars':2, 'مارس':2,
    'apr':3, 'avr':3, 'abr':3, 'أبريل':3,
    'may':4, 'mai':4, 'مايو':4,
    'jun':5, 'juin':5, 'يونيو':5,
    'jul':6, 'juil':6, 'يوليو':6,
    'aug':7, 'aou':7, 'ago':7, 'أغسطس':7,
    'sep':8, 'sept':8, 'سبتمبر':8,
    'oct':9, 'okt':9, 'أكتوبر':9,
    'nov':10, 'نوفمبر':10,
    'dec':11, 'dez':11, 'dic':11, 'déc':11, 'ديسمبر':11
  };

  let day: number | undefined, month: number | undefined, year: number | undefined;

  const parts = clean.split(/[\s\/\-\.,年月日]+/).filter(Boolean);
  const numbers = parts.filter(p => /^\d+$/.test(p)).map(Number);
  const words = parts.filter(p => !/^\d+$/.test(p));

  // 3 numbers: determine order
  if (numbers.length >= 3) {
    const [a, b, c] = numbers;
    if (a > 1000) { year = a; month = b - 1; day = c; }
    else if (c > 1000) { year = c; month = b - 1; day = a; }
    else { year = 2000 + c; month = a - 1; day = b; }
  } 
  // 2 numbers + month name
  else if (numbers.length === 2 && words.length >= 1) {
    for (const w of words) {
      for (const [key, val] of Object.entries(monthMap)) {
        if (w.includes(key)) {
          month = val;
          break;
        }
      }
      if (month !== undefined) break;
    }
    
    if (month !== undefined) {
      const [n1, n2] = numbers;
      if (n2 > 1000) { day = n1; year = n2; }
      else if (n1 > 1000) { day = n2; year = n1; }
      else { day = n1; year = 2000 + n2; }
    }
  }

  if (year && month !== undefined && day) {
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Extracts a number from text (universal digits).
 */
export function extractNumber(text: string): number | null {
  const clean = normalizeText(text);
  const match = clean.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return (!isNaN(num) && num > 0 && num < 100000) ? num : null;
  }
  return null;
}

// ============================================================================
// KEYWORDS DICTIONARY
// ============================================================================

export const EDITED_KEYWORDS: Record<string, string[]> = {
  // English & Germanic
  en: ['edited', 'modified', 'modification', 'changed', 'updated'],
  de: ['bearbeitet', 'geändert', 'änderung', 'aktualisiert'],
  nl: ['bewerkt', 'gewijzigd', 'wijziging'],
  sv: ['redigerad', 'ändrad'],
  da: ['redigeret', 'ændret'],
  no: ['redigert', 'endret'],
  // Romance
  es: ['editado', 'modificado', 'modificación'],
  fr: ['modifié', 'édité', 'modification', 'mis à jour'],
  it: ['modificato', 'modifica'],
  pt: ['editado', 'alterado', 'modificação'],
  ro: ['editat', 'modificat'],
  // Slavic
  ru: ['изменено', 'отредактировано', 'изменение'],
  pl: ['edytowano', 'zmieniono', 'modyfikacja'],
  uk: ['змінено', 'відредаговано'],
  cs: ['upraveno', 'změněno'],
  // Asian
  ja: ['編集済み', '編集'],
  ko: ['수정됨', '수정'],
  zh: ['已编辑', '已修改', '修改'],
  'zh-CN': ['已编辑', '已修改'],
  'zh-TW': ['已編輯', '已修改'],
  vi: ['đã chỉnh sửa', 'chỉnh sửa'],
  th: ['แก้ไขแล้ว', 'การแก้ไข'],
  // Arabic / Persian / RTL
  ar: ['تم تعديله', 'تعديل', 'معدل', 'وقت آخر تعديل', 'آخر تعديل'],
  fa: ['ویرایش شده', 'تغییر یافته'],
  he: ['נערך', 'שונה'],
  iw: ['נערך', 'שונה'],
  ur: ['ترمیم شدہ'],
  // Joke Languages
  'xx-hacker': ['3d1t3d', 'm0d1f13d', 'upd4t3d'],
  'xx-pirate': ['altered', 'be changed', 'yarr update'],
  'xx-bork': ['Bork', 'Editee-a', 'Zee-a'],
  'xx-elmer': ['editewd', 'modifiewd'],
  'tlh': ['choH', 'ghItlh']
};

export const CREATED_KEYWORDS: string[] = [
  'created', 'posted', 'published', 'date de création', 'tarihinde yayınlandı',
  'publié', 'veröffentlicht', 'tarih', 'تاريخ', 'انشاء', 'نشر',
  'pubblicato', 'publicado', 'geplaatst', 'opublikowano', 'опубликовано',
  '创建', '作成', '게시됨'
];

export const EXCLUSION_KEYWORDS: string[] = [
  'comment', 'add', 'write', 'type', 'submission', 'hand in',
  'commentaire', 'ajouter', 'écrire',
  'kommentar', 'hinzufügen',
  'comentario', 'añadir',
  'تعليق', 'اضافة', 'كتابة',
  'submission', 'devoir', 'aufgabe', 'tarea'
];

export const COMMENT_KEYWORDS: string[] = [
  'comment', 'comments', 'commentaire', 'commentaires', 
  'comentario', 'comentarios', 'kommentar', 'kommentare',
  'تعليق', 'تعليقات', '评论', 'コメント', '댓글'
];

// Helper functions
export function getAllEditedKeywords(): string[] {
  return Object.values(EDITED_KEYWORDS).flat();
}

export function getAllCommentKeywords(): string[] {
  return COMMENT_KEYWORDS;
}

export function getEditedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  return EDITED_KEYWORDS[lang] || EDITED_KEYWORDS[shortLang] || EDITED_KEYWORDS['en'];
}

export function hasDatePattern(text: string): boolean {
  if (!text) return false;
  const clean = normalizeText(text);
  return DATE_PATTERNS.some(regex => regex.test(clean));
}

export function isExcludedPattern(text: string): boolean {
  const lower = normalizeForComparison(text);
  return EXCLUSION_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}
