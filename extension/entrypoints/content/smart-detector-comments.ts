// filepath: entrypoints/content/smart-detector-comments.ts
import { ARABIC_NUMBER_WORDS } from './constants';

export interface CommentDetectionResult {
  hasComments: boolean;
  count: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedText?: string;
}

// Keywords for "comment" in support languages
const COMMENT_KEYWORDS: Record<string, { singular: string[]; plural: string[] }> = {
  ar: { singular: ['تعليق', 'تعليق واحد'], plural: ['تعليقات', 'تعليقًا'] },
  en: { singular: ['comment'], plural: ['comments'] },
  es: { singular: ['comentario'], plural: ['comentarios'] },
  fr: { singular: ['commentaire'], plural: ['commentaires'] },
  de: { singular: ['kommentar'], plural: ['kommentare'] },
  pt: { singular: ['comentário'], plural: ['comentários'] },
  it: { singular: ['commento'], plural: ['commenti'] },
  ru: { singular: ['комментарий'], plural: ['комментария', 'комментариев'] },
  ja: { singular: ['コメント'], plural: ['コメント'] },
  ko: { singular: ['댓글'], plural: ['댓글'] },
  zh: { singular: ['评论'], plural: ['评论'] },
};

function getCommentKeywords(lang: string) {
  const shortLang = lang.split('-')[0].toLowerCase();
  return COMMENT_KEYWORDS[shortLang] || COMMENT_KEYWORDS['en'];
}

function extractNumber(text: string): number | null {
  const match = text.match(/[\d,.]+/);
  if (match) {
    // Remove commas, etc.
    const num = parseInt(match[0].replace(/[,.]/g, ''), 10);
    if (!isNaN(num)) return num;
  }
  
  // Check Arabic words
  for (const [word, value] of Object.entries(ARABIC_NUMBER_WORDS)) {
    if (text.includes(word)) return value;
  }
  return null;
}

const EXCLUDED_COMMENT_PATTERNS = [
  'اضافة تعليق', 'إضافة تعليق', 'أضف تعليق', 'كتابة تعليق',
  'add comment', 'add a comment', 'write a comment', 'leave a comment',
  'ajouter un commentaire', 'kommentar hinzufügen',
  'añadir comentario', 'agregar comentario', 'escribe un comentario',
  'adicionar comentário', 'aggiungi commento',
  'добавить комментарий',
];

function isExcludedCommentText(text: string): boolean {
  const lowerText = text.toLowerCase();
  return EXCLUDED_COMMENT_PATTERNS.some(pattern => lowerText.includes(pattern));
}

// Extract aria-labels helper (duplicated simple version to avoid circular dependency)
function getAriaLabels(el: HTMLElement): string {
  return Array.from(el.querySelectorAll('[aria-label]'))
    .map((node) => node.getAttribute('aria-label') || '')
    .join(' ');
}

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  // Strategy 1: Targeted DOM for Google Classroom Comment Count
  const countSpan = post.querySelector('.mUIrbf-vQzf8d');
  if (countSpan && countSpan.textContent) {
    const text = countSpan.textContent;
    const count = extractNumber(text);
    if (count !== null && count > 0) {
      return { hasComments: true, count, confidence: 'high', matchedText: text };
    }
  }

  // Strategy 2: Look for the specific comment button aria-label
  const commentButton = post.querySelector('button[aria-label]');
  if (commentButton) {
    const label = commentButton.getAttribute('aria-label') || '';
    const pageKeywords = getCommentKeywords(pageLang);
    const englishKeywords = getCommentKeywords('en');
    const allKeywords = [...pageKeywords.plural, ...englishKeywords.plural, ...pageKeywords.singular, ...englishKeywords.singular];
    
    for (const keyword of allKeywords) {
      if (label.toLowerCase().includes(keyword.toLowerCase())) {
        const count = extractNumber(label);
        if (count && count > 0) {
          return { hasComments: true, count, confidence: 'high', matchedText: label };
        }
      }
    }
  }
  
  // Strategy 3: Text Fallback (ignoring body content)
  // We need to be careful not to trigger on "Add class comment" placeholder
  const clone = post.cloneNode(true) as HTMLElement;
  const bodyContent = clone.querySelectorAll('.n8F6Jd, .a3j8U, .gM4mlb, .A6dC2c');
  bodyContent.forEach(el => el.remove());
  
  const safeText = (clone.innerText || '') + ' ' + getAriaLabels(clone);
  
  const pageKeywords = getCommentKeywords(pageLang);
  const englishKeywords = getCommentKeywords('en');
  const allPlural = [...pageKeywords.plural, ...englishKeywords.plural];
  const allSingular = [...pageKeywords.singular, ...englishKeywords.singular];
  
  for (const keyword of allPlural) {
    if (safeText.toLowerCase().includes(keyword.toLowerCase())) {
      if (isExcludedCommentText(safeText)) continue;
      
      const count = extractNumber(safeText);
      if (count && count > 0) {
        return { hasComments: true, count, confidence: 'medium', matchedText: keyword };
      }
    }
  }
  
  return { hasComments: false, count: 0, confidence: 'high' };
}
