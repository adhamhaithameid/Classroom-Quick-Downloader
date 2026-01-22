// filepath: entrypoints/edited_frame.content.ts
import { EDIT_ICON_SVG_RAW, appendSvgFromString } from './content/icons';
import { injectStyles } from './content/styles';
import { isPageDark } from './content/theme';
import { t, getCurrentCachedLanguage } from './content/i18n';
import { detectEdited } from './content/smart-detector';
import { whenExtensionEnabled } from './content/flags';
import { triggerPostClick, upgradeCombinedBadge, ATTR_EDIT_DIFF } from './content/both-badge';

// Selector for the main stream card
const POST_SELECTOR = 'div[data-stream-item-id]';
const EDITED_ATTR = 'data-cqd-edited-processed';
const INJECTED_ATTR = 'data-cqd-injected';

// Debounce flag so we don't rescan on every tiny mutation
let editedScanScheduled = false;

// Per-tab + runtime state
let tabEnabled = true;
let running = false;
let domObserver: MutationObserver | null = null;
let heartbeatId: number | null = null;
let urlObserver: MutationObserver | null = null;

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    whenExtensionEnabled(() => {
      if (!tabEnabled) return;
      startEditedFeature();
    });
  },
});

/* -----------------------------------------------------
 * Start / Stop logic (per tab)
 * ---------------------------------------------------*/
function startEditedFeature(): void {
  if (running) return;
  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!running && tabEnabled) {
          startEditedFeature();
        }
      },
      { once: true },
    );
    return;
  }
  running = true;
  injectStyles();
  scanForEditedPosts();

  // Scroll listener (Fixes missing frames after hard scroll)
  window.addEventListener('scroll', scanForEditedPosts, { passive: true });

  domObserver = new MutationObserver(() => {
    if (editedScanScheduled) return;
    editedScanScheduled = true;
    requestAnimationFrame(() => {
      editedScanScheduled = false;
      if (!running) return;
      scanForEditedPosts();
    });
  });

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'style'], 
  });

  heartbeatId = window.setInterval(() => {
    if (!running) return;
    scanForEditedPosts();
  }, 2500);

  let lastUrl = location.href;
  urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (!running) return;
      setTimeout(scanForEditedPosts, 500);
      setTimeout(scanForEditedPosts, 1500);
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });
}

function stopEditedFeature(): void {
  if (!running) return;
  running = false;

  window.removeEventListener('scroll', scanForEditedPosts);

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
  editedScanScheduled = false;

  // Remove our DOM artifacts
  document
    .querySelectorAll<HTMLElement>(
      '.cqd-edited-badge, .cqd-both-badge, .cqd-overlay-container',
    )
    .forEach((el) => el.remove());

  document
    .querySelectorAll<HTMLElement>(POST_SELECTOR)
    .forEach((post) => {
      post.removeAttribute(EDITED_ATTR);
      post.removeAttribute(ATTR_EDIT_DIFF); // Clean up data attr
      post.style.removeProperty('position');
    });
}

/* -----------------------------------------------------
 * Per-tab toggle messages
 * ---------------------------------------------------*/
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    // Firefox fix: return false for messages we don't handle
    if (!message) return false;
    if (message.type !== 'CQD_POPUP_SET_DESIRED_STATE') return false;
    tabEnabled = !!message.enabled;
    if (tabEnabled) {
      whenExtensionEnabled(() => {
        startEditedFeature();
      });
    } else {
      stopEditedFeature();
    }
    return false; // No async response needed
  });
}

/* -----------------------------------------------------
 * Edited posts scanning
 * ---------------------------------------------------*/
function scanForEditedPosts() {
  if (!running) return;
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);
    
    // Use smart detector for language-agnostic edited detection
    // Uses two-date pattern matching first (works in ALL languages),
    // then falls back to keywords with page language + English
    const currentLang = getCurrentCachedLanguage();

    const posts = document.querySelectorAll<HTMLElement>(POST_SELECTOR);
    posts.forEach((post) => {
      // Smart detection - language agnostic
      const result = detectEdited(post, currentLang);
      const found = result.isEdited;
      const diffText = result.editDiff;

      // DATA SOURCE OF TRUTH:
      // Always update the data attribute first.
      if (found && diffText !== null) {
        post.setAttribute(ATTR_EDIT_DIFF, diffText);
      } else {
        post.removeAttribute(ATTR_EDIT_DIFF);
      }

      // 1. Single Badge Logic
      if (found && diffText !== null) {
        if (post.hasAttribute(EDITED_ATTR)) {
          // Verify presence
          const hasEditedOverlay =
            !!post.querySelector('.cqd-overlay-container.cqd-edited') ||
            !!post.querySelector('.cqd-edited-badge') ||
            !!post.querySelector('.cqd-both-badge');
          
          if (!hasEditedOverlay) {
            post.removeAttribute(EDITED_ATTR);
          } else {
            if (post.style.position !== 'relative') {
               post.style.position = 'relative';
            }
          }
        }

        if (!post.hasAttribute(EDITED_ATTR)) {
          post.setAttribute(EDITED_ATTR, 'true');
          createEditedOverlay(post, diffText);
        }
      }

      // 2. Always attempt to merge/upgrade to "Both" badge
      upgradeCombinedBadge(post);
    });
  } catch {
    // Silent fail
  }
}

/**
 * Calculates the difference in days between created and edited date.
 * @deprecated Legacy implementation, kept for reference/fallback
 */
function calculateEditDiff(
  fullText: string,
  editedKeyword: string,
): string | null {
  try {
    const normalized = (fullText || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    const lower = normalized.toLowerCase();
    const key = editedKeyword.toLowerCase();
    const editedIndex = lower.indexOf(key);

    const monthPattern =
      '\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}\\b';
    const currentYear = new Date().getFullYear();

    const parseDate = (s: string): Date | null => {
      const d = new Date(`${s.trim()} ${currentYear}`);
      return isNaN(d.getTime()) ? null : d;
    };

    let createdDate: Date | null = null;
    let editedDate: Date | null = null;

    // 1) Preferred path: use dates around the "edited" keyword
    if (editedIndex !== -1) {
      const beforeText = normalized.slice(0, editedIndex);
      const afterText = normalized.slice(editedIndex);

      const beforeMatches =
        beforeText.match(new RegExp(monthPattern, 'gi')) || [];
      const afterMatches =
        afterText.match(new RegExp(monthPattern, 'gi')) || [];

      if (beforeMatches.length > 0) {
        const createdStr = beforeMatches[beforeMatches.length - 1];
        createdDate = parseDate(createdStr);
      }
      if (afterMatches.length > 0) {
        const editedStr = afterMatches[0];
        editedDate = parseDate(editedStr);
      }
    }

    // 2) Fallback: just use first and last dates in the whole string
    if (!createdDate || !editedDate) {
      const allMatches = normalized.match(new RegExp(monthPattern, 'gi'));
      if (!allMatches || allMatches.length === 0) {
        return null;
      }
      const parsedDates = allMatches
        .map((m) => parseDate(m))
        .filter((d): d is Date => !!d);

      if (!parsedDates.length) return null;
      createdDate = parsedDates[0];
      editedDate =
        parsedDates.length > 1
          ? parsedDates[parsedDates.length - 1]
          : parsedDates[0];
    }

    if (!createdDate || !editedDate) return null;

    const dayMs = 1000 * 60 * 60 * 24;
    let diffDays = Math.floor(
      (editedDate.getTime() - createdDate.getTime()) / dayMs,
    );
    if (diffDays < 0) diffDays = 0;

    return `${diffDays}`;
  } catch {
    return null;
  }
}



/**
 * Helper: collect aria-label/title text from inside the post,
 * so we can also see dates that are only exposed there.
 */
function getAriaLabelsFromPost(post: HTMLElement): string {
  return Array.from(
    post.querySelectorAll<HTMLElement>('[aria-label], [title]'),
  )
    .map(
      (el) =>
        (el.getAttribute('aria-label') || '') +
        ' ' +
        (el.getAttribute('title') || ''),
    )
    .join(' ');
}

function createEditedOverlay(post: HTMLElement, diffText: string) {
  // If BOTH pill already exists, don't create a separate edited pill
  // Data attr logic handles the update.
  if (post.querySelector('.cqd-both-badge')) {
    return;
  }

  const computed = window.getComputedStyle(post);
  if (computed.position === 'static') post.style.position = 'relative';
  
  // Reuse overlay
  let overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cqd-overlay-container cqd-edited';
    overlay.style.borderRadius = computed.borderRadius || '8px';
    overlay.setAttribute(INJECTED_ATTR, 'true');
    if (isPageDark()) overlay.classList.add('cqd-theme-dark');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        triggerPostClick(post);
      }
    });
    post.appendChild(overlay);
  } else {
    overlay.classList.add('cqd-edited');
    overlay.setAttribute(INJECTED_ATTR, 'true');
    if (isPageDark()) overlay.classList.add('cqd-theme-dark');
  }

  // Create Single Edited Badge
  let pill = post.querySelector<HTMLElement>('.cqd-edited-badge');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'cqd-edited-badge';
    pill.setAttribute(INJECTED_ATTR, 'true');
    if (isPageDark()) pill.classList.add('cqd-theme-dark');
    // Tooltip for edited pill (NO NUMBER)
    pill.title = t('edited');
    pill.setAttribute('aria-label', t('edited'));

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'cqd-edited-icon';
    appendSvgFromString(iconWrapper, EDIT_ICON_SVG_RAW);
    pill.appendChild(iconWrapper);

    // === NUMBER DISPLAY COMMENTED OUT - Uncomment to restore ===
    // const content = document.createElement('div');
    // content.className = 'cqd-edited-content';
    // const diffSpan = document.createElement('span');
    // diffSpan.className = 'cqd-diff-val';
    // diffSpan.textContent = diffText;
    // content.appendChild(diffSpan);
    // pill.appendChild(content);
    // === END NUMBER DISPLAY ===

    post.appendChild(pill);
  }
  
  // === NUMBER UPDATE COMMENTED OUT - Uncomment to restore ===
  // const span = pill.querySelector('.cqd-diff-val');
  // if (span) span.textContent = diffText;
  // === END NUMBER UPDATE ===
}

function getPageDirection(): 'ltr' | 'rtl' {
  const docDir = document.documentElement.dir || document.body.dir;
  return docDir === 'rtl' ? 'rtl' : 'ltr';
}