// filepath: entrypoints/content/pulse-effect.ts
/**
 * Pulse effect utility for comment/edit/both badge clicks.
 * Cross-browser compatible (Chrome, Firefox, Edge, Brave, Safari).
 */

export type PulseType = 'comment' | 'edited' | 'both';

// PRIMARY selectors provided by user
// if Google changes these classes we are so doomed
const DATE_CONTAINER = '.IMvYId.dDKhVc.Vu2fZd';
const COMMENT_WITH_COUNT = '.asQXV.QRiHXd';
const COMMENT_NO_COUNT = '.mUIrbf-vQzf8d';

// Fallback selectors
const DATE_FALLBACKS = ['.EZrbnd', '.asQXV', 'time', '.lPnpwd'];
const COMMENT_FALLBACKS = ['.z3vRcc-aD1xae', '.z3vRcc', '[data-co]'];

const STYLED_ATTR = 'data-cqd-styled';

/**
 * Finds comment element in post
 */
function findComment(post: HTMLElement): HTMLElement | null {
  // Primary selectors first
  let el = post.querySelector<HTMLElement>(COMMENT_WITH_COUNT);
  if (el?.textContent?.trim()) return el;
  
  el = post.querySelector<HTMLElement>(COMMENT_NO_COUNT);
  if (el?.textContent?.trim()) return el;
  
  // Fallbacks
  for (const sel of COMMENT_FALLBACKS) {
    el = post.querySelector<HTMLElement>(sel);
    if (el?.textContent?.trim()) return el;
  }
  
  // Text search fallback
  for (const span of post.querySelectorAll('span')) {
    if (span.textContent?.toLowerCase().includes('comment') && 
        !span.closest('[data-cqd-injected]')) {
      return span;
    }
  }
  return null;
}

/**
 * Finds date element in post
 */
function findDate(post: HTMLElement): HTMLElement | null {
  // Primary selector first
  let el = post.querySelector<HTMLElement>(DATE_CONTAINER);
  if (el?.textContent?.trim()) return el;
  
  // Fallbacks
  for (const sel of DATE_FALLBACKS) {
    el = post.querySelector<HTMLElement>(sel);
    if (el?.textContent?.trim()) return el;
  }
  
  // Pattern match fallback
  for (const elem of post.querySelectorAll('span, div')) {
    const text = elem.textContent?.trim() || '';
    if (/\d{1,2}[\/\-\.]\d{1,2}|\w{3}\s+\d{1,2}/i.test(text) &&
        !elem.closest('[data-cqd-injected]') && 
        elem instanceof HTMLElement) {
      return elem;
    }
  }
  return null;
}

/**
 * Marks target elements with permanent bold class.
 * Call during overlay creation.
 */
export function markTargetElements(post: HTMLElement, type: PulseType): void {
  if (type === 'comment' || type === 'both') {
    const el = findComment(post);
    if (el && !el.hasAttribute(STYLED_ATTR)) {
      el.setAttribute(STYLED_ATTR, 'comment');
      el.classList.add('cqd-permanent-bold-comment');
    }
  }
  if (type === 'edited' || type === 'both') {
    const el = findDate(post);
    if (el && !el.hasAttribute(STYLED_ATTR)) {
      el.setAttribute(STYLED_ATTR, 'edited');
      el.classList.add('cqd-permanent-bold-edited');
    }
  }
}

/**
 * Removes all styling when extension is disabled.
 */
export function unmarkTargetElements(post: HTMLElement): void {
  post.querySelectorAll<HTMLElement>(`[${STYLED_ATTR}]`).forEach(el => {
    el.removeAttribute(STYLED_ATTR);
    el.classList.remove(
      'cqd-permanent-bold-comment', 'cqd-permanent-bold-edited',
      'cqd-color-comment', 'cqd-color-edited', 'cqd-color-both', 'cqd-inner-pulse'
    );
  });
}

/**
 * Triggers pulse animation on overlay and color highlight on target elements.
 * Call from badge click handlers.
 * Includes debounce to prevent multiple clicks during animation.
 */
export function triggerPulseEffect(post: HTMLElement, type: PulseType): void {
  // animations in js instead of css?? sacrilege
  const ANIMATION_DURATION = 1500; // Match CSS animation duration
  const DEBOUNCE_ATTR = 'data-cqd-animating';
  
  // Check if already animating - prevent multiple clicks
  if (post.hasAttribute(DEBOUNCE_ATTR)) {
    return; // Do nothing if animation is in progress
  }
  
  // Mark as animating
  post.setAttribute(DEBOUNCE_ATTR, 'true');
  
  // 1. Pulse the overlay border
  const overlay = post.querySelector<HTMLElement>('.cqd-overlay-container');
  if (overlay) {
    // Remove existing, force reflow, add new
    overlay.classList.remove('cqd-pulse-comment', 'cqd-pulse-edited', 'cqd-pulse-both');
    void overlay.offsetWidth; // Force reflow (cross-browser)
    overlay.classList.add(`cqd-pulse-${type}`);
    
    setTimeout(() => {
      overlay.classList.remove(`cqd-pulse-${type}`);
    }, ANIMATION_DURATION);
  }

  // 2. Color highlight the target text
  // Define which class to use based on type
  const commentClass = type === 'both' ? 'cqd-color-both' : 'cqd-color-comment';
  const editedClass = type === 'both' ? 'cqd-color-both' : 'cqd-color-edited';

  if (type === 'comment' || type === 'both') {
    const el = post.querySelector<HTMLElement>('[data-cqd-styled="comment"]');
    if (el) {
      el.classList.add(commentClass, 'cqd-inner-pulse');
      setTimeout(() => el.classList.remove(commentClass, 'cqd-inner-pulse'), ANIMATION_DURATION);
    }
  }
  
  if (type === 'edited' || type === 'both') {
    const el = post.querySelector<HTMLElement>('[data-cqd-styled="edited"]');
    if (el) {
      el.classList.add(editedClass, 'cqd-inner-pulse');
      setTimeout(() => el.classList.remove(editedClass, 'cqd-inner-pulse'), ANIMATION_DURATION);
    }
  }
  
  // 3. Remove debounce attribute after animation completes
  setTimeout(() => {
    post.removeAttribute(DEBOUNCE_ATTR);
  }, ANIMATION_DURATION);
}
