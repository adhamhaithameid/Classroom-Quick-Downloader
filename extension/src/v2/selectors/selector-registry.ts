// filepath: extension/src/v2/selectors/selector-registry.ts
/**
 * ============================================================================
 * SELECTOR REGISTRY — Every Google Classroom Selector We Know, Organized
 * ============================================================================
 *
 * This file is basically the "phone book" of Google Classroom's DOM.
 *
 * Every CSS selector, data attribute, ARIA pattern, and heuristic that
 * we use to find things in the Classroom DOM is registered here as a
 * SelectorCandidate with a proper priority level.
 *
 * This replaces the scattered selectors from the V1 codebase:
 * - state.ts had DRIVE_ANCHOR_SELECTOR and ATTACHMENT_CONTAINER_SELECTOR
 * - detection-keywords.ts had GOLDEN_SELECTORS
 * - tab-detector.ts had various post selectors
 * - download_all.content.ts had header/three-dots selectors
 *
 * Now they're all in ONE place, with ONE priority system, and ONE
 * self-healing mechanism (via selector-scorer.ts).
 *
 * IMPORTANT: When updating selectors after a Google deploy, you only
 * need to edit THIS file. Nothing else. That's the whole point.
 *
 * The naming convention for selector IDs:
 *   {target}-{level}-{variant}
 *   Examples: post-l1-data, post-l2-aria, post-l4-tfGBod
 *
 * I sourced all of these from the Phase 0 selector-catalog.md baseline
 * and cross-referenced with the actual Classroom DOM.
 *
 * @author Adham — cataloged over 74 selectors into 5 levels, one selector at a time
 * @since v4.0.0
 */

import {
  type SelectorCandidate,
  SelectorLevel,
  SelectorScorer,
} from './selector-scorer';

// ============================================================================
// HELPER — Create a candidate with sensible defaults
// ============================================================================

/**
 * Shorthand factory for creating SelectorCandidates.
 *
 * I got tired of typing out all the fields for 60+ selectors,
 * so I made this helper. The defaults are:
 * - L1: baseReliability=95
 * - L2: baseReliability=85
 * - L3: baseReliability=70
 * - L4: baseReliability=55
 * - L5: baseReliability=40
 *
 * These defaults come from my reliability analysis of the Phase 0 baseline.
 * data-* attributes have literally NEVER changed in the 5 months I've been
 * watching Classroom. Class names have changed ~3 times.
 */
function candidate(
  id: string,
  cssSelector: string | null,
  level: SelectorLevel,
  target: string,
  overrides?: Partial<SelectorCandidate>,
): SelectorCandidate {
  const defaultReliability: Record<SelectorLevel, number> = {
    [SelectorLevel.L1_DATA_ATTR]: 95,
    [SelectorLevel.L2_ARIA_SEMANTIC]: 85,
    [SelectorLevel.L3_STRUCTURAL]: 70,
    [SelectorLevel.L4_GOLDEN_CLASS]: 55,
    [SelectorLevel.L5_HEURISTIC]: 40,
  };

  return {
    id,
    cssSelector,
    level,
    target,
    baseReliability: defaultReliability[level],
    lastConfirmedAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

// ============================================================================
// POST SELECTORS — Finding post containers on the page
// ============================================================================

/**
 * Selectors for finding post elements (announcements, assignments, materials).
 *
 * These are the outermost container elements for each "card" on the page.
 * In Stream view they're <div>s, in Classwork they're <li>s.
 * The data-stream-item-id attribute is the GOLDEN SOURCE OF TRUTH — it's
 * present on every post in every view and has never changed.
 */
export const POST_CANDIDATES: SelectorCandidate[] = [
  // L1: data-* attributes (bulletproof)
  candidate('post-l1-data-stream', '[data-stream-item-id]', SelectorLevel.L1_DATA_ATTR, 'post container'),
  candidate('post-l1-div-data-stream', 'div[data-stream-item-id]', SelectorLevel.L1_DATA_ATTR, 'stream post'),
  candidate('post-l1-li-data-stream', 'li[data-stream-item-id]', SelectorLevel.L1_DATA_ATTR, 'classwork post'),

  // L2: ARIA attributes
  candidate('post-l2-listitem', '[role="listitem"][data-stream-item-id]', SelectorLevel.L2_ARIA_SEMANTIC, 'post container'),

  // L4: Golden class names (may break on Google deploys)
  candidate('post-l4-tfGBod', 'li.tfGBod', SelectorLevel.L4_GOLDEN_CLASS, 'classwork list item'),
  candidate('post-l4-etr9pd', 'div.etr9pd', SelectorLevel.L4_GOLDEN_CLASS, 'topic view post'),
  candidate('post-l4-i8Wprc', 'div.i8Wprc', SelectorLevel.L4_GOLDEN_CLASS, 'topic view post alt'),
  candidate('post-l4-sVNOQ', 'div.sVNOQ[data-stream-item-id]', SelectorLevel.L4_GOLDEN_CLASS, 'topic attachments'),
];

// ============================================================================
// FILE ATTACHMENT SELECTORS — Finding downloadable files
// ============================================================================

/**
 * Selectors for finding file attachments (Drive links, embedded files).
 *
 * The Drive anchor selector (finding <a> tags with Drive URLs) is the most
 * reliable — it's based on the href URL pattern, not class names.
 *
 * The container selector (wrapping element around the attachment) is less
 * reliable because it uses lots of Google class names.
 */
export const FILE_ANCHOR_CANDIDATES: SelectorCandidate[] = [
  // L1: data-* attributes
  candidate('file-l1-drive-id', '[data-drive-id]', SelectorLevel.L1_DATA_ATTR, 'drive file element'),
  candidate('file-l1-data-id-item', '[data-id][data-item-id]', SelectorLevel.L1_DATA_ATTR, 'file meta element'),

  // L2: URL-based anchors (very stable — based on href content)
  candidate('file-l2-drive-href', 'a[href*="drive.google.com/file/d/"]', SelectorLevel.L2_ARIA_SEMANTIC, 'drive file link', { baseReliability: 90 }),
  candidate('file-l2-drive-open', 'a[href*="drive.google.com/open"]', SelectorLevel.L2_ARIA_SEMANTIC, 'drive open link', { baseReliability: 90 }),
  candidate('file-l2-drive-uc', 'a[href*="drive.google.com/uc"]', SelectorLevel.L2_ARIA_SEMANTIC, 'drive download link', { baseReliability: 90 }),
  candidate('file-l2-classroom-drive', 'a[href*="classroom.google.com/drive"]', SelectorLevel.L2_ARIA_SEMANTIC, 'classroom drive link', { baseReliability: 90 }),

  // L4: Golden class names
  candidate('file-l4-KlRXdf', '.KlRXdf', SelectorLevel.L4_GOLDEN_CLASS, 'attachment container'),
  candidate('file-l4-z3vRcc', '.z3vRcc', SelectorLevel.L4_GOLDEN_CLASS, 'attachment container alt'),
  candidate('file-l4-VfPpkd', '.VfPpkd-aPP78e', SelectorLevel.L4_GOLDEN_CLASS, 'attachment container alt2'),
];

// ============================================================================
// HEADER / THREE-DOTS SELECTORS — Placing "Download All" button
// ============================================================================

/**
 * Selectors for finding the header area and three-dots menu button.
 *
 * The "Download All" button needs to be placed near the three-dots menu
 * in the post header. This is probably the most fragile part of the
 * extension because Google can change the header layout easily.
 *
 * That's why we have so many candidates at different levels.
 */
export const HEADER_CANDIDATES: SelectorCandidate[] = [
  // L1: data-* attributes
  candidate('header-l1-guided-help', '[data-guided-help-id="streamItemActionMenuGH"]', SelectorLevel.L1_DATA_ATTR, 'stream action menu chunk'),

  // L2: ARIA / semantic
  candidate('header-l2-haspopup-menu', '[aria-haspopup="menu"]', SelectorLevel.L2_ARIA_SEMANTIC, 'menu button'),
  candidate('header-l2-role-button-expanded', 'div[role="button"][aria-expanded]', SelectorLevel.L2_ARIA_SEMANTIC, 'accordion toggle'),

  // L4: Golden class names
  candidate('header-l4-N5dSp', '.N5dSp', SelectorLevel.L4_GOLDEN_CLASS, 'stream header'),
  candidate('header-l4-RcHwO', '.RcHwO', SelectorLevel.L4_GOLDEN_CLASS, 'header row'),
  candidate('header-l4-nZCyt', 'span.nZCyt', SelectorLevel.L4_GOLDEN_CLASS, 'classwork title span'),
  candidate('header-l4-jWCzBe', '.jWCzBe.gmNu1d', SelectorLevel.L4_GOLDEN_CLASS, 'classwork header'),
  candidate('header-l4-JZicYb', '.JZicYb.gmNu1d', SelectorLevel.L4_GOLDEN_CLASS, 'stream internal header'),
  candidate('header-l4-JZicYb-fallback', '.JZicYb', SelectorLevel.L4_GOLDEN_CLASS, 'header fallback'),
  candidate('header-l4-kpDQ8', '.kpDQ8', SelectorLevel.L4_GOLDEN_CLASS, 'action menu identifier'),
  candidate('header-l4-vFkiub', '.vFkiub.kpDQ8', SelectorLevel.L4_GOLDEN_CLASS, 'dots container'),
  candidate('header-l4-WyjGac', '.WyjGac', SelectorLevel.L4_GOLDEN_CLASS, 'topic menu'),
  candidate('header-l4-pYTkkf', '.pYTkkf-Bz112c-LgbsSe', SelectorLevel.L4_GOLDEN_CLASS, 'three-dots button class'),
];

// ============================================================================
// COMMENT FLAG SELECTORS — Finding comment indicators
// ============================================================================

/**
 * Selectors for finding comment indicators on posts.
 *
 * The comment detection system uses a layered approach (inherited from V1).
 * Level priorities here map to the V1 layers:
 * - L1: data attributes on the comment count element
 * - L2: ARIA labels that say "X comments" (language-dependent)
 * - L4: Golden selectors (.asQXV, .qCWAqb, etc.)
 *
 * The L2 ARIA selectors include multiple languages because Google
 * translates Classroom's UI and the aria-labels change with it.
 */
export const COMMENT_FLAG_CANDIDATES: SelectorCandidate[] = [
  // L2: ARIA-based (works across some UI changes, language-dependent)
  candidate('comment-l2-aria-en', '[aria-label*="comment"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (en)'),
  candidate('comment-l2-aria-en-cap', '[aria-label*="Comment"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (en cap)'),
  candidate('comment-l2-aria-ar', '[aria-label*="تعليق"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (ar)'),
  candidate('comment-l2-aria-ja', '[aria-label*="コメント"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (ja)'),
  candidate('comment-l2-aria-zh', '[aria-label*="评论"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (zh)'),
  candidate('comment-l2-aria-ru', '[aria-label*="комментар"]', SelectorLevel.L2_ARIA_SEMANTIC, 'comment aria (ru)'),

  // L4: Golden class names (current Classroom structure)
  candidate('comment-l4-asQXV-QRiHXd', '.asQXV.QRiHXd', SelectorLevel.L4_GOLDEN_CLASS, 'stream comment area'),
  candidate('comment-l4-mUIrbf', '.mUIrbf-vQzf8d', SelectorLevel.L4_GOLDEN_CLASS, 'comment text'),
  candidate('comment-l4-z3vRcc-sub', '.z3vRcc-aD1xae', SelectorLevel.L4_GOLDEN_CLASS, 'comment section'),
  candidate('comment-l4-z3vRcc', '.z3vRcc', SelectorLevel.L4_GOLDEN_CLASS, 'comment container'),
  candidate('comment-l4-qCWAqb-seqYL', '.qCWAqb.seqYL', SelectorLevel.L4_GOLDEN_CLASS, 'classwork comment indicator'),
  candidate('comment-l4-qCWAqb', '.qCWAqb', SelectorLevel.L4_GOLDEN_CLASS, 'comment wrapper'),
  candidate('comment-l4-huI6Cb', '.huI6Cb.Cx437e', SelectorLevel.L4_GOLDEN_CLASS, 'comment icon+count'),
  candidate('comment-l4-yqQS0c', '.yqQS0c', SelectorLevel.L4_GOLDEN_CLASS, 'comment click area'),
  candidate('comment-l4-gVJHxe', '.gVJHxe', SelectorLevel.L4_GOLDEN_CLASS, 'comment button area'),

  // L3: Structure-based (resilient to class renames)
  candidate('comment-l3-count-span', '.z3vRcc span.RZC0Db', SelectorLevel.L3_STRUCTURAL, 'comment count text'),
  candidate('comment-l3-button-count', 'button[aria-label*="comment"] span', SelectorLevel.L3_STRUCTURAL, 'comment button count'),
];

// ============================================================================
// DATE CONTAINER SELECTORS — Finding dates for "edited" detection
// ============================================================================

/**
 * Selectors for finding date containers on posts.
 * The edited detection works by finding TWO dates in a post —
 * the creation date and the edit date. If we find both, the post is edited.
 */
export const DATE_CONTAINER_CANDIDATES: SelectorCandidate[] = [
  // L4: Golden class selectors (from GOLDEN_SELECTORS.dateContainer)
  candidate('date-l4-IMvYId-full', '.IMvYId.dDKhVc.Vu2fZd', SelectorLevel.L4_GOLDEN_CLASS, 'stream date (full)'),
  candidate('date-l4-IMvYId-mid', '.IMvYId.Vu2fZd', SelectorLevel.L4_GOLDEN_CLASS, 'stream date (mid)'),
  candidate('date-l4-IMvYId', '.IMvYId', SelectorLevel.L4_GOLDEN_CLASS, 'stream date (base)'),
  candidate('date-l4-jzdBjc', '.jzdBjc', SelectorLevel.L4_GOLDEN_CLASS, 'date label'),
  candidate('date-l4-EZrbnd', '.EZrbnd', SelectorLevel.L4_GOLDEN_CLASS, 'date container alt'),
  candidate('date-l4-vGGYOe-Vu2fZd', '.vGGYOe.Vu2fZd', SelectorLevel.L4_GOLDEN_CLASS, 'classwork expanded date'),
  candidate('date-l4-vGGYOe', '.vGGYOe', SelectorLevel.L4_GOLDEN_CLASS, 'classwork date'),
  candidate('date-l4-JZk9qf', '.JZk9qf.P354se', SelectorLevel.L4_GOLDEN_CLASS, 'edited/deleted marker'),

  // L3: Structure-based (resilient to class renames)
  candidate('date-l3-edited-span', 'span[data-stream-item-id] span.IMvYId ~ span', SelectorLevel.L3_STRUCTURAL, 'edit date sibling'),
  candidate('date-l3-hover-date', '[data-tooltip*="Edited"]', SelectorLevel.L3_STRUCTURAL, 'edited tooltip'),
];

// ============================================================================
// USER CONTENT EXCLUSION SELECTORS — Areas to SKIP during detection
// ============================================================================

/**
 * Elements that should NEVER be scanned for flags.
 * These are user-editable areas where the text "edited" or "comment"
 * might appear as user-typed content, not as Classroom metadata.
 */
export const USER_CONTENT_EXCLUSION_CANDIDATES: SelectorCandidate[] = [
  // L2: Semantic (very reliable — contenteditable and inputs are stable)
  candidate('exclude-l2-contenteditable', '[contenteditable="true"]', SelectorLevel.L2_ARIA_SEMANTIC, 'editable area'),
  candidate('exclude-l2-input', 'input', SelectorLevel.L2_ARIA_SEMANTIC, 'input field'),
  candidate('exclude-l2-textarea', 'textarea', SelectorLevel.L2_ARIA_SEMANTIC, 'textarea'),

  // L4: Golden class names
  candidate('exclude-l4-n8F6Jd', '.n8F6Jd', SelectorLevel.L4_GOLDEN_CLASS, 'user content area'),
  candidate('exclude-l4-a3j8U', '.a3j8U', SelectorLevel.L4_GOLDEN_CLASS, 'user content area 2'),
  candidate('exclude-l4-gM4mlb', '.gM4mlb', SelectorLevel.L4_GOLDEN_CLASS, 'user text area'),
  candidate('exclude-l4-A6dC2c', '.A6dC2c', SelectorLevel.L4_GOLDEN_CLASS, 'user content area 3'),
];

// ============================================================================
// CLASSWORK-SPECIFIC SELECTORS — Accordion state
// ============================================================================

/**
 * Selectors for detecting if a Classwork post is expanded or collapsed.
 *
 * In Classwork List View, posts can be folded (collapsed). When folded,
 * we should hide the Download All button. The V1 code had a complex
 * isPostCollapsed() function — this registry makes it data-driven.
 */
export const ACCORDION_STATE_CANDIDATES: SelectorCandidate[] = [
  // L2: ARIA (very reliable — aria-expanded is a WAI pattern)
  candidate('accordion-l2-aria-expanded', '[aria-expanded]', SelectorLevel.L2_ARIA_SEMANTIC, 'expand toggle'),
  candidate('accordion-l2-role-button', 'div[role="button"][aria-expanded]', SelectorLevel.L2_ARIA_SEMANTIC, 'expand toggle button'),

  // L4: Golden class names for expanded/collapsed states
  candidate('accordion-l4-lXuxY', 'li.lXuxY', SelectorLevel.L4_GOLDEN_CLASS, 'expanded classwork item'),
  candidate('accordion-l4-AZd1I', 'li.AZd1I', SelectorLevel.L4_GOLDEN_CLASS, 'collapsed classwork item'),
];

// ============================================================================
// PRE-BUILT SCORERS — Ready-to-use scorer instances for each target
// ============================================================================

/**
 * Factory functions that create pre-configured SelectorScorer instances.
 *
 * Each function returns a scorer loaded with the right candidates for
 * a specific purpose (finding posts, finding files, etc.).
 *
 * Usage in the engine:
 *   const scorer = createPostScorer();
 *   const result = scorer.queryAll(document.body);
 *   const posts = result.allElements;
 *
 * The scorer handles all the priority logic, tracing, and self-healing
 * internally. The engine just asks for what it wants and gets it.
 */
export function createPostScorer(): SelectorScorer {
  return new SelectorScorer('post container', POST_CANDIDATES);
}

export function createFileAnchorScorer(): SelectorScorer {
  return new SelectorScorer('file attachment', FILE_ANCHOR_CANDIDATES);
}

export function createHeaderScorer(): SelectorScorer {
  return new SelectorScorer('post header / three-dots', HEADER_CANDIDATES);
}

export function createCommentFlagScorer(): SelectorScorer {
  return new SelectorScorer('comment indicator', COMMENT_FLAG_CANDIDATES);
}

export function createDateContainerScorer(): SelectorScorer {
  return new SelectorScorer('date container', DATE_CONTAINER_CANDIDATES);
}

export function createExclusionScorer(): SelectorScorer {
  return new SelectorScorer('user content exclusion', USER_CONTENT_EXCLUSION_CANDIDATES, 50);
}

export function createAccordionScorer(): SelectorScorer {
  return new SelectorScorer('accordion state', ACCORDION_STATE_CANDIDATES);
}
