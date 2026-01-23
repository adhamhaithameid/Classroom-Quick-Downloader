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
  getCreatedKeywords, // Added
  hasDatePattern,
  isExcludedEditedPattern,
  parseUnicodeDate,
  formatTimeDifference,
  type ParsedDate,
} from './translations/detection-keywords';

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
  // New Hover Intelligence fields
  detectedDate?: Date | null;
  createdDate?: Date | null;
  timeDiff?: number | null; // ms
  timeDiffString?: string | null;
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
// DATE EXTRACTION & DISAMBIGUATION ENGINE
// ============================================================================

interface DateCandidate {
  date: Date;
  raw: string;
  confidence: 'high' | 'medium' | 'low';
  context: 'edited' | 'created' | 'unknown';
  node: Node;
}

function extractDatesFromPost(post: HTMLElement, pageLang: string): { created: Date | null; edited: Date | null } {
  const editedKeywords = getEditedKeywords(pageLang);
  const createdKeywords = getCreatedKeywords(pageLang);
  const englishEdited = getEditedKeywords('en'); // Safety fallback
  const englishCreated = getCreatedKeywords('en');
  
  const allEdited = [...new Set([...editedKeywords, ...englishEdited])];
  const allCreated = [...new Set([...createdKeywords, ...englishCreated])];
  
  const candidates: DateCandidate[] = [];
  
  // 1. Scan for dates using TreeWalker
  const walker = document.createTreeWalker(
    post,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip hidden elements and scripts
        if (node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          const tagName = node.parentElement.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (text.length < 5) continue; // Too short for a date
    
    // Parse date from this node
    const parsed = parseUnicodeDate(text);
    if (parsed) {
      // Determine context by checking siblings/parents for keywords
      let context: 'edited' | 'created' | 'unknown' = 'unknown';
      
      const parentText = normalizeText(node.parentElement?.textContent || '');
      const grandParentText = normalizeText(node.parentElement?.parentElement?.textContent || '');
      const surroundingText = (parentText + ' ' + grandParentText).toLowerCase();
      
      // Check for Edited keywords nearby
      if (allEdited.some(k => surroundingText.includes(normalizeForComparison(k)))) {
        context = 'edited';
      } 
      // Check for Created keywords nearby
      else if (allCreated.some(k => surroundingText.includes(normalizeForComparison(k)))) {
        context = 'created';
      }
      
      candidates.push({
        ...parsed,
        context,
        node
      });
    }
  }
  
  // 2. Disambiguate strategies
  let createdDate: Date | null = null;
  let editedDate: Date | null = null;
  
  // Strategy A: Explicit Context
  const explicitEdited = candidates.find(c => c.context === 'edited');
  const explicitCreated = candidates.find(c => c.context === 'created');
  
  if (explicitEdited) editedDate = explicitEdited.date;
  if (explicitCreated) createdDate = explicitCreated.date;
  
  // Strategy B: Time Heuristic (if we have 2 dates and unknown context)
  if ((!editedDate || !createdDate) && candidates.length >= 2) {
    // Sort logic: Created date is usually older than Edited date
    // But be careful - mostly we care if we found explicit "Edited".
    // If we haven't found explicit "Edited", maybe we shouldn't assume.
    // But assume we are calling this because we detected an "Edited" flag.
    
    const sortedDates = candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    const earliest = sortedDates[0];
    const latest = sortedDates[sortedDates.length - 1];
    
    if (!createdDate) createdDate = earliest.date;
    if (!editedDate && earliest !== latest) editedDate = latest.date;
  }
  
  // Strategy C: Single date found near "Edited" -> that's the Edit date
  if (candidates.length === 1 && candidates[0].context === 'edited' && !editedDate) {
    editedDate = candidates[0].date;
  }
  
  return { created: createdDate, edited: editedDate };
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
  const sanitizedPost = createSanitizedClone(post);
  
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
  const keywords = getEditedKeywords(pageLang);
  const englishKeywords = getEditedKeywords('en');
  
  const combinedKeywords = [...new Set([...keywords, ...englishKeywords])];
  
  const layer1 = executeEditedLayer1(post, combinedKeywords);
  const layer2 = executeEditedLayer2(post, combinedKeywords);
  const layer3 = executeEditedLayer3(post, combinedKeywords);
  
  let primaryMatch: LayerResult = { 
    score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: '' 
  };
  let primaryLayer = 0;
  
  if (layer1.score > primaryMatch.score) { primaryMatch = layer1; primaryLayer = 1; }
  if (layer2.score > primaryMatch.score) { primaryMatch = layer2; primaryLayer = 2; }
  if (layer3.score > primaryMatch.score) { primaryMatch = layer3; primaryLayer = 3; }
  
  const layer4 = executeEditedLayer4(post, primaryMatch.matchedText);
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
  
  const isEdited = finalScore >= CONFIDENCE_WEIGHTS.LOW_CONFIDENCE && 
                   primaryMatch.matchedText !== null;
  
  // Perform Date Extraction & Diff Calculation
  let detectedDate: Date | null = null;
  let createdDate: Date | null = null;
  let timeDiff: number | null = null;
  let timeDiffString: string | null = null;
  
  if (isEdited) {
    const dates = extractDatesFromPost(post, pageLang);
    detectedDate = dates.edited;
    createdDate = dates.created;
    
    if (detectedDate && createdDate) {
      timeDiff = detectedDate.getTime() - createdDate.getTime();
      // Ensure positive diff (sometimes clocks or parsing might be slight off)
      if (timeDiff < 0) timeDiff = 0;
      timeDiffString = formatTimeDifference(timeDiff);
    }
  }

  return {
    isEdited,
    confidence,
    confidenceScore: finalScore,
    matchedText: primaryMatch.matchedText,
    detectionLayer: primaryLayer,
    hasDateProximity: primaryMatch.hasDateProximity,
    usedParentContext: primaryMatch.usedParentContext,
    detectedDate, // New field
    createdDate,  // New field
    timeDiff,     // New field
    timeDiffString, // New field
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
