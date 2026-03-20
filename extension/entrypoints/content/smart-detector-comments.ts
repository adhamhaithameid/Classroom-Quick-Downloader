// filepath: entrypoints/content/smart-detector-comments.ts
/**
 * SMART DETECTOR COMMENTS - Universal V4 "100% Detection" Architecture
 * 
 * 4-LAYER NUCLEAR FALLBACK STRATEGY:
 * 1. Accessibility Scan (aria-label, title) - HIGHEST PRIORITY
 * 2. Button Heuristic (role="button" with number prefix)
 * 3. Golden Selectors (Legacy class-based fallback)
 * 4. NUCLEAR: Full DOM Text Scan (catches everything)
 * 
 * ALL text is normalized via normalizeText() to handle:
 * - Eastern Arabic numerals (٥ -> 5)
 * - BiDi control characters
 * - Unicode whitespace variants
 * - Word-numbers (واحد -> 1)
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
  layer4Score: number;
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
  /أضف\s+تعليق/i,             // Arabic: Add comment (imperative)
  /добавить\s+комментарий/i,  // Russian
  /コメントを追加/i,            // Japanese
  /添加评论/i,                 // Chinese
  /ajouter.*commentaire/i,    // French
  /kommentar.*hinzufügen/i,   // German
  /añadir.*comentario/i,      // Spanish
  /write.*comment/i,
  /type.*comment/i,
  /post.*comment/i,
  /new\s+comment/i,
  /leave.*comment/i,
];

function isActionButton(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return ACTION_BUTTON_PATTERNS.some(pattern => pattern.test(normalized));
}

// ============================================================================
// KEYWORD MATCHING UTILITIES
// ============================================================================

/**
 * Check if text contains ANY of the comment keywords
 */
function containsCommentKeyword(text: string, keywords: CommentKeywords): string | null {
  const normalizedText = normalizeForComparison(text);
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  for (const keyword of allKeywords) {
    const normalizedKeyword = normalizeForComparison(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Extract count from text - tries digits first, then word-numbers
 */
function extractCount(text: string): number | null {
  const count = parseUnicodeInteger(text);
  return (count !== null && count > 0 && count < 10000) ? count : null;
}

// ============================================================================
// LAYER 0: DOM TRUTH (ABSOLUTE AUTHORITY)
// Targets the specific Classwork tab comment container that Google renders.
// When this structure exists, it is the AUTHORITATIVE source and overrides all
// fuzzy matching or nuclear scan results.
// 
// TARGET STRUCTURE (per spec):
// <div class="qCWAqb seqYL" ...>
//     <div class="gmNu1d huI6Cb Cx437e">
//         <i class="google-symbols">comment</i> 1
//     </div>
// </div>
//
// Primary Selector: .qCWAqb .huI6Cb
// The count is extracted from the textContent of .huI6Cb (contains icon + number)
// ============================================================================

function executeLayer0_DOMTruth(post: HTMLElement): LayerResult {
  // PRIMARY: Target .qCWAqb .huI6Cb per spec
  // This is the most reliable selector for the Classwork comment indicator
  const huI6CbElement = post.querySelector<HTMLElement>('.qCWAqb .huI6Cb');
  
  if (huI6CbElement) {
    // Extract text content - will be like "comment 1" or just "1"
    const rawText = huI6CbElement.textContent?.trim() || '';
    const normalizedText = normalizeText(rawText);
    
    // Parse the number from the text
    const count = extractCount(normalizedText);
    if (count !== null && count > 0) {
      return {
        score: 100, // Maximum authority score - this is THE truth source
        count,
        matchedText: normalizedText,
        details: `Layer0-DOMTruth: Found "${normalizedText}" via .qCWAqb .huI6Cb (count: ${count})`,
      };
    }
  }
  
  // FALLBACK 1: Try .qCWAqb.seqYL container with various child selectors
  const commentContainer = post.querySelector<HTMLElement>('.qCWAqb.seqYL');
  
  if (commentContainer) {
    // Strategy 1: Find the text span with the comment count (e.g., "1 comment" or "3 class comments")
    const textSpan = commentContainer.querySelector<HTMLElement>('.mUIrbf-vQzf8d, .jzdBjc, span[aria-hidden="true"]');
    
    if (textSpan) {
      const rawText = textSpan.textContent?.trim() || '';
      const text = normalizeText(rawText);
      const count = extractCount(text);
      if (count !== null && count > 0) {
        return {
          score: 100,
          count,
          matchedText: text,
          details: `Layer0-DOMTruth: Found "${text}" in .qCWAqb.seqYL span (count: ${count})`,
        };
      }
    }
    
    // Strategy 2: Look for .huI6Cb within the container (without .qCWAqb prefix)
    const iconDiv = commentContainer.querySelector<HTMLElement>('.huI6Cb');
    if (iconDiv) {
      const iconDivText = normalizeText(iconDiv.textContent || '');
      const count = extractCount(iconDivText);
      if (count !== null && count > 0) {
        return {
          score: 100,
          count,
          matchedText: iconDivText,
          details: `Layer0-DOMTruth: Found "${iconDivText}" via .huI6Cb icon sibling (count: ${count})`,
        };
      }
    }
    
    // Strategy 3: Direct text content extraction from container
    const directText = normalizeText(commentContainer.textContent || '');
    const directCount = extractCount(directText);
    if (directCount !== null && directCount > 0 && directCount < 1000) {
      return {
        score: 100,
        count: directCount,
        matchedText: directText,
        details: `Layer0-DOMTruth: Found "${directText}" in container (count: ${directCount})`,
      };
    }
  }
  
  // FALLBACK 2: Check for .seqYL class alone (without qCWAqb)
  const seqYL = post.querySelector<HTMLElement>('.seqYL');
  if (seqYL && seqYL !== commentContainer) {
    const text = normalizeText(seqYL.textContent || '');
    const count = extractCount(text);
    if (count !== null && count > 0 && count < 1000) {
      return {
        score: 95,
        count,
        matchedText: text,
        details: `Layer0-DOMTruth: Found "${text}" via .seqYL (count: ${count})`,
      };
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer0: No DOM truth element found' };
}

// ============================================================================
// LAYER 1: ACCESSIBILITY SCAN (HIGHEST PRIORITY after DOM Truth)
// Scans aria-label and title attributes for comment patterns
// ============================================================================

function executeLayer1_AccessibilityScan(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  // 1A. Scan aria-label attributes
  const ariaElements = post.querySelectorAll('[aria-label]');
  for (const el of ariaElements) {
    const rawLabel = el.getAttribute('aria-label') || '';
    const label = normalizeText(rawLabel);
    
    if (!label || label.length < 2) continue;
    if (isExcludedCommentPattern(label)) continue;
    if (isActionButton(label)) continue;
    
    const matchedKeyword = containsCommentKeyword(label, keywords);
    if (matchedKeyword) {
      const count = extractCount(label);
      // CRITICAL: Only match if we have an actual count - don't default to 1
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS + 
                 CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: label,
          details: `Layer1-Aria: Found "${matchedKeyword}" in "${label}" (count: ${count})`,
        };
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
    
    const matchedKeyword = containsCommentKeyword(title, keywords);
    if (matchedKeyword) {
      const count = extractCount(title);
      // CRITICAL: Only match if we have an actual count
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: title,
          details: `Layer1-Title: Found "${matchedKeyword}" in "${title}" (count: ${count})`,
        };
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer1: No accessibility match' };
}

// ============================================================================
// LAYER 2: BUTTON HEURISTIC
// Scans role="button" elements for comment patterns
// ============================================================================

function executeLayer2_ButtonHeuristic(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  const buttonElements = post.querySelectorAll('[role="button"], button, [jsaction*="click"]');
  
  for (const el of buttonElements) {
    const rawText = el.textContent || '';
    const text = normalizeText(rawText);
    
    if (!text || text.length < 2) continue;
    if (isExcludedCommentPattern(text)) continue;
    if (isActionButton(text)) continue;
    
    const matchedKeyword = containsCommentKeyword(text, keywords);
    if (matchedKeyword) {
      const count = extractCount(text);
      // CRITICAL: Only match if we have an actual count
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: text,
          details: `Layer2-Button: Found "${matchedKeyword}" (count: ${count})`,
        };
      }
    }
    
    // Also check aria-label on the button itself
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || '');
    if (ariaLabel && !isActionButton(ariaLabel) && !isExcludedCommentPattern(ariaLabel)) {
      const matchedKeyword = containsCommentKeyword(ariaLabel, keywords);
      if (matchedKeyword) {
        const count = extractCount(ariaLabel);
        // CRITICAL: Only match if we have an actual count
        if (count !== null && count > 0) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS,
            count,
            matchedText: ariaLabel,
            details: `Layer2-ButtonAria: Found "${matchedKeyword}" (count: ${count})`,
          };
        }
      }
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer2: No button heuristic match' };
}

// ============================================================================
// LAYER 3: GOLDEN SELECTORS (LEGACY FALLBACK)
// Uses class-based selectors as fallback
// ============================================================================

function executeLayer3_GoldenSelectors(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    try {
      const elements = post.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        // STRATEGY: To avoid double-counting ("3 class comments" → "33 class comments")
        // we need to be very careful about how we extract the count.
        
        // Priority 1: Check aria-label first (single source of truth)
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const normalizedLabel = normalizeText(ariaLabel);
          if (!isExcludedCommentPattern(normalizedLabel) && !isActionButton(normalizedLabel)) {
            const matchedKeyword = containsCommentKeyword(normalizedLabel, keywords);
            if (matchedKeyword) {
              const count = extractCount(normalizedLabel);
              if (count !== null && count > 0) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: normalizedLabel,
                  details: `Layer3-Golden-Aria: Found "${matchedKeyword}" via "${selector}" (count: ${count})`,
                };
              }
            }
          }
        }
        
        // Priority 2: Find a child element that is ONLY a number (like a badge)
        // This avoids reading "3 class comments" twice
        for (const child of element.querySelectorAll<HTMLElement>('span, div')) {
          const childText = normalizeText(child.textContent || '');
          // Check if this child ONLY contains a number (e.g., "3" or "20")
          if (/^\d+$/.test(childText.trim()) && child.children.length === 0) {
            const count = parseInt(childText.trim(), 10);
            if (count > 0 && count < 10000) {
              // Found a pure number element, now check if parent has comment keyword
              const parentText = normalizeText(element.textContent || '');
              const matchedKeyword = containsCommentKeyword(parentText, keywords);
              if (matchedKeyword) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: `${count} (${matchedKeyword})`,
                  details: `Layer3-Golden-Badge: Found "${matchedKeyword}" via "${selector}" (count: ${count})`,
                };
              }
            }
          }
        }
        
        // Priority 3: Look for jzdBjc span (Classwork comment label like "3 class comments")
        const classworkLabel = element.querySelector<HTMLElement>('.jzdBjc');
        if (classworkLabel) {
          const labelText = normalizeText(classworkLabel.textContent || '');
          if (!isExcludedCommentPattern(labelText) && !isActionButton(labelText)) {
            const matchedKeyword = containsCommentKeyword(labelText, keywords);
            if (matchedKeyword) {
              const count = extractCount(labelText);
              if (count !== null && count > 0) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: labelText,
                  details: `Layer3-Golden-Label: Found "${matchedKeyword}" via jzdBjc (count: ${count})`,
                };
              }
            }
          }
        }
        
        // Priority 4: Only if element is a leaf node (no children), use its text
        if (element.children.length === 0) {
          const text = normalizeText(element.textContent || '');
          if (!text || text.length < 2) continue;
          if (isExcludedCommentPattern(text)) continue;
          if (isActionButton(text)) continue;
          
          const matchedKeyword = containsCommentKeyword(text, keywords);
          if (matchedKeyword) {
            const count = extractCount(text);
            if (count !== null && count > 0) {
              return {
                score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                count,
                matchedText: text,
                details: `Layer3-Golden-Leaf: Found "${matchedKeyword}" via "${selector}" (count: ${count})`,
              };
            }
          }
        }
      }
    } catch {
      continue;
    }
  }
  
  return { score: 0, count: null, matchedText: null, details: 'Layer3: No golden selector match' };
}

// ============================================================================
// LAYER 4: NUCLEAR FULL DOM SCAN (CATCHES EVERYTHING)
// TreeWalker-based scan of ALL visible text nodes
// ============================================================================

function executeLayer4_NuclearScan(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  // Traverse in-place and filter elements instead of cloning for better performance.
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

          // Optimized: Single matches() call with joined selector instead of array .some()
          if (GOLDEN_SELECTORS.userContentExclusionsJoined && element.matches(GOLDEN_SELECTORS.userContentExclusionsJoined)) {
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

          return NodeFilter.FILTER_SKIP;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    }
  );
  
  let bestMatch: LayerResult | null = null;
  let node: Node | null;
  
  while ((node = walker.nextNode())) {
    const rawText = node.textContent || '';
    const text = normalizeText(rawText);
    
    if (!text || text.length < 2 || text.length > 100) continue;
    if (isExcludedCommentPattern(text)) continue;
    if (isActionButton(text)) continue;
    
    const matchedKeyword = containsCommentKeyword(text, keywords);
    if (matchedKeyword) {
      const count = extractCount(text);
      // CRITICAL: Only match if we have an actual count
      if (count !== null && count > 0) {
        // Only accept if we haven't found a better match yet
        if (!bestMatch || count > (bestMatch.count || 0)) {
          bestMatch = {
            score: CONFIDENCE_WEIGHTS.LOW_CONFIDENCE + (count > 1 ? CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS : 0),
            count,
            matchedText: text,
            details: `Layer4-Nuclear: Found "${matchedKeyword}" in DOM text (count: ${count})`,
          };
        }
      }
    }
  }
  
  return bestMatch || { score: 0, count: null, matchedText: null, details: 'Layer4: No nuclear match' };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

export function detectComments(post: HTMLElement, pageLang: string): CommentDetectionResult {
  // Get keywords for current language + English fallback + Arabic (common)
  const keywords = getCommentKeywords(pageLang);
  const englishKeywords = getCommentKeywords('en');
  const arabicKeywords = getCommentKeywords('ar');
  
  // Combine keywords (deduplicated)
  const combinedKeywords: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...englishKeywords.singular, ...arabicKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...englishKeywords.plural, ...arabicKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...englishKeywords.classComment, ...arabicKeywords.classComment])],
  };
  
  // LAYER 0: DOM TRUTH (ABSOLUTE AUTHORITY)
  // If the specific Classwork comment container exists, its value is the AUTHORITY
  // and overrides all fuzzy matching or nuclear scan results.
  const layer0 = executeLayer0_DOMTruth(post);
  
  // If Layer 0 found a match, return immediately with high confidence
  if (layer0.score > 0 && layer0.count !== null && layer0.count > 0) {
    return {
      hasComments: true,
      count: layer0.count,
      confidence: 'high',
      confidenceScore: layer0.score,
      matchedText: layer0.matchedText,
      detectionLayer: 0,
      debugInfo: {
        layer1Score: 0,
        layer2Score: 0,
        layer3Score: 0,
        layer4Score: 0,
        exclusionPenalty: 0,
        matchDetails: [layer0.details],
      },
    };
  }
  
  // Execute remaining layers as fallback (5-Layer Nuclear Fallback Strategy)
  const layer1 = executeLayer1_AccessibilityScan(post, combinedKeywords);
  const layer2 = executeLayer2_ButtonHeuristic(post, combinedKeywords);
  const layer3 = executeLayer3_GoldenSelectors(post, combinedKeywords);
  const layer4 = executeLayer4_NuclearScan(post, combinedKeywords);
  
  // Find best match using priority order
  let primaryMatch: LayerResult = { score: 0, count: null, matchedText: null, details: '' };
  let primaryLayer = 0;
  
  // Layer 1 (Accessibility) takes priority
  if (layer1.score > 0 && layer1.count !== null && layer1.count > 0) { 
    primaryMatch = layer1; 
    primaryLayer = 1; 
  }
  // Layer 2 fallback
  else if (layer2.score > 0 && layer2.count !== null && layer2.count > 0) { 
    primaryMatch = layer2; 
    primaryLayer = 2; 
  }
  // Layer 3 fallback
  else if (layer3.score > 0 && layer3.count !== null && layer3.count > 0) { 
    primaryMatch = layer3; 
    primaryLayer = 3; 
  }
  // Layer 4 NUCLEAR fallback
  else if (layer4.score > 0 && layer4.count !== null && layer4.count > 0) { 
    primaryMatch = layer4; 
    primaryLayer = 4; 
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
  } else if (primaryMatch.count !== null && primaryMatch.count > 0) {
    // If we found a count, give low confidence even without score threshold
    confidence = 'low';
  } else {
    confidence = 'none';
  }
  
  // Final determination - be more permissive
  const hasComments = (primaryMatch.count !== null && primaryMatch.count > 0) ||
                      (finalScore >= CONFIDENCE_WEIGHTS.LOW_CONFIDENCE && primaryMatch.matchedText !== null);
  
  return {
    hasComments,
    count: primaryMatch.count || 0,
    confidence: hasComments ? confidence : 'none',
    confidenceScore: finalScore,
    matchedText: primaryMatch.matchedText,
    detectionLayer: primaryLayer,
    debugInfo: {
      layer1Score: layer1.score,
      layer2Score: layer2.score,
      layer3Score: layer3.score,
      layer4Score: layer4.score,
      exclusionPenalty: 0,
      matchDetails: [layer1.details, layer2.details, layer3.details, layer4.details],
    },
  };
}

export type { CommentKeywords };
