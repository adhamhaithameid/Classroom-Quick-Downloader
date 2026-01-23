// filepath: entrypoints/content/smart-detector-comments.ts
/**
 * SMART DETECTOR COMMENTS - Universal Tier Architecture
 * 
 * SEMANTIC TRIANGULATION ALGORITHM:
 * 1. Accessibility Scan (Layer 1): High-confidence aria-label/title extraction
 * 2. Interactive Heuristic (Layer 2): role="button" checks with strict exclusions
 * 3. Legacy Golden Selectors (Layer 3): Fallback for known DOM structures
 */

import {
  GOLDEN_SELECTORS,
  CONFIDENCE_WEIGHTS,
  normalizeText,
  normalizeForComparison,
  parseUnicodeInteger,
  getCommentKeywords,
  isExcludedCommentPattern,
  COMMENT_REGEX_PATTERN,
  type CommentKeywords,
} from './translations/detection-keywords';

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

/**
 * Validates if the text contains a comment count pattern.
 * Uses strict Regex: "{Number} {CommentKeyword}" (e.g., "5 comments")
 */
function extractCountFromText(text: string, keywords: CommentKeywords): { count: number; matchedText: string } | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // 1. Run the Regex
  const match = normalized.match(COMMENT_REGEX_PATTERN);
  if (!match) return null;

  const [fullMatch, digitStr, wordStr] = match;

  // 2. keyword validation
  // We need to verify that 'wordStr' actually contains one of our keywords
  const lowerWord = normalizeForComparison(wordStr);
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  
  const keywordMatch = allKeywords.some(k => lowerWord.includes(normalizeForComparison(k)));
  if (!keywordMatch) return null;

  // 3. Strict Exclusion check on the FULL string to avoid "Add 5 comments" (unlikely but possible)
  if (isExcludedCommentPattern(normalized)) return null;

  // 4. Parse the number
  const count = parseUnicodeInteger(digitStr);
  if (count === null) return null;

  return { count, matchedText: fullMatch };
}

// ============================================================================
// LAYER 1: ACCESSIBILITY SCAN (Aria-label & Title)
// "The Unbreakable Anchor"
// ============================================================================

function executeLayer1(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  // 1. Check aria-labels
  const elementsWithAria = post.querySelectorAll('[aria-label]');
  const candidates = [post, ...Array.from(elementsWithAria)] as HTMLElement[];

  for (const el of candidates) {
    const label = el.getAttribute('aria-label');
    if (!label) continue;

    const result = extractCountFromText(label, keywords);
    if (result && result.count > 0) {
      return {
        score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS,
        count: result.count,
        matchedText: result.matchedText,
        details: `Layer1: Found "${result.matchedText}" in aria-label`,
      };
    }
  }

  // 2. Check titles
  const elementsWithTitle = post.querySelectorAll('[title]');
  for (const el of elementsWithTitle) {
    const title = el.getAttribute('title');
    if (!title) continue;

    const result = extractCountFromText(title, keywords);
    if (result && result.count > 0) {
      return {
        score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN,
        count: result.count,
        matchedText: result.matchedText,
        details: `Layer1: Found "${result.matchedText}" in title`,
      };
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'Layer1: No match' };
}

// ============================================================================
// LAYER 2: INTERACTIVE HEURISTIC (Role=Button/Link)
// "The Interactive Check"
// ============================================================================

function executeLayer2(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  // Select potential interactive elements
  const interactiveElements = post.querySelectorAll('[role="button"], [role="link"], button, a');

  for (const el of interactiveElements) {
    // Skip if hidden
    if ((el as HTMLElement).offsetParent === null) continue;

    const text = el.textContent || '';
    const result = extractCountFromText(text, keywords);

    if (result && result.count > 0) {
      // STRICT EXCLUSION: Double check content for action verbs
      if (isExcludedCommentPattern(text)) continue;

      return {
        score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC,
        count: result.count,
        matchedText: result.matchedText,
        details: `Layer2: Found "${result.matchedText}" in interactive element <${el.tagName}>`,
      };
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'Layer2: No semantic match' };
}

// ============================================================================
// LAYER 3: GOLDEN SELECTORS (Legacy Fallback)
// "The Safety Net"
// ============================================================================

function executeLayer3(post: HTMLElement, keywords: CommentKeywords): LayerResult {
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    const element = post.querySelector<HTMLElement>(selector);
    if (!element) continue;

    const text = element.innerText || element.textContent || ''; // innerText prefers visible text
    const result = extractCountFromText(text, keywords);

    if (result && result.count > 0) {
      return {
        score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL,
        count: result.count,
        matchedText: result.matchedText,
        details: `Layer3: Found "${result.matchedText}" via selector "${selector}"`,
      };
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'Layer3: No structural match' };
}

// ============================================================================
// LAYER 4: EXCLUSION ENGINE (Final Sanity Check)
// ============================================================================

function executeLayer4(post: HTMLElement, matchedText: string | null): LayerResult {
  if (!matchedText) {
    return { score: 0, count: null, matchedText: null, details: 'Layer4: Nothing to validate' };
  }

  // 1. Global Exclusion Pattern Check
  if (isExcludedCommentPattern(matchedText)) {
    return {
      score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
      count: null,
      matchedText,
      details: `Layer4: PENALTY - "${matchedText}" matches exclusion pattern`,
    };
  }

  // 2. User Input Area Check (Placeholder text often triggers false positives)
  const inputElements = post.querySelectorAll('input, textarea, [contenteditable="true"]');
  for (const input of inputElements) {
    const placeholder = input.getAttribute('placeholder') || '';
    const label = input.getAttribute('aria-label') || '';
    
    // If the matched text is EXACTLY inside a placeholder, it's a false positive
    if (normalizeText(placeholder).includes(normalizeText(matchedText)) || 
        normalizeText(label).includes(normalizeText(matchedText))) {
      return {
        score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
        count: null,
        matchedText,
        details: 'Layer4: PENALTY - Found in user input placeholder/label',
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

  // Combine keywords for maximum coverage (User lang + English fallback)
  const combinedKeywords: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...englishKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...englishKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...englishKeywords.classComment])],
  };

  // EXECUTE LAYERS SEQUENTIALLY
  // We prioritize Layer 1, then Layer 2, then Layer 3.
  const layer1 = executeLayer1(post, combinedKeywords);
  const layer2 = executeLayer2(post, combinedKeywords);
  const layer3 = executeLayer3(post, combinedKeywords);

  let primaryMatch: LayerResult = { score: 0, count: null, matchedText: null, details: '' };
  let primaryLayer = 0;

  // Winner-takes-all logic based on score
  if (layer1.score > primaryMatch.score) { primaryMatch = layer1; primaryLayer = 1; }
  if (layer2.score > primaryMatch.score) { primaryMatch = layer2; primaryLayer = 2; }
  if (layer3.score > primaryMatch.score) { primaryMatch = layer3; primaryLayer = 3; }

  // VALIDATION
  const layer4 = executeLayer4(post, primaryMatch.matchedText);
  const finalScore = primaryMatch.score + layer4.score;

  // Determine Confidence
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

  const hasComments = confidence !== 'none' && (primaryMatch.count ?? 0) > 0;

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
