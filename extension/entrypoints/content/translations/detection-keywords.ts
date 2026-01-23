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
// ============================================================================

/**
 * Maps any Unicode decimal digit to its integer value (0-9).
 * Uses the Unicode property that all \p{Nd} digits are in blocks of 10.
 */
function unicodeDigitToInt(char: string): number {
  const code = char.codePointAt(0);
  if (code === undefined) return -1;
  
  // Get the digit value by finding offset within its numeric block
  // All Unicode decimal digit blocks start at a codepoint divisible by 10
  // and the digit value is the offset from that base
  const digitValue = code % 10;
  
  // Validate it's actually in range 0-9
  if (digitValue >= 0 && digitValue <= 9) {
    return digitValue;
  }
  return -1;
}

/**
 * Parses any Unicode number string to an integer.
 * Handles Devanagari (०-९), Bengali (০-৯), Thai (๐-๙), Arabic (٠-٩), etc.
 */
export function parseUnicodeInteger(text: string): number | null {
  if (!text) return null;
  
  const normalized = normalizeText(text);
  
  // Extract all sequences of Unicode digits
  const digitMatches = normalized.match(new RegExp(`[${D}]+`, 'gu'));
  if (!digitMatches || digitMatches.length === 0) return null;
  
  // Take the first numeric sequence
  const digitSequence = digitMatches[0];
  
  // Convert each Unicode digit to its integer value
  let result = 0;
  for (const char of digitSequence) {
    const digitValue = unicodeDigitToInt(char);
    if (digitValue < 0) return null; // Invalid digit
    result = result * 10 + digitValue;
  }
  
  return result > 0 && result < 100000 ? result : null;
}

/**
 * Legacy alias for backward compatibility
 */
export const extractNumber = parseUnicodeInteger;

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

// Matches: (Digits) + (Optional Whitespace) + (Keyword)
// Uses \p{Nd} for universal digits
// Group 1: Number (Digits)
// Group 2: Keyword
export const COMMENT_REGEX_PATTERN = new RegExp(`(${D}+)\\s*([\\p{L}\\p{M}]+(?:\\s+[\\p{L}\\p{M}]+)*)`, 'iu');

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
  ar: { singular: ['تعليق'], plural: ['تعليقات', 'تعليقًا'], classComment: ['تعليق صف', 'تعليقات الصف'] },
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
  hy: { singular: ['մեկնաբանություն'], plural: ['մեկնաբանություններ'], classComment: ['դասարանի մեկնաբանություն'] }, // Fixed broken text
  am: { singular: ['አስተያየት'], plural: ['አስተያየቶች'], classComment: ['የክፍል አስተያየት'] },
  bn: { singular: ['মন্তব্য'], plural: ['মন্তব্যগুলি'], classComment: ['ক্লাস মন্তব্য'] },
  ta: { singular: ['கருத்து'], plural: ['கருத்துகள்'], classComment: ['வகுப்பு கருத்து'] },
  te: { singular: ['వ్యాఖ్య'], plural: ['వ్యాఖ్యలు'], classComment: ['తరగతి వ్యాఖ్య'] },
  kn: { singular: ['ಕಾಮೆಂಟ್'], plural: ['ಕಾಮೆಂಟ್‌ಗಳು'], classComment: ['ತರಗತಿ ಕಾಮೆಂಟ್'] },
  ml: { singular: ['അഭിപ്രായം'], plural: ['അഭിപ്രായങ്ങൾ'], classComment: ['ക്ലാസ് അഭിപ്രായം'] },
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
// CREATED KEYWORDS (for detecting original post date)
// Supports "Posted", "Created", "Published" patterns across 100+ languages
// ============================================================================

const CREATED_KEYWORDS_LATIN: Record<string, string[]> = {
  en: ['posted', 'created', 'published', 'added', 'written'],
  es: ['publicado', 'creado', 'añadido', 'escrito'],
  fr: ['publié', 'posté', 'créé', 'ajouté'],
  de: ['gepostet', 'erstellt', 'veröffentlicht', 'hinzugefügt', 'geschrieben'],
  pt: ['publicado', 'postado', 'criado', 'adicionado'],
  it: ['pubblicato', 'creato', 'aggiunto', 'scritto'],
  nl: ['gepost', 'gemaakt', 'gepubliceerd', 'toegevoegd'],
  pl: ['opublikowano', 'utworzono', 'dodano', 'napisano'],
  cs: ['zveřejněno', 'vytvořeno', 'přidáno'],
  ro: ['publicat', 'creat', 'adăugat'],
  tr: ['yayınlandı', 'oluşturuldu', 'eklendi', 'gönderildi'],
  vi: ['đã đăng', 'đã tạo', 'đã thêm'],
  id: ['diposting', 'dibuat', 'ditambahkan'],
  ms: ['diposkan', 'dicipta', 'ditambah'],
  tl: ['na-post', 'nilikha', 'idinagdag'],
  sw: ['imechapishwa', 'imeundwa', 'imeongezwa'],
};

const CREATED_KEYWORDS_CYRILLIC: Record<string, string[]> = {
  ru: ['опубликовано', 'создано', 'добавлено', 'написано'],
  uk: ['опубліковано', 'створено', 'додано'],
  be: ['апублікавана', 'створана', 'дададзена'],
  bg: ['публикувано', 'създадено', 'добавено'],
  sr: ['објављено', 'креирано', 'додато'],
  mk: ['објавено', 'создадено', 'додадено'],
  kk: ['жарияланды', 'жасалды', 'қосылды'],
  ky: ['жарыяланды', 'түзүлдү', 'кошулду'],
  mn: ['нийтэлсэн', 'үүсгэсэн', 'нэмсэн'],
  tg: ['нашр шуд', 'сохта шуд', 'илова шуд'],
};

const CREATED_KEYWORDS_ARABIC: Record<string, string[]> = {
  ar: ['تم النشر', 'نُشر', 'تاريخ النشر', 'أُضيف', 'تاريخ الإنشاء', 'تم الإنشاء'],
  fa: ['منتشر شد', 'ایجاد شد', 'اضافه شد'],
  ur: ['شائع کیا گیا', 'بنایا گیا', 'شامل کیا گیا'],
  ps: ['خپور شو', 'جوړ شو', 'اضافه شو'],
  ug: ['ئېلان قىلىندى', 'قۇرۇلدى', 'قوشۇلدى'],
  ckb: ['بڵاو کرایەوە', 'دروست کرا', 'زیاد کرا'],
};

const CREATED_KEYWORDS_DEVANAGARI: Record<string, string[]> = {
  hi: ['पोस्ट किया गया', 'प्रकाशित', 'जोड़ा गया', 'लिखा गया'],
  mr: ['प्रकाशित', 'तयार केले', 'जोडले'],
  ne: ['प्रकाशित गरियो', 'सिर्जना गरियो', 'थपियो'],
  sa: ['प्रकाशितम्', 'सृष्टम्', 'योजितम्'],
};

const CREATED_KEYWORDS_CJK: Record<string, string[]> = {
  zh: ['发布于', '发布', '创建于', '创建', '添加于', '已发布'],
  'zh-TW': ['發佈於', '發佈', '建立於', '建立', '已發佈'],
  ja: ['投稿日', '投稿', '作成日', '作成', '追加'],
  ko: ['게시됨', '작성됨', '생성됨', '추가됨'],
};

const CREATED_KEYWORDS_OTHER: Record<string, string[]> = {
  he: ['פורסם', 'נוצר', 'נוסף', 'נכתב'],
  th: ['โพสต์เมื่อ', 'สร้างเมื่อ', 'เพิ่มเมื่อ'],
  el: ['δημοσιεύτηκε', 'δημιουργήθηκε', 'προστέθηκε'],
  ka: ['გამოქვეყნდა', 'შეიქმნა', 'დაემატა'],
  hy: ['հրապdelays', ' delays'],
  am: ['ታትሟል', 'ተፈጥሯል', 'ታክሏል'],
  bn: ['পোস্ট করা হয়েছে', 'তৈরি করা হয়েছে', 'যোগ করা হয়েছে'],
  ta: ['வெளியிடப்பட்டது', 'உருவாக்கப்பட்டது', 'சேர்க்கப்பட்டது'],
  te: ['పోస్ట్ చేయబడింది', 'సృష్టించబడింది', 'జోడించబడింది'],
  kn: ['ಪೋಸ್ಟ್ ಮಾಡಲಾಗಿದೆ', 'ರಚಿಸಲಾಗಿದೆ', 'ಸೇರಿಸಲಾಗಿದೆ'],
  ml: ['പോസ്റ്റ് ചെയ്തു', 'സൃഷ്ടിച്ചു', 'ചേർത്തു'],
  si: ['පළ කළා', 'නිර්මාණය කළා', 'එකතු කළා'],
  my: ['တင်ပြီး', 'ဖန်တီးပြီး', 'ထည့်ပြီး'],
  km: ['បានបង្ហោះ', 'បានបង្កើត', 'បានបន្ថែម'],
  lo: ['ໂພສແລ້ວ', 'ສ້າງແລ້ວ', 'ເພີ່ມແລ້ວ'],
  tlh: ['qaSta\'', 'chenmoHta\''], // Klingon
};

export const CREATED_KEYWORDS: Record<string, string[]> = {
  ...CREATED_KEYWORDS_LATIN,
  ...CREATED_KEYWORDS_CYRILLIC,
  ...CREATED_KEYWORDS_ARABIC,
  ...CREATED_KEYWORDS_DEVANAGARI,
  ...CREATED_KEYWORDS_CJK,
  ...CREATED_KEYWORDS_OTHER,
};

export function getCreatedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  const fullLang = lang.toLowerCase();
  return CREATED_KEYWORDS[fullLang] || CREATED_KEYWORDS[shortLang] || CREATED_KEYWORDS['en'];
}

// ============================================================================
// MONTHS PATTERN - Universal month name mapping for date parsing
// Maps month names from 100+ languages to month index (0-11)
// ============================================================================

const MONTHS_MAP: Record<string, number> = {
  // English (and shared global keys like 'september', 'november', 'december' found in Dutch too)
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  
  // French
  janvier: 0, février: 1, fevrier: 1, mars: 2, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, octobre: 9, décembre: 11, decembre: 11,
  janv: 0, févr: 1, avr: 3, juil: 6, déc: 11,
  // 'novembre' (French) is shared with Italian below OR duplicates regular 'november' if typo? 
  // No, 'novembre' != 'november'. 
  // 'septembre' != 'september'.
  novembre: 10, septembre: 8, 
  
  // German
  januar: 0, märz: 2, marz: 2, 
  // Others: februar(1), mai(4), juni(5), juli(6), oktober(9), dezember -> check
  // 'februar' overlaps with nothing? No, English is 'february'.
  // 'mai' overlaps with French 'mai'. (Already defined in French block)
  
  // Spanish / Portuguese / Italian (Shared Romance)
  enero: 0, febrero: 1, marzo: 2, mayo: 4, junio: 5,
  julio: 6, agosto: 7, diciembre: 11,
  // 'septiembre' != 'settembre' != 'septembre' != 'september'
  septiembre: 8, 
  // 'octubre' != 'ottobre' != 'octobre' != 'october'
  octubre: 9,
  // 'noviembre' != 'novembre' (French/Italian) != 'november'
  noviembre: 10,
  
  // Portuguese specific
  janeiro: 0, março: 2, marco: 2, maio: 4, junho: 5,
  julho: 6, setembro: 8, outubro: 9, 
  // 'fevereiro' duplicates 'febrero' (Spanish)? No 'v' vs 'b'.
  fevereiro: 1,
  
  // Italian specific
  gennaio: 0, febbraio: 1, maggio: 4, 
  luglio: 6, settembre: 8, ottobre: 9, dicembre: 11,
  // 'novembre' is shared with French. ALREADY DEFINED in French block.
  
  // Dutch
  januari: 0, maart: 2, mei: 4, augustus: 7, 
  // 'februari' matches Italian 'febbrari'? No. 
  februari: 1,
  // 'juni', 'juli' match Spanish/French/German?
  // 'juni' matches 'junio'? No. 'juni' matches German 'juni'? Yes.
  // 'oktober' matches German 'oktober'? Yes.
  
  // Russian
  'январь': 0, 'января': 0, 'февраль': 1, 'февраля': 1, 'март': 2, 'марта': 2,
  'апрель': 3, 'апреля': 3, 'май': 4, 'мая': 4, 'июнь': 5, 'июня': 5,
  'июль': 6, 'июля': 6, 'август': 7, 'августа': 7, 'сентябрь': 8, 'сентября': 8,
  'октябрь': 9, 'октября': 9, 'ноябрь': 10, 'ноября': 10, 'декабрь': 11, 'декабря': 11,
  
  // Arabic
  'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3, 'إبريل': 3, 'يونيو': 5,
  'يوليو': 6, 'أغسطس': 7, 'سبتمبر': 8, 'أكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11,
  
  // CJK
  '一月': 0, '二月': 1, '三月': 2, '四月': 3, '五月': 4, '六月': 5,
  '七月': 6, '八月': 7, '九月': 8, '十月': 9, '十一月': 10, '十二月': 11,
  '1月': 0, '2月': 1, '3月': 2, '4月': 3, '5月': 4, '6月': 5,
  '7月': 6, '8月': 7, '9月': 8, '10月': 9, '11月': 10, '12月': 11,
  '投稿日': -1, 

  // Hebrew
  'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'אפריל': 3, 'מאי': 4, 'יוני': 5,
  'יולי': 6, 'אוגוסט': 7, 'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11,
  
  // Hindi  
  'जनवरी': 0, 'फ़रवरी': 1, 'मार्च': 2, 'अप्रैल': 3, 'मई': 4, 'जून': 5,
  'जुलाई': 6, 'अगस्त': 7, 'सितंबर': 8, 'सितम्बर': 8, 'अक्टूबर': 9, 'अक्तूबर': 9, 'नवंबर': 10, 'नवम्बर': 10, 'दिसंबर': 11, 'दिसम्बर': 11,
  
  // Turkish
  'ocak': 0, 'şubat': 1, 'subat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'mayis': 4, 'haziran': 5,
  'temmuz': 6, 'ağustos': 7, 'agustos': 7, 'eylül': 8, 'eylul': 8, 'ekim': 9, 'kasım': 10, 'kasim': 10, 'aralık': 11, 'aralik': 11,
  
  // Polish
  'styczeń': 0, 'styczen': 0, 'luty': 1, 'marzec': 2, 'kwiecień': 3, 'kwiecien': 3, 'czerwiec': 5,
  'lipiec': 6, 'sierpień': 7, 'sierpien': 7, 'wrzesień': 8, 'wrzesien': 8, 'październik': 9, 'pazdziernik': 9, 'listopad': 10, 'grudzień': 11, 'grudzien': 11,
  
  // Greek
  'ιανουάριος': 0, 'φεβρουάριος': 1, 'μάρτιος': 2, 'απρίλιος': 3, 'μάιος': 4, 'ιούνιος': 5,
  'ιούλιος': 6, 'αύγουστος': 7, 'σεπτέμβριος': 8, 'οκτώβριος': 9, 'νοέμβριος': 10, 'δεκέμβριος': 11,
  'ιαν': 0, 'φεβ': 1, 'μαρ': 2, 'απρ': 3, 'μαϊ': 4, 'ιουν': 5, 'ιουλ': 6, 'αυγ': 7, 'σεπ': 8, 'οκτ': 9, 'νοε': 10, 'δεκ': 11,
};

/**
 * Get month index (0-11) from month name in any supported language
 */
export function getMonthFromName(monthName: string): number | null {
  const normalized = normalizeForComparison(monthName).replace(/\.$/g, '');
  return MONTHS_MAP[normalized] ?? null;
}

// ============================================================================
// RELATIVE DATE PATTERNS - Multilingual
// ============================================================================

const RELATIVE_DATE_PATTERNS: Record<string, { pattern: RegExp; daysAgo: number }[]> = {
  today: [
    { pattern: /\b(?:today|aujourd'hui|hoy|heute|oggi|vandaag|dzisiaj|сегодня|اليوم|今日|오늘|今天)\b/iu, daysAgo: 0 },
  ],
  yesterday: [
    { pattern: /\b(?:yesterday|hier|ayer|gestern|ieri|gisteren|wczoraj|вчера|أمس|昨日|어제|昨天)\b/iu, daysAgo: 1 },
  ],
  justNow: [
    { pattern: /\b(?:just now|à l'instant|ahora mismo|gerade eben|proprio adesso|zojuist|только что|الآن فقط|たった今|방금|刚刚|刚才)\b/iu, daysAgo: 0 },
  ],
};

/**
 * Parse relative date patterns (today, yesterday, just now)
 * Returns Date object or null
 */
export function parseRelativeDate(text: string): Date | null {
  const normalized = normalizeText(text).toLowerCase();
  
  for (const [, patterns] of Object.entries(RELATIVE_DATE_PATTERNS)) {
    for (const { pattern, daysAgo } of patterns) {
      if (pattern.test(normalized)) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }
  }
  return null;
}

// ============================================================================
// UNICODE DATE PARSING ENGINE
// Handles dates with Unicode digits and multilingual month names
// ============================================================================

export interface ParsedDate {
  date: Date;
  raw: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Normalize Unicode digits to ASCII (0-9)
 * Converts ٥ → 5, ५ → 5, etc.
 */
function normalizeDigitsToAscii(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined) {
      // Check if it's a Unicode decimal digit
      const digitMatch = char.match(new RegExp(`[${D}]`, 'u'));
      if (digitMatch) {
        // Convert to ASCII digit using the modulo trick
        result += String(code % 10);
      } else {
        result += char;
      }
    }
  }
  return result;
}

/**
 * Parse a date string from any language into a Date object
 * Handles:
 * - Unicode digits (Arabic-Indic, Devanagari, Thai, etc.)
 * - Multilingual month names
 * - European (DD MMM YYYY) and American (MMM DD, YYYY) formats
 * - Relative dates (today, yesterday)
 * - Numeric formats (DD/MM/YYYY, MM/DD/YYYY with heuristic disambiguation)
 */
export function parseUnicodeDate(text: string): ParsedDate | null {
  if (!text) return null;
  
  const normalized = normalizeText(text);
  
  // 1. Try relative dates first
  const relativeDate = parseRelativeDate(normalized);
  if (relativeDate) {
    return { date: relativeDate, raw: text, confidence: 'high' };
  }
  
  // 2. Normalize all Unicode digits to ASCII
  const asciiText = normalizeDigitsToAscii(normalized);
  
  // 3. Try extracting date with month name
  // Pattern: captures optional day, month name, optional day (for American format), year
  const monthNamePattern = /(\d{1,2})?\s*([A-Za-z\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F\u0E00-\u0E7F\u0590-\u05FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]+)\.?\s*(\d{1,2})?[,،]?\s*(\d{2,4})?/iu;
  
  const monthMatch = asciiText.match(monthNamePattern);
  if (monthMatch) {
    const [, beforeMonth, monthStr, afterMonth, yearStr] = monthMatch;
    const monthIndex = getMonthFromName(monthStr);
    
    if (monthIndex !== null) {
      let day: number | null = null;
      let year = new Date().getFullYear();
      
      // Determine day (before or after month name)
      if (beforeMonth) {
        day = parseInt(beforeMonth, 10);
      } else if (afterMonth) {
        day = parseInt(afterMonth, 10);
      }
      
      // Parse year
      if (yearStr) {
        year = parseInt(yearStr, 10);
        if (year < 100) {
          year += year > 50 ? 1900 : 2000; // 23 → 2023, 99 → 1999
        }
      }
      
      if (day && day >= 1 && day <= 31) {
        const date = new Date(year, monthIndex, day);
        if (!isNaN(date.getTime())) {
          return { date, raw: text, confidence: 'high' };
        }
      }
    }
  }
  
  // 4. Try numeric date formats (DD/MM/YYYY or MM/DD/YYYY)
  const numericPattern = /(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})/;
  const numericMatch = asciiText.match(numericPattern);
  if (numericMatch) {
    const [, p1, p2, p3] = numericMatch;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    const n3 = parseInt(p3, 10);
    
    let day: number, month: number, year: number;
    
    // Heuristic: if first number > 31, assume YYYY/MM/DD (ISO-like)
    if (n1 > 31) {
      year = n1;
      month = n2 - 1;
      day = n3;
    }
    // If third number > 31, it's the year
    else if (n3 > 31) {
      year = n3 < 100 ? (n3 > 50 ? 1900 + n3 : 2000 + n3) : n3;
      // Heuristic: if n1 > 12, it must be day (European DD/MM/YYYY)
      if (n1 > 12) {
        day = n1;
        month = n2 - 1;
      }
      // If n2 > 12, n2 must be day (American MM/DD/YYYY)
      else if (n2 > 12) {
        month = n1 - 1;
        day = n2;
      }
      // Both could be day or month - prefer European (DD/MM/YYYY)
      else {
        day = n1;
        month = n2 - 1;
      }
    }
    // No clear year indicator - assume current year
    else {
      year = new Date().getFullYear();
      // Same heuristic for day/month
      if (n1 > 12) {
        day = n1;
        month = n2 - 1;
      } else if (n2 > 12) {
        month = n1 - 1;
        day = n2;
      } else {
        day = n1;
        month = n2 - 1;
      }
    }
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return { date, raw: text, confidence: 'medium' };
      }
    }
  }
  
  // 5. Try to extract just time (fallback to today's date with that time)
  const timePattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm]|ص|م)?/;
  const timeMatch = asciiText.match(timePattern);
  if (timeMatch) {
    const [, hourStr, minStr, , ampm] = timeMatch;
    let hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);
    
    // Handle AM/PM
    if (ampm) {
      const isAM = /[Aa]|ص/.test(ampm);
      const isPM = /[Pp]|م/.test(ampm);
      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
    }
    
    const date = new Date();
    date.setHours(hour, min, 0, 0);
    return { date, raw: text, confidence: 'low' };
  }
  
  return null;
}

/**
 * Calculate human-readable time difference between two dates
 */
export function formatTimeDifference(diffMs: number): string {
  const absDiff = Math.abs(diffMs);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return 'moments';
}

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

export function getEditedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  const fullLang = lang.toLowerCase();
  return EDITED_KEYWORDS[fullLang] || EDITED_KEYWORDS[shortLang] || EDITED_KEYWORDS['en'];
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
