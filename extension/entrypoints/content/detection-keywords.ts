// filepath: entrypoints/content/detection-keywords.ts
/**
 * DETECTION KEYWORDS - Zero-Fail v2 Architecture
 * 
 * UPGRADES FROM v1:
 * 1. Noun-Form Support: "Modification", "Änderung", "Modificación" etc.
 * 2. European Date Regex: DD MMM YYYY with dot-abbreviated months (déc., janv.)
 * 3. Retains: Arabic BiDi normalization, Eastern numerals, RTL support
 */

// ============================================================================
// BIDI CONTROL CHARACTERS TO STRIP
// ============================================================================

const BIDI_CONTROL_CHARS: RegExp = new RegExp(
  '[' +
    '\u200B\u200C\u200D\u200E\u200F' + // Zero-width and directional marks
    '\u202A\u202B\u202C\u202D\u202E' + // Directional embeddings/overrides
    '\u2066\u2067\u2068\u2069' +       // Isolates
    '\u061C\uFEFF' +                   // Arabic letter mark, BOM
  ']',
  'g'
);

const WHITESPACE_VARIANTS: RegExp = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

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
// UNIVERSAL NUMERAL SUPPORT
// Western (0-9) + Eastern Arabic (٠-٩) + Persian (۰-۹)
// ============================================================================

export const UNIVERSAL_DIGIT = '[0-9\u0660-\u0669\u06F0-\u06F9]';
export const UNIVERSAL_DIGIT_REGEX = new RegExp(UNIVERSAL_DIGIT, 'g');

export const EASTERN_ARABIC_NUMERALS: Record<string, number> = {
  '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4,
  '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
};

export const PERSIAN_NUMERALS: Record<string, number> = {
  '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4,
  '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9,
};

export function normalizeNumerals(text: string): string {
  if (!text) return '';
  let result = text;
  for (const [eastern, western] of Object.entries(EASTERN_ARABIC_NUMERALS)) {
    result = result.replace(new RegExp(eastern, 'g'), String(western));
  }
  for (const [persian, western] of Object.entries(PERSIAN_NUMERALS)) {
    result = result.replace(new RegExp(persian, 'g'), String(western));
  }
  return result;
}

export const ARABIC_NUMBER_WORDS: Record<string, number> = {
  'واحد': 1, 'واحدة': 1, 'أحد': 1,
  'اثنان': 2, 'اثنين': 2, 'اثنتان': 2, 'اثنتين': 2,
  'ثلاثة': 3, 'ثلاث': 3,
  'أربعة': 4, 'أربع': 4, 'اربع': 4, 'اربعة': 4,
  'خمسة': 5, 'خمس': 5,
  'ستة': 6, 'ست': 6,
  'سبعة': 7, 'سبع': 7,
  'ثمانية': 8, 'ثمان': 8, 'ثماني': 8,
  'تسعة': 9, 'تسع': 9,
  'عشرة': 10, 'عشر': 10,
};

export function extractNumber(text: string): number | null {
  if (!text) return null;
  const normalized = normalizeNumerals(normalizeText(text));
  const numericMatch = normalized.match(/[0-9,،]+/);
  if (numericMatch) {
    const cleanNum = numericMatch[0].replace(/[,،]/g, '');
    const num = parseInt(cleanNum, 10);
    if (!isNaN(num) && num > 0 && num < 100000) {
      return num;
    }
  }
  for (const [word, value] of Object.entries(ARABIC_NUMBER_WORDS)) {
    if (normalized.includes(word)) {
      return value;
    }
  }
  return null;
}

// ============================================================================
// SUPPORTED LANGUAGES
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  'en', 'ar', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ja', 'ko', 'zh', 
  'tr', 'nl', 'pl', 'vi', 'th', 'id', 'hi', 'he', 'fa', 'sv', 'da', 'no', 'fi'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// ============================================================================
// COMMENT KEYWORDS
// ============================================================================

export interface CommentKeywords {
  singular: string[];
  plural: string[];
  classComment: string[];
}

export const COMMENT_KEYWORDS: Record<string, CommentKeywords> = {
  en: {
    singular: ['comment'],
    plural: ['comments'],
    classComment: ['class comment', 'class comments'],
  },
  ar: {
    singular: ['تعليق', 'تعليق واحد'],
    plural: ['تعليقات', 'تعليقًا', 'تعليق'],
    classComment: ['تعليق صف', 'تعليقات الصف', 'تعليقات صف', 'تعليق الصف'],
  },
  es: {
    singular: ['comentario'],
    plural: ['comentarios'],
    classComment: ['comentario de clase', 'comentarios de clase'],
  },
  fr: {
    singular: ['commentaire'],
    plural: ['commentaires'],
    classComment: ['commentaire de classe', 'commentaires de classe'],
  },
  de: {
    singular: ['kommentar'],
    plural: ['kommentare'],
    classComment: ['klassenkommentar', 'klassenkommentare'],
  },
  pt: {
    singular: ['comentário'],
    plural: ['comentários'],
    classComment: ['comentário da turma', 'comentários da turma'],
  },
  it: {
    singular: ['commento'],
    plural: ['commenti'],
    classComment: ['commento della classe', 'commenti della classe'],
  },
  ru: {
    singular: ['комментарий'],
    plural: ['комментария', 'комментариев', 'комментарии'],
    classComment: ['комментарий класса', 'комментарии класса'],
  },
  ja: {
    singular: ['コメント'],
    plural: ['コメント'],
    classComment: ['クラスのコメント'],
  },
  ko: {
    singular: ['댓글'],
    plural: ['댓글'],
    classComment: ['수업 댓글'],
  },
  zh: {
    singular: ['评论', '留言'],
    plural: ['评论', '留言', '条评论'],
    classComment: ['课堂评论', '班级评论'],
  },
  tr: {
    singular: ['yorum'],
    plural: ['yorum'],
    classComment: ['sınıf yorumu', 'sınıf yorumları'],
  },
  nl: {
    singular: ['opmerking'],
    plural: ['opmerkingen'],
    classComment: ['klasopmerking', 'klasopmerkingen'],
  },
  pl: {
    singular: ['komentarz'],
    plural: ['komentarze', 'komentarzy'],
    classComment: ['komentarz klasy', 'komentarze klasy'],
  },
  vi: {
    singular: ['bình luận'],
    plural: ['bình luận'],
    classComment: ['bình luận lớp học'],
  },
  th: {
    singular: ['ความคิดเห็น'],
    plural: ['ความคิดเห็น'],
    classComment: ['ความคิดเห็นของชั้นเรียน'],
  },
  id: {
    singular: ['komentar'],
    plural: ['komentar'],
    classComment: ['komentar kelas'],
  },
  hi: {
    singular: ['टिप्पणी'],
    plural: ['टिप्पणियां', 'टिप्पणियाँ'],
    classComment: ['क्लास टिप्पणी', 'कक्षा टिप्पणी'],
  },
  he: {
    singular: ['תגובה'],
    plural: ['תגובות'],
    classComment: ['תגובת כיתה', 'תגובות כיתה'],
  },
  fa: {
    singular: ['نظر'],
    plural: ['نظرات'],
    classComment: ['نظر کلاس', 'نظرات کلاس'],
  },
  sv: {
    singular: ['kommentar'],
    plural: ['kommentarer'],
    classComment: ['klasskommentar', 'klasskommentarer'],
  },
  da: {
    singular: ['kommentar'],
    plural: ['kommentarer'],
    classComment: ['klassekommentar', 'klassekommentarer'],
  },
  no: {
    singular: ['kommentar'],
    plural: ['kommentarer'],
    classComment: ['klassekommentar', 'klassekommentarer'],
  },
  fi: {
    singular: ['kommentti'],
    plural: ['kommenttia', 'kommentit'],
    classComment: ['luokan kommentti', 'luokan kommentit'],
  },
};

// ============================================================================
// EDITED KEYWORDS - v2: INCLUDES NOUN FORMS
// Each language now has: Verbs/Adjectives + Noun Forms
// ============================================================================

export const EDITED_KEYWORDS: Record<string, string[]> = {
  en: [
    // Verb/Adjective forms
    'edited', '(edited)', 'modified', 'last modified',
    // Noun forms
    'modification', 'edit', 'last edit',
  ],
  ar: [
    'تم تعديله', '(تم تعديله)', 'تم التعديل', 'معدل', 'معدّل',
    'وقت آخر تعديل', 'آخر تعديل', 'تعديل',
    // Noun forms
    'التعديل', 'تعديلات',
  ],
  es: [
    // Verb/Adjective forms
    'editado', '(editado)', 'modificado', 'última modificación',
    // Noun forms - CRITICAL for Spanish
    'modificación', 'edición', 'última edición',
  ],
  fr: [
    // Verb/Adjective forms
    'modifié', '(modifié)', 'édité', 'dernière modification',
    // Noun forms - CRITICAL for French
    'modification', 'dernière édition', 'édition',
  ],
  de: [
    // Verb/Adjective forms
    'bearbeitet', '(bearbeitet)', 'geändert', 'letzte änderung',
    // Noun forms - CRITICAL for German
    'änderung', 'bearbeitung', 'letzte bearbeitung',
  ],
  pt: [
    'editado', '(editado)', 'modificado', 'última modificação',
    // Noun forms
    'modificação', 'edição', 'última edição',
  ],
  it: [
    'modificato', '(modificato)', 'editato', 'ultima modifica',
    // Noun forms
    'modifica', 'modifiche', 'ultima modificazione',
  ],
  ru: [
    'изменено', '(изменено)', 'отредактировано', 'последнее изменение',
    // Noun forms
    'изменение', 'редактирование', 'правка',
  ],
  ja: [
    '編集済み', '(編集済み)', '編集しました', '最終編集',
    // Noun forms
    '編集', '変更',
  ],
  ko: [
    '수정됨', '(수정됨)', '수정함', '마지막 수정',
    // Noun forms
    '수정', '편집',
  ],
  zh: [
    '已编辑', '(已编辑)', '已修改', '已編輯', '最后编辑',
    // Noun forms
    '编辑', '修改', '更改',
  ],
  tr: [
    'düzenlendi', '(düzenlendi)', 'değiştirildi', 'son düzenleme',
    // Noun forms
    'düzenleme', 'değişiklik',
  ],
  nl: [
    'bewerkt', '(bewerkt)', 'gewijzigd', 'laatst gewijzigd',
    // Noun forms
    'wijziging', 'bewerking', 'aanpassing',
  ],
  pl: [
    'edytowano', '(edytowano)', 'zmieniono', 'ostatnia edycja',
    // Noun forms - CRITICAL for Polish
    'modyfikacja', 'zmiana', 'edycja',
  ],
  vi: [
    'đã chỉnh sửa', '(đã chỉnh sửa)', 'sửa đổi lần cuối',
    // Noun forms
    'chỉnh sửa', 'sửa đổi',
  ],
  th: [
    'แก้ไขแล้ว', '(แก้ไขแล้ว)', 'แก้ไขล่าสุด',
    // Noun forms
    'การแก้ไข',
  ],
  id: [
    'diedit', '(diedit)', 'diubah', 'terakhir diedit',
    // Noun forms
    'perubahan', 'pengeditan',
  ],
  hi: [
    'संपादित', '(संपादित)', 'बदला गया', 'अंतिम संपादन',
    // Noun forms
    'संपादन', 'परिवर्तन',
  ],
  he: [
    'נערך', '(נערך)', 'עריכה אחרונה',
    // Noun forms
    'עריכה', 'שינוי',
  ],
  fa: [
    'ویرایش شد', '(ویرایش شد)', 'آخرین ویرایش',
    // Noun forms
    'ویرایش', 'تغییر',
  ],
  sv: [
    'redigerad', '(redigerad)', 'ändrad', 'senast ändrad',
    // Noun forms
    'ändring', 'redigering',
  ],
  da: [
    'redigeret', '(redigeret)', 'ændret', 'sidst ændret',
    // Noun forms
    'ændring', 'redigering',
  ],
  no: [
    'redigert', '(redigert)', 'endret', 'sist endret',
    // Noun forms
    'endring', 'redigering',
  ],
  fi: [
    'muokattu', '(muokattu)', 'viimeksi muokattu',
    // Noun forms
    'muokkaus', 'muutos',
  ],
};

// ============================================================================
// EXCLUSION PATTERNS (FALSE POSITIVES)
// ============================================================================

export const COMMENT_EXCLUSION_PATTERNS: string[] = [
  'add comment', 'add a comment', 'write a comment', 'leave a comment',
  'add class comment', 'add a class comment', 'type a comment', 'enter a comment',
  'اضافة تعليق', 'إضافة تعليق', 'أضف تعليق', 'كتابة تعليق', 'أضف تعليقًا',
  'añadir comentario', 'agregar comentario', 'escribe un comentario',
  'ajouter un commentaire', 'ajouter commentaire', 'écrire un commentaire',
  'kommentar hinzufügen', 'kommentar schreiben',
  'adicionar comentário', 'aggiungi commento',
  'добавить комментарий', 'コメントを追加', '댓글 추가', '添加评论',
  'yorum ekle', 'הוסף תגובה', 'افزودن نظر',
];

export const EDITED_EXCLUSION_PATTERNS: string[] = [
  'can be edited', 'should be edited', 'needs to be edited',
  'i edited', 'you edited', 'we edited', 'they edited',
  'edit this', 'edit the', 'editing', 'to edit',
  'editor', 'editorial', 'expected', 'submission', 'submit',
  'قم بالتعديل', 'يمكن التعديل', 'أريد تعديل',
];

// ============================================================================
// EUROPEAN DATE REGEX ENGINE - v2 ADDITION
// Handles dot-abbreviated months: DD MMM. YYYY (e.g., "10 déc. 2025")
// ============================================================================

// Abbreviated months with optional dots - MULTILINGUAL
const MONTHS_ABBREVIATED = [
  // English
  'jan\\.?', 'feb\\.?', 'mar\\.?', 'apr\\.?', 'may', 'jun\\.?',
  'jul\\.?', 'aug\\.?', 'sep\\.?', 'oct\\.?', 'nov\\.?', 'dec\\.?',
  // French (CRITICAL)
  'janv\\.?', 'févr?\\.?', 'mars', 'avr\\.?', 'mai', 'juin',
  'juil\\.?', 'août', 'sept\\.?', 'oct\\.?', 'nov\\.?', 'déc\\.?',
  // German
  'jan\\.?', 'feb\\.?', 'mär\\.?', 'apr\\.?', 'mai', 'jun\\.?',
  'jul\\.?', 'aug\\.?', 'sep\\.?', 'okt\\.?', 'nov\\.?', 'dez\\.?',
  // Spanish
  'ene\\.?', 'feb\\.?', 'mar\\.?', 'abr\\.?', 'may\\.?', 'jun\\.?',
  'jul\\.?', 'ago\\.?', 'sep\\.?', 'oct\\.?', 'nov\\.?', 'dic\\.?',
  // Italian
  'gen\\.?', 'feb\\.?', 'mar\\.?', 'apr\\.?', 'mag\\.?', 'giu\\.?',
  'lug\\.?', 'ago\\.?', 'set\\.?', 'ott\\.?', 'nov\\.?', 'dic\\.?',
  // Portuguese
  'jan\\.?', 'fev\\.?', 'mar\\.?', 'abr\\.?', 'mai\\.?', 'jun\\.?',
  'jul\\.?', 'ago\\.?', 'set\\.?', 'out\\.?', 'nov\\.?', 'dez\\.?',
  // Dutch
  'jan\\.?', 'feb\\.?', 'mrt\\.?', 'apr\\.?', 'mei', 'jun\\.?',
  'jul\\.?', 'aug\\.?', 'sep\\.?', 'okt\\.?', 'nov\\.?', 'dec\\.?',
  // Polish
  'sty\\.?', 'lut\\.?', 'mar\\.?', 'kwi\\.?', 'maj', 'cze\\.?',
  'lip\\.?', 'sie\\.?', 'wrz\\.?', 'paź\\.?', 'lis\\.?', 'gru\\.?',
];

// Full month names - MULTILINGUAL
const MONTHS_FULL = [
  // English
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // French
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  // German
  'januar', 'februar', 'märz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  // Spanish
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  // Italian
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  // Portuguese
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  // Arabic
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Build the unified month pattern
const MONTH_PATTERN = [...new Set([...MONTHS_ABBREVIATED, ...MONTHS_FULL])].join('|');

// Universal digit shorthand
const D = UNIVERSAL_DIGIT;

// ============================================================================
// DATE PATTERNS - v2: Includes European DD MMM YYYY format
// ============================================================================

export const DATE_PATTERNS: RegExp[] = [
  // EUROPEAN FORMAT: DD MMM. YYYY (e.g., "10 déc. 2025", "14 janv. 2024")
  new RegExp(`${D}{1,2}\\s*(?:${MONTH_PATTERN})\\s*\\.?\\s*${D}{2,4}`, 'i'),
  
  // AMERICAN FORMAT: MMM DD, YYYY (e.g., "Dec 10, 2025")
  new RegExp(`(?:${MONTH_PATTERN})\\s*\\.?\\s*${D}{1,2}[,،]?\\s*${D}{2,4}`, 'i'),
  
  // Numeric: DD/MM/YYYY, MM-DD-YYYY, YYYY.MM.DD (with universal digits)
  new RegExp(`${D}{1,4}[/\\-.]${D}{1,2}[/\\-.]${D}{1,4}`),
  
  // Short numeric: DD/MM or MM/DD
  new RegExp(`${D}{1,2}[/\\-.]${D}{1,2}`),
  
  // Eastern Arabic numeric dates
  new RegExp(`[٠-٩]{1,4}[/\\-][٠-٩]{1,2}[/\\-][٠-٩]{1,4}`),
  
  // Relative dates (multilingual)
  /\b(?:today|yesterday|aujourdhui|hier|hoy|ayer|heute|gestern|oggi|ieri|vandaag|gisteren|اليوم|أمس|البارحة)\b/i,
  
  // Time patterns with universal digits
  new RegExp(`${D}{1,2}:${D}{2}\\s*(?:AM|PM|am|pm|ص|م)?`),
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
  return COMMENT_KEYWORDS[shortLang] || COMMENT_KEYWORDS['en'];
}

export function getEditedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  return EDITED_KEYWORDS[shortLang] || EDITED_KEYWORDS['en'];
}

export function getAllEditedKeywords(): string[] {
  return Object.values(EDITED_KEYWORDS).flat();
}

export function getAllCommentKeywords(): string[] {
  return Object.values(COMMENT_KEYWORDS)
    .flatMap(k => [...k.singular, ...k.plural, ...k.classComment]);
}

/**
 * Checks if normalized text contains a date pattern.
 */
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
  return COMMENT_EXCLUSION_PATTERNS.some(pattern => 
    normalized.includes(normalizeForComparison(pattern))
  );
}

export function isExcludedEditedPattern(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return EDITED_EXCLUSION_PATTERNS.some(pattern => 
    normalized.includes(normalizeForComparison(pattern))
  );
}
