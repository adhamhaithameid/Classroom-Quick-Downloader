// filepath: entrypoints/content/smart-detector.ts
/**
 * SMART DETECTOR - Universal Tier Architecture
 * 
 * Uses Unicode Property Escapes (\p{Nd}) with `u` flag for universal digit matching.
 * Supports 100+ languages including joke languages (Pirate, Hacker, Bork, Klingon).
 */

import {
  GOLDEN_SELECTORS,
  CONFIDENCE_WEIGHTS,
  normalizeText,
  normalizeForComparison,
  getEditedKeywords,
  getCombinedEditedKeywords,
  hasDatePattern,
  isExcludedEditedPattern,
} from './detection-keywords';

import {
  detectComments,
  type CommentDetectionResult,
  type LayerDebugInfo,
} from './smart-detector-comments';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EditedDetectionResult {
  isEdited: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  confidenceScore: number;
  matchedText: string | null;
  detectionLayer: number;
  hasDateProximity: boolean;
  usedParentContext: boolean;
  debugInfo?: EditedLayerDebugInfo;
}

interface EditedLayerDebugInfo {
  layer1Score: number;
  layer2Score: number;
  layer3Score: number;
  layer4Penalty: number;
  dateProximityBonus: number;
  parentContextBonus: number;
  matchDetails: string[];
}

interface LayerResult {
  score: number;
  matchedText: string | null;
  hasDateProximity: boolean;
  usedParentContext: boolean;
  details: string;
}

export interface PostStateResult {
  comments: CommentDetectionResult;
  edited: EditedDetectionResult;
  combinedConfidence: 'high' | 'medium' | 'low' | 'none';
  hasBothFlags: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

function findEditedKeyword(text: string, keywords: string[]): string | null {
  const normalizedText = normalizeForComparison(text);
  
  for (const keyword of keywords) {
    if (normalizedText.includes(normalizeForComparison(keyword))) {
      return keyword;
    }
  }
  return null;
}

function expandParentContext(node: Node): { text: string; hasDate: boolean; level: number } {
  const directText = normalizeText(node.textContent || '');
  if (hasDatePattern(directText)) {
    return { text: directText, hasDate: true, level: 0 };
  }
  
  if (node.parentElement) {
    const parentText = normalizeText(node.parentElement.textContent || '');
    if (hasDatePattern(parentText)) {
      return { text: parentText, hasDate: true, level: 1 };
    }
    
    if (node.parentElement.parentElement) {
      const grandparentText = normalizeText(node.parentElement.parentElement.textContent || '');
      if (hasDatePattern(grandparentText)) {
        return { text: grandparentText, hasDate: true, level: 2 };
      }
    }
  }
  
  return { text: directText, hasDate: false, level: 0 };
}

// ============================================================================
// LAYER 1: GOLDEN SELECTORS
// ============================================================================

function executeEditedLayer1(post: HTMLElement, keywords: string[]): LayerResult {
  for (const selector of GOLDEN_SELECTORS.dateContainer) {
    const container = post.querySelector<HTMLElement>(selector);
    if (!container) continue;
    
    const text = normalizeText(container.textContent || '');
    
    const matchedKeyword = findEditedKeyword(text, keywords);
    if (matchedKeyword) {
      const datePresent = hasDatePattern(text);
      let score = CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN;
      if (datePresent) {
        score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;
      }
      
      return {
        score,
        matchedText: matchedKeyword,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `Layer1: Found "${matchedKeyword}" in "${selector}" (date: ${datePresent})`,
      };
    }
  }
  
  return { 
    score: 0, 
    matchedText: null, 
    hasDateProximity: false,
    usedParentContext: false,
    details: 'Layer1: No golden selector match' 
  };
}

// ============================================================================
// LAYER 2: SEMANTIC ATTRIBUTES
// ============================================================================

function executeEditedLayer2(post: HTMLElement, keywords: string[]): LayerResult {
  const ariaLabels = extractAriaLabels(post);
  
  for (const label of ariaLabels) {
    const matchedKeyword = findEditedKeyword(label, keywords);
    if (matchedKeyword) {
      const datePresent = hasDatePattern(label);
      let score = CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC;
      if (datePresent) {
        score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;
      }
      
      return {
        score,
        matchedText: matchedKeyword,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `Layer2: Found "${matchedKeyword}" in aria-label (date: ${datePresent})`,
      };
    }
  }
  
  const titleElements = post.querySelectorAll('[title]');
  for (const el of titleElements) {
    const title = normalizeText(el.getAttribute('title') || '');
    
    const matchedKeyword = findEditedKeyword(title, keywords);
    if (matchedKeyword) {
      const datePresent = hasDatePattern(title);
      let score = CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC;
      if (datePresent) {
        score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;
      }
      
      return {
        score,
        matchedText: matchedKeyword,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `Layer2: Found "${matchedKeyword}" in title (date: ${datePresent})`,
      };
    }
  }
  
  return { 
    score: 0, 
    matchedText: null, 
    hasDateProximity: false,
    usedParentContext: false,
    details: 'Layer2: No semantic match' 
  };
}

// ============================================================================
// LAYER 3: TREEWALKER WITH PARENT CONTEXT EXPANSION (Sliding Window)
// ============================================================================

function executeEditedLayer3(post: HTMLElement, keywords: string[]): LayerResult {
  // Traverse live DOM directly with element-level filtering to avoid clone cost.
  const walker = document.createTreeWalker(
    post,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }

          if (GOLDEN_SELECTORS.userContentExclusions.some((selector) => element.matches(selector))) {
            return NodeFilter.FILTER_REJECT;
          }

          try {
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
          } catch {
            // Ignore style lookup failures.
          }

          if (tagName === 'button' || element.getAttribute('role') === 'button') {
            const text = normalizeText(element.textContent || '').toLowerCase();
            if (/more|less|show|hide|voir|mehr|menos/i.test(text)) {
              return NodeFilter.FILTER_REJECT;
            }
          }

          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    }
  );
  
  let bestMatchWithDate: LayerResult | null = null;
  let bestMatchWithoutDate: LayerResult | null = null;
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (!text || text.length < 3) continue;
    
    if (isExcludedEditedPattern(text)) continue;
    
    const matchedKeyword = findEditedKeyword(text, keywords);
    if (matchedKeyword) {
      let datePresent = hasDatePattern(text);
      let usedParentContext = false;
      
      // SLIDING WINDOW: Escalate to parent/grandparent if no date in direct text
      if (!datePresent) {
        const expanded = expandParentContext(node);
        if (expanded.hasDate) {
          datePresent = true;
          usedParentContext = true;
        }
      }
      
      let score = CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL;
      if (datePresent) {
        score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;
      }
      if (usedParentContext) {
        score += CONFIDENCE_WEIGHTS.PARENT_CONTEXT_BONUS;
      }
      
      const result: LayerResult = {
        score,
        matchedText: matchedKeyword,
        hasDateProximity: datePresent,
        usedParentContext,
        details: `Layer3: Found "${matchedKeyword}" (date: ${datePresent}, parent: ${usedParentContext})`,
      };
      
      if (datePresent) {
        if (!bestMatchWithDate || result.score > bestMatchWithDate.score) {
          bestMatchWithDate = result;
        }
      } else {
        if (!bestMatchWithoutDate || result.score > bestMatchWithoutDate.score) {
          bestMatchWithoutDate = result;
        }
      }
    }
  }
  
  if (bestMatchWithDate) {
    return bestMatchWithDate;
  }
  if (bestMatchWithoutDate) {
    return {
      ...bestMatchWithoutDate,
      score: bestMatchWithoutDate.score / 2,
      details: bestMatchWithoutDate.details + ' (no date - reduced)',
    };
  }
  
  return { 
    score: 0, 
    matchedText: null, 
    hasDateProximity: false,
    usedParentContext: false,
    details: 'Layer3: No structural match' 
  };
}

// ============================================================================
// LAYER 4: EXCLUSION ENGINE
// ============================================================================

function executeEditedLayer4(post: HTMLElement, matchedText: string | null): LayerResult {
  if (!matchedText) {
    return { 
      score: 0, 
      matchedText: null, 
      hasDateProximity: false,
      usedParentContext: false,
      details: 'Layer4: Nothing to validate' 
    };
  }
  
  if (isExcludedEditedPattern(matchedText)) {
    return {
      score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
      matchedText,
      hasDateProximity: false,
      usedParentContext: false,
      details: `Layer4: PENALTY - "${matchedText}" excluded`,
    };
  }
  
  for (const selector of GOLDEN_SELECTORS.userContentExclusions.slice(0, 4)) {
    const userContent = post.querySelector(selector);
    if (userContent) {
      const userText = normalizeForComparison(userContent.textContent || '');
      if (userText.includes(normalizeForComparison(matchedText))) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
          matchedText,
          hasDateProximity: false,
          usedParentContext: false,
          details: `Layer4: PENALTY - Found in user content "${selector}"`,
        };
      }
    }
  }
  
  return { 
    score: 0, 
    matchedText: null, 
    hasDateProximity: false,
    usedParentContext: false,
    details: 'Layer4: Passed' 
  };
}

// ============================================================================
// EDITED DETECTION FUNCTION
// ============================================================================

export function detectEdited(post: HTMLElement, pageLang: string): EditedDetectionResult {
  // Always include English and Arabic as fallbacks for maximum detection
  const combinedKeywords = getCombinedEditedKeywords(pageLang);
  
  const layer1 = executeEditedLayer1(post, combinedKeywords);
  const layer2 = executeEditedLayer2(post, combinedKeywords);
  const layer3 = executeEditedLayer3(post, combinedKeywords);
  
  let primaryMatch: LayerResult = { 
    score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: '' 
  };
  let primaryLayer = 0;
  
  // Priority-based matching
  if (layer1.score > 0 && layer1.matchedText) { 
    primaryMatch = layer1; 
    primaryLayer = 1; 
  } else if (layer2.score > 0 && layer2.matchedText) { 
    primaryMatch = layer2; 
    primaryLayer = 2; 
  } else if (layer3.score > 0 && layer3.matchedText) { 
    primaryMatch = layer3; 
    primaryLayer = 3; 
  }
  
  const layer4 = executeEditedLayer4(post, primaryMatch.matchedText);
  const finalScore = primaryMatch.score + layer4.score;
  
  let confidence: 'high' | 'medium' | 'low' | 'none';
  if (finalScore >= CONFIDENCE_WEIGHTS.HIGH_CONFIDENCE) {
    confidence = 'high';
  } else if (finalScore >= CONFIDENCE_WEIGHTS.MEDIUM_CONFIDENCE) {
    confidence = 'medium';
  } else if (finalScore >= CONFIDENCE_WEIGHTS.LOW_CONFIDENCE) {
    confidence = 'low';
  } else if (primaryMatch.matchedText !== null) {
    // If we matched a keyword, give low confidence
    confidence = 'low';
  } else {
    confidence = 'none';
  }
  
  // More permissive: if we found any edited keyword, consider it edited
  const isEdited = primaryMatch.matchedText !== null && 
                   layer4.score >= 0; // Not penalized by exclusion
  
  return {
    isEdited,
    confidence: isEdited ? confidence : 'none',
    confidenceScore: finalScore,
    matchedText: primaryMatch.matchedText,
    detectionLayer: primaryLayer,
    hasDateProximity: primaryMatch.hasDateProximity,
    usedParentContext: primaryMatch.usedParentContext,
    debugInfo: {
      layer1Score: layer1.score,
      layer2Score: layer2.score,
      layer3Score: layer3.score,
      layer4Penalty: layer4.score,
      dateProximityBonus: primaryMatch.hasDateProximity ? CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS : 0,
      parentContextBonus: primaryMatch.usedParentContext ? CONFIDENCE_WEIGHTS.PARENT_CONTEXT_BONUS : 0,
      matchDetails: [layer1.details, layer2.details, layer3.details, layer4.details],
    },
  };
}

// ============================================================================
// MASTER AGGREGATION FUNCTION
// ============================================================================

export function detectPostState(post: HTMLElement, pageLang: string): PostStateResult {
  const comments = detectComments(post, pageLang);
  const edited = detectEdited(post, pageLang);
  
  const hasComments = comments.hasComments && comments.confidence !== 'none';
  const isEdited = edited.isEdited && edited.confidence !== 'none';
  
  let combinedConfidence: 'high' | 'medium' | 'low' | 'none';
  
  if ((comments.confidence === 'high' && hasComments) || 
      (edited.confidence === 'high' && isEdited)) {
    combinedConfidence = 'high';
  } else if ((comments.confidence === 'medium' && hasComments) || 
             (edited.confidence === 'medium' && isEdited)) {
    combinedConfidence = 'medium';
  } else if ((comments.confidence === 'low' && hasComments) || 
             (edited.confidence === 'low' && isEdited)) {
    combinedConfidence = 'low';
  } else {
    combinedConfidence = 'none';
  }
  
  return {
    comments,
    edited,
    combinedConfidence,
    hasBothFlags: hasComments && isEdited,
  };
}

// ============================================================================
// LEGACY EXPORTS
// ============================================================================

export { detectComments } from './smart-detector-comments';
export type { CommentDetectionResult, LayerDebugInfo } from './smart-detector-comments';

export function analyzePost(
  post: HTMLElement,
  pageLang: string
): { comments: CommentDetectionResult; edited: EditedDetectionResult } {
  return {
    comments: detectComments(post, pageLang),
    edited: detectEdited(post, pageLang),
  };
}
