// filepath: entrypoints/content/smart-detector-comments.ts
/**
 * SMART DETECTOR COMMENTS - Universal V4 Architecture
 * 
 * 3-LAYER SEMANTIC TRIANGULATION:
 * 1. Accessibility Scan (aria-label, title) - HIGHEST PRIORITY
 * 2. Button Heuristic (role="button" with number prefix)
 * 3. Golden Selectors (Legacy class-based fallback)
 * 
 * ALL text is normalized via normalizeText() to handle:
 * - Eastern Arabic numerals (٥ -> 5)
 * - BiDi control characters
 * - Unicode whitespace variants
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
  exclusionPenalty: number;
  matchDetails: string[];
}

interface LayerResult {
  score: number;
  count: number | null;
  matchedText: string | null;
  details: string;
}

// ============================================================================
// EXCLUSION PATTERNS (Action buttons to ignore)
// ============================================================================

const ACTION_BUTTON_PATTERNS = [
  /add\s+(?:class\s+)?comment/i,
  /اضافة\s+تعليق/i,           // Arabic: Add comment
  /إضافة\s+تعليق/i,           // Arabic variant
  /добавить\s+комментарий/i,  // Russian
  /コメントを追加/i,            // Japanese
  /添加评论/i,                 // Chinese
  /ajouter.*commentaire/i,    // French
  /kommentar.*hinzufügen/i,   // German
  /añadir.*comentario/i,      // Spanish
  /write.*comment/i,
  /type.*comment/i,
  /post.*comment/i,
];

function isActionButton(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return ACTION_BUTTON_PATTERNS.some(pattern => pattern.test(normalized));
}

// ============================================================================
// LAYER 1: ACCESSIBILITY SCAN (HIGHEST PRIORITY)
// Scans aria-label and title attributes for comment patterns
// ============================================================================

function executeLayer1_AccessibilityScan(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  // 1A. Scan aria-label attributes
  const ariaElements = post.querySelectorAll('[aria-label]');
  for (const el of ariaElements) {
    const rawLabel = el.getAttribute('aria-label') || '';
    const label = normalizeText(rawLabel);
    
    if (!label || label.length < 2) continue;
    if (isExcludedCommentPattern(label)) continue;
    if (isActionButton(label)) continue;
    
    // Check for number + keyword pattern
    const count = parseUnicodeInteger(label);
    if (count !== null && count > 0) {
      for (const keyword of allKeywords) {
        if (normalizeForComparison(label).includes(normalizeForComparison(keyword))) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
            count,
            matchedText: label,
            details: `Layer1-Aria: Found "${label}" (count: ${count})`,
          };
        }
      }
    }
  }
  
  // 1B. Scan title attributes
  const titleElements = post.querySelectorAll('[title]');
  for (const el of titleElements) {
    const rawTitle = el.getAttribute('title') || '';
    const title = normalizeText(rawTitle);
    
    if (!title || title.length < 2) continue;
    if (isExcludedCommentPattern(title)) continue;
    if (isActionButton(title)) continue;
    
    const count = parseUnicodeInteger(title);
    if (count !== null && count > 0) {
      for (const keyword of allKeywords) {
        if (normalizeForComparison(title).includes(normalizeForComparison(keyword))) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
            count,
            matchedText: title,
            details: `Layer1-Title: Found "${title}" (count: ${count})`,
          };
        }
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer1: No accessibility match' };
}

// ============================================================================
// LAYER 2: BUTTON HEURISTIC
// Scans role="button" elements for number-prefixed content
// ============================================================================

function executeLayer2_ButtonHeuristic(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  // Scan elements with role="button"
  const buttonElements = post.querySelectorAll('[role="button"], button');
  
  for (const el of buttonElements) {
    const rawText = el.textContent || '';
    const text = normalizeText(rawText);
    
    if (!text || text.length < 2) continue;
    if (isExcludedCommentPattern(text)) continue;
    if (isActionButton(text)) continue;
    
    // Check for number at start or within text
    const count = parseUnicodeInteger(text);
    if (count !== null && count > 0) {
      for (const keyword of allKeywords) {
        if (normalizeForComparison(text).includes(normalizeForComparison(keyword))) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
            count,
            matchedText: text,
            details: `Layer2-Button: Found "${text}" (count: ${count})`,
          };
        }
      }
    }
    
    // Also check aria-label on the button itself
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || '');
    if (ariaLabel && !isActionButton(ariaLabel)) {
      const ariaCount = parseUnicodeInteger(ariaLabel);
      if (ariaCount !== null && ariaCount > 0) {
        for (const keyword of allKeywords) {
          if (normalizeForComparison(ariaLabel).includes(normalizeForComparison(keyword))) {
            return {
              score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS,
              count: ariaCount,
              matchedText: ariaLabel,
              details: `Layer2-ButtonAria: Found "${ariaLabel}" (count: ${ariaCount})`,
            };
          }
        }
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer2: No button heuristic match' };
}

// ============================================================================
// LAYER 3: GOLDEN SELECTORS (LEGACY FALLBACK)
// Uses class-based selectors as final fallback
// ============================================================================

function executeLayer3_GoldenSelectors(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    try {
      const element = post.querySelector<HTMLElement>(selector);
      if (!element) continue;
      
      const rawText = element.textContent || '';
      const text = normalizeText(rawText);
      
      if (!text || text.length < 2) continue;
      if (isExcludedCommentPattern(text)) continue;
      if (isActionButton(text)) continue;
      
      const count = parseUnicodeInteger(text);
      if (count !== null && count > 0) {
        for (const keyword of allKeywords) {
          if (normalizeForComparison(text).includes(normalizeForComparison(keyword))) {
            return {
              score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
              count,
              matchedText: text,
              details: `Layer3-Golden: Found "${text}" via "${selector}" (count: ${count})`,
            };
          }
        }
      }
    } catch {
      // Selector may be invalid, skip
      continue;
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer3: No golden selector match' };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  // Get keywords for current language + English fallback
  const keywords = getCommentKeywords(pageLang);
  const englishKeywords = getCommentKeywords('en');
  
  // Combine keywords (deduplicated)
  const combinedKeywords: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...englishKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...englishKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...englishKeywords.classComment])],
  };
  
  // Execute 3-Layer Semantic Triangulation
  const layer1 = executeLayer1_AccessibilityScan(post, combinedKeywords);
  const layer2 = executeLayer2_ButtonHeuristic(post, combinedKeywords);
  const layer3 = executeLayer3_GoldenSelectors(post, combinedKeywords);
  
  // Find best match (highest score)
  let primaryMatch: LayerResult = { score: 0, count: null, matchedText: null, details: '' };
  let primaryLayer = 0;
  
  // Layer 1 has priority even with lower score due to accessibility stability
  if (layer1.score > 0) { 
    primaryMatch = layer1; 
    primaryLayer = 1; 
  }
  if (layer2.score > primaryMatch.score) { 
    primaryMatch = layer2; 
    primaryLayer = 2; 
  }
  if (layer3.score > primaryMatch.score) { 
    primaryMatch = layer3; 
    primaryLayer = 3; 
  }
  
  // Calculate final score
  const finalScore = primaryMatch.score;
  
  // Determine confidence level
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
  
  // Final determination
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
      exclusionPenalty: 0,
      matchDetails: [layer1.details, layer2.details, layer3.details],
    },
  };
}

export type { CommentKeywords };
