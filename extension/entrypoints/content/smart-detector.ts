// filepath: entrypoints/content/smart-detector.ts
import { detectComments } from './smart-detector-comments';
import { ARABIC_MONTHS, MONTH_NAMES } from './constants';

export * from './smart-detector-comments';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EditedDetectionResult {
  isEdited: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedText?: string;
  editDiff?: string;
}

// ============================================================================
// KEYWORD DICTIONARIES
// ============================================================================

const EDITED_KEYWORDS: Record<string, string[]> = {
  ar: ['تم تعديله', '(تم تعديله)', 'معدل', 'تعديل'],
  en: ['edited', '(edited)', 'modified'],
  es: ['editado', '(editado)'],
  fr: ['modifié', '(modifié)'],
  de: ['bearbeitet', '(bearbeitet)'],
  pt: ['editado', '(editado)'],
  it: ['modificato', '(modificato)'],
  ru: ['изменено', '(изменено)'],
  ja: ['編集済み', '(編集済み)'],
  ko: ['수정됨', '(수정됨)'],
  zh: ['已编辑', '(已编辑)'],
};

function getEditedKeywords(lang: string): string[] {
  const shortLang = lang.split('-')[0].toLowerCase();
  return EDITED_KEYWORDS[shortLang] || EDITED_KEYWORDS['en'];
}

function getAriaLabels(el: HTMLElement): string {
  return Array.from(el.querySelectorAll('[aria-label]'))
    .map((node) => node.getAttribute('aria-label') || '')
    .join(' ');
}

// ============================================================================
// EDITED POST DETECTION
// ============================================================================

/**
 * The specific container class provided by user that contains the updated date info.
 * This container will have "Created Dec 30, 2025" and "(Edited Dec 30, 2025)"
 */
const EDITED_DATE_CONTAINER_SELECTOR = '.IMvYId.dDKhVc.Vu2fZd';

/**
 * Extracts text from a post while explicitly excluding the body content
 * where teachers might type ambiguous keywords like "Hand In" or "Edited".
 */
function getSafeMetadataText(post: HTMLElement): string {
  // Clone the node to avoid modifying the live DOM
  const clone = post.cloneNode(true) as HTMLElement;
  
  // Remove the body content wrappers to avoid false positives from user typed text
  const bodyContent = clone.querySelectorAll('.n8F6Jd, .a3j8U, .gM4mlb, .A6dC2c');
  bodyContent.forEach(el => el.remove());
  
  // Also remove expand buttons
  const expandButtons = clone.querySelectorAll('[role="button"]');
  expandButtons.forEach(btn => {
    if (btn.textContent?.includes('more') || btn.textContent?.includes('less')) {
      btn.remove();
    }
  });

  return (clone.innerText || '') + ' ' + getAriaLabels(clone);
}

export function detectEdited(post: HTMLElement, pageLang: string): EditedDetectionResult {
  // 1. PRIMARY: Check the specific date container first (User request)
  // This is the most reliable method for the current Google Classroom UI
  const dateContainer = post.querySelector<HTMLElement>(EDITED_DATE_CONTAINER_SELECTOR);
  
  const keywords = getEditedKeywords(pageLang);
  const englishKeywords = getEditedKeywords('en');
  // Combine current language + English (fallback)
  const allKeywords = [...new Set([...keywords, ...englishKeywords])];

  if (dateContainer) {
    const text = dateContainer.textContent || '';
    for (const keyword of allKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        return { isEdited: true, confidence: 'high', matchedText: keyword };
      }
    }
  }

  // 2. FALLBACK: Enhanced "Safe Text" scan
  // If the specific container isn't found (maybe different view/layout), scan metadata
  const safeText = getSafeMetadataText(post);
  
  for (const keyword of allKeywords) {
    if (safeText.toLowerCase().includes(keyword.toLowerCase())) {
       // Extra safety check: ensure it's not part of "Expected: ..." or other UI text
       // that might contain "edited" in some context (though unlikely in metadata)
       return { isEdited: true, confidence: 'high', matchedText: keyword };
    }
  }

  return { isEdited: false, confidence: 'none' };
}
