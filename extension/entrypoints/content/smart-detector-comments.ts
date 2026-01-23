// filepath: entrypoints/content/smart-detector-comments.ts
/**
 * SMART DETECTOR COMMENTS - Universal Tier Architecture
 * 
 * Uses parseUnicodeInteger() for Unicode digit parsing (Devanagari, Bengali, Thai, etc.)
 * All patterns use the `u` flag for Unicode Property Escape support.
 */

import {
  GOLDEN_SELECTORS,
  CONFIDENCE_WEIGHTS,
  normalizeText,
  normalizeForComparison,
  parseUnicodeInteger,
  getCommentKeywords,
  isExcludedCommentPattern,
  type CommentKeywords,
} from './detection-keywords';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CommentDetectionResult {
  hasComments: boolean;
  count: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  confidenceScore: number;
  matchedText: string | null;
  detectionLayer: number;
  debugInfo?: LayerDebugInfo;
}

export interface LayerDebugInfo {
  layer1Score: number;
  layer2Score: number;
  layer3Score: number;
  layer4Penalty: number;
  matchDetails: string[];
}

interface LayerResult {
  score: number;
  count: number | null;
  matchedText: string | null;
  details: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSanitizedClone(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  
  for (const selector of GOLDEN_SELECTORS.userContentExclusions) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }
  
  clone.querySelectorAll('[role="button"]').forEach(btn => {
    const text = normalizeText(btn.textContent || '').toLowerCase();
    if (/more|less|show|hide|voir|mehr|menos/i.test(text)) {
      btn.remove();
    }
  });
  
  return clone;
}

function extractAriaLabels(element: HTMLElement): string[] {
  const labels: string[] = [];
  
  const selfLabel = element.getAttribute('aria-label');
  if (selfLabel) labels.push(normalizeText(selfLabel));
  
  element.querySelectorAll('[aria-label]').forEach(el => {
    const label = el.getAttribute('aria-label');
    if (label) labels.push(normalizeText(label));
  });
  
  return labels;
}

function findCommentKeyword(text: string, keywords: CommentKeywords): string | null {
  const normalizedText = normalizeForComparison(text);
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  for (const keyword of allKeywords) {
    if (normalizedText.includes(normalizeForComparison(keyword))) {
      return keyword;
    }
  }
  return null;
}

// ============================================================================
// LAYER 1: GOLDEN SELECTORS
// ============================================================================

function executeLayer1(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    const element = post.querySelector<HTMLElement>(selector);
    if (!element) continue;
    
    const text = normalizeText(element.textContent || '');
    if (!text) continue;
    
    const matchedKeyword = findCommentKeyword(text, keywords);
    if (matchedKeyword) {
      // CRITICAL: Use parseUnicodeInteger for universal digit support
      const count = parseUnicodeInteger(text);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: text,
          details: `Layer1: Found "${text}" via "${selector}" (count: ${count})`,
        };
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer1: No match' };
}

// ============================================================================
// LAYER 2: SEMANTIC ATTRIBUTES
// ============================================================================

function executeLayer2(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const ariaLabels = extractAriaLabels(post);
  
  for (const label of ariaLabels) {
    if (isExcludedCommentPattern(label)) continue;
    
    const matchedKeyword = findCommentKeyword(label, keywords);
    if (matchedKeyword) {
      const count = parseUnicodeInteger(label);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS,
          count,
          matchedText: label,
          details: `Layer2: Found "${label}" in aria-label (count: ${count})`,
        };
      }
    }
  }
  
  const titleElements = post.querySelectorAll('[title]');
  for (const el of titleElements) {
    const title = normalizeText(el.getAttribute('title') || '');
    
    if (isExcludedCommentPattern(title)) continue;
    
    const matchedKeyword = findCommentKeyword(title, keywords);
    if (matchedKeyword) {
      const count = parseUnicodeInteger(title);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC,
          count,
          matchedText: title,
          details: `Layer2: Found "${title}" in title (count: ${count})`,
        };
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer2: No semantic match' };
}

// ============================================================================
// LAYER 3: TREEWALKER WITH PARENT CONTEXT EXPANSION
// ============================================================================

function executeLayer3(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const sanitizedPost = createSanitizedClone(post);
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  const walker = document.createTreeWalker(
    sanitizedPost,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        try {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
        } catch {
          // Ignore
        }
        
        const tagName = parent.tagName.toLowerCase();
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (!text || text.length < 2) continue;
    
    if (isExcludedCommentPattern(text)) continue;
    
    for (const keyword of allKeywords) {
      const normalizedKeyword = normalizeForComparison(keyword);
      if (normalizeForComparison(text).includes(normalizedKeyword)) {
        let count = parseUnicodeInteger(text);
        
        // Parent context expansion
        if (count === null && node.parentElement) {
          const parentText = normalizeText(node.parentElement.textContent || '');
          count = parseUnicodeInteger(parentText);
          
          if (count === null && node.parentElement.parentElement) {
            const grandparentText = normalizeText(node.parentElement.parentElement.textContent || '');
            count = parseUnicodeInteger(grandparentText);
            
            if (count !== null && count > 0) {
              return {
                score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.PARENT_CONTEXT_BONUS,
                count,
                matchedText: grandparentText.substring(0, 50),
                details: `Layer3: Found "${keyword}" (count: ${count}) via grandparent`,
              };
            }
          } else if (count !== null && count > 0) {
            return {
              score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.PARENT_CONTEXT_BONUS,
              count,
              matchedText: parentText.substring(0, 50),
              details: `Layer3: Found "${keyword}" (count: ${count}) via parent`,
            };
          }
        } else if (count !== null && count > 0) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
            count,
            matchedText: text,
            details: `Layer3: Found "${keyword}" (count: ${count}) in direct text`,
          };
        }
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer3: No structural match' };
}

// ============================================================================
// LAYER 4: EXCLUSION ENGINE
// ============================================================================

function executeLayer4(post: HTMLElement, matchedText: string | null): LayerResult {
  if (!matchedText) {
    return { score: 0, count: null, matchedText: null, details: 'Layer4: Nothing to validate' };
  }
  
  if (isExcludedCommentPattern(matchedText)) {
    return {
      score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
      count: null,
      matchedText,
      details: `Layer4: PENALTY - "${matchedText.substring(0, 30)}" excluded`,
    };
  }
  
  const inputElements = post.querySelectorAll('input, textarea, [contenteditable="true"]');
  for (const input of inputElements) {
    const placeholder = normalizeText(input.getAttribute('placeholder') || '');
    if (normalizeForComparison(placeholder).includes(normalizeForComparison(matchedText))) {
      return {
        score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
        count: null,
        matchedText,
        details: 'Layer4: PENALTY - Found in placeholder',
      };
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer4: Passed' };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  const keywords = getCommentKeywords(pageLang);
  const englishKeywords = getCommentKeywords('en');
  
  const combinedKeywords: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...englishKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...englishKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...englishKeywords.classComment])],
  };
  
  const layer1 = executeLayer1(post, combinedKeywords);
  const layer2 = executeLayer2(post, combinedKeywords);
  const layer3 = executeLayer3(post, combinedKeywords);
  
  let primaryMatch: LayerResult = { score: 0, count: null, matchedText: null, details: '' };
  let primaryLayer = 0;
  
  if (layer1.score > primaryMatch.score) { primaryMatch = layer1; primaryLayer = 1; }
  if (layer2.score > primaryMatch.score) { primaryMatch = layer2; primaryLayer = 2; }
  if (layer3.score > primaryMatch.score) { primaryMatch = layer3; primaryLayer = 3; }
  
  const layer4 = executeLayer4(post, primaryMatch.matchedText);
  const finalScore = primaryMatch.score + layer4.score;
  
  let confidence: 'high' | 'medium' | 'low' | 'none';
  if (finalScore >= CONFIDENCE_WEIGHTS.HIGH_CONFIDENCE) {
    confidence = 'high';
  } else if (finalScore >= CONFIDENCE_WEIGHTS.MEDIUM_CONFIDENCE) {
    confidence = 'medium';
  } else if (finalScore >= CONFIDENCE_WEIGHTS.LOW_CONFIDENCE) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }
  
  const hasComments = finalScore >= CONFIDENCE_WEIGHTS.LOW_CONFIDENCE && 
                      primaryMatch.count !== null && 
                      primaryMatch.count > 0;
  
  return {
    hasComments,
    count: primaryMatch.count || 0,
    confidence,
    confidenceScore: finalScore,
    matchedText: primaryMatch.matchedText,
    detectionLayer: primaryLayer,
    debugInfo: {
      layer1Score: layer1.score,
      layer2Score: layer2.score,
      layer3Score: layer3.score,
      layer4Penalty: layer4.score,
      matchDetails: [layer1.details, layer2.details, layer3.details, layer4.details],
    },
  };
}

export type { CommentKeywords };
