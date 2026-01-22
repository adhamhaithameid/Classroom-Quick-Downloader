/**
 * Smart Detection System
 * 
 * A language-agnostic detection system that uses multiple layers:
 * 1. DOM Structure Analysis - Look for specific patterns Google uses
 * 2. Pattern Matching - Use regex that works across all languages
 * 3. Multi-Language Fallback - Check both page language AND English
 * 
 * This approach handles:
 * - Mixed language content (English numbers + local text)
 * - 130+ languages without maintaining individual keywords
 * - Edge cases where Google shows inconsistent UI
 * - Multiple date formats: numeric, text, relative
 */

import { getCommentKeywords, getEditedKeywords } from './translations/detection-keywords';

// ============================================================================
// COMPREHENSIVE MONTH NAMES MAPPING
// ============================================================================

/**
 * Month names in 30+ languages for text-based date parsing
 * This enables language-agnostic date detection across ALL Google Classroom locales
 */
const MONTH_NAMES: Record<string, number> = {
  // Arabic
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5,
  'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9,
  'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  
  // English (and shared global terms)
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8,
  'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
  
  // French
  'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5,
  'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8, 'septembre': 9,
  'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12,
  
  // German (unique terms only)
  'januar': 1, 'februar': 2, 'märz': 3, 'marz': 3, 
  // 'juni', 'juli' covered by others/duplicates, removing to fix lint
  'dezember': 12,
  
  // Spanish
  'enero': 1, 'febrero': 2, 'marzo': 3, 'mayo': 5, 'junio': 6, 'julio': 7,
  'agosto': 8, 'septiembre': 9, 'noviembre': 11, 'diciembre': 12,
  
  // Portuguese
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'maio': 5, 'junho': 6,
  'julho': 7, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
  
  // Italian
  'gennaio': 1, 'febbraio': 2, 'aprile': 4, 'maggio': 5, 'giugno': 6,
  'luglio': 7, 'settembre': 9, 'ottobre': 10,
  
  // Russian
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
  'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'июн': 6,
  'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
  
  // Turkish
  'ocak': 1, 'şubat': 2, 'subat': 2, 'mart': 3, 'nisan': 4, 'mayıs': 5, 'mayis': 5,
  'haziran': 6, 'temmuz': 7, 'ağustos': 8, 'agustos': 8, 'eylül': 9, 'eylul': 9,
  'ekim': 10, 'kasım': 11, 'kasim': 11, 'aralık': 12, 'aralik': 12,
  
  // Dutch/Swedish/Indonesian/Swahili (shared)
  'januari': 1, 'februari': 2, 'maart': 3, 'mei': 5,
  'augustus': 8, 'augusti': 8,
  'desember': 12, 'maret': 3, 'desemba': 12,
  
  // Polish
  'styczeń': 1, 'styczen': 1, 'luty': 2, 'marzec': 3, 'kwiecień': 4, 'kwiecien': 4,
  'maj': 5, 'czerwiec': 6, 'lipiec': 7, 'sierpień': 8, 'sierpien': 8,
  'wrzesień': 9, 'wrzesien': 9, 'październik': 10, 'pazdziernik': 10,
  'listopad': 11, 'grudzień': 12, 'grudzien': 12,
  
  // Czech
  'leden': 1, 'únor': 2, 'unor': 2, 'březen': 3, 'brezen': 3, 'duben': 4,
  'květen': 5, 'kveten': 5, 'červen': 6, 'cerven': 6, 'červenec': 7, 'cervenec': 7,
  'srpen': 8, 'září': 9, 'zari': 9, 'říjen': 10, 'rijen': 10,
  'prosinec': 12,
  
  // Norwegian/Danish (duplicates removed)
  // 'januar', 'februar', 'mars', 'april', 'mai', 'august' are all covered above
  
  // Finnish
  'tammikuu': 1, 'helmikuu': 2, 'maaliskuu': 3, 'huhtikuu': 4, 'toukokuu': 5,
  'kesäkuu': 6, 'kesakuu': 6, 'heinäkuu': 7, 'heinakuu': 7, 'elokuu': 8,
  'syyskuu': 9, 'lokakuu': 10, 'marraskuu': 11, 'joulukuu': 12,
  
  // Greek
  'ιανουάριος': 1, 'ιανουαριος': 1, 'φεβρουάριος': 2, 'φεβρουαριος': 2,
  'μάρτιος': 3, 'μαρτιος': 3, 'απρίλιος': 4, 'απριλιος': 4, 'μάϊος': 5, 'μαιος': 5,
  'ιούνιος': 6, 'ιουνιος': 6, 'ιούλιος': 7, 'ιουλιος': 7, 'αύγουστος': 8, 'αυγουστος': 8,
  'σεπτέμβριος': 9, 'σεπτεμβριος': 9, 'οκτώβριος': 10, 'οκτωβριος': 10,
  'νοέμβριος': 11, 'νοεμβριος': 11, 'δεκέμβριος': 12, 'δεκεμβριος': 12,
  
  // Hebrew
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'מרס': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
  'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
  
  // Hindi
  'जनवरी': 1, 'फ़रवरी': 2, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
  'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'सितम्बर': 9, 'अक्टूबर': 10, 'अक्तूबर': 10,
  'नवंबर': 11, 'नवम्बर': 11, 'दिसंबर': 12, 'दिसम्बर': 12,
  
  // Korean
  '1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6,
  '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12,
  
  // Japanese
  '1月': 1, '2月': 2, '3月': 3, '4月': 4, '5月': 5, '6月': 6,
  '7月': 7, '8月': 8, '9月': 9, '10月': 10, '11月': 11, '12月': 12,
  
  // Chinese
  '一月': 1, '二月': 2, '三月': 3, '四月': 4, '五月': 5, '六月': 6,
  '七月': 7, '八月': 8, '九月': 9, '十月': 10, '十一月': 11, '十二月': 12,
  
  // Vietnamese
  'tháng 1': 1, 'tháng 2': 2, 'tháng 3': 3, 'tháng 4': 4, 'tháng 5': 5, 'tháng 6': 6,
  'tháng 7': 7, 'tháng 8': 8, 'tháng 9': 9, 'tháng 10': 10, 'tháng 11': 11, 'tháng 12': 12,
  'thang 1': 1, 'thang 2': 2, 'thang 3': 3, 'thang 4': 4, 'thang 5': 5, 'thang 6': 6,
  'thang 7': 7, 'thang 8': 8, 'thang 9': 9, 'thang 10': 10, 'thang 11': 11, 'thang 12': 12,
  
  // Thai
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
  'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
  
  // Ukrainian
  'січень': 1, 'лютий': 2, 'березень': 3, 'квітень': 4, 'травень': 5, 'червень': 6,
  'липень': 7, 'серпень': 8, 'вересень': 9, 'жовтень': 10, 'листопад': 11, 'грудень': 12,
  
  // Romanian
  'ianuarie': 1, 'februarie': 2, 'martie': 3, 'aprilie': 4, 'iunie': 6,
  'iulie': 7, 'septembrie': 9, 'octombrie': 10, 'noiembrie': 11, 'decembrie': 12,
  
  // Hungarian
  'január': 1, 'február': 2, 'március': 3, 'április': 4, 'május': 5, 'június': 6,
  'július': 7, 'augusztus': 8, 'szeptember': 9, 'október': 10,
  
  // Croatian/Serbian
  'siječanj': 1, 'veljača': 2, 'ožujak': 3, 'travanj': 4, 'svibanj': 5, 'lipanj': 6,
  'srpanj': 7, 'kolovoz': 8, 'rujan': 9, 'studeni': 11,
  
  // Bulgarian
  'януари': 1, 'февруари': 2, 'март': 3, 'април': 4, 'май': 5, 'юни': 6,
  'юли': 7, 'август': 8, 'септември': 9, 'октомври': 10, 'ноември': 11, 'декември': 12,
  
  // Slovak
  'marec': 3, 'apríl': 4, 'máj': 5, 'jún': 6, 'júl': 7,
  
  // Catalan
  'gener': 1, 'febrer': 2, 'març': 3, 'maig': 5, 'juny': 6,
  'juliol': 7, 'agost': 8, 'setembre': 9, 'desembre': 12,
  
  // Persian/Farsi
  'ژانویه': 1, 'فوریه': 2, 'مارس': 3, 'آوریل': 4, 'مه': 5, 'ژوئن': 6,
  'ژوئیه': 7, 'اوت': 8, 'سپتامبر': 9, 'اکتبر': 10, 'نوامبر': 11, 'دسامبر': 12,
  
  // Bengali
  'জানুয়ারি': 1, 'ফেব্রুয়ারি': 2, 'মার্চ': 3, 'এপ্রিল': 4, 'মে': 5, 'জুন': 6,
  'জুলাই': 7, 'আগস্ট': 8, 'সেপ্টেম্বর': 9, 'অক্টোবর': 10, 'নভেম্বর': 11, 'ডিসেম্বর': 12,
  
  // Tamil
  'ஜனவரி': 1, 'பிப்ரவரி': 2, 'மார்ச்': 3, 'ஏப்ரல்': 4, 'மே': 5, 'ஜூன்': 6,
  'ஜூலை': 7, 'ஆகஸ்ட்': 8, 'செப்டம்பர்': 9, 'அக்டோபர்': 10, 'நவம்பர்': 11, 'டிசம்பர்': 12,
  
  // Urdu
  'جنوری': 1, 'فروری': 2, 'مارچ': 3, 'اپریل': 4, 'مئی': 5, 'جون': 6,
  'جولائی': 7, 'اگست': 8, 'ستمبر': 9, 'اکتوبر': 10, 'نومبر': 11, 'دسمبر': 12,
  
  // Swahili specific (duplicates removed)
  'machi': 3, 'aprili': 4, 'julai': 7, 'agosti': 8, 'septemba': 9, 'oktoba': 10, 'novemba': 11,
};

/**
 * Edited keywords in multiple languages
 */
const EDITED_KEYWORDS = [
  // Arabic
  'وقت آخر تعديل',
  'آخر تعديل',
  'تم التعديل',
  // English
  'edited',
  'last edited',
  'modified',
  // French
  'modifié',
  'dernière modification',
  // German
  'bearbeitet',
  'zuletzt bearbeitet',
  // Spanish
  'editado',
  'última edición',
  'modificado',
  // Portuguese
  'editado',
  'última edição',
  // Italian
  'modificato',
  'ultima modifica',
  // Russian
  'изменено',
  'отредактировано',
  // Turkish
  'düzenlendi',
  // Japanese (expanded)
  '編集済み',
  '編集',
  '最終編集',
  '更新済み',
  '修正済み',
  // Korean (expanded)
  '수정됨',
  '수정 날짜',
  '수정',
  '편집됨',
  '마지막 수정',
  // Chinese Simplified (expanded)
  '已编辑',
  '已修改',
  '编辑时间',
  '修改时间',
  '编辑',
  // Chinese Traditional (expanded)
  '已編輯',
  '已修改',
  '編輯時間',
  '修改時間',
  '編輯',
  // Vietnamese
  'đã chỉnh sửa',
  'chỉnh sửa lần cuối',
  // Thai
  'แก้ไขแล้ว',
  'แก้ไขล่าสุด',
  // Indonesian
  'diedit',
  'diubah',
];

// Detection result interfaces
export interface CommentDetectionResult {
  hasComments: boolean;
  count: number;
  confidence: 'high' | 'medium' | 'low';
  matchedText?: string;
}

export interface EditedDetectionResult {
  isEdited: boolean;
  editDiff: string | null;
  confidence: 'high' | 'medium' | 'low';
  originalDate?: string;
  editedDate?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getAriaLabels(post: HTMLElement): string {
  const elements = post.querySelectorAll('[aria-label]');
  return Array.from(elements)
    .map(el => el.getAttribute('aria-label') || '')
    .join(' ');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse month name to number (1-12)
 */
function parseMonthName(monthStr: string): number | null {
  const normalized = monthStr.toLowerCase().trim();
  return MONTH_NAMES[normalized] || null;
}

/**
 * Parse a date from text - handles multiple formats
 */
function parseDateFromText(text: string): Date | null {
  // Format 1: YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = text.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
  }
  
  // Format 2: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }
  
  // Format 3: DD Month YYYY (e.g., "12 January 2024")
  const textDateMatch = text.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1]);
    const month = parseMonthName(textDateMatch[2]);
    const year = parseInt(textDateMatch[3]);
    if (month) {
      return new Date(year, month - 1, day);
    }
  }
  
  // Format 4: Month DD, YYYY (e.g., "January 12, 2024")
  const usDateMatch = text.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (usDateMatch) {
    const month = parseMonthName(usDateMatch[1]);
    const day = parseInt(usDateMatch[2]);
    const year = parseInt(usDateMatch[3]);
    if (month) {
      return new Date(year, month - 1, day);
    }
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calculate days difference between two dates
 */
function calculateDaysDiff(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================================
// ARABIC NUMBER WORDS
// ============================================================================

const ARABIC_NUMBER_WORDS: Record<string, number> = {
  'واحد': 1, 'اثنان': 2, 'اثنين': 2, 'ثلاثة': 3, 'أربعة': 4, 'خمسة': 5,
  'ستة': 6, 'سبعة': 7, 'ثمانية': 8, 'تسعة': 9, 'عشرة': 10,
};

function extractNumber(text: string): number | null {
  const numeralMatch = text.match(/(\d+)/);
  if (numeralMatch) return parseInt(numeralMatch[1], 10);
  
  for (const [word, value] of Object.entries(ARABIC_NUMBER_WORDS)) {
    if (text.includes(word)) return value;
  }
  return null;
}

// ============================================================================
// COMMENT EXCLUSION PATTERNS
// ============================================================================

const EXCLUDED_COMMENT_PATTERNS = [
  'اضافة تعليق', 'إضافة تعليق', 'أضف تعليق', 'كتابة تعليق',
  'add comment', 'add a comment', 'write a comment', 'leave a comment',
  'ajouter un commentaire', 'kommentar hinzufügen',
  'añadir comentario', 'agregar comentario',
  'adicionar comentário', 'aggiungi commento',
  'добавить комментарий', 'コメントを追加', '댓글 추가', '添加评论', '新增留言',
];

function isExcludedCommentText(text: string): boolean {
  const lowerText = text.toLowerCase();
  return EXCLUDED_COMMENT_PATTERNS.some(pattern => lowerText.includes(pattern.toLowerCase()));
}

// ============================================================================
// SAFE TEXT EXTRACTION
// ============================================================================

/**
 * Extracts text from a post while explicitly excluding the body content
 * where teachers might type ambiguous keywords like "Hand In" or "Edited".
 * 
 * Excludes:
 * - .n8F6Jd (The main post body content wrapper)
 * - .a3j8U (Another common body wrapper in streams)
 */
function getSafeText(post: HTMLElement): string {
  // Clone the node to avoid modifying the live DOM
  // (Deep clone is necessary to filter out children)
  const clone = post.cloneNode(true) as HTMLElement;
  
  // Remove the body content wrappers
  const bodyContent = clone.querySelectorAll('.n8F6Jd, .a3j8U, .gM4mlb, .A6dC2c');
  bodyContent.forEach(el => el.remove());
  
  // Also remove the "expand" text which might be noisy
  const expandButtons = clone.querySelectorAll('[role="button"]');
  expandButtons.forEach(btn => {
    if (btn.textContent?.includes('more') || btn.textContent?.includes('less')) {
      btn.remove();
    }
  });

  return (clone.innerText || '') + ' ' + getAriaLabels(clone);
}

// ============================================================================
// COMMENT DETECTION
// ============================================================================

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  // Strategy 1: Targeted DOM for Google Classroom Comment Count
  // The specific class for the comment count span
  const countSpan = post.querySelector('.mUIrbf-vQzf8d');
  if (countSpan && countSpan.textContent) {
    const text = countSpan.textContent;
    const count = extractNumber(text);
    if (count !== null && count > 0) {
      return { hasComments: true, count, confidence: 'high', matchedText: text };
    }
  }

  // Strategy 2: Look for the specific comment button aria-label
  // This button usually has classes like mUIrbf-LgbsSe
  const commentButton = post.querySelector('button[aria-label]');
  if (commentButton) {
    const label = commentButton.getAttribute('aria-label') || '';
    const pageKeywords = getCommentKeywords(pageLang);
    const englishKeywords = getCommentKeywords('en');
    const allKeywords = [...pageKeywords.plural, ...englishKeywords.plural, ...pageKeywords.singular, ...englishKeywords.singular];
    
    // Only check the LABEL of the button, not arbitrary text
    for (const keyword of allKeywords) {
      if (label.toLowerCase().includes(keyword.toLowerCase())) {
        const count = extractNumber(label);
        if (count && count > 0) {
          return { hasComments: true, count, confidence: 'high', matchedText: label };
        }
      }
    }
  }
  
  // Strategy 3: SAFE Text Fallback (Restored but filtered)
  // Only scans headers, footers, and metadata - explicitly excludes body content
  const safeText = getSafeText(post);
  const pageKeywords = getCommentKeywords(pageLang);
  const englishKeywords = getCommentKeywords('en');
  const allPlural = [...pageKeywords.plural, ...englishKeywords.plural].map(k => k.toLowerCase());
  const allSingular = [...pageKeywords.singular, ...englishKeywords.singular].map(k => k.toLowerCase());
  
  for (const keyword of [...allPlural, ...allSingular]) {
    const escapedKeyword = escapeRegex(keyword);
    const numeralPattern = new RegExp(`(\\d+)\\s*\\S*?${escapedKeyword}`, 'i');
    const numeralMatch = safeText.match(numeralPattern);
    
    if (numeralMatch) {
      const count = parseInt(numeralMatch[1], 10);
      if (count > 0 && count < 10000) {
        return {
          hasComments: true,
          count,
          confidence: 'medium', // Lower confidence for fallback
          matchedText: numeralMatch[0],
        };
      }
    }
    
    // Arabic word numbers
    if (safeText.toLowerCase().includes(keyword)) {
      for (const [arabicWord, value] of Object.entries(ARABIC_NUMBER_WORDS)) {
        if (safeText.includes(arabicWord)) {
          return { hasComments: true, count: value, confidence: 'medium', matchedText: `${arabicWord} ${keyword}` };
        }
      }
    }
  }

  return { hasComments: false, count: 0, confidence: 'high' };
}

// ============================================================================
// EDITED DETECTION - COMPREHENSIVE DATE PATTERNS
// ============================================================================

interface DateExtraction {
  originalDate: Date | null;
  editedDate: Date | null;
  matchedPattern: string;
}

/**
 * Normalize text for date extraction
 * Removes special characters that can interfere with date parsing:
 * (){}[],.<>/\|%^&*$#@!±?;':" and extra spaces
 * Keeps: letters, numbers, / - . (for dates), spaces between words
 */
function normalizeTextForDateExtraction(text: string): string {
  // Replace special characters with spaces (except date separators / - .)
  let normalized = text.replace(/[(){}[\],<>\\|%^&*$#@!±?;'":]/g, ' ');
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized.trim();
}

/**
 * SIMPLIFIED DATE EXTRACTION
 * Minimal logging, direct approach
 */
function extractAllDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  
  // Find all patterns that look like dates: digits separated by / or - or .
  // Pattern matches: 10/12/2025, 2025/12/10, 10-12-2025, etc.
  const matches = text.match(/\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/g) || [];
  
  for (const dateStr of matches) {
    // Split by separator
    const parts = dateStr.split(/[\/\-.]/);
    if (parts.length !== 3) continue;
    
    const n1 = parseInt(parts[0], 10);
    const n2 = parseInt(parts[1], 10);
    const n3 = parseInt(parts[2], 10);
    
    let year: number, month: number, day: number;
    
    // Determine format by which number is the year
    if (n1 > 1900 && n1 < 2100) {
      // YYYY/MM/DD
      year = n1; month = n2; day = n3;
    } else if (n3 > 1900 && n3 < 2100) {
      // DD/MM/YYYY
      day = n1; month = n2; year = n3;
    } else {
      continue; // Can't determine format
    }
    
    // Validate
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dates.push(new Date(year, month - 1, day));
    }
  }
  
  // Deduplicate by date string
  const seen = new Set<string>();
  const unique = dates.filter(d => {
    const key = d.toDateString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return unique;
}

/**
 * Calculate ABSOLUTE days difference (never negative)
 */
function calculateAbsoluteDaysDiff(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Extract dates from text using multiple comprehensive patterns
 * IMPORTANT: Only returns edited if text contains an EDITED KEYWORD
 */
function extractEditedDates(text: string): DateExtraction | null {
  // Check if text contains any edited keyword
  let hasEditedKeyword = false;
  for (const keyword of EDITED_KEYWORDS) {
    if (text.includes(keyword)) {
      hasEditedKeyword = true;
      break;
    }
  }
  
  if (!hasEditedKeyword) {
    return null;
  }
  
  const allDates = extractAllDatesFromText(text);
  
  if (allDates.length >= 2) {
    return {
      originalDate: allDates[0],
      editedDate: allDates[1],
      matchedPattern: 'robust_extraction',
    };
  }
  
  if (allDates.length === 1) {
    return {
      originalDate: null,
      editedDate: null,
      matchedPattern: 'keyword_with_single_date',
    };
  }
  
  return {
    originalDate: null,
    editedDate: null,
    matchedPattern: 'keyword_only',
  };
}

/**
 * TARGETED DOM DETECTION - Look for specific Google Classroom elements
 * The class "IMvYId dDKhVc Vu2fZd" contains the date info in Google Classroom
 */
function extractDatesFromDOM(post: HTMLElement): Date[] {
  const dates: Date[] = [];
  
  // Look for the specific date container class
  const dateContainers = post.querySelectorAll('.IMvYId.dDKhVc.Vu2fZd, .IMvYId.Vu2fZd');
  
  for (const container of dateContainers) {
    const containerText = container.textContent || '';
    
    // Check if this container has edited keyword
    let hasEdited = false;
    for (const keyword of EDITED_KEYWORDS) {
      if (containerText.includes(keyword)) {
        hasEdited = true;
        break;
      }
    }
    
    if (hasEdited) {
      const containerDates = extractAllDatesFromText(containerText);
      dates.push(...containerDates);
    }
  }
  
  // Strategy 2: Look for spans with aria-hidden that contain dates
  // often the visible date is aria-hidden
  if (dates.length < 2) {
    const hiddenSpans = post.querySelectorAll('span[aria-hidden="true"]');
    for (const span of hiddenSpans) {
      // Ensure we are only looking at date-like spans, not just any aria-hidden span
      if (span.closest('.IMvYId') || span.parentElement?.closest('.IMvYId')) {
          const spanText = span.textContent || '';
          const spanDates = extractAllDatesFromText(spanText);
          if (spanDates.length > 0) {
            dates.push(...spanDates);
          }
      }
    }
  }
  
  return dates;
}

export function detectEdited(post: HTMLElement, pageLang: string): EditedDetectionResult {
  // STRATEGY 1: Targeted DOM detection (most reliable)
  const domDates = extractDatesFromDOM(post);
  
  // Debug: Log once per post that has dates
  if (domDates.length > 0) {
    console.log('[CQD] DOM dates found:', domDates.length, domDates.map(d => d.toDateString()));
  }
  
  if (domDates.length >= 2) {
    const daysDiff = calculateAbsoluteDaysDiff(domDates[0], domDates[1]);
    console.log('[CQD] RESULT:', daysDiff, 'days');
    return {
      isEdited: true,
      editDiff: daysDiff.toString(),
      confidence: 'high',
      originalDate: domDates[0].toLocaleDateString(),
      editedDate: domDates[1].toLocaleDateString(),
    };
  }
  
  // STRATEGY 2: Fallback to text-based detection BUT ONLY within the date metadata container
  // We do NOT scan the whole post text anymore to avoid false positives.
  // The date metadata container usually has class 'IMvYId' or 'dDKhVc'
  const dateMetadataContainer = post.querySelector('.IMvYId.dDKhVc, .IMvYId');
  if (dateMetadataContainer) {
    const text = (dateMetadataContainer.textContent || '') + ' ' + getAriaLabels(dateMetadataContainer as HTMLElement);
    const extraction = extractEditedDates(text);
    
    if (extraction) {
      if (extraction.originalDate && extraction.editedDate) {
        const daysDiff = calculateDaysDiff(extraction.originalDate, extraction.editedDate);
        return {
          isEdited: true,
          editDiff: daysDiff.toString(),
          confidence: 'high',
          originalDate: extraction.originalDate.toLocaleDateString(),
          editedDate: extraction.editedDate.toLocaleDateString(),
        };
      }
      
      // Edited keyword found but couldn't calculate diff
      return {
        isEdited: true,
        editDiff: '0',
        confidence: 'medium', // Higher confidence since we are in the metadata container
      };
    }
  }

  // STRATEGY 3: Fallback keyword check (Restored but SAFE)
  // Scanning specific Safe Text (excluding body) for edit keywords
  const safeText = getSafeText(post);
  const extraction = extractEditedDates(safeText);
  
  if (extraction) {
      if (extraction.originalDate && extraction.editedDate) {
        // ... (same as above)
         const daysDiff = calculateDaysDiff(extraction.originalDate, extraction.editedDate);
        return {
          isEdited: true,
          editDiff: daysDiff.toString(),
          confidence: 'medium',
          originalDate: extraction.originalDate.toLocaleDateString(),
          editedDate: extraction.editedDate.toLocaleDateString(),
        };
      }
      
       // Edited keyword found
      return {
        isEdited: true,
        editDiff: '0',
        confidence: 'low',
      };
  }
  
  return { isEdited: false, editDiff: null, confidence: 'high' };
}

// ============================================================================
// COMBINED ANALYSIS
// ============================================================================

export function analyzePost(
  post: HTMLElement,
  pageLang: string
): { comments: CommentDetectionResult; edited: EditedDetectionResult } {
  return {
    comments: detectComments(post, pageLang),
    edited: detectEdited(post, pageLang),
  };
}
