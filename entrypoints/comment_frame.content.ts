// filepath: entrypoints/comment_frame.content.ts
import { COMMENT_ICON_URL } from './content/icons';
import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';
import { whenExtensionEnabled } from './content/flags';

// Selector for the main stream card
const POST_SELECTOR = 'div[data-stream-item-id]';
const PROCESSED_ATTR = 'data-cqd-processed';

// 🔴 NEW: debounce flag so we don't rescan on every tiny mutation
let commentScanScheduled = false;
/* -----------------------------------------------------
 * Main Script
 * ---------------------------------------------------*/

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // ⬇️ Only run this script when the extension is enabled
    whenExtensionEnabled(() => {
      injectStyles();
      scanForComments();

      // --- STRATEGY 1: MUTATION OBSERVER ---
      const observer = new MutationObserver(() => {
        // ✅ Debounce: only one scan per frame
        if (commentScanScheduled) return;
        commentScanScheduled = true;

        requestAnimationFrame(() => {
          commentScanScheduled = false;
          scanForComments();
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setInterval(() => {
        scanForComments();
      }, 2500);

      let lastUrl = location.href; 
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          setTimeout(scanForComments, 500); 
        }
      }).observe(document, { subtree: true, childList: true });
    });
  },
});

function scanForComments() {
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);

    const posts = document.querySelectorAll<HTMLElement>(POST_SELECTOR);

    posts.forEach((post) => {
      if (post.hasAttribute(PROCESSED_ATTR)) {
        const existingOverlay = post.querySelector('.cqd-overlay-container');
        if (existingOverlay) {
          return;
        }
        post.removeAttribute(PROCESSED_ATTR);
      }

      // Prevent double borders on nested posts
      if (post.parentElement?.closest(POST_SELECTOR)) return;

      const rawText = (post.innerText || '') + ' ' + getAriaLabels(post);
      const match = rawText.match(/(\d+)\s+class comment/i);
      const count = match ? parseInt(match[1], 10) : 0;

      if (count > 0) {
        post.setAttribute(PROCESSED_ATTR, 'true');
        createOverlay(post, count);
      }
    });
  } catch (err) {
    console.warn('CQD Scan Error:', err);
  }
}

function createOverlay(post: HTMLElement, count: number) {
  const computed = window.getComputedStyle(post);
  const borderRadius = computed.borderRadius || '8px';

  if (computed.position === 'static') {
    post.style.position = 'relative';
  }

  post.style.setProperty('overflow', 'visible', 'important');
  post.style.setProperty('contain', 'none', 'important');
  post.style.zIndex = '1';

  // Reuse overlay if edited script already created it
  let overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cqd-overlay-container';
    overlay.style.borderRadius = borderRadius;

    if (isPageDark()) overlay.classList.add('cqd-theme-dark');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) triggerPostClick(post);
    });

    post.appendChild(overlay);
  }

  // Do not create a comment badge if a BOTH pill already exists
  if (post.querySelector('.cqd-both-badge')) {
    return;
  }

  const badge = document.createElement('div');
  badge.className = 'cqd-comment-badge';

  // 🔹 Tooltip for comments pill
  const explanation = 'Number of comments on this post';
  badge.title = explanation;
  badge.setAttribute('aria-label', explanation);

  badge.title = `${count} ${t('comments')}`;
  if (isPageDark()) badge.classList.add('cqd-theme-dark');

  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-badge-icon';
  iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;

  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-badge-label';
  labelDiv.textContent = `${count}`;

  badge.appendChild(iconDiv);
  badge.appendChild(labelDiv);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerPostClick(post);
  });

  post.appendChild(badge);
}

function triggerPostClick(post: HTMLElement) {
  const titleLink = post.querySelector<HTMLElement>('a[href*="/details/"], h2 a');
  if (titleLink) {
    titleLink.click();
  } else {
    post.click();
  }
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