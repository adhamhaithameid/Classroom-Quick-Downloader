// filepath: extension/entrypoints/content/tab-detector.ts
/**
 * Tab Detection Utility for Google Classroom
 * 
 * Detects which tab (Stream, Classwork, People, Grades) is currently active
 * based on URL patterns.
 */

export type ClassroomTab = 'stream' | 'classwork' | 'people' | 'grades' | 'unknown';

/**
 * Detects the current active tab based on URL pattern.
 * 
 * URL patterns:
 * - Stream: /c/{classId} (class home, no /w/ in path)
 * - Classwork: /w/{classId}/t/... (assignments/materials)
 * - People: /r/{classId}/sort-... (class members)
 * - Grades: /u/{user}/g/{classId} or similar
 */
export function getCurrentTab(): ClassroomTab {
  const path = window.location.pathname;
  
  // Classwork: /w/{classId}/t/all or /w/{classId}/t/{topicId}
  if (/\/w\/[^/]+\/t\//.test(path)) return 'classwork';
  
  // Topic category view: /w/{classId}/tc/{topicId}
  if (/\/w\/[^/]+\/tc\//.test(path)) return 'classwork';
  
  // Individual assignment/material view: /c/{classId}/a/{itemId}/details
  if (/\/c\/[^/]+\/a\/[^/]+\/details/.test(path)) return 'classwork';
  
  // Material view: /c/{classId}/m/{itemId}/details
  if (/\/c\/[^/]+\/m\/[^/]+\/details/.test(path)) return 'classwork';
  
  // People tab: /r/{classId}/sort-...
  if (/\/r\/[^/]+\/sort-/.test(path)) return 'people';
  
  // Grades: various patterns like /u/{userId}/g/{classId}
  if (/\/g\/[^/]+/.test(path) || /\/u\/[^/]+\/g\//.test(path)) return 'grades';
  
  // Stream (class home): /c/{classId} without further subpaths
  if (/\/c\/[^/]+\/?$/.test(path) || /\/c\/[^/]+\/p\/[^/]+/.test(path)) return 'stream';
  
  // Also match stream posts: /c/{classId}/p/{postId}
  if (/\/c\/[^/]+/.test(path)) return 'stream';
  
  return 'unknown';
}

/**
 * Check if currently on Stream tab
 */
export function isStreamTab(): boolean {
  return getCurrentTab() === 'stream';
}

/**
 * Check if currently on Classwork tab
 */
export function isClassworkTab(): boolean {
  return getCurrentTab() === 'classwork';
}

/**
 * Check if the given element is a Classwork post
 * 
 * Matches:
 * - List view: li.tfGBod, li[data-stream-item-id]
 * - Topic view: div.etr9pd, div.i8Wprc, div.sVNOQ (posts inside /tc/ pages)
 * - Topic view also: div[data-stream-item-id] with jscontroller="yP6Lwf"
 */
export function isClassworkPost(element: HTMLElement): boolean {
  // Check standard Classwork selectors
  if (element.matches('li.tfGBod, li[data-stream-item-id], div.etr9pd, div.i8Wprc')) {
    return true;
  }
  
  // Topic View: div.sVNOQ with data-stream-item-id and jscontroller="yP6Lwf"
  if (element.matches('div.sVNOQ[data-stream-item-id]')) {
    return true;
  }
  
  // Topic View: any div with both data-stream-item-id and data-material-parent-id
  if (element.matches('div[data-stream-item-id][data-material-parent-id]')) {
    return true;
  }
  
  // If URL is Topic View (/tc/), treat all divs with data-stream-item-id as classwork
  if (isTopicView() && element.matches('div[data-stream-item-id]')) {
    return true;
  }
  
  return false;
}

/**
 * Check if this is a topic view page (always expanded, no folding)
 */
export function isTopicView(): boolean {
  return /\/w\/[^/]+\/tc\//.test(window.location.pathname);
}

/**
 * Check if the given element is a Stream post (div with data-stream-item-id)
 */
export function isStreamPost(element: HTMLElement): boolean {
  return element.matches('div[data-stream-item-id]');
}

/**
 * Unified selector for posts that works on both Stream and Classwork tabs
 */
export const UNIFIED_POST_SELECTOR = '[data-stream-item-id]';
