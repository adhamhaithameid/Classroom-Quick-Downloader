// filepath: entrypoints/content/comment_frame.content.ts
import { COMMENT_ICON_URL } from './content/icons';
import { injectStyles } from './content/styles';
import { t } from './content/i18n';

// Selector for the main stream card
const POST_SELECTOR = 'div[data-stream-item-id]';
const PROCESSED_ATTR = 'data-cqd-processed';

/* -----------------------------------------------------
 * Main Script
 * ---------------------------------------------------*/

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // 1. Inject CSS immediately
    injectStyles();

    // 2. Run initial scan
    scanForComments();

    // --- STRATEGY 1: MUTATION OBSERVER ---
    const observer = new MutationObserver((mutations) => {
      requestAnimationFrame(() => {
        scanForComments();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // --- STRATEGY 2: THE HEARTBEAT ---
    setInterval(() => {
      scanForComments();
    }, 1000);

    // --- STRATEGY 3: URL WATCHER ---
    let lastUrl = location.href; 
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(scanForComments, 500); 
      }
    }).observe(document, { subtree: true, childList: true });
  },
});

function scanForComments() {
  try {
    const direction = getPageDirection();
    document.body.setAttribute('data-cqd-dir', direction);

    const posts = document.querySelectorAll<HTMLElement>(POST_SELECTOR);

    posts.forEach((post) => {
      // 1. Check if already processed
      if (post.hasAttribute(PROCESSED_ATTR)) {
        const existingOverlay = post.querySelector('.cqd-overlay-container');
        if (existingOverlay) {
            return; 
        }
        post.removeAttribute(PROCESSED_ATTR);
      }

      // 2. Prevent double borders
      if (post.parentElement?.closest(POST_SELECTOR)) return;

      // 3. Check for comments text
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

  // --- LAYOUT FIXES ---
  if (computed.position === 'static') {
    post.style.position = 'relative';
  }
  
  post.style.setProperty('overflow', 'visible', 'important');
  post.style.setProperty('contain', 'none', 'important');
  post.style.zIndex = '1';

  // --- A. THE FRAME ---
  const overlay = document.createElement('div');
  overlay.className = 'cqd-overlay-container';
  overlay.style.borderRadius = borderRadius;
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) triggerPostClick(post);
  });
  post.appendChild(overlay);

  // --- B. THE VERTICAL BADGE ---
  const badge = document.createElement('div');
  badge.className = 'cqd-comment-badge';
  badge.title = `${count} ${t('comments')}`; 

  // 1. Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-badge-icon';
  iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;

  // 2. Label (Number Only)
  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-badge-label';
  labelDiv.textContent = `${count}`; // Just the number

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