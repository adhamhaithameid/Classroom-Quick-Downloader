// filepath: entrypoints/content/both-badge.ts
import { COMMENT_ICON_URL, EDIT_ICON_SVG_RAW, appendSvgFromString } from './icons';
import { t } from './i18n';
import { triggerPulseEffect, markTargetElements } from './pulse-effect';

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
  const rawEditTooltip = post.getAttribute('data-cqd-edit-tooltip');

  // Get the overlay now to handle cleanup if needed
  const overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');

  // If we don't have BOTH pieces of data yet, we cannot form a valid "Both" badge.
  // RELAXED CONDITION: We need a comment count AND (either a diff OR at least an edited tooltip/flag)
  if (rawCount === null || (rawDiff === null && rawEditTooltip === null)) {
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
  
  // Mark BOTH comment counter and date elements for permanent bold styling
  markTargetElements(post, 'both');

    // 4. Create or Update the Badge (New Expanding Style)
    // We treat the "Both" badge as a standard .cqd-flag now.
    let bothBadge = post.querySelector<HTMLElement>('.cqd-both-badge');
    
    const commentTooltip = `${commentCount} ${t('comments')}`;
    const editTooltipText = rawEditTooltip || t('edited');
    // Combine for the expanded text: "5 Comments | Modified 2d ago"
    const tooltipText = `${commentTooltip} | ${editTooltipText}`;

    if (!bothBadge) {
      bothBadge = document.createElement('div');
      // inherits .cqd-flag styles from global CSS
      bothBadge.className = 'cqd-flag cqd-both-badge'; 
      bothBadge.setAttribute(INJECTED_ATTR, 'true');
      
      bothBadge.title = tooltipText;
      bothBadge.setAttribute('aria-label', tooltipText);

      // --- Icon Container ---
      const iconDiv = document.createElement('div');
      iconDiv.className = 'cqd-flag-icon';
      // Use comment icon as primary, or we could add a specific 'both' icon
      iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
      
      // Optional: Add a small indicator for "Edited" on top of the icon?
      // For now, simplicity: Just the icon.
      
      // --- Text Span (Hidden by default, expands on hover) ---
      const textSpan = document.createElement('span');
      textSpan.className = 'cqd-flag-text';
      textSpan.textContent = tooltipText;
      
      bothBadge.appendChild(iconDiv);
      bothBadge.appendChild(textSpan);

      // Click Handler
      bothBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerPulseEffect(post, 'both');
        triggerPostClick(post);
      });

      post.appendChild(bothBadge);
    } else {
        // Update if existing
        if (bothBadge.title !== tooltipText) {
            bothBadge.title = tooltipText;
            bothBadge.setAttribute('aria-label', tooltipText);
            const textSpan = bothBadge.querySelector('.cqd-flag-text');
            if (textSpan) textSpan.textContent = tooltipText;
        }
    }
}