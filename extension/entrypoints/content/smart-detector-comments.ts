// filepath: extension/entrypoints/content/smart-detector-comments.ts
/**
 * SMART DETECTOR COMMENTS - Universal V3 Architecture
 * Uses Unicode digit normalization for accurate comment counting.
 */

import {
  GOLDEN_SELECTORS,
  EXCLUSION_KEYWORDS,
  COMMENT_KEYWORDS,
  normalizeText,
  extractNumber,
} from './translations/detection-keywords';

// ============================================================================
// TYPES
// ============================================================================

export interface CommentDetectionResult {
  hasComments: boolean;
  count: number;
  confidenceScore: number;
  matchedText: string | null;
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  let maxScore = 0;
  let detectedCount = 0;
  let matchedText: string | null = null;

  // 1. Scan Golden Selectors (High Confidence)
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    const el = post.querySelector(selector);
    if (!el) continue;
    
    const text = normalizeText(el.textContent || '');
    if (!text) continue;

    // Check for Exclusion
    const lowerText = text.toLowerCase();
    if (EXCLUSION_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) continue;

    // Look for Number + Keyword
    const num = extractNumber(text);
    if (num !== null && num > 0) {
      // Verify keyword presence
      if (COMMENT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
        detectedCount = num;
        maxScore = 100;
        matchedText = text;
        break;
      }
    }
  }

  // 2. Fallback: Aria-Labels
  if (maxScore < 50) {
    post.querySelectorAll('[aria-label]').forEach(el => {
      const label = normalizeText(el.getAttribute('aria-label') || '');
      const lowerLabel = label.toLowerCase();
      
      if (EXCLUSION_KEYWORDS.some(k => lowerLabel.includes(k.toLowerCase()))) return;

      const num = extractNumber(label);
      if (num !== null && num > 0) {
        if (COMMENT_KEYWORDS.some(k => lowerLabel.includes(k.toLowerCase()))) {
          detectedCount = num;
          maxScore = 80;
          matchedText = label;
        }
      }
    });
  }

  // 3. Fallback: TreeWalker scan
  if (maxScore < 30) {
    const clone = post.cloneNode(true) as HTMLElement;
    GOLDEN_SELECTORS.userContentExclusions.forEach(sel => 
      clone.querySelectorAll(sel).forEach(el => el.remove())
    );

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const text = normalizeText(node.textContent || '');
      if (text.length < 3) continue;
      
      const lowerText = text.toLowerCase();
      if (EXCLUSION_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) continue;

      const num = extractNumber(text);
      if (num !== null && num > 0) {
        if (COMMENT_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()))) {
          detectedCount = num;
          maxScore = 50;
          matchedText = text;
          break;
        }
      }
    }
  }

  return {
    hasComments: maxScore > 0 && detectedCount > 0,
    count: detectedCount,
    confidenceScore: maxScore,
    matchedText
  };
}
