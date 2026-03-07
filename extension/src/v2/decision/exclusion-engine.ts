// filepath: extension/src/v2/decision/exclusion-engine.ts
/**
 * ============================================================================
 * V2 EXCLUSION ENGINE — Centralized False-Positive Prevention
 * ============================================================================
 *
 * V1's problem: Exclusion logic was scattered across 3 files:
 * - smart-detector-comments.ts: 14 regex ACTION_BUTTON_PATTERNS
 * - detection-keywords.ts: COMMENT_EXCLUSION_PATTERNS + EDITED_EXCLUSION_PATTERNS
 * - smart-detector.ts: GOLDEN_SELECTORS.userContentExclusions
 *
 * Each was tested independently, 14 regexes .some() on every text chunk.
 *
 * V2's approach:
 * - Single ExclusionRule registry (one source of truth)
 * - Pre-compiled composite RegExp for text-based patterns (one test() call)
 * - Selector-based rules for structural exclusions
 * - Each rule has a penalty score, a reason, and which flag types it applies to
 *
 * Why this matters:
 * - "Add class comment" is an action button, NOT a real comment indicator
 * - "i edited my homework" is student text, NOT an edited-post indicator
 * - Text inside contenteditable or input areas is user-generated
 *
 * @author Adham — this module kills the #1 cause of false-positive flags
 * @since v4.0.0
 */

import {
  normalizeForComparison,
  normalizeText,
} from '../../../entrypoints/content/detection-keywords';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single exclusion rule.
 *
 * Rules describe patterns that should NOT be counted as flag evidence.
 * When matched, they apply a negative penalty to the flag score.
 */
export interface ExclusionRule {
  /** Unique rule ID for tracing — e.g., 'ACTION_BTN_ADD_COMMENT' */
  id: string;

  /** What kind of check this rule performs */
  type: 'regex' | 'text' | 'selector';

  /**
   * The pattern to check:
   * - regex: a RegExp to test against text
   * - text: a substring to find (case-insensitive, normalized)
   * - selector: a CSS selector to match against DOM elements
   */
  pattern: RegExp | string;

  /** Which flag types this exclusion applies to */
  applies_to: ('comment' | 'edited')[];

  /** Score reduction when matched (negative number, typically -15 to -30) */
  penalty: number;

  /** Human-readable reason for the exclusion */
  reason: string;

  /** Category for grouping in traces */
  category: ExclusionCategory;
}

/**
 * Categories help group and understand exclusions in debug output.
 */
export type ExclusionCategory =
  | 'action_button'    // "Add comment", "Write comment", etc.
  | 'user_content'     // Text inside student-authored areas
  | 'template_text'    // Placeholder/empty-state text
  | 'navigation'       // Breadcrumbs, tab labels
  | 'cross_post';      // Text from adjacent post bleeding in

/**
 * Result of applying an exclusion rule.
 */
export interface ExclusionResult {
  /** The rule that matched */
  ruleId: string;

  /** Category of the rule */
  category: ExclusionCategory;

  /** Penalty applied */
  penalty: number;

  /** Why this was excluded */
  reason: string;

  /** The text or element that triggered the exclusion */
  matchedText: string;
}

// ============================================================================
// EXCLUSION RULES REGISTRY
// ============================================================================

/**
 * All exclusion rules in one place.
 *
 * V1 had these scattered across 3 files — now they're here, together,
 * so you can see every reason a flag might be suppressed.
 *
 * Categories:
 * 1. Action buttons — "Add comment", "Write comment" in ~10 languages
 * 2. User content — things typed by students (not system text)
 * 3. Template text — placeholder text, empty states
 * 4. Navigation — breadcrumbs and tab labels
 * 5. Cross-post — text that leaked from an adjacent post
 */
const EXCLUSION_RULES: ExclusionRule[] = [
  // ──────────────────────────────────────────────
  // ACTION BUTTON PATTERNS (comment)
  // These are UI buttons like "Add class comment", not actual comment indicators.
  // ──────────────────────────────────────────────
  {
    id: 'ACTION_BTN_ADD_COMMENT',
    type: 'regex',
    pattern: /add\s+(?:class\s+)?comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "Add [class] comment"',
    category: 'action_button',
  },
  {
    id: 'ACTION_BTN_WRITE_COMMENT',
    type: 'regex',
    pattern: /write.*comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "Write comment"',
    category: 'action_button',
  },
  {
    id: 'ACTION_BTN_TYPE_COMMENT',
    type: 'regex',
    pattern: /type.*comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "Type comment"',
    category: 'action_button',
  },
  {
    id: 'ACTION_BTN_POST_COMMENT',
    type: 'regex',
    pattern: /post.*comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "Post comment"',
    category: 'action_button',
  },
  {
    id: 'ACTION_BTN_NEW_COMMENT',
    type: 'regex',
    pattern: /new\s+comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "New comment"',
    category: 'action_button',
  },
  {
    id: 'ACTION_BTN_LEAVE_COMMENT',
    type: 'regex',
    pattern: /leave.*comment/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: "Leave comment"',
    category: 'action_button',
  },
  // Arabic action buttons
  {
    id: 'ACTION_BTN_ADD_COMMENT_AR',
    type: 'regex',
    pattern: /(?:اضافة|إضافة|أضف)\s+تعليق/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Arabic "Add comment"',
    category: 'action_button',
  },
  // Russian
  {
    id: 'ACTION_BTN_ADD_COMMENT_RU',
    type: 'regex',
    pattern: /добавить\s+комментарий/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Russian "Add comment"',
    category: 'action_button',
  },
  // Japanese
  {
    id: 'ACTION_BTN_ADD_COMMENT_JA',
    type: 'regex',
    pattern: /コメントを追加/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Japanese "Add comment"',
    category: 'action_button',
  },
  // Chinese
  {
    id: 'ACTION_BTN_ADD_COMMENT_ZH',
    type: 'regex',
    pattern: /添加评论/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Chinese "Add comment"',
    category: 'action_button',
  },
  // French
  {
    id: 'ACTION_BTN_ADD_COMMENT_FR',
    type: 'regex',
    pattern: /ajouter.*commentaire/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: French "Add comment"',
    category: 'action_button',
  },
  // German
  {
    id: 'ACTION_BTN_ADD_COMMENT_DE',
    type: 'regex',
    pattern: /kommentar.*hinzufügen/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: German "Add comment"',
    category: 'action_button',
  },
  // Spanish
  {
    id: 'ACTION_BTN_ADD_COMMENT_ES',
    type: 'regex',
    pattern: /añadir.*comentario/i,
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Spanish "Add comment"',
    category: 'action_button',
  },
  // Korean
  {
    id: 'ACTION_BTN_ADD_COMMENT_KO',
    type: 'text',
    pattern: '댓글 추가',
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Korean "Add comment"',
    category: 'action_button',
  },
  // Hebrew
  {
    id: 'ACTION_BTN_ADD_COMMENT_HE',
    type: 'text',
    pattern: 'הוסף תגובה',
    applies_to: ['comment'],
    penalty: -30,
    reason: 'Action button text: Hebrew "Add comment"',
    category: 'action_button',
  },

  // ──────────────────────────────────────────────
  // EDITED EXCLUSIONS
  // These are contexts where "edited" appears but doesn't
  // mean the post was edited — it's user-generated text.
  // ──────────────────────────────────────────────
  {
    id: 'EDITED_CAN_BE',
    type: 'text',
    pattern: 'can be edited',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Instructional text: "can be edited"',
    category: 'user_content',
  },
  {
    id: 'EDITED_SHOULD_BE',
    type: 'text',
    pattern: 'should be edited',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Instructional text: "should be edited"',
    category: 'user_content',
  },
  {
    id: 'EDITED_NEEDS_TO_BE',
    type: 'text',
    pattern: 'needs to be edited',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Instructional text: "needs to be edited"',
    category: 'user_content',
  },
  {
    id: 'EDITED_I_EDITED',
    type: 'text',
    pattern: 'i edited',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Student text: "I edited"',
    category: 'user_content',
  },
  {
    id: 'EDITED_YOU_EDITED',
    type: 'text',
    pattern: 'you edited',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Instructional text: "you edited"',
    category: 'user_content',
  },
  {
    id: 'EDITED_EDITING',
    type: 'text',
    pattern: 'editing',
    applies_to: ['edited'],
    penalty: -15,
    reason: 'Could be instructional: "editing"',
    category: 'user_content',
  },
  {
    id: 'EDITED_TO_EDIT',
    type: 'text',
    pattern: 'to edit',
    applies_to: ['edited'],
    penalty: -20,
    reason: 'Instructional text: "to edit"',
    category: 'user_content',
  },
  {
    id: 'EDITED_EDITOR',
    type: 'text',
    pattern: 'editor',
    applies_to: ['edited'],
    penalty: -20,
    reason: 'Could be app name: "editor"',
    category: 'user_content',
  },
  {
    id: 'EDITED_EDITORIAL',
    type: 'text',
    pattern: 'editorial',
    applies_to: ['edited'],
    penalty: -20,
    reason: 'Could be adjective: "editorial"',
    category: 'user_content',
  },
  // Arabic edited exclusions
  {
    id: 'EDITED_AR_EDIT',
    type: 'text',
    pattern: 'قم بالتعديل',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Arabic instructional: "do the edit"',
    category: 'user_content',
  },
  {
    id: 'EDITED_AR_CAN_EDIT',
    type: 'text',
    pattern: 'يمكن التعديل',
    applies_to: ['edited'],
    penalty: -25,
    reason: 'Arabic instructional: "can be edited"',
    category: 'user_content',
  },

  // ──────────────────────────────────────────────
  // USER CONTENT BOUNDARIES (selector-based)
  // Text inside these areas is student-authored and should
  // never trigger flag detection.
  // ──────────────────────────────────────────────
  {
    id: 'USER_CONTENT_N8F6JD',
    type: 'selector',
    pattern: '.n8F6Jd',
    applies_to: ['comment', 'edited'],
    penalty: -25,
    reason: 'User content area (.n8F6Jd)',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_A3J8U',
    type: 'selector',
    pattern: '.a3j8U',
    applies_to: ['comment', 'edited'],
    penalty: -25,
    reason: 'User content area (.a3j8U)',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_GM4MLB',
    type: 'selector',
    pattern: '.gM4mlb',
    applies_to: ['comment', 'edited'],
    penalty: -25,
    reason: 'User content area (.gM4mlb)',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_A6DC2C',
    type: 'selector',
    pattern: '.A6dC2c',
    applies_to: ['comment', 'edited'],
    penalty: -25,
    reason: 'User content area (.A6dC2c)',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_EDITABLE',
    type: 'selector',
    pattern: '[contenteditable="true"]',
    applies_to: ['comment', 'edited'],
    penalty: -30,
    reason: 'Contenteditable area — user is typing',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_INPUT',
    type: 'selector',
    pattern: 'input',
    applies_to: ['comment', 'edited'],
    penalty: -30,
    reason: 'Input field — user content',
    category: 'user_content',
  },
  {
    id: 'USER_CONTENT_TEXTAREA',
    type: 'selector',
    pattern: 'textarea',
    applies_to: ['comment', 'edited'],
    penalty: -30,
    reason: 'Textarea — user content',
    category: 'user_content',
  },
];

// ============================================================================
// PRE-COMPILED REGEX — O(1) test instead of O(n) .some()
// ============================================================================

/**
 * Build a single compiled regex from all regex+text rules for a flag type.
 *
 * V1 tested 14+ individual patterns in a loop. This compiles them into
 * a single alternation: /(pattern1|pattern2|…)/i
 *
 * One regex.test() call replaces 14 .some() iterations.
 */
function buildCompiledRegex(flagType: 'comment' | 'edited'): RegExp {
  const parts: string[] = [];

  for (const rule of EXCLUSION_RULES) {
    if (!rule.applies_to.includes(flagType)) continue;
    if (rule.type === 'selector') continue; // selectors aren't regex-testable

    if (rule.type === 'regex' && rule.pattern instanceof RegExp) {
      // Extract the source from the regex (strip flags, we'll add our own)
      parts.push(rule.pattern.source);
    } else if (rule.type === 'text' && typeof rule.pattern === 'string') {
      // Escape special regex chars in the text pattern
      parts.push(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  // Combine into single alternation — case-insensitive, unicode-aware
  return new RegExp(`(?:${parts.join('|')})`, 'iu');
}

/** Pre-compiled regex for comment exclusions */
const COMMENT_EXCLUSION_REGEX = buildCompiledRegex('comment');

/** Pre-compiled regex for edited exclusions */
const EDITED_EXCLUSION_REGEX = buildCompiledRegex('edited');

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if text matches any exclusion pattern for a flag type.
 *
 * This is the fast path — one regex test instead of 14.
 * Use this in the hot path during detection scanning.
 *
 * @param text - The text to check
 * @param flagType - Which flag type to check exclusions for
 * @returns true if the text matches an exclusion pattern
 */
export function isExcludedText(text: string, flagType: 'comment' | 'edited'): boolean {
  const normalized = normalizeForComparison(text);
  const regex = flagType === 'comment' ? COMMENT_EXCLUSION_REGEX : EDITED_EXCLUSION_REGEX;
  return regex.test(normalized);
}

/**
 * Apply all applicable exclusion rules to a text + post element.
 *
 * Returns all matching exclusion results with penalties and reasons.
 * Use this for the full decision trace — not in the hot path.
 *
 * @param text - The matched text being evaluated
 * @param post - The post element (for selector-based exclusions)
 * @param flagType - Which flag type to check
 * @returns Array of all matching exclusion results
 */
export function applyExclusions(
  text: string,
  post: HTMLElement,
  flagType: 'comment' | 'edited',
): ExclusionResult[] {
  const results: ExclusionResult[] = [];
  const normalizedText = normalizeForComparison(text);

  for (const rule of EXCLUSION_RULES) {
    // Skip rules that don't apply to this flag type
    if (!rule.applies_to.includes(flagType)) continue;

    let matched = false;
    let matchedContent = '';

    switch (rule.type) {
      case 'regex': {
        if (rule.pattern instanceof RegExp && rule.pattern.test(normalizedText)) {
          matched = true;
          matchedContent = text.slice(0, 80);
        }
        break;
      }
      case 'text': {
        const normalizedPattern = normalizeForComparison(rule.pattern as string);
        if (normalizedText.includes(normalizedPattern)) {
          matched = true;
          matchedContent = text.slice(0, 80);
        }
        break;
      }
      case 'selector': {
        // Check if the matched text appears inside an excluded area
        const excludedArea = post.querySelector(rule.pattern as string);
        if (excludedArea) {
          const areaText = normalizeForComparison(excludedArea.textContent || '');
          if (areaText.includes(normalizedText)) {
            matched = true;
            matchedContent = `[${rule.pattern}]: ${excludedArea.textContent?.slice(0, 60) || ''}`;
          }
        }
        break;
      }
    }

    if (matched) {
      results.push({
        ruleId: rule.id,
        category: rule.category,
        penalty: rule.penalty,
        reason: rule.reason,
        matchedText: matchedContent,
      });
    }
  }

  return results;
}

/**
 * Check if a specific DOM element is inside an excluded user-content area.
 *
 * This is a quick structural check — does the element live inside
 * a contenteditable, textarea, or known student-content container?
 *
 * @param element - The element to check
 * @returns true if the element is inside an excluded area
 */
export function isInExcludedArea(element: HTMLElement): boolean {
  for (const rule of EXCLUSION_RULES) {
    if (rule.type !== 'selector') continue;
    if (element.closest(rule.pattern as string)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all user-content exclusion selectors.
 *
 * Used to build a visibility cache — collect these once per scan,
 * then check text nodes against them.
 */
export function getUserContentSelectors(): string[] {
  return EXCLUSION_RULES
    .filter(r => r.type === 'selector' && r.category === 'user_content')
    .map(r => r.pattern as string);
}

/**
 * Get all rules for debugging/tracing.
 */
export function getAllRules(): readonly ExclusionRule[] {
  return EXCLUSION_RULES;
}

/**
 * Get rules by category.
 */
export function getRulesByCategory(category: ExclusionCategory): ExclusionRule[] {
  return EXCLUSION_RULES.filter(r => r.category === category);
}

/**
 * Get the total penalty for a set of exclusion results.
 */
export function totalPenalty(results: ExclusionResult[]): number {
  return results.reduce((sum, r) => sum + r.penalty, 0);
}
