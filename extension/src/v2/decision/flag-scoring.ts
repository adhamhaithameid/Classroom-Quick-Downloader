// filepath: extension/src/v2/decision/flag-scoring.ts
/**
 * ============================================================================
 * V2 FLAG SCORING ENGINE — Unified Comment + Edited Detection
 * ============================================================================
 *
 * V1 ran comment and edited detection as two fully independent pipelines
 * in separate content scripts (comment_frame.content.ts and edited_frame.content.ts).
 * Each had its own MutationObserver, heartbeat, and scan pass.
 *
 * V2 unifies everything into a single function: scoreFlagsForPost().
 * One call → FlagDecision with full DecisionTrace for debugging.
 *
 * Detection Layers (Comment):
 *   L0: DOM Truth — Google's own comment container (.qCWAqb .huI6Cb)
 *   L1: Accessibility — aria-label/title text with count extraction
 *   L2: Button Heuristic — role="button" elements with comment keywords
 *   L3: Golden Selectors — class-based selectors (last resort)
 *   L4: Nuclear — TreeWalker full DOM scan for comment keywords
 *
 * Detection Layers (Edited):
 *   L1: Golden Selectors — date container class selectors
 *   L2: Semantic — aria-label/title attributes with date patterns
 *   L3: TreeWalker — full scan with parent context expansion
 *   L4: Exclusion — penalty for false-positive patterns
 *
 * @author Adham — this is the single most complex module in V2.
 *   spent 5 months getting these heuristics right. don't change
 *   the scoring thresholds without running the full test suite.
 * @since v4.0.0
 */

import type {
  FlagDecision,
  DecisionTrace,
  LayerTrace,
  ExclusionTrace,
  ViewKind,
} from '../../engines/types';

import {
  getCommentKeywords,
  getEditedKeywords,
  preloadKeywords,
  detectPageLanguage,
  normalizeText,
  normalizeForComparison,
  parseUnicodeInteger,
  hasDatePattern,
  CONFIDENCE_WEIGHTS,
  GOLDEN_SELECTORS,
  type CommentKeywords,
} from './keyword-loader';

import {
  applyExclusions,
  isExcludedText,
  isInExcludedArea,
  getUserContentSelectors,
  type ExclusionResult,
} from './exclusion-engine';

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Internal result from a single detection layer.
 */
interface CommentLayerResult {
  score: number;
  count: number | null;
  matchedText: string | null;
  details: string;
}

interface EditedLayerResult {
  score: number;
  matchedText: string | null;
  hasDateProximity: boolean;
  usedParentContext: boolean;
  details: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Action button patterns — regex for "Add comment" style text.
 * These are UI buttons, not actual comment indicators.
 * Tested via the exclusion engine as well, but we double-check
 * at the layer level for early exit.
 */
const ACTION_BUTTON_PATTERNS: RegExp[] = [
  /add\s+(?:class\s+)?comment/i,
  /(?:اضافة|إضافة|أضف)\s+تعليق/i,
  /добавить\s+комментарий/i,
  /コメントを追加/i,
  /添加评论/i,
  /ajouter.*commentaire/i,
  /kommentar.*hinzufügen/i,
  /añadir.*comentario/i,
  /write.*comment/i,
  /type.*comment/i,
  /post.*comment/i,
  /new\s+comment/i,
  /leave.*comment/i,
];

/**
 * Thresholds for flag verdicts.
 * These come from the refactor plan (§7.4).
 * Do NOT change these without running the full test suite.
 */
const THRESHOLDS = {
  comment_show: 40,
  comment_high_confidence: 70,
  edited_show: 35,
  edited_high_confidence: 65,
  both_minimum_each: 30,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Check if text looks like an action button ("Add comment", etc.) */
function isActionButton(text: string): boolean {
  const normalized = normalizeForComparison(text);
  return ACTION_BUTTON_PATTERNS.some(p => p.test(normalized));
}

/** Check if text contains any of the comment keywords */
function containsCommentKeyword(text: string, keywords: CommentKeywords): string | null {
  const normalizedText = normalizeForComparison(text);
  const allKeywords = [...keywords.singular, ...keywords.plural, ...keywords.classComment];
  for (const keyword of allKeywords) {
    if (normalizedText.includes(normalizeForComparison(keyword))) {
      return keyword;
    }
  }
  return null;
}

/** Extract a numeric count from text using Unicode-aware parsing */
function extractCount(text: string): number | null {
  return parseUnicodeInteger(text);
}

/** Find an edited keyword in text */
function findEditedKeyword(text: string, keywords: string[]): string | null {
  const normalizedText = normalizeForComparison(text);
  for (const keyword of keywords) {
    if (normalizedText.includes(normalizeForComparison(keyword))) {
      return keyword;
    }
  }
  return null;
}

/** Extract aria-label values from all elements in a post */
function extractAriaLabels(post: HTMLElement): string[] {
  const labels: string[] = [];
  const elements = post.querySelectorAll('[aria-label]');
  for (const el of elements) {
    const label = el.getAttribute('aria-label');
    if (label) labels.push(normalizeText(label));
  }
  return labels;
}

/**
 * Expand parent context — walk up the DOM to find date patterns
 * near an edited keyword. This catches cases where "Edited" and
 * "Dec 14, 2025" are in sibling elements.
 */
function expandParentContext(node: Node): { text: string; hasDate: boolean; level: number } {
  let current = node.parentElement;
  let level = 0;

  while (current && level < 3) {
    level++;
    const text = normalizeText(current.textContent || '');
    if (hasDatePattern(text)) {
      return { text, hasDate: true, level };
    }
    current = current.parentElement;
  }

  return { text: '', hasDate: false, level };
}

// ============================================================================
// COMMENT DETECTION LAYERS
// ============================================================================

/**
 * LAYER 0: DOM TRUTH — Google's own comment container.
 *
 * The most reliable source. Google renders comment counts in
 * .qCWAqb .huI6Cb elements. If we find this, it's authoritative.
 * Score: 100 (maximum).
 */
function commentLayer0_DOMTruth(post: HTMLElement): CommentLayerResult {
  // Primary: .qCWAqb .huI6Cb
  const huI6Cb = post.querySelector<HTMLElement>('.qCWAqb .huI6Cb');
  if (huI6Cb) {
    const text = normalizeText(huI6Cb.textContent?.trim() || '');
    const count = extractCount(text);
    if (count !== null && count > 0) {
      return {
        score: 100,
        count,
        matchedText: text,
        details: `L0-DOMTruth: "${text}" via .qCWAqb .huI6Cb (count: ${count})`,
      };
    }
  }

  // Fallback 1: .qCWAqb.seqYL container
  const container = post.querySelector<HTMLElement>('.qCWAqb.seqYL');
  if (container) {
    // Try specific child selectors
    const textSpan = container.querySelector<HTMLElement>(
      '.mUIrbf-vQzf8d, .jzdBjc, span[aria-hidden="true"]',
    );
    if (textSpan) {
      const text = normalizeText(textSpan.textContent?.trim() || '');
      const count = extractCount(text);
      if (count !== null && count > 0) {
        return { score: 100, count, matchedText: text, details: `L0-DOMTruth: "${text}" in .qCWAqb.seqYL span (count: ${count})` };
      }
    }

    // Try .huI6Cb inside the container
    const icon = container.querySelector<HTMLElement>('.huI6Cb');
    if (icon) {
      const text = normalizeText(icon.textContent || '');
      const count = extractCount(text);
      if (count !== null && count > 0) {
        return { score: 100, count, matchedText: text, details: `L0-DOMTruth: "${text}" via .huI6Cb (count: ${count})` };
      }
    }

    // Direct text content
    const directText = normalizeText(container.textContent || '');
    const directCount = extractCount(directText);
    if (directCount !== null && directCount > 0 && directCount < 1000) {
      return { score: 100, count: directCount, matchedText: directText, details: `L0-DOMTruth: "${directText}" direct (count: ${directCount})` };
    }
  }

  // Fallback 2: .seqYL alone
  const seqYL = post.querySelector<HTMLElement>('.seqYL');
  if (seqYL && seqYL !== container) {
    const text = normalizeText(seqYL.textContent || '');
    const count = extractCount(text);
    if (count !== null && count > 0 && count < 1000) {
      return { score: 95, count, matchedText: text, details: `L0-DOMTruth: "${text}" via .seqYL (count: ${count})` };
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'L0: No DOM truth found' };
}

/**
 * LAYER 1: Accessibility Scan — aria-label and title attributes.
 *
 * Google sets aria-labels with comment info for screen readers.
 * Score: LAYER_2_SEMANTIC (35) + bonuses.
 */
function commentLayer1_Accessibility(post: HTMLElement, keywords: CommentKeywords): CommentLayerResult {
  // Scan aria-label attributes
  const ariaElements = post.querySelectorAll('[aria-label]');
  for (const el of ariaElements) {
    const label = normalizeText(el.getAttribute('aria-label') || '');
    if (!label || label.length < 2) continue;
    if (isExcludedText(label, 'comment')) continue;
    if (isActionButton(label)) continue;

    const match = containsCommentKeyword(label, keywords);
    if (match) {
      const count = extractCount(label);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: label,
          details: `L1-Aria: "${match}" in "${label}" (count: ${count})`,
        };
      }
    }
  }

  // Scan title attributes
  const titleElements = post.querySelectorAll('[title]');
  for (const el of titleElements) {
    const title = normalizeText(el.getAttribute('title') || '');
    if (!title || title.length < 2) continue;
    if (isExcludedText(title, 'comment')) continue;
    if (isActionButton(title)) continue;

    const match = containsCommentKeyword(title, keywords);
    if (match) {
      const count = extractCount(title);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: title,
          details: `L1-Title: "${match}" in "${title}" (count: ${count})`,
        };
      }
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'L1: No accessibility match' };
}

/**
 * LAYER 2: Button Heuristic — role="button" elements.
 *
 * Google sometimes puts comment info in button text.
 * Score: LAYER_3_STRUCTURAL (20) + bonuses.
 */
function commentLayer2_ButtonHeuristic(post: HTMLElement, keywords: CommentKeywords): CommentLayerResult {
  const buttons = post.querySelectorAll('[role="button"], button, [jsaction*="click"]');

  for (const el of buttons) {
    const text = normalizeText(el.textContent || '');
    if (!text || text.length < 2) continue;
    if (isExcludedText(text, 'comment')) continue;
    if (isActionButton(text)) continue;

    const match = containsCommentKeyword(text, keywords);
    if (match) {
      const count = extractCount(text);
      if (count !== null && count > 0) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
          count,
          matchedText: text,
          details: `L2-Button: "${match}" (count: ${count})`,
        };
      }
    }

    // Also check button's own aria-label
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || '');
    if (ariaLabel && !isActionButton(ariaLabel) && !isExcludedText(ariaLabel, 'comment')) {
      const match = containsCommentKeyword(ariaLabel, keywords);
      if (match) {
        const count = extractCount(ariaLabel);
        if (count !== null && count > 0) {
          return {
            score: CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL + CONFIDENCE_WEIGHTS.ARIA_MATCH_BONUS,
            count,
            matchedText: ariaLabel,
            details: `L2-ButtonAria: "${match}" (count: ${count})`,
          };
        }
      }
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'L2: No button heuristic match' };
}

/**
 * LAYER 3: Golden Selectors — class-based comment containers.
 *
 * Uses GOLDEN_SELECTORS.commentContainer from detection-keywords.ts.
 * Score: LAYER_1_GOLDEN (40) + bonuses.
 */
function commentLayer3_GoldenSelectors(post: HTMLElement, keywords: CommentKeywords): CommentLayerResult {
  for (const selector of GOLDEN_SELECTORS.commentContainer) {
    try {
      const elements = post.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        // Priority 1: aria-label on the element
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const normalized = normalizeText(ariaLabel);
          if (!isExcludedText(normalized, 'comment') && !isActionButton(normalized)) {
            const match = containsCommentKeyword(normalized, keywords);
            if (match) {
              const count = extractCount(normalized);
              if (count !== null && count > 0) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: normalized,
                  details: `L3-Golden-Aria: "${match}" via "${selector}" (count: ${count})`,
                };
              }
            }
          }
        }

        // Priority 2: Pure number child elements (badge-style)
        for (const child of element.querySelectorAll<HTMLElement>('span, div')) {
          const childText = normalizeText(child.textContent || '');
          if (/^\d+$/.test(childText.trim()) && child.children.length === 0) {
            const count = parseInt(childText.trim(), 10);
            if (count > 0 && count < 10000) {
              const parentText = normalizeText(element.textContent || '');
              const match = containsCommentKeyword(parentText, keywords);
              if (match) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: `${count} (${match})`,
                  details: `L3-Golden-Badge: "${match}" via "${selector}" (count: ${count})`,
                };
              }
            }
          }
        }

        // Priority 3: .jzdBjc label (Classwork tab)
        const label = element.querySelector<HTMLElement>('.jzdBjc');
        if (label) {
          const text = normalizeText(label.textContent || '');
          if (!isExcludedText(text, 'comment') && !isActionButton(text)) {
            const match = containsCommentKeyword(text, keywords);
            if (match) {
              const count = extractCount(text);
              if (count !== null && count > 0) {
                return {
                  score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                  count,
                  matchedText: text,
                  details: `L3-Golden-Label: "${match}" via jzdBjc (count: ${count})`,
                };
              }
            }
          }
        }

        // Priority 4: Leaf node text
        if (element.children.length === 0) {
          const text = normalizeText(element.textContent || '');
          if (!text || text.length < 2) continue;
          if (isExcludedText(text, 'comment') || isActionButton(text)) continue;

          const match = containsCommentKeyword(text, keywords);
          if (match) {
            const count = extractCount(text);
            if (count !== null && count > 0) {
              return {
                score: CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN + CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS,
                count,
                matchedText: text,
                details: `L3-Golden-Leaf: "${match}" via "${selector}" (count: ${count})`,
              };
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return { score: 0, count: null, matchedText: null, details: 'L3: No golden selector match' };
}

/**
 * LAYER 4: Nuclear TreeWalker — scans ALL visible text nodes.
 *
 * The last resort. Walks every text node in the post,
 * skipping hidden elements and user content areas.
 * Score: LOW_CONFIDENCE (15) + bonuses.
 */
function commentLayer4_Nuclear(post: HTMLElement, keywords: CommentKeywords): CommentLayerResult {
  const userContentSelectors = getUserContentSelectors();

  const walker = document.createTreeWalker(
    post,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType === 1 /* ELEMENT_NODE */) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip user content areas
          if (userContentSelectors.some(s => el.matches(s))) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip hidden elements
          try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
          } catch { /* ignore */ }
          return NodeFilter.FILTER_SKIP;
        }
        if (node.nodeType === 3 /* TEXT_NODE */) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let bestMatch: CommentLayerResult | null = null;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (!text || text.length < 2 || text.length > 100) continue;
    if (isExcludedText(text, 'comment') || isActionButton(text)) continue;

    const match = containsCommentKeyword(text, keywords);
    if (match) {
      const count = extractCount(text);
      if (count !== null && count > 0) {
        if (!bestMatch || count > (bestMatch.count || 0)) {
          bestMatch = {
            score: CONFIDENCE_WEIGHTS.LOW_CONFIDENCE + (count > 1 ? CONFIDENCE_WEIGHTS.NUMBER_PRESENT_BONUS : 0),
            count,
            matchedText: text,
            details: `L4-Nuclear: "${match}" in DOM text (count: ${count})`,
          };
        }
      }
    }
  }

  return bestMatch || { score: 0, count: null, matchedText: null, details: 'L4: No nuclear match' };
}

// ============================================================================
// EDITED DETECTION LAYERS
// ============================================================================

/**
 * EDITED LAYER 1: Golden Selectors — date container classes.
 *
 * Scans GOLDEN_SELECTORS.dateContainer for edited keywords.
 * Score: LAYER_1_GOLDEN (40) + bonuses.
 */
function editedLayer1_GoldenSelectors(post: HTMLElement, keywords: string[]): EditedLayerResult {
  for (const selector of GOLDEN_SELECTORS.dateContainer) {
    const container = post.querySelector<HTMLElement>(selector);
    if (!container) continue;

    const text = normalizeText(container.textContent || '');
    const match = findEditedKeyword(text, keywords);
    if (match) {
      const datePresent = hasDatePattern(text);
      let score = CONFIDENCE_WEIGHTS.LAYER_1_GOLDEN;
      if (datePresent) score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;

      return {
        score,
        matchedText: match,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `EditedL1: "${match}" in "${selector}" (date: ${datePresent})`,
      };
    }
  }

  return { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: 'EditedL1: No golden match' };
}

/**
 * EDITED LAYER 2: Semantic Attributes — aria-label/title.
 *
 * Score: LAYER_2_SEMANTIC (35) + bonuses.
 */
function editedLayer2_Semantic(post: HTMLElement, keywords: string[]): EditedLayerResult {
  const ariaLabels = extractAriaLabels(post);

  for (const label of ariaLabels) {
    const match = findEditedKeyword(label, keywords);
    if (match) {
      const datePresent = hasDatePattern(label);
      let score = CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC;
      if (datePresent) score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;

      return {
        score,
        matchedText: match,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `EditedL2: "${match}" in aria-label (date: ${datePresent})`,
      };
    }
  }

  // Also check title attributes
  const titleElements = post.querySelectorAll('[title]');
  for (const el of titleElements) {
    const title = normalizeText(el.getAttribute('title') || '');
    const match = findEditedKeyword(title, keywords);
    if (match) {
      const datePresent = hasDatePattern(title);
      let score = CONFIDENCE_WEIGHTS.LAYER_2_SEMANTIC;
      if (datePresent) score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;

      return {
        score,
        matchedText: match,
        hasDateProximity: datePresent,
        usedParentContext: false,
        details: `EditedL2: "${match}" in title (date: ${datePresent})`,
      };
    }
  }

  return { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: 'EditedL2: No semantic match' };
}

/**
 * EDITED LAYER 3: TreeWalker with parent context expansion.
 *
 * Full DOM scan with sliding window — if the direct text node
 * has an edited keyword but no date, check parent/grandparent.
 * Score: LAYER_3_STRUCTURAL (20) + bonuses.
 */
function editedLayer3_TreeWalker(post: HTMLElement, keywords: string[]): EditedLayerResult {
  const userContentSelectors = getUserContentSelectors();

  const walker = document.createTreeWalker(
    post,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType === 1 /* ELEMENT_NODE */) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          if (userContentSelectors.some(s => el.matches(s))) {
            return NodeFilter.FILTER_REJECT;
          }
          try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
          } catch { /* ignore */ }

          // Skip more/less toggle buttons
          if (tag === 'button' || el.getAttribute('role') === 'button') {
            const text = normalizeText(el.textContent || '').toLowerCase();
            if (/more|less|show|hide|voir|mehr|menos/i.test(text)) {
              return NodeFilter.FILTER_REJECT;
            }
          }

          return NodeFilter.FILTER_SKIP;
        }
        if (node.nodeType === 3 /* TEXT_NODE */) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let bestWithDate: EditedLayerResult | null = null;
  let bestWithoutDate: EditedLayerResult | null = null;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (!text || text.length < 3) continue;
    if (isExcludedText(text, 'edited')) continue;

    const match = findEditedKeyword(text, keywords);
    if (match) {
      let datePresent = hasDatePattern(text);
      let usedParentContext = false;

      // Sliding window: check parent context for dates
      if (!datePresent) {
        const expanded = expandParentContext(node);
        if (expanded.hasDate) {
          datePresent = true;
          usedParentContext = true;
        }
      }

      let score = CONFIDENCE_WEIGHTS.LAYER_3_STRUCTURAL;
      if (datePresent) score += CONFIDENCE_WEIGHTS.DATE_PROXIMITY_BONUS;
      if (usedParentContext) score += CONFIDENCE_WEIGHTS.PARENT_CONTEXT_BONUS;

      const result: EditedLayerResult = {
        score,
        matchedText: match,
        hasDateProximity: datePresent,
        usedParentContext,
        details: `EditedL3: "${match}" (date: ${datePresent}, parent: ${usedParentContext})`,
      };

      if (datePresent) {
        if (!bestWithDate || result.score > bestWithDate.score) {
          bestWithDate = result;
        }
      } else {
        if (!bestWithoutDate || result.score > bestWithoutDate.score) {
          bestWithoutDate = result;
        }
      }
    }
  }

  if (bestWithDate) return bestWithDate;
  if (bestWithoutDate) {
    return {
      ...bestWithoutDate,
      score: bestWithoutDate.score / 2,
      details: bestWithoutDate.details + ' (no date - reduced)',
    };
  }

  return { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: 'EditedL3: No TreeWalker match' };
}

/**
 * EDITED LAYER 4: Exclusion penalty for false positives.
 *
 * Score: LAYER_4_EXCLUSION (-25) if matched.
 */
function editedLayer4_Exclusion(post: HTMLElement, matchedText: string | null): EditedLayerResult {
  if (!matchedText) {
    return { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: 'EditedL4: Nothing to validate' };
  }

  // Check if matched text is in an excluded pattern
  if (isExcludedText(matchedText, 'edited')) {
    return {
      score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
      matchedText,
      hasDateProximity: false,
      usedParentContext: false,
      details: `EditedL4: PENALTY - "${matchedText}" excluded`,
    };
  }

  // Check if matched text appears in user content areas
  const userContentSelectors = getUserContentSelectors().slice(0, 4);
  for (const selector of userContentSelectors) {
    const userContent = post.querySelector(selector);
    if (userContent) {
      const userText = normalizeForComparison(userContent.textContent || '');
      if (userText.includes(normalizeForComparison(matchedText))) {
        return {
          score: CONFIDENCE_WEIGHTS.LAYER_4_EXCLUSION,
          matchedText,
          hasDateProximity: false,
          usedParentContext: false,
          details: `EditedL4: PENALTY - Found in user content "${selector}"`,
        };
      }
    }
  }

  return { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: 'EditedL4: Passed' };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Score comment flags for a single post.
 *
 * Runs all 5 comment detection layers and returns the best result.
 *
 * @param post - The post element to analyze
 * @param lang - Page language code
 * @returns Comment detection result with score, count, and layer details
 */
export function scoreComments(
  post: HTMLElement,
  lang: string,
): { score: number; count: number | null; matchedText: string | null; layers: CommentLayerResult[] } {
  const keywords = getCommentKeywords(lang);
  const enKeywords = getCommentKeywords('en');
  const arKeywords = getCommentKeywords('ar');

  // Combine keywords (deduped)
  const combined: CommentKeywords = {
    singular: [...new Set([...keywords.singular, ...enKeywords.singular, ...arKeywords.singular])],
    plural: [...new Set([...keywords.plural, ...enKeywords.plural, ...arKeywords.plural])],
    classComment: [...new Set([...keywords.classComment, ...enKeywords.classComment, ...arKeywords.classComment])],
  };

  // Layer 0: DOM Truth — if found, return immediately
  const l0 = commentLayer0_DOMTruth(post);
  if (l0.score > 0 && l0.count !== null && l0.count > 0) {
    return { score: l0.score, count: l0.count, matchedText: l0.matchedText, layers: [l0] };
  }

  // Remaining layers
  const l1 = commentLayer1_Accessibility(post, combined);
  const l2 = commentLayer2_ButtonHeuristic(post, combined);
  const l3 = commentLayer3_GoldenSelectors(post, combined);
  const l4 = commentLayer4_Nuclear(post, combined);

  const allLayers = [l0, l1, l2, l3, l4];

  // Find best match by priority order
  let best: CommentLayerResult = { score: 0, count: null, matchedText: null, details: '' };
  if (l1.score > 0 && l1.count) best = l1;
  else if (l2.score > 0 && l2.count) best = l2;
  else if (l3.score > 0 && l3.count) best = l3;
  else if (l4.score > 0 && l4.count) best = l4;

  return { score: best.score, count: best.count, matchedText: best.matchedText, layers: allLayers };
}

/**
 * Score edited flags for a single post.
 *
 * Runs all 4 edited detection layers and returns the best result
 * (including exclusion penalty from Layer 4).
 *
 * @param post - The post element to analyze
 * @param lang - Page language code
 * @returns Edited detection result with score, match, and layer details
 */
export function scoreEdited(
  post: HTMLElement,
  lang: string,
): { score: number; matchedText: string | null; hasDateProximity: boolean; layers: EditedLayerResult[] } {
  const keywords = getEditedKeywords(lang);
  const enKeywords = getEditedKeywords('en');
  const arKeywords = getEditedKeywords('ar');
  const combined = [...new Set([...keywords, ...enKeywords, ...arKeywords])];

  const l1 = editedLayer1_GoldenSelectors(post, combined);
  const l2 = editedLayer2_Semantic(post, combined);
  const l3 = editedLayer3_TreeWalker(post, combined);

  // Find primary match
  let primary: EditedLayerResult = { score: 0, matchedText: null, hasDateProximity: false, usedParentContext: false, details: '' };
  if (l1.score > 0 && l1.matchedText) primary = l1;
  else if (l2.score > 0 && l2.matchedText) primary = l2;
  else if (l3.score > 0 && l3.matchedText) primary = l3;

  // Apply exclusion layer
  const l4 = editedLayer4_Exclusion(post, primary.matchedText);
  const finalScore = primary.score + l4.score;

  return {
    score: finalScore,
    matchedText: primary.matchedText,
    hasDateProximity: primary.hasDateProximity,
    layers: [l1, l2, l3, l4],
  };
}

/**
 * THE MAIN FUNCTION — Score all flags for a single post.
 *
 * This replaces V1's:
 * - detectComments() from smart-detector-comments.ts
 * - detectEdited() from smart-detector.ts
 * - detectPostState() from smart-detector.ts
 *
 * One call → FlagDecision with full DecisionTrace.
 *
 * @param post - The post element to analyze
 * @param postId - Canonical post ID
 * @param viewKind - Current page type
 * @param lang - Page language (auto-detected if not provided)
 * @returns FlagDecision with verdict, scores, and trace
 */
export function scoreFlagsForPost(
  post: HTMLElement,
  postId: string,
  viewKind: ViewKind,
  lang?: string,
): FlagDecision {
  const startTime = performance.now();
  const pageLang = lang || detectPageLanguage();

  // Ensure keywords are loaded
  preloadKeywords(pageLang);

  // Run comment detection
  const commentResult = scoreComments(post, pageLang);

  // Run edited detection
  const editedResult = scoreEdited(post, pageLang);

  // Apply cross-type exclusions
  const exclusionResults: ExclusionResult[] = [];
  if (commentResult.matchedText) {
    exclusionResults.push(...applyExclusions(commentResult.matchedText, post, 'comment'));
  }
  if (editedResult.matchedText) {
    exclusionResults.push(...applyExclusions(editedResult.matchedText, post, 'edited'));
  }

  // Compute final scores (with exclusion penalties)
  let commentScore = commentResult.score;
  let editedScore = editedResult.score;

  for (const exc of exclusionResults) {
    if (exc.ruleId.includes('COMMENT') || exc.ruleId.includes('ACTION_BTN')) {
      commentScore += exc.penalty;
    }
    if (exc.ruleId.includes('EDITED')) {
      editedScore += exc.penalty;
    }
  }

  // Clamp to 0
  commentScore = Math.max(0, commentScore);
  editedScore = Math.max(0, editedScore);

  // Determine verdict
  let verdict: FlagDecision['finalVerdict'] = 'none';
  if (commentScore >= THRESHOLDS.comment_show && editedScore >= THRESHOLDS.edited_show &&
      commentScore >= THRESHOLDS.both_minimum_each && editedScore >= THRESHOLDS.both_minimum_each) {
    verdict = 'both';
  } else if (commentScore >= THRESHOLDS.comment_show) {
    verdict = 'comment';
  } else if (editedScore >= THRESHOLDS.edited_show) {
    verdict = 'edited';
  }

  // Determine confidence
  const maxScore = Math.max(commentScore, editedScore);
  const confidence: FlagDecision['confidence'] =
    maxScore >= THRESHOLDS.comment_high_confidence ? 'high' :
    maxScore >= THRESHOLDS.edited_show ? 'medium' : 'low';

  const elapsed = performance.now() - startTime;

  // Build trace
  const layers: LayerTrace[] = [];

  // Comment layers
  for (let i = 0; i < commentResult.layers.length; i++) {
    const l = commentResult.layers[i];
    layers.push({
      layerName: `comment-L${i}`,
      layerIndex: layers.length,
      score: l.score,
      matched: l.score > 0,
      matchedText: l.matchedText,
      selectorUsed: null,
      details: l.details,
    });
  }

  // Edited layers
  for (let i = 0; i < editedResult.layers.length; i++) {
    const l = editedResult.layers[i];
    layers.push({
      layerName: `edited-L${i + 1}`,
      layerIndex: layers.length,
      score: l.score,
      matched: l.score !== 0,
      matchedText: l.matchedText,
      selectorUsed: null,
      details: l.details,
    });
  }

  // Convert exclusion results to traces
  const exclusions: ExclusionTrace[] = exclusionResults.map(e => ({
    ruleId: e.ruleId,
    penalty: e.penalty,
    reason: e.reason,
    matchedText: e.matchedText,
  }));

  const trace: DecisionTrace = {
    postId,
    timestamp: Date.now(),
    viewKind,
    layers,
    exclusions,
    finalScore: maxScore,
    duration_ms: elapsed,
  };

  return {
    postId,
    commentScore,
    editedScore,
    commentCount: commentResult.count,
    editedDiff: null, // Will be computed by the render layer from date comparison
    exclusionPenalties: exclusionResults.map(e => ({ ruleId: e.ruleId, penalty: e.penalty })),
    finalVerdict: verdict,
    confidence,
    trace,
  };
}

/**
 * Get the current detection thresholds.
 * Exposed for testing and tuning.
 */
export function getThresholds(): typeof THRESHOLDS {
  return { ...THRESHOLDS };
}
