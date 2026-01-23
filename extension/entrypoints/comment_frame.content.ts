// filepath: entrypoints/comment_frame.content.ts
import { COMMENT_ICON_URL } from './content/icons';
import { injectStyles } from './content/styles';
import { t, getCurrentCachedLanguage } from './content/i18n';
import { detectComments } from './content/smart-detector';
import { isPageDark } from './content/theme';
import { subscribeToGlobalState } from './content/flags';
import { triggerPostClick, upgradeCombinedBadge, ATTR_COMMENT_COUNT } from './content/both-badge';
import { triggerPulseEffect, markTargetElements } from './content/pulse-effect';

// Selector for the main stream card
const POST_SELECTOR = 'div[data-stream-item-id]';

// IMPORTANT: use a comments-specific flag, not the generic one
const PROCESSED_ATTR = 'data-cqd-comments-processed';
const INJECTED_ATTR = 'data-cqd-injected';

// Debounce flag so we don't rescan on every tiny mutation
let commentScanScheduled = false;

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// Per-tab + runtime state
// let tabEnabled = true; // Removed
let running = false;
let domObserver: MutationObserver | null = null;
let heartbeatId: number | null = null;
let urlObserver: MutationObserver | null = null;

/* -----------------------------------------------------
 * Content script entry
 * ---------------------------------------------------*/
export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // Subscribe to global enabled/disabled events
    // This handles initial check AND live updates
    subscribeToGlobalState(
      () => startCommentsFeature(),
      () => stopCommentsFeature()
    );
  },
});

/* -----------------------------------------------------
 * Start / Stop logic
 * ---------------------------------------------------*/
function startCommentsFeature(): void {
  if (running) return;
  
  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!running) {
          startCommentsFeature();
        }
      },
      { once: true },
    );
    return;
  }

  running = true;
  injectStyles();
  scanForComments();

  // Scroll listener (Fixes missing frames after hard scroll)
  window.addEventListener('scroll', scanForComments, { passive: true });

  domObserver = new MutationObserver(() => {
    if (commentScanScheduled) return;
    commentScanScheduled = true;
    requestAnimationFrame(() => {
      commentScanScheduled = false;
      if (!running) return;
      scanForComments();
    });
  });

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true, 
    attributeFilter: ['style'], // Monitor style so we can re-apply position:relative
  });

  heartbeatId = window.setInterval(() => {
    if (!running) return;
    scanForComments();
  }, 2500);

  let lastUrl = location.href;
  urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (!running) return;
      setTimeout(scanForComments, 500);
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });
}

function stopCommentsFeature(): void {
  if (!running) return;
  running = false;

  window.removeEventListener('scroll', scanForComments);

  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  if (heartbeatId != null) {
    window.clearInterval(heartbeatId);
    heartbeatId = null;
  }
  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }
  commentScanScheduled = false;

  // Remove our DOM artifacts from this tab
  document
    .querySelectorAll<HTMLElement>(
      '.cqd-comment-badge, .cqd-both-badge, .cqd-overlay-container',
    )
    .forEach((el) => el.remove());

  document
    .querySelectorAll<HTMLElement>(POST_SELECTOR)
    .forEach((post) => {
      post.removeAttribute(PROCESSED_ATTR);
      post.removeAttribute(ATTR_COMMENT_COUNT); // Clean up data attr
      post.style.removeProperty('position');
    });
}

/* -----------------------------------------------------
 * Main scanning logic
 * ---------------------------------------------------*/
function scanForComments() {
  if (!running) return;
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);
    const posts = document.querySelectorAll<HTMLElement>(POST_SELECTOR);

    posts.forEach((post) => {
      // Prevent double borders on nested posts
      if (post.parentElement?.closest(POST_SELECTOR)) return;

      // Use smart detector for language-agnostic comment detection
      // Checks current language + English fallback, uses DOM analysis + pattern matching
      const currentLang = getCurrentCachedLanguage();
      const result = detectComments(post, currentLang);
      const count = result.count;

      // DATA SOURCE OF TRUTH:
      // Always update the data attribute first. This enables the "Both" logic to work 
      // even if visual pills are currently missing/wiped.
      if (count > 0) {
        post.setAttribute(ATTR_COMMENT_COUNT, count.toString());
      } else {
        post.removeAttribute(ATTR_COMMENT_COUNT);
      }

      // 1. Check if we need to render the Single Badge
      if (count > 0) {
         if (post.hasAttribute(PROCESSED_ATTR)) {
            // It was marked processed. Check if overlay/badge is actually there.
            const existingOverlay = post.querySelector('.cqd-overlay-container');
            const existingBadge = post.querySelector('.cqd-comment-badge');
            const existingBoth = post.querySelector('.cqd-both-badge');
            
            if (!existingOverlay && !existingBadge && !existingBoth) {
               // Missing visuals -> Reset flag to force redraw
               post.removeAttribute(PROCESSED_ATTR);
            } else {
               // Ensure relative positioning persists
               if (post.style.position !== 'relative') {
                  post.style.position = 'relative';
               }
            }
         }

         if (!post.hasAttribute(PROCESSED_ATTR)) {
            post.setAttribute(PROCESSED_ATTR, 'true');
            createOverlay(post, count);
         }
      }

      // 2. Always attempt to merge/upgrade to "Both" badge if data exists
      upgradeCombinedBadge(post);
    });
  } catch (err) {
    console.warn('CQD Scan Error:', err);
  }
}

function createOverlay(post: HTMLElement, count: number) {
  // If a BOTH pill already exists, we do NOT create a separate comment badge.
  // The data attribute is enough for the Both badge to update itself.
  if (post.querySelector('.cqd-both-badge')) {
    return;
  }

  const computed = window.getComputedStyle(post);
  const borderRadius = computed.borderRadius || '8px';
  if (computed.position === 'static') {
    post.style.position = 'relative';
  }
  
  // Reuse overlay if it exists
  let overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cqd-overlay-container';
    overlay.style.borderRadius = borderRadius;
    overlay.setAttribute(INJECTED_ATTR, 'true');
    if (isPageDark()) overlay.classList.add('cqd-theme-dark');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) triggerPostClick(post);
    });
    post.appendChild(overlay);
    
    // Mark comment counter for permanent bold styling
    markTargetElements(post, 'comment');
  }

  // Create Single Comment Badge
  let badge = post.querySelector<HTMLElement>('.cqd-comment-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'cqd-comment-badge';
    badge.setAttribute(INJECTED_ATTR, 'true');
    // Tooltip with Count
    const explanation = `${count} ${t('comments')}`;
    badge.title = explanation;
    badge.setAttribute('aria-label', explanation);
    if (isPageDark()) badge.classList.add('cqd-theme-dark');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cqd-badge-icon';
    iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;

    // === NUMBER DISPLAY COMMENTED OUT - Uncomment to restore ===
    // const labelDiv = document.createElement('span');
    // labelDiv.className = 'cqd-badge-label';
    // labelDiv.textContent = `${count}`;
    // === END NUMBER DISPLAY ===

    badge.appendChild(iconDiv);
    // === Uncomment if restoring numbers ===
    // badge.appendChild(labelDiv);
    // ===

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerPulseEffect(post, 'comment');
      triggerPostClick(post);
    });
    post.appendChild(badge);
  }
  
  // === NUMBER UPDATE COMMENTED OUT - Uncomment to restore ===
  // badge.title = `${count} ${t('comments')}`;
  // const label = badge.querySelector('.cqd-badge-label');
  // if (label) label.textContent = `${count}`;
  // === END NUMBER UPDATE ===
}

function getPageDirection(): 'ltr' | 'rtl' {
  const docDir = document.documentElement.dir || document.body.dir;
  if (docDir === 'rtl') return 'rtl';
  const computed = window.getComputedStyle(document.body).direction;
  return computed === 'rtl' ? 'rtl' : 'ltr';
}

function getAriaLabels(el: HTMLElement): string {
  return Array.from(el.querySelectorAll('[aria-label]'))
    .map((node) => node.getAttribute('aria-label') || '')
    .join(' ');
}