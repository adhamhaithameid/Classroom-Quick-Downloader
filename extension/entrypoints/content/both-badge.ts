// filepath: entrypoints/content/both-badge.ts
import { COMMENT_ICON_URL, EDIT_ICON_SVG_RAW } from './icons';

const INJECTED_ATTR = 'data-cqd-injected';

// Data attributes that act as the "Source of Truth"
export const ATTR_COMMENT_COUNT = 'data-cqd-comment-count';
export const ATTR_EDIT_DIFF = 'data-cqd-edit-diff';

/**
 * Utility: open the Classroom post when user clicks our overlay / pill.
 */
export function triggerPostClick(post: HTMLElement) {
  const titleLink = post.querySelector<HTMLElement>(
    'a[href*="/details/"], h2 a',
  );
  if (titleLink) {
    titleLink.click();
  } else {
    post.click();
  }
}

/**
 * Merge "comments" badge + "edited" badge into a single BOTH pill.
 * NEW STRATEGY:
 * - Read values from data-attributes (Source of Truth).
 * - Create the pill.
 * - Add the .cqd-both class to the overlay to trigger the Red Frame.
 */
export function upgradeCombinedBadge(post: HTMLElement): void {
  // 1. Read the Source of Truth directly from the container
  const rawCount = post.getAttribute(ATTR_COMMENT_COUNT);
  const rawDiff = post.getAttribute(ATTR_EDIT_DIFF);

  // Get the overlay now to handle cleanup if needed
  const overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');

  // If we don't have BOTH pieces of data yet, we cannot form a valid "Both" badge.
  if (rawCount === null || rawDiff === null) {
    const existingBoth = post.querySelector('.cqd-both-badge');
    if (existingBoth) {
      existingBoth.remove();
      // If we remove the badge, also remove the red frame class
      if (overlay) {
        overlay.classList.remove('cqd-both');
      }
    }
    return;
  }

  // 2. We have both values. Time to render the "Both" badge.
  const commentCount = rawCount || '0';
  const diffText = rawDiff || '0';

  // Remove separate badges (cleanup)
  post.querySelector('.cqd-comment-badge')?.remove();
  post.querySelector('.cqd-edited-badge')?.remove();

  // Ensure overlay exists (shared container)
  let finalOverlay = overlay;
  if (!finalOverlay) {
    const computed = window.getComputedStyle(post);
    finalOverlay = document.createElement('div');
    finalOverlay.className = 'cqd-overlay-container'; // Base class
    
    // Check dark mode
    if (document.body.classList.contains('cqd-theme-dark') || post.classList.contains('cqd-theme-dark')) {
        finalOverlay.classList.add('cqd-theme-dark');
    }

    finalOverlay.style.borderRadius = computed.borderRadius || '8px';
    finalOverlay.setAttribute(INJECTED_ATTR, 'true');

    finalOverlay.addEventListener('click', (e) => {
      if (e.target === finalOverlay) {
        triggerPostClick(post);
      }
    });
    post.appendChild(finalOverlay);
  }

  // 3. APPLY THE RED FRAME: Add .cqd-both class
  if (!finalOverlay.classList.contains('cqd-both')) {
      finalOverlay.classList.add('cqd-both');
  }

  // 4. Create or Update the Badge
  let bothBadge = post.querySelector<HTMLElement>('.cqd-both-badge');
  
  if (!bothBadge) {
    bothBadge = document.createElement('div');
    bothBadge.className = 'cqd-both-badge';
    bothBadge.setAttribute(INJECTED_ATTR, 'true');
    
    // Tooltip
    bothBadge.title = 'Top: number of comments. Bottom: days between posting and last edit.';
    bothBadge.setAttribute('aria-label', bothBadge.title);

    // Build Internal Structure
    
    // -- Comments Section --
    const commentsSection = document.createElement('div');
    commentsSection.className = 'cqd-both-section cqd-both-comments';
    
    const commentIcon = document.createElement('div');
    commentIcon.className = 'cqd-both-icon cqd-both-icon-comment';
    commentIcon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
    
    const commentValue = document.createElement('span');
    commentValue.className = 'cqd-both-value cqd-both-value-comment';
    commentValue.textContent = commentCount;
    
    commentsSection.appendChild(commentIcon);
    commentsSection.appendChild(commentValue);

    // -- Plus / Divider --
    const plus = document.createElement('div');
    plus.className = 'cqd-both-plus';
    plus.textContent = '+';
    
    const divider = document.createElement('div');
    divider.className = 'cqd-both-divider';

    // -- Edited Section --
    const editedSection = document.createElement('div');
    editedSection.className = 'cqd-both-section cqd-both-edited';
    
    const editedIcon = document.createElement('div');
    editedIcon.className = 'cqd-both-icon cqd-both-icon-edited';
    editedIcon.innerHTML = EDIT_ICON_SVG_RAW;
    
    const diffValue = document.createElement('span');
    diffValue.className = 'cqd-both-value cqd-both-value-edited';
    diffValue.textContent = diffText;
    
    editedSection.appendChild(editedIcon);
    editedSection.appendChild(diffValue);

    // Assemble
    bothBadge.appendChild(commentsSection);
    bothBadge.appendChild(plus);
    bothBadge.appendChild(divider);
    bothBadge.appendChild(editedSection);

    bothBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerPostClick(post);
    });

    post.appendChild(bothBadge);

  } else {
    // Just update the numbers if badge exists
    const cc = bothBadge.querySelector<HTMLElement>('.cqd-both-value-comment');
    const dd = bothBadge.querySelector<HTMLElement>('.cqd-both-value-edited');
    if (cc && cc.textContent !== commentCount) cc.textContent = commentCount;
    if (dd && dd.textContent !== diffText) dd.textContent = diffText;
  }
}