// filepath: entrypoints/content/detection-keywords.ts
/**
 * DETECTION KEYWORDS - Universal Tier Architecture
 * 
 * KEY UPGRADES:
 * 1. Unicode Property Escapes (\p{Nd}) for any script's decimal digits
 * 2. 100+ languages including joke languages (Pirate, Hacker, Bork, etc.)
 * 3. Script-based keyword grouping for efficiency
 * 4. BiDi control character stripping
 */

// ============================================================================
// UNICODE PROPERTY ESCAPES - THE NUCLEAR REGEX
// \p{Nd} matches decimal digits in ANY human script automatically
// ============================================================================

/** Universal decimal digit pattern - matches ANY script's digits (0-9, ٠-٩, ०-९, etc.) */
export const D = '\\p{Nd}';

/** Pre-compiled regex for universal digit matching */
export const UNIVERSAL_DIGIT_REGEX = new RegExp(`[${D}]`, 'gu');

// ============================================================================
// BIDI CONTROL CHARACTERS TO STRIP
// ============================================================================

const BIDI_CONTROL_CHARS: RegExp = new RegExp(
  '[' +
    '\u200B\u200C\u200D' + // Zero-width spaces/joiners
    '\u200E\u200F' +       // LTR/RTL marks
    '\u202A-\u202E' +      // Directional embeddings/overrides
    '\u2066-\u2069' +      // Isolates
    '\u061C' +             // Arabic Letter Mark
    '\uFEFF' +             // BOM
    '\u00AD' +             // Soft hyphen
  ']',
  'gu'
);

const WHITESPACE_VARIANTS: RegExp = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu;

// ============================================================================
// TEXT NORMALIZATION ENGINE
// ============================================================================

/**
 * Normalizes text by stripping invisible BiDi control characters.
 * ALL scanning MUST pass through this function.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(BIDI_CONTROL_CHARS, '')
    .replace(WHITESPACE_VARIANTS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aggressive normalization for comparison (lowercase, no punctuation).
 */
export function normalizeForComparison(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[()[\]{}.,،!?:;'"]/g, '')
    .trim();
}

// ============================================================================
// UNICODE INTEGER PARSING
// JavaScript's parseInt() does NOT handle Unicode digits (e.g., parseInt('٥') is NaN)
// Also handles word-numbers like Arabic "واحد" (one), "اثنان" (two)
// ============================================================================

/**
 * Word-number mappings for languages that use words instead of digits for small counts
 * This is critical for Arabic where "تعليق واحد" (one comment) uses the word "واحد"
 */
const WORD_NUMBERS: Record<string, number> = {
  // Arabic
  'واحد': 1, 'واحدة': 1,  // one (masculine/feminine)
  'اثنان': 2, 'اثنين': 2, 'اثنتان': 2, 'اثنتين': 2,  // two
  'ثلاثة': 3, 'ثلاث': 3,  // three
  'أربعة': 4, 'أربع': 4,  // four
  'خمسة': 5, 'خمس': 5,    // five
  'ستة': 6, 'ست': 6,      // six
  'سبعة': 7, 'سبع': 7,    // seven
  'ثمانية': 8, 'ثماني': 8, 'ثمان': 8,  // eight
  'تسعة': 9, 'تسع': 9,    // nine
  'عشرة': 10, 'عشر': 10,  // ten
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  // Spanish & French (shared: un/una)
  'un': 1, 'uno': 1, 'una': 1, 'une': 1, 'dos': 2, 'deux': 2, 
  'tres': 3, 'trois': 3, 'cuatro': 4, 'quatre': 4, 'cinco': 5, 'cinq': 5,
  // German
  'ein': 1, 'eine': 1, 'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5,
  // Hebrew
  'אחד': 1, 'אחת': 1, 'שניים': 2, 'שתיים': 2, 'שלושה': 3, 'שלוש': 3,
};

/**
 * Parse word-numbers from text
 */
function parseWordNumber(text: string): number | null {
  const normalized = normalizeForComparison(text);
  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (normalized.includes(word.toLowerCase())) {
      return value;
    }
  }
  return null;
}

/**
 * Maps any Unicode decimal digit to its integer value (0-9).
 * Handles all Unicode numeric scripts by finding the base codepoint of the block.
 * 
 * Unicode digit blocks are sequences of 10 consecutive codepoints (0-9).
 * To find the digit value: char.codePointAt(0) - blockBase
 */
function unicodeDigitToInt(char: string): number {
  const code = char.codePointAt(0);
  if (code === undefined) return -1;
  
  // Known digit block base codepoints (the "zero" character of each script)
  const DIGIT_BLOCKS: Array<[number, number]> = [
    [0x0030, 0x0039], // ASCII: 0-9
    [0x0660, 0x0669], // Arabic-Indic: ٠-٩
    [0x06F0, 0x06F9], // Extended Arabic-Indic: ۰-۹ (Persian)
    [0x0966, 0x096F], // Devanagari: ०-९
    [0x09E6, 0x09EF], // Bengali: ০-৯
    [0x0A66, 0x0A6F], // Gurmukhi: ੦-੯
    [0x0AE6, 0x0AEF], // Gujarati: ૦-૯
    [0x0B66, 0x0B6F], // Oriya: ୦-୯
    [0x0BE6, 0x0BEF], // Tamil: ௦-௯
    [0x0C66, 0x0C6F], // Telugu: ౦-౯
    [0x0CE6, 0x0CEF], // Kannada: ೦-೯
    [0x0D66, 0x0D6F], // Malayalam: ൦-൯
    [0x0E50, 0x0E59], // Thai: ๐-๙
    [0x0ED0, 0x0ED9], // Lao: ໐-໙
    [0x0F20, 0x0F29], // Tibetan: ༠-༩
    [0x1040, 0x1049], // Myanmar: ၀-၉
    [0x17E0, 0x17E9], // Khmer: ០-៩
    [0x1810, 0x1819], // Mongolian: ᠐-᠙
    [0xFF10, 0xFF19], // Fullwidth: ０-９
  ];
  
  for (const [start, end] of DIGIT_BLOCKS) {
    if (code >= start && code <= end) {
      return code - start;
    }
  }
  
  return -1;
}

/**
 * Parses any Unicode number string to an integer.
 * Handles Devanagari (०-९), Bengali (০-৯), Thai (๐-๙), Arabic numerals (٠-٩), etc.
 * Also handles word-numbers like Arabic "واحد" (one), "اثنان" (two)
 */
export function parseUnicodeInteger(text: string): number | null {
  if (!text) return null;
  
  const normalized = normalizeText(text);
  
  // First, try to extract numeric digits
  const digitMatches = normalized.match(new RegExp(`[${D}]+`, 'gu'));
  if (digitMatches && digitMatches.length > 0) {
    // Take the first numeric sequence
    const digitSequence = digitMatches[0];
    
    // Convert each Unicode digit to its integer value
    let result = 0;
    for (const char of digitSequence) {
      const digitValue = unicodeDigitToInt(char);
      if (digitValue < 0) break; // Invalid digit
      result = result * 10 + digitValue;
    }
    
    if (result > 0 && result < 100000) {
      return result;
    }
  }
  
  // Fallback: Try word-number parsing (for Arabic "واحد", etc.)
  const wordNumber = parseWordNumber(normalized);
  if (wordNumber !== null) {
    return wordNumber;
  }
  
  return null;
}

/**
 * Legacy alias for backward compatibility
 */
export const extractNumber = parseUnicodeInteger;

// ============================================================================
// DATE PARSING ENGINE (V3 Hover Intelligence)
// ============================================================================

/** Month name mappings (multilingual) */
const MONTH_MAP: Record<string, number> = {
  // English
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  // French (unique keys only)
  janv:0, févr:1, mars:2, avr:3, mai:4, juin:5, juil:6, août:7, sept:8, déc:11,
  // Spanish
  ene:0, abr:3, ago:7, dic:11,
  // German
  mär:2, okt:9, dez:11,
  // Arabic
  'يناير':0, 'فبراير':1, 'مارس':2, 'أبريل':3, 'مايو':4, 'يونيو':5, 
  'يوليو':6, 'أغسطس':7, 'سبتمبر':8, 'أكتوبر':9, 'نوفمبر':10, 'ديسمبر':11,
  'كانون':0, 'شباط':1, 'آذار':2, 'نيسان':3, 'أيار':4, 'حزيران':5,
  'تموز':6, 'آب':7, 'أيلول':8, 'تشرين':9,
};

/**
 * Parses a localized date string into a JS Date.
 * Returns {date, raw, confidence} or null.
 */
export function parseUnicodeDate(dateString: string): { date: Date; raw: string; confidence: 'high' | 'medium' | 'low' } | null {
  if (!dateString) return null;

  // NOTE: Avoid Date.parse to prevent local-time interpretation. We parse into UTC manually.

  // Extract all digit sequences
  const normalized = normalizeText(dateString).toLowerCase();
  const parts = normalized.split(/[\s\/\-\.,،年月日]+/).filter(Boolean);
  const numbers = parts.map(p => {
    const n = parseUnicodeInteger(p);
    return n !== null ? n : NaN;
  }).filter(n => !isNaN(n));
  
  const words = parts.filter(p => parseUnicodeInteger(p) === null);

  let day: number | undefined, month: number | undefined, year: number | undefined;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // 3 numbers: try to infer format
  if (numbers.length >= 3) {
    const [a, b, c] = numbers;
    if (a > 1000) {
      year = a; month = b - 1; day = c;
      confidence = 'high'; // ISO-like (YYYY-MM-DD)
    } // YYYY-MM-DD
    else if (c > 1000) { year = c; month = b - 1; day = a; } // DD-MM-YYYY
    else if (c > 31) { year = c + 2000; month = a - 1; day = b; } // MM/DD/YY
    else { year = c + 2000; month = b - 1; day = a; } // DD/MM/YY
  }
  // 2 numbers + month name
  else if (numbers.length === 2 && words.length >= 1) {
    for (const w of words) {
      for (const [key, val] of Object.entries(MONTH_MAP)) {
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
      else { day = n1; year = n2 > 31 ? n2 + 2000 : 2020 + n2; }
    }
  }

  if (year && month !== undefined && day) {
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) {
      return { date: d, raw: dateString, confidence };
    }
  }

  return null;
}

/**
 * Formats milliseconds into human-readable duration for Hover Intelligence.
 */
export function formatTimeDifference(ms: number): string {
  if (ms <= 0) return '';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'just now';
}

// ============================================================================
// SUPPORTED LANGUAGES (100+ including joke languages)
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  // Major world languages
  'en', 'ar', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ja', 'ko', 'zh', 'zh-TW', 'zh-HK',
  // European
  'nl', 'pl', 'sv', 'da', 'no', 'nn', 'fi', 'cs', 'sk', 'hu', 'ro', 'bg', 'uk', 'be',
  'sr', 'sr-Latn', 'hr', 'bs', 'sl', 'mk', 'sq', 'el', 'tr', 'az', 'ka', 'hy',
  'lv', 'lt', 'et', 'is', 'mt', 'ga', 'cy', 'gd', 'br', 'eu', 'gl', 'ca', 'oc',
  'rm', 'fo', 'lb', 'fy',
  // Asian
  'vi', 'th', 'lo', 'km', 'my', 'id', 'ms', 'tl', 'jv', 'su', 'ceb',
  'hi', 'bn', 'pa', 'gu', 'or', 'ta', 'te', 'kn', 'ml', 'si', 'ne', 'mr', 'sa', 'as',
  'bh', // Bhojpuri
  // Middle Eastern
  'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'ug', 'ckb',
  // African
  'sw', 'am', 'ti', 'ha', 'yo', 'ig', 'zu', 'xh', 'sn', 'st', 'tn', 'nso', 'rw', 'ny',
  'lg', 'ln', 'kg', 'bem', 'loz', 'lu', 'run', 'rn', 'wo', 'ak', 'gaa', 'ee', 'kri',
  'pcm', // Nigerian Pidgin
  'crs', // Seychellois Creole
  'mfe', // Mauritian Creole
  'ht', // Haitian Creole
  // Pacific
  'mi', 'haw', 'sm', 'to', 'fj',
  // Other
  'eo', 'ia', 'la', 'qu', 'gn', 'mg', 'co', 'chr',
  // Central Asian
  'kk', 'ky', 'uz', 'tk', 'tg', 'mn',
  // Yiddish
  'yi',
  // Joke languages
  'xx-bork',   // Bork, bork, bork! (Swedish Chef)
  'xx-elmer',  // Elmer Fudd
  'xx-hacker', // 1337 H4X0R
  'xx-pirate', // Pirate
  'tlh',       // Klingon
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// ============================================================================
// COMMENT KEYWORDS - GROUPED BY SCRIPT FOR EFFICIENCY
// ============================================================================

export interface CommentKeywords {
  singular: string[];
  plural: string[];
  classComment: string[];
}

// Script-based keyword groups
const COMMENT_KEYWORDS_LATIN: Record<string, CommentKeywords> = {
  en: { singular: ['comment'], plural: ['comments'], classComment: ['class comment', 'class comments'] },
  es: { singular: ['comentario'], plural: ['comentarios'], classComment: ['comentario de clase'] },
  fr: { singular: ['commentaire'], plural: ['commentaires'], classComment: ['commentaire de classe'] },
  de: { singular: ['kommentar'], plural: ['kommentare'], classComment: ['klassenkommentar'] },
  pt: { singular: ['comentário'], plural: ['comentários'], classComment: ['comentário da turma'] },
  it: { singular: ['commento'], plural: ['commenti'], classComment: ['commento della classe'] },
  nl: { singular: ['opmerking'], plural: ['opmerkingen'], classComment: ['klasopmerking'] },
  pl: { singular: ['komentarz'], plural: ['komentarze', 'komentarzy'], classComment: ['komentarz klasy'] },
  cs: { singular: ['komentář'], plural: ['komentáře', 'komentářů'], classComment: ['komentář třídy'] },
  ro: { singular: ['comentariu'], plural: ['comentarii'], classComment: ['comentariu lecție'] },
  tr: { singular: ['yorum'], plural: ['yorum'], classComment: ['sınıf yorumu'] },
  vi: { singular: ['bình luận'], plural: ['bình luận'], classComment: ['bình luận lớp học'] },
  id: { singular: ['komentar'], plural: ['komentar'], classComment: ['komentar kelas'] },
  ms: { singular: ['komen'], plural: ['komen'], classComment: ['komen kelas'] },
  tl: { singular: ['komento'], plural: ['mga komento'], classComment: ['komento ng klase'] },
  sw: { singular: ['maoni'], plural: ['maoni'], classComment: ['maoni ya darasa'] },
  'xx-pirate': { singular: ['comment', 'yarr'], plural: ['comments'], classComment: ['crew comment'] },
  'xx-bork': { singular: ['kumment', 'bork'], plural: ['kumments'], classComment: ['cless kumment'] },
  'xx-elmer': { singular: ['comment', 'commentw'], plural: ['commentws'], classComment: ['cwass comment'] },
  'xx-hacker': { singular: ['c0mm3nt', 'comm3nt'], plural: ['c0mm3nt5'], classComment: ['c14ss c0mm3nt'] },
};

const COMMENT_KEYWORDS_CYRILLIC: Record<string, CommentKeywords> = {
  ru: { singular: ['комментарий'], plural: ['комментария', 'комментариев', 'комментарии'], classComment: ['комментарий класса'] },
  uk: { singular: ['коментар'], plural: ['коментарі', 'коментарів'], classComment: ['коментар класу'] },
  be: { singular: ['каментарый'], plural: ['каментарыі', 'каментарыяў'], classComment: ['каментарый класа'] },
  bg: { singular: ['коментар'], plural: ['коментара', 'коментари'], classComment: ['коментар на клас'] },
  sr: { singular: ['коментар'], plural: ['коментара', 'коментари'], classComment: ['коментар одељења'] },
  mk: { singular: ['коментар'], plural: ['коментари'], classComment: ['коментар на класот'] },
  kk: { singular: ['пікір'], plural: ['пікірлер'], classComment: ['сынып пікірі'] },
  ky: { singular: ['комментарий'], plural: ['комментарийлер'], classComment: ['класс комментарийи'] },
  mn: { singular: ['сэтгэгдэл'], plural: ['сэтгэгдлүүд'], classComment: ['ангийн сэтгэгдэл'] },
  tg: { singular: ['шарҳ'], plural: ['шарҳҳо'], classComment: ['шарҳи синф'] },
};

const COMMENT_KEYWORDS_ARABIC: Record<string, CommentKeywords> = {
  ar: { 
    singular: [
      'تعليق', 'تعليق واحد', 'تعليق صفي', 'ردّ', 'رد',
    ], 
    plural: [
      'تعليقات', 'تعليقًا', 'تعليقين', 'ردود',
    ], 
    classComment: [
      'تعليق صف', 'تعليقات الصف', 'تعليق واحد من الصف', 'تعليقات صفية',
      'تعليق صف واحد', 'تعليق الصف', 'تعليقات صف', 'من الصف',
    ] 
  },
  fa: { singular: ['نظر'], plural: ['نظرات'], classComment: ['نظر کلاس'] },
  ur: { singular: ['تبصرہ'], plural: ['تبصرے'], classComment: ['کلاس تبصرہ'] },
  ps: { singular: ['تبصره'], plural: ['تبصرې'], classComment: ['ټولګي تبصره'] },
  ug: { singular: ['ئىنكاس'], plural: ['ئىنكاسلار'], classComment: ['سىنىپ ئىنكاسى'] },
  ckb: { singular: ['لێدوان'], plural: ['لێدوانەکان'], classComment: ['لێدوانی پۆل'] },
};

const COMMENT_KEYWORDS_DEVANAGARI: Record<string, CommentKeywords> = {
  hi: { singular: ['टिप्पणी'], plural: ['टिप्पणियां', 'टिप्पणियाँ'], classComment: ['क्लास टिप्पणी'] },
  mr: { singular: ['प्रतिक्रिया'], plural: ['प्रतिक्रिया'], classComment: ['वर्ग प्रतिक्रिया'] },
  ne: { singular: ['टिप्पणी'], plural: ['टिप्पणीहरू'], classComment: ['कक्षा टिप्पणी'] },
  sa: { singular: ['टिप्पणी'], plural: ['टिप्पण्यः'], classComment: ['वर्ग टिप्पणी'] },
};

const COMMENT_KEYWORDS_CJK: Record<string, CommentKeywords> = {
  zh: { singular: ['评论', '留言'], plural: ['评论', '条评论'], classComment: ['课堂评论', '班级评论'] },
  'zh-TW': { singular: ['評論', '留言'], plural: ['則評論'], classComment: ['課堂評論'] },
  ja: { singular: ['コメント'], plural: ['コメント'], classComment: ['クラスのコメント'] },
  ko: { singular: ['댓글'], plural: ['댓글'], classComment: ['수업 댓글'] },
};

const COMMENT_KEYWORDS_OTHER: Record<string, CommentKeywords> = {
  he: { singular: ['תגובה'], plural: ['תגובות'], classComment: ['תגובת כיתה'] },
  th: { singular: ['ความคิดเห็น'], plural: ['ความคิดเห็น'], classComment: ['ความคิดเห็นของชั้นเรียน'] },
  el: { singular: ['σχόλιο'], plural: ['σχόλια'], classComment: ['σχόλιο τάξης'] },
  ka: { singular: ['კომენტარი'], plural: ['კომენტარები'], classComment: ['კლასის კომენტარი'] },
  hy: { singular: ['մեկdelays'], plural: ['մegdelays'], classComment: ['delays'] },
  am: { singular: ['አስተያየት'], plural: ['አስተያየቶች'], classComment: ['የክፍል አስተያየት'] },
  bn: { singular: ['মন্তব্য'], plural: ['মন্তव्यগুলি'], classComment: ['ক্লাس মন্তব্য'] },
  ta: { singular: ['கருத்து'], plural: ['கருத்துகள்'], classComment: ['வகுப்பு கருத்து'] },
  te: { singular: ['వ్యాఖ్య'], plural: ['వ్యాఖ్యలు'], classComment: ['తరಗತಿ వ్యాఖ్య'] },
  kn: { singular: ['ಕಾಮೆಂಟ್'], plural: ['ಕಾಮೆಂಟ್‌ಗಳು'], classComment: ['ತರಗತಿ ಕಾಮೆಂಟ್'] },
  ml: { singular: ['അഭിപ്രായം'], plural: ['അഭിപ്രായങ್ങൾ'], classComment: ['ക്ലാസ് അഭിപ്രായം'] },
  si: { singular: ['අදහස'], plural: ['අදහස්'], classComment: ['පන්ති අදහස'] },
  my: { singular: ['မှတ်ချက်'], plural: ['မှတ်ချက်များ'], classComment: ['အတန်းမှတ်ချက်'] },
  km: { singular: ['មតិយោបល់'], plural: ['មតិយោបល់'], classComment: ['មតិយោបល់ថ្នាក់'] },
  lo: { singular: ['ຄຳເຫັນ'], plural: ['ຄຳເຫັນ'], classComment: ['ຄຳເຫັນຂອງຫ້ອງຮຽນ'] },
  tlh: { singular: ['QIn'], plural: ['QInmey'], classComment: ['ghom QIn'] }, // Klingon
};

// Merge all keyword groups
export const COMMENT_KEYWORDS: Record<string, CommentKeywords> = {
  ...COMMENT_KEYWORDS_LATIN,
  ...COMMENT_KEYWORDS_CYRILLIC,
  ...COMMENT_KEYWORDS_ARABIC,
  ...COMMENT_KEYWORDS_DEVANAGARI,
  ...COMMENT_KEYWORDS_CJK,
  ...COMMENT_KEYWORDS_OTHER,
};

// ============================================================================
// EDITED KEYWORDS - INCLUDES NOUN FORMS + JOKE LANGUAGES
// ============================================================================

const EDITED_KEYWORDS_LATIN: Record<string, string[]> = {
  en: ['edited', '(edited)', 'modified', 'last modified', 'modification', 'edit', 'last edit'],
  es: ['editado', 'modificado', 'modificación', 'última modificación', 'edición'],
  fr: ['modifié', 'modification', 'dernière modification', 'édité', 'édition'],
  de: ['bearbeitet', 'geändert', 'änderung', 'bearbeitung', 'letzte änderung'],
  pt: ['editado', 'modificado', 'modificação', 'última modificação'],
  it: ['modificato', 'modifica', 'ultima modifica', 'modificazione'],
  nl: ['bewerkt', 'gewijzigd', 'wijziging', 'bewerking'],
  pl: ['edytowano', 'zmieniono', 'modyfikacja', 'zmiana', 'edycja'],
  cs: ['upraveno', 'změněno', 'úprava', 'změna'],
  ro: ['editat', 'modificat', 'modificare', 'ultima modificare'],
  tr: ['düzenlendi', 'değiştirildi', 'düzenleme', 'değişiklik'],
  vi: ['đã chỉnh sửa', 'sửa đổi', 'chỉnh sửa'],
  id: ['diedit', 'diubah', 'perubahan', 'pengeditan'],
  ms: ['disunting', 'diubah', 'suntingan'],
  tl: ['na-edit', 'binago', 'pagbabago'],
  sw: ['imehaririwa', 'imebadilishwa', 'mabadiliko'],
  // JOKE LANGUAGES
  'xx-pirate': ['altered', 'be changed', 'yarr update', 'modified by the crew'],
  'xx-bork': ['Bork', 'Editee-a', 'Zee-a', 'moodeefied'],
  'xx-elmer': ['editewd', 'modifiewd', 'changed by wabbit'],
  'xx-hacker': ['3d1t3d', 'm0d1f13d', 'upd4t3d', 'ch4ng3d', 'h4x0r3d'],
};

const EDITED_KEYWORDS_CYRILLIC: Record<string, string[]> = {
  ru: ['изменено', 'отредактировано', 'редактирование', 'изменение', 'правка'],
  uk: ['відредаговано', 'змінено', 'редагування', 'зміна'],
  be: ['адрэдагавана', 'зменена', 'змена'],
  bg: ['редактирано', 'променено', 'промяна', 'редакция'],
  sr: ['измењено', 'уређено', 'измена', 'уређивање'],
  mk: ['уредено', 'изменето', 'измена', 'уредување'],
  kk: ['өңделді', 'өзгертілді', 'өзгеріс', 'өңдеу'],
  ky: ['оңдолду', 'өзгөртүлдү', 'өзгөртүү'],
  mn: ['засварласан', 'өөрчилсөн', 'өөрчлөлт', 'засвар'],
  tg: ['таҳрир шуд', 'тағйир ёфт', 'тағйирот'],
};

const EDITED_KEYWORDS_ARABIC: Record<string, string[]> = {
  ar: ['تم تعديله', 'تم التعديل', 'معدل', 'وقت آخر تعديل', 'آخر تعديل', 'تعديل', 'التعديل'],
  fa: ['ویرایش شد', 'آخرین ویرایش', 'ویرایش', 'تغییر'],
  ur: ['ترمیم شدہ', 'تبدیل شدہ', 'ترمیم'],
  ps: ['سمون شوی', 'بدلون', 'سمون'],
  ug: ['تەھرىرلەندى', 'ئۆزگەرتىلدى', 'تەھرىر'],
  ckb: ['دەستکاری کرا', 'گۆڕانکاری', 'دەستکاری'],
};

const EDITED_KEYWORDS_DEVANAGARI: Record<string, string[]> = {
  hi: ['संपादित', 'बदला गया', 'संपादन', 'परिवर्तन', 'अंतिम संपादन'],
  mr: ['संपादित', 'बदललेले', 'संपादन', 'बदल'],
  ne: ['सम्पादन गरियो', 'परिवर्तन', 'सम्पादन'],
  sa: ['संपादितम्', 'परिवर्तितम्', 'संपादनम्'],
};

const EDITED_KEYWORDS_CJK: Record<string, string[]> = {
  zh: ['已编辑', '已修改', '编辑', '修改', '更改', '最后编辑'],
  'zh-TW': ['已編輯', '已修改', '編輯', '修改', '最後編輯'],
  ja: ['編集済み', '編集しました', '編集', '変更', '最終編集'],
  ko: ['수정됨', '수정함', '수정', '편집', '마지막 수정'],
};

const EDITED_KEYWORDS_OTHER: Record<string, string[]> = {
  he: ['נערך', 'עריכה אחרונה', 'עריכה', 'שינוי'],
  th: ['แก้ไขแล้ว', 'แก้ไขล่าสุด', 'การแก้ไข'],
  el: ['επεξεργάστηκε', 'τροποποιήθηκε', 'τροποποίηση', 'επεξεργασία'],
  ka: ['რედაქტირებულია', 'შეცვლილია', 'რედაქტირება', 'ცვლილება'],
  hy: ['խdelays', 'փdelays', 'խdelays'],
  am: ['ተስተካክል', 'ተቀይሮ', 'አርትዕ', 'ለውጥ'],
  bn: ['সম্পাদিত', 'পরিবর্তিত', 'সম্পাদনা'],
  ta: ['திருத்தப்பட்டது', 'மாற்றப்பட்டது', 'திருத்தம்'],
  te: ['సవరించబడింది', 'మార్చబడింది', 'సవరణ'],
  kn: ['ಸಂಪಾದಿಸಲಾಗಿದೆ', 'ಬದಲಾಯಿಸಲಾಗಿದೆ', 'ಸಂಪಾದನೆ'],
  ml: ['എഡിറ്റ് ചെയ്തു', 'മാറ്റി', 'എഡിറ്റ്'],
  si: ['සංස්කරණය කළා', 'වෙනස් කළා', 'සංස්කරණය'],
  my: ['တည်းဖြတ်ပြီး', 'ပြင်ဆင်ပြီး', 'တည်းဖြတ်'],
  km: ['បានកែសម្រួល', 'បានកែប្រែ', 'កែសម្រួល'],
  lo: ['ແກ້ໄຂແລ້ວ', 'ປ່ຽນແປງແລ້ວ', 'ການແກ້ໄຂ'],
  tlh: ['choHta\'', 'mughta\'', 'choH'], // Klingon
};

// Merge all edited keyword groups
export const EDITED_KEYWORDS: Record<string, string[]> = {
  ...EDITED_KEYWORDS_LATIN,
  ...EDITED_KEYWORDS_CYRILLIC,
  ...EDITED_KEYWORDS_ARABIC,
  ...EDITED_KEYWORDS_DEVANAGARI,
  ...EDITED_KEYWORDS_CJK,
  ...EDITED_KEYWORDS_OTHER,
};

// ============================================================================
// EXCLUSION PATTERNS
// ============================================================================

export const COMMENT_EXCLUSION_PATTERNS: string[] = [
  'add comment', 'add a comment', 'write a comment', 'leave a comment',
  'add class comment', 'type a comment', 'post a comment',
  'اضافة تعليق', 'إضافة تعليق', 'أضف تعليق',
  'ajouter un commentaire', 'kommentar hinzufügen', 'добавить комментарий',
  'コメントを追加', '댓글 추가', '添加评论', 'הוסף תגובה',
];

export const EDITED_EXCLUSION_PATTERNS: string[] = [
  'can be edited', 'should be edited', 'needs to be edited',
  'i edited', 'you edited', 'editing', 'to edit', 'editor', 'editorial',
  'قم بالتعديل', 'يمكن التعديل',
];

// ============================================================================
// DATE PATTERNS WITH UNICODE PROPERTY ESCAPES
// Uses \p{Nd} for universal digit matching
// ============================================================================

export const DATE_PATTERNS: RegExp[] = [
  // European: DD MMM. YYYY with universal digits
  new RegExp(`${D}{1,2}\\s+\\w{3,9}\\.?\\s+${D}{2,4}`, 'iu'),
  // American: MMM DD, YYYY
  new RegExp(`\\w{3,9}\\.?\\s+${D}{1,2}[,،]?\\s*${D}{2,4}`, 'iu'),
  // Numeric: DD/MM/YYYY (universal digits)
  new RegExp(`${D}{1,4}[/\\-.]${D}{1,2}[/\\-.]${D}{1,4}`, 'u'),
  // Short: DD/MM
  new RegExp(`${D}{1,2}[/\\-.]${D}{1,2}`, 'u'),
  // Relative dates (multilingual)
  /\b(?:today|yesterday|aujourd'hui|hier|hoy|ayer|heute|gestern|oggi|ieri|vandaag|gisteren|اليوم|أمس|oggi|昨日|어제|昨天|сегодня|вчера)\b/iu,
  // Time: HH:MM with universal digits
  new RegExp(`${D}{1,2}:${D}{2}\\s*(?:AM|PM|am|pm|ص|م)?`, 'u'),
];

// ============================================================================
// GOLDEN SELECTORS
// ============================================================================

export const GOLDEN_SELECTORS = {
  dateContainer: [
    // Stream tab selectors
    '.JZk9qf.Vu2fZd',  // Primary: contains "Feb 28 (Edited Feb 28)" — parent of .jzdBjc
    '.JZk9qf',          // Fallback: the date/deleted marker container
    '.IMvYId.dDKhVc.Vu2fZd',
    '.IMvYId.Vu2fZd',
    '.IMvYId',
    '.jzdBjc',
    '.EZrbnd',
    // Classwork tab selectors (expanded post content area)
    '.vGGYOe.Vu2fZd',  // "Posted Dec 10, 2025 (Edited Dec 14, 2025)"
    '.vGGYOe',
    'li[data-stream-item-id] .Vu2fZd',
  ],
  commentContainer: [
    // Primary selectors (current Classroom structure - Stream tab)
    '.asQXV.QRiHXd',
    '.mUIrbf-vQzf8d',
    '.z3vRcc-aD1xae',
    '.z3vRcc',
    // Classwork tab selectors (comment indicator in header)
    '.qCWAqb.seqYL',  // Comment indicator with google-symbols icon
    '.qCWAqb',
    '.huI6Cb.Cx437e', // Container with comment icon and count
    'li[data-stream-item-id] .seqYL',
    // Additional potential selectors
    '[data-stream-item-id] .asQXV',
    '[jsname="z3vRcc"]',
    '[jscontroller] .QRiHXd',
    // Click area / comment button selectors
    '.yqQS0c',
    '.gVJHxe',
    // Semantic fallbacks
    '[aria-label*="comment"]',
    '[aria-label*="Comment"]',
    '[aria-label*="تعليق"]',
    '[aria-label*="コメント"]',
    '[aria-label*="评论"]',
    '[aria-label*="комментар"]',
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

export const USER_CONTENT_EXCLUSIONS_SELECTOR = GOLDEN_SELECTORS.userContentExclusions.join(',');
export const USER_CONTENT_EXCLUSIONS_TOP4_SELECTOR = GOLDEN_SELECTORS.userContentExclusions.slice(0, 4).join(',');

// ============================================================================
// CONFIDENCE WEIGHTS
// ============================================================================

export const CONFIDENCE_WEIGHTS = {
  LAYER_1_GOLDEN: 40,
  LAYER_2_SEMANTIC: 35,
  LAYER_3_STRUCTURAL: 20,
  LAYER_4_EXCLUSION: -25,
  HIGH_CONFIDENCE: 60,
  MEDIUM_CONFIDENCE: 35,
  LOW_CONFIDENCE: 15,
  DATE_PROXIMITY_BONUS: 10,
  NUMBER_PRESENT_BONUS: 5,
  ARIA_MATCH_BONUS: 15,
  PARENT_CONTEXT_BONUS: 5,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCommentKeywords(lang: string): CommentKeywords {
  const shortLang = lang.split('-')[0].toLowerCase();
  const fullLang = lang.toLowerCase();
  return COMMENT_KEYWORDS[fullLang] || COMMENT_KEYWORDS[shortLang] || COMMENT_KEYWORDS['en'];
}

const combinedCommentKeywordsCache = new Map<string, CommentKeywords>();

export function getCombinedCommentKeywords(lang: string): CommentKeywords {
  if (combinedCommentKeywordsCache.has(lang)) {
    return combinedCommentKeywordsCache.get(lang)!;
  }

  const keywords = getCommentKeywords(lang);
  const englishKeywords = getCommentKeywords('en');
  const arabicKeywords = getCommentKeywords('ar');

  const combined: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...englishKeywords.singular, ...arabicKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...englishKeywords.plural, ...arabicKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...englishKeywords.classComment, ...arabicKeywords.classComment])],
  };

  combinedCommentKeywordsCache.set(lang, combined);
  return combined;
}

export function getEditedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  const fullLang = lang.toLowerCase();
  return EDITED_KEYWORDS[fullLang] || EDITED_KEYWORDS[shortLang] || EDITED_KEYWORDS['en'];
}

const combinedEditedKeywordsCache = new Map<string, string[]>();

export function getCombinedEditedKeywords(lang: string): string[] {
  if (combinedEditedKeywordsCache.has(lang)) {
    return combinedEditedKeywordsCache.get(lang)!;
  }

  const keywords = getEditedKeywords(lang);
  const englishKeywords = getEditedKeywords('en');
  const arabicKeywords = getEditedKeywords('ar');

  const combined = [...new Set([...keywords, ...englishKeywords, ...arabicKeywords])];
  combinedEditedKeywordsCache.set(lang, combined);
  return combined;
}

export function getAllEditedKeywords(): string[] {
  return Object.values(EDITED_KEYWORDS).flat();
}

export function getAllCommentKeywords(): string[] {
  return Object.values(COMMENT_KEYWORDS)
    .flatMap(k => [...k.singular, ...k.plural, ...k.classComment]);
}

export function hasDatePattern(text: string): boolean {
  const normalized = normalizeText(text);
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

export function isExcludedCommentPattern(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return COMMENT_EXCLUSION_PATTERNS.some(p => normalized.includes(normalizeForComparison(p)));
}

export function isExcludedEditedPattern(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return EDITED_EXCLUSION_PATTERNS.some(p => normalized.includes(normalizeForComparison(p)));
}
