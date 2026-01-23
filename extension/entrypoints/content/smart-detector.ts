// filepath: extension/entrypoints/content/smart-detector.ts
/**
 * SMART DETECTOR - Universal V3 Architecture
 * Features:
 * 1. Extracts both Created and Edited dates
 * 2. Calculates time difference for Hover Intelligence
 * 3. Uses TreeWalker with Sliding Window parent context
 */

import {
  GOLDEN_SELECTORS,
  DATE_PATTERNS,
  getAllEditedKeywords,
  CREATED_KEYWORDS,
  EXCLUSION_KEYWORDS,
  normalizeText,
  normalizeForComparison,
  parseUnicodeDate,
  hasDatePattern,
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
}

export interface PostStateResult {
  comments: {
    hasComments: boolean;
    count: number;
    matchedText: string | null;
  };
  edited: EditedDetectionResult;
  hasBothFlags: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formats milliseconds into human-readable duration.
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return '';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Just now';
}

/**
 * Extracts the first date from text using regex patterns.
 */
function extractDate(text: string): Date | null {
  if (!text) return null;
  const clean = normalizeText(text);
  
  for (const pattern of DATE_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      const date = parseUnicodeDate(match[0]);
      if (date) return date;
    }
  }
  return null;
}

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
// MAIN DETECTION LOGIC
// ============================================================================

export function detectPostState(post: HTMLElement, pageLang: string): PostStateResult {
  // 1. Comments Detection
  const commentResult = detectComments(post, pageLang);

  // 2. Edited & Creation Detection
  let isEdited = false;
  let editDate: Date | null = null;
  let createDate: Date | null = null;
  let matchedText: string | null = null;

  const editedKeywords = getAllEditedKeywords();
  const sanitizedPost = createSanitizedClone(post);

  // Use TreeWalker to scan text nodes
  const walker = document.createTreeWalker(
    sanitizedPost,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if in exclusion context
        const parentText = normalizeForComparison(parent.textContent || '');
        if (EXCLUSION_KEYWORDS.some(k => parentText.includes(k.toLowerCase()))) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Collect date candidates
  interface DateCandidate {
    date: Date;
    text: string;
    hasEditedKeyword: boolean;
    hasCreatedKeyword: boolean;
  }
  const dateCandidates: DateCandidate[] = [];

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = normalizeText(node.textContent || '');
    if (text.length < 3) continue;

    const lowerText = text.toLowerCase();
    
    if (hasDatePattern(text)) {
      const date = extractDate(text);
      if (date) {
        // Check context for keywords
        const isEdit = editedKeywords.some(k => lowerText.includes(k.toLowerCase()));
        const isCreate = CREATED_KEYWORDS.some(k => lowerText.includes(k.toLowerCase()));
        
        // Sliding Window: Check parent for keywords too
        const parentText = normalizeText(node.parentElement?.textContent || '').toLowerCase();
        const parentIsEdit = editedKeywords.some(k => parentText.includes(k.toLowerCase()));
        const parentIsCreate = CREATED_KEYWORDS.some(k => parentText.includes(k.toLowerCase()));

        dateCandidates.push({
          date,
          text,
          hasEditedKeyword: isEdit || parentIsEdit,
          hasCreatedKeyword: isCreate || parentIsCreate
        });
      }
    }
  }

  // Logic to assign Created vs Edited
  const editCandidate = dateCandidates.find(c => c.hasEditedKeyword);
  if (editCandidate) {
    isEdited = true;
    editDate = editCandidate.date;
    matchedText = editCandidate.text;
  }

  // Find Creation Date
  const createCandidate = dateCandidates.find(c => c.hasCreatedKeyword);
  if (createCandidate) {
    createDate = createCandidate.date;
  } else {
    // Fallback: Use the earliest date that isn't the edit date
    const otherDates = dateCandidates
      .filter(c => !c.hasEditedKeyword && c.date.getTime() !== editDate?.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (otherDates.length > 0) {
      createDate = otherDates[0].date;
    }
  }

  // Calculate time difference
  let diffString: string | null = null;
  if (isEdited && editDate && createDate) {
    const diff = editDate.getTime() - createDate.getTime();
    if (diff > 0) {
      diffString = formatDuration(diff);
    }
  }

  return {
    comments: {
      hasComments: commentResult.hasComments,
      count: commentResult.count,
      matchedText: commentResult.matchedText
    },
    edited: {
      isEdited,
      editDate,
      createDate,
      diffString,
      matchedText
    },
    hasBothFlags: commentResult.hasComments && isEdited
  };
}

// ============================================================================
// LEGACY EXPORTS
// ============================================================================

export { detectComments } from './smart-detector-comments';
export type { CommentDetectionResult } from './smart-detector-comments';

export function analyzePost(
  post: HTMLElement,
  pageLang: string
): PostStateResult {
  return detectPostState(post, pageLang);
}

/**
 * Legacy wrapper for backward compatibility.
 * Returns just the edited portion of the detection result.
 */
export function detectEdited(
  post: HTMLElement,
  pageLang: string
): EditedDetectionResult {
  return detectPostState(post, pageLang).edited;
}

