// filepath: extension/entrypoints/content/smart-detector.ts
/**
 * SMART DETECTOR - Universal Tier Architecture (v4)
 * Features:
 * 1. Semantic Triangulation for both Comments and Dates
 * 2. Unbreakable Accessibility-First Anchoring
 * 3. Unicode Property Escape support for all Scripts
 */

import {
  GOLDEN_SELECTORS,
  DATE_PATTERNS,
  getEditedKeywords,
  getCreatedKeywords,
  hasDatePattern,
  isExcludedEditedPattern,
  parseUnicodeDate,
  formatTimeDifference,
  normalizeText,
  normalizeForComparison,
  type ParsedDate,
} from './translations/detection-keywords';

import { detectComments, type CommentDetectionResult } from './smart-detector-comments';

// ============================================================================
// TYPES
// ============================================================================

export interface EditedDetectionResult {
  isEdited: boolean;
  editDate: Date | null;
  createDate: Date | null;
  diffString: string | null;
  matchedText: string | null;
  confidenceScore: number;
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
  hasBothFlags: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a sanitized clone without user content.
 */
function createSanitizedClone(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  for (const selector of GOLDEN_SELECTORS.userContentExclusions) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }
  return clone;
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
  const englishEdited = getEditedKeywords('en');
  const englishCreated = getCreatedKeywords('en');
  
  const allEdited = [...new Set([...editedKeywords, ...englishEdited])];
  const allCreated = [...new Set([...createdKeywords, ...englishCreated])];
  
  const candidates: DateCandidate[] = [];
  
  const walker = document.createTreeWalker(
    post,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
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
    if (text.length < 5) continue;
    
    const parsed = parseUnicodeDate(text);
    if (parsed) {
      let context: 'edited' | 'created' | 'unknown' = 'unknown';
      const surroundingText = (node.parentElement?.textContent || '').toLowerCase();
      
      if (allEdited.some(k => surroundingText.includes(normalizeForComparison(k)))) {
        context = 'edited';
      } else if (allCreated.some(k => surroundingText.includes(normalizeForComparison(k)))) {
        context = 'created';
      }
      
      candidates.push({ ...parsed, context, node });
    }
  }
  
  let createdDate: Date | null = null;
  let editedDate: Date | null = null;
  
  const explicitEdited = candidates.find(c => c.context === 'edited');
  const explicitCreated = candidates.find(c => c.context === 'created');
  
  if (explicitEdited) editedDate = explicitEdited.date;
  if (explicitCreated) createdDate = explicitCreated.date;
  
  if ((!editedDate || !createdDate) && candidates.length >= 2) {
    const sorted = candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (!createdDate) createdDate = sorted[0].date;
    if (!editedDate && sorted.length > 1) editedDate = sorted[sorted.length - 1].date;
  } else if (candidates.length === 1 && candidates[0].context === 'edited') {
    editedDate = candidates[0].date;
  }
  
  return { created: createdDate, edited: editedDate };
}

// ============================================================================
// MAIN DETECTION LOGIC
// ============================================================================

const CONFIDENCE_WEIGHTS = {
  LAYER_1_ARIA: 100,
  LAYER_2_TEXT: 70,
  LAYER_3_GOLDEN: 50,
  DATE_PROXIMITY_BONUS: 20,
  PARENT_CONTEXT_BONUS: 15,
  EXCLUSION_PENALTY: -100,
  HIGH_THRESHOLD: 80,
  MEDIUM_THRESHOLD: 50,
};

export function detectPostState(post: HTMLElement, pageLang: string): PostStateResult {
  // 1. Comments Detection
  const commentResult = detectComments(post, pageLang);

  // 2. Edited Detection (Simplified Triangulation for consistency)
  const sanitizedPost = createSanitizedClone(post);
  const editedKeywords = getEditedKeywords(pageLang);
  const englishEdited = getEditedKeywords('en');
  const allEdited = [...new Set([...editedKeywords, ...englishEdited])];

  let primaryMatch: LayerResult = { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: '' };
  
  // Scans for edited keywords
  const walker = document.createTreeWalker(sanitizedPost, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    const lowerText = text.toLowerCase();
    
    const matchedKeyword = allEdited.find(k => lowerText.includes(normalizeForComparison(k)));
    if (matchedKeyword) {
      const score = CONFIDENCE_WEIGHTS.LAYER_2_TEXT;
      if (score > primaryMatch.score) {
        primaryMatch = {
          score,
          matchedText: text,
          hasDateProximity: hasDatePattern(text),
          usedParentContext: false,
          details: `Found edited keyword: ${matchedKeyword}`
        };
      }
    }
  }

  // Final Evaluation
  const isEdited = primaryMatch.score >= CONFIDENCE_WEIGHTS.MEDIUM_THRESHOLD;
  
  // Date Extraction
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
      if (timeDiff < 0) timeDiff = 0;
      timeDiffString = formatTimeDifference(timeDiff);
    }
  }

  return {
    comments: commentResult,
    edited: {
      isEdited,
      editDate: detectedDate,
      createDate: createdDate,
      diffString: timeDiffString,
      matchedText: primaryMatch.matchedText,
      confidenceScore: primaryMatch.score,
      detectionLayer: 2, // Default to text layer for now
      hasDateProximity: primaryMatch.hasDateProximity,
      usedParentContext: primaryMatch.usedParentContext,
      detectedDate,
      createdDate,
      timeDiff,
      timeDiffString,
    },
    hasBothFlags: commentResult.hasComments && isEdited
  };
}

// ============================================================================
// LEGACY EXPORTS
// ============================================================================

export { detectComments } from './smart-detector-comments';
export type { CommentDetectionResult } from './smart-detector-comments';

export function analyzePost(post: HTMLElement, pageLang: string): PostStateResult {
  return detectPostState(post, pageLang);
}

export function detectEdited(post: HTMLElement, pageLang: string): EditedDetectionResult {
  return detectPostState(post, pageLang).edited;
}
