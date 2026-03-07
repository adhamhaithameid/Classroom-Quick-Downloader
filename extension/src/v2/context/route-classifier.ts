// filepath: extension/src/v2/context/route-classifier.ts
/**
 * ============================================================================
 * ROUTE CLASSIFIER — URL → ViewKind Mapping
 * ============================================================================
 *
 * This is the "traffic cop" of the V2 engine. When the user navigates
 * to a new page (or the SPA changes the URL without a real navigation),
 * this module figures out WHAT KIND of page we're looking at.
 *
 * Why does this matter? Because every page type has:
 * - Different DOM structure (Stream uses divs, Classwork uses lis)
 * - Different selectors that work (topic view has .etr9pd, list doesn't)
 * - Different features that apply (Classwork has accordion, Stream doesn't)
 * - Different files we can download (student submissions only on those pages)
 *
 * The old V1 code had this logic scattered across tab-detector.ts and
 * several `if (url.includes('/w/'))` checks throughout the codebase.
 * Now it's all in one place, with proper regex patterns, priority ordering,
 * and a change detection system.
 *
 * The `onRouteChange` callback is the key integration point with the
 * orchestrator. When the URL changes, the orchestrator needs to:
 * 1. Cancel any in-progress work
 * 2. Re-classify the view
 * 3. Re-initialize the engine for the new view
 *
 * Google Classroom is an SPA (Single Page Application), so it changes
 * the URL using the History API without doing a real page load. That's
 * why we can't just listen for `load` events — we need a MutationObserver
 * on the document to catch URL changes via `pushState` and `replaceState`.
 *
 * I also patched `history.pushState` and `history.replaceState` directly
 * because the MutationObserver approach can miss rapid URL changes.
 * Belt AND suspenders, baby.
 *
 * @author Adham — the SPA detection was the hardest thing to get right
 * @since v4.0.0
 */

import { ViewKind } from '../../engines/types';

// ============================================================================
// ROUTE PATTERNS — Ordered by specificity (most specific first!)
// ============================================================================

/**
 * Each pattern maps a URL regex to a ViewKind.
 *
 * The order matters! More specific patterns must come before general ones.
 * For example, /c/{id}/a/{id}/submissions/{id} must be checked BEFORE
 * /c/{id}/a/{id}/submissions (without student ID) and BEFORE /c/{id}/a/{id}/details.
 *
 * I derived these patterns from tab-detector.ts and verified each one
 * by navigating to real Classroom URLs. The comments show example URLs.
 */
interface RoutePattern {
  pattern: RegExp;
  viewKind: ViewKind;
  description: string;
}

const ROUTE_PATTERNS: RoutePattern[] = [
  // === STUDENT SUBMISSIONS (MOST SPECIFIC — has 3 path segments) ===
  // URL: /c/123456/a/789012/submissions/345678
  {
    pattern: /\/c\/[^/]+\/a\/[^/]+\/submissions\/[^/]+/,
    viewKind: ViewKind.STUDENT_SUBMISSIONS,
    description: 'Individual student submission view',
  },

  // === STUDENT WORK TEACHER VIEW (has 2 path segments) ===
  // URL: /c/123456/a/789012/submissions
  {
    pattern: /\/c\/[^/]+\/a\/[^/]+\/submissions\/?$/,
    viewKind: ViewKind.STUDENT_WORK_TEACHER,
    description: 'Teacher view of all student submissions',
  },

  // === ASSIGNMENT DETAILS ===
  // URL: /c/123456/a/789012/details
  {
    pattern: /\/c\/[^/]+\/a\/[^/]+\/details/,
    viewKind: ViewKind.ASSIGNMENT_DETAILS,
    description: 'Single assignment detail page',
  },

  // === MATERIAL DETAILS ===
  // URL: /c/123456/m/789012/details
  {
    pattern: /\/c\/[^/]+\/m\/[^/]+\/details/,
    viewKind: ViewKind.MATERIAL_DETAILS,
    description: 'Single material detail page',
  },

  // === CLASSWORK TOPIC VIEW ===
  // URL: /w/123456/tc/TopicName or /w/123456/tc/123
  {
    pattern: /\/w\/[^/]+\/tc\//,
    viewKind: ViewKind.CLASSWORK_TOPIC,
    description: 'Topic-filtered classwork view (always expanded)',
  },

  // === CLASSWORK LIST VIEW ===
  // URL: /w/123456/t/all or /w/123456/t/something
  {
    pattern: /\/w\/[^/]+\/t\//,
    viewKind: ViewKind.CLASSWORK_LIST,
    description: 'Full classwork list (has accordion)',
  },

  // === ANNOUNCEMENT DETAIL ===
  // URL: /c/123456/p/PostId123
  {
    pattern: /\/c\/[^/]+\/p\/[^/]+/,
    viewKind: ViewKind.ANNOUNCEMENT_DETAIL,
    description: 'Single announcement/post detail',
  },

  // === STREAM (DEFAULT CLASS VIEW) ===
  // URL: /c/123456 or /c/123456/
  {
    pattern: /\/c\/[^/]+\/?$/,
    viewKind: ViewKind.STREAM,
    description: 'Stream page (class home)',
  },

  // === STREAM WITH POST EXPANSION ===
  // Some Stream interactions show details inline without changing to /p/ URLs
  // We still classify these as STREAM since the DOM structure is the same
  {
    pattern: /\/c\/[^/]+$/,
    viewKind: ViewKind.STREAM,
    description: 'Stream page (no trailing slash)',
  },
];

/**
 * URL patterns that we know we should IGNORE (not inject into at all).
 *
 * These are pages like People, Grades, Settings where CQD has nothing to do.
 * Identifying these early saves us from spinning up engines and observers
 * for pages that will never have downloadable content.
 */
const IGNORE_PATTERNS: RegExp[] = [
  /\/r\/[^/]+\/sort-/,         // People tab
  /\/g\/[^/]+/,                // Grades
  /\/u\/\d+\/g\//,            // Grades (alt path with authuser)
  /\/settings/,                // Settings page
  /\/notifications/,           // Notifications
  /\/h$/,                      // Home page (no class selected)
  /\/h\//,                     // Home subpages
  /accounts\.google\.com/,     // Login page
];

// ============================================================================
// CLASSIFIER
// ============================================================================

/**
 * Classify a URL into a ViewKind.
 *
 * This is a pure function — no side effects, no state, just URL → ViewKind.
 * Makes it easy to test. I wrote like 30 unit tests for this function alone
 * because getting the regex priority wrong caused so many bugs in V1.
 *
 * @param url - The full URL or just the pathname
 * @returns The ViewKind for this URL, or UNKNOWN if no pattern matches
 */
export function classifyRoute(url: string): ViewKind {
  // Strip the origin if present (we only care about the pathname)
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  // First check if this is a page we should ignore entirely
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(pathname) || pattern.test(url)) {
      return ViewKind.UNKNOWN;
    }
  }

  // Then check the route patterns in priority order
  for (const route of ROUTE_PATTERNS) {
    if (route.pattern.test(pathname)) {
      return route.viewKind;
    }
  }

  // Nothing matched — this is a page we don't handle
  return ViewKind.UNKNOWN;
}

/**
 * Check if a URL is a Classroom URL at all.
 * Quick early-exit check so we don't waste time classifying non-Classroom URLs.
 */
export function isClassroomUrl(url: string): boolean {
  return /^https:\/\/classroom\.google\.com\//.test(url);
}

// ============================================================================
// ROUTE CHANGE DETECTION
// ============================================================================

export type RouteChangeCallback = (
  newViewKind: ViewKind,
  previousViewKind: ViewKind | null,
  url: string,
) => void;

/**
 * RouteWatcher — watches for URL changes in the Classroom SPA.
 *
 * Google Classroom is a Single Page Application, so page "navigation"
 * happens via the History API (pushState/replaceState) without a real
 * page load. We need to detect these URL changes and re-classify the route.
 *
 * This class uses THREE detection mechanisms (belt, suspenders, and duct tape):
 * 1. history.pushState/replaceState MonkeyPatching — catches programmatic navigation
 * 2. popstate event — catches browser back/forward
 * 3. MutationObserver on <title> — catches URL changes we missed
 *
 * Why three? Because I've been burned before. The pushState monkey-patch
 * can miss some navigations if Google uses their own history abstraction.
 * The popstate event only fires on back/forward, not pushState. The
 * MutationObserver is the safety net that catches anything we missed.
 *
 * The 500ms debounce ensures we don't fire multiple times for the same
 * navigation (Google sometimes does pushState → replaceState in sequence).
 */
export class RouteWatcher {
  private callback: RouteChangeCallback;
  private currentViewKind: ViewKind | null = null;
  private lastUrl: string = '';
  private debounceTimer: number | null = null;
  private titleObserver: MutationObserver | null = null;
  private abortController: AbortController | null = null;

  /** Original history methods (saved before monkey-patching) */
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;

  constructor(callback: RouteChangeCallback) {
    this.callback = callback;
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);
  }

  /**
   * Start watching for route changes.
   *
   * This sets up all three detection mechanisms and does an initial
   * classification of the current URL.
   */
  start(): void {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // 1. Monkey-patch History API
    // I know monkey-patching is frowned upon, but it's the only reliable
    // way to catch pushState navigations in an extension content script.
    // We save the originals and call them after our hook runs.
    const self = this;

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      self.originalPushState(...args);
      self.onPossibleUrlChange();
    };

    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      self.originalReplaceState(...args);
      self.onPossibleUrlChange();
    };

    // 2. Listen for popstate (browser back/forward)
    window.addEventListener('popstate', () => this.onPossibleUrlChange(), { signal });

    // 3. MutationObserver on <title> as a fallback
    // When the title changes, the page has likely navigated
    const titleEl = document.querySelector('title');
    if (titleEl) {
      this.titleObserver = new MutationObserver(() => this.onPossibleUrlChange());
      this.titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // Initial classification
    this.onPossibleUrlChange();
  }

  /**
   * Stop watching for route changes.
   * Restores the original history methods and disconnects all observers.
   */
  stop(): void {
    // Restore original history methods
    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;

    // Cancel the abort controller (removes event listeners)
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Disconnect the title observer
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }

    // Clear any pending debounce
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Get the current view classification.
   */
  getCurrentViewKind(): ViewKind | null {
    return this.currentViewKind;
  }

  /**
   * Called whenever we suspect the URL might have changed.
   * Debounced to 300ms to avoid rapid re-fires.
   */
  private onPossibleUrlChange(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.checkUrlChange();
    }, 300);
  }

  /**
   * Actually check if the URL changed and fire the callback if so.
   */
  private checkUrlChange(): void {
    const currentUrl = window.location.href;

    // Same URL — no change
    if (currentUrl === this.lastUrl) return;

    this.lastUrl = currentUrl;
    const previousViewKind = this.currentViewKind;
    const newViewKind = classifyRoute(currentUrl);

    // Only fire callback if the ViewKind actually changed
    // (We don't care about query param changes within the same view)
    if (newViewKind !== previousViewKind) {
      this.currentViewKind = newViewKind;
      this.callback(newViewKind, previousViewKind, currentUrl);
    }
  }
}
