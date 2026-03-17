// filepath: entrypoints/edited_frame.content.ts
import { EDIT_ICON_SVG_RAW, appendSvgFromString } from './content/icons';
import { injectStyles } from './content/styles';
import { isPageDark } from './content/theme';
import { t, getCurrentCachedLanguage } from './content/i18n';
import { detectEdited } from './content/smart-detector';
import { subscribeToGlobalState, createEditedBadge } from './content/flags';
import { triggerPostClick, upgradeCombinedBadge, ATTR_EDIT_DIFF } from './content/both-badge';
import { triggerPulseEffect, markTargetElements } from './content/pulse-effect';
import { queryPostCards } from './content/post-card-utils';
import { isStudentWorkRoute } from '../src/student_work/url-classifier';

// Selector for the main stream card (works for both Stream and Classwork tabs)
// Stream: div[data-stream-item-id], Classwork: li[data-stream-item-id]
const POST_SELECTOR = '[data-stream-item-id]';
const EDITED_ATTR = 'data-cqd-edited-processed';
const INJECTED_ATTR = 'data-cqd-injected';

// Debounce flag so we don't rescan on every tiny mutation
let editedScanScheduled = false;

// Per-tab + runtime state
// let tabEnabled = true; // Removed
let running = false;
let domObserver: MutationObserver | null = null;
let heartbeatId: number | null = null;
let urlObserver: MutationObserver | null = null;

// Flag toggle state (controlled from popup)
let editedFlagEnabled = true;

function isStudentWorkPage(): boolean {
  return isStudentWorkRoute(window.location.pathname);
}

function removeEditedArtifacts(): void {
  document.querySelectorAll<HTMLElement>(
    '.cqd-edited-badge, .cqd-both-badge, .cqd-overlay-container',
  ).forEach((el) => el.remove());

  document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((post) => {
    post.removeAttribute(EDITED_ATTR);
    post.removeAttribute(ATTR_EDIT_DIFF);
    post.removeAttribute('data-cqd-edit-tooltip');
  });
}

function requestEditedRefresh(): void {
  if (!running || !editedFlagEnabled) return;
  document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((post) => {
    post.removeAttribute(EDITED_ATTR);
  });
  scanForEditedPosts();
}

function applyEditedFlagState(enabled: boolean): void {
  const wasEnabled = editedFlagEnabled;
  editedFlagEnabled = enabled;

  if (wasEnabled && !editedFlagEnabled) {
    removeEditedArtifacts();
    return;
  }

  if (!wasEnabled && editedFlagEnabled) {
    requestEditedRefresh();
  }
}

// Load flag state from storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _browserApi = (globalThis as any).chrome;
if (_browserApi?.storage?.local) {
  _browserApi.storage.local.get('editedFlagEnabled', (res: { editedFlagEnabled?: boolean }) => {
    editedFlagEnabled = res.editedFlagEnabled !== false; // default true
  });
  _browserApi.storage.onChanged.addListener((changes: any, area: string) => {
    if (area === 'local' && 'editedFlagEnabled' in changes) {
      applyEditedFlagState(changes.editedFlagEnabled.newValue !== false);
    }
  });
}

if (_browserApi?.runtime?.onMessage) {
  _browserApi.runtime.onMessage.addListener((message: any) => {
    if (!message || message.type !== 'cqd-flag-toggle') return;

    if (message.flag === 'editedFlagEnabled') {
      applyEditedFlagState(message.enabled !== false);
      return;
    }

    if ((message.flag === 'commentsFlagEnabled' || message.flag === 'combinedFlagEnabled') && running && editedFlagEnabled) {
      window.setTimeout(() => requestEditedRefresh(), 0);
    }
  });
}

/* --------------------------------------------------------------------------
 * Content script entry
 * ------------------------------------------------------------------------*/

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    subscribeToGlobalState(
      () => startEditedFeature(),
      () => stopEditedFeature()
    );
  },
});

/* -----------------------------------------------------
 * Start / Stop logic
 * ---------------------------------------------------*/
function startEditedFeature(): void {
  if (running) return;
  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!running) {
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
 * Edited posts scanning
 * ---------------------------------------------------*/
function scanForEditedPosts() {
  if (!running) return;
  if (!editedFlagEnabled) return; // Flag disabled from popup settings
  if (isStudentWorkPage()) {
    removeEditedArtifacts();
    return;
  }
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);
    
    // Use smart detector for language-agnostic edited detection
    // Uses two-date pattern matching first (works in ALL languages),
    // then falls back to keywords with page language + English
    const currentLang = getCurrentCachedLanguage();

    const posts = queryPostCards();
    posts.forEach((post) => {
      // Smart detection - language agnostic
      const result = detectEdited(post, currentLang);
      const found = result.isEdited;

      // Construct native tooltip text
      const tooltipText = t('edited');

      // DATA SOURCE OF TRUTH:
      if (found) {
        post.setAttribute('data-cqd-edit-tooltip', tooltipText); // Store full tooltip for shared use
      } else {
        post.removeAttribute(ATTR_EDIT_DIFF);
        post.removeAttribute('data-cqd-edit-tooltip');
      }

      // 1. Single Badge Logic
      if (found) {
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

        // Get existing diff value if stored, otherwise null (will show ✓)
        const diffValue = post.getAttribute(ATTR_EDIT_DIFF) || null;

        if (!post.hasAttribute(EDITED_ATTR)) {
          post.setAttribute(EDITED_ATTR, 'true');
          // Use factory to create the expanding badge - pass diffValue not tooltipText!
          const badge = createEditedBadge(post, diffValue);
          post.appendChild(badge);
        } else {
           // Update existing badge text span - don't override with tooltipText!
           const badge = post.querySelector<HTMLElement>('.cqd-edited-badge');
           if (badge) {
             // Only update tooltip (for accessibility), not the visible text
             badge.title = tooltipText;
             badge.setAttribute('aria-label', tooltipText);
             // Text span should keep showing the diff value or ✓
           }
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

function createEditedOverlay(post: HTMLElement, tooltipText: string) {
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
    
    // Mark date element for permanent bold styling
    markTargetElements(post, 'edited');
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

    // Click handler with pulse effect
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerPulseEffect(post, 'edited');
      triggerPostClick(post);
    });

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
