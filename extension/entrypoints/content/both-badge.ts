// filepath: entrypoints/content/both-badge.ts
/**
 * BOTH BADGE - Universal V4 Combined Comment + Edited Badge
 * 
 * Shows when a post has BOTH comments AND edited status.
 * Uses vertical expansion on hover with combined info display.
 */

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
 * 
 * V4 Strategy:
 * - Read values from data-attributes (Source of Truth)
 * - Create Smart Pill with vertical expansion
 * - Show "{count} • {diffString}" on hover
 */
export function upgradeCombinedBadge(post: HTMLElement): void {
  // 1. Read the Source of Truth
  const rawCount = post.getAttribute(ATTR_COMMENT_COUNT);
  const rawDiff = post.getAttribute(ATTR_EDIT_DIFF);
  const rawEditTooltip = post.getAttribute('data-cqd-edit-tooltip');

  const overlay = post.querySelector<HTMLDivElement>('.cqd-overlay-container');

  // Need BOTH pieces of data for a valid "Both" badge
  if (rawCount === null || (rawDiff === null && rawEditTooltip === null)) {
    const existingBoth = post.querySelector('.cqd-both-badge');
    if (existingBoth) {
      existingBoth.remove();
      if (overlay) {
        overlay.classList.remove('cqd-both');
      }
    }
    return;
  }

  // 2. We have both values
  const commentCount = rawCount || '0';
  const diffText = rawDiff || '';

  // Remove separate badges (cleanup)
  post.querySelector('.cqd-comment-badge')?.remove();
  post.querySelector('.cqd-edited-badge')?.remove();

  // Ensure overlay exists
  let finalOverlay = overlay;
  if (!finalOverlay) {
    const computed = window.getComputedStyle(post);
    finalOverlay = document.createElement('div');
    finalOverlay.className = 'cqd-overlay-container';
    
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

  // 3. Apply RED FRAME
  if (!finalOverlay.classList.contains('cqd-both')) {
    finalOverlay.classList.add('cqd-both');
  }
  
  // Mark elements for permanent bold styling
  markTargetElements(post, 'both');

  // 4. Build tooltip text
  const commentTooltip = `${commentCount} ${t('comments')}`;
  const editTooltipText = rawEditTooltip || t('edited');
  
  // Combined hover text: "5 • +2d" (compact format)
  const compactText = diffText ? `${commentCount} • +${diffText}` : commentCount;
  const fullTooltip = `${commentTooltip} | ${editTooltipText}`;

  // 5. Create or Update Badge
  let bothBadge = post.querySelector<HTMLElement>('.cqd-both-badge');
  
  if (!bothBadge) {
    bothBadge = document.createElement('div');
    bothBadge.className = 'cqd-flag cqd-both-badge';
    bothBadge.setAttribute(INJECTED_ATTR, 'true');
    
    bothBadge.title = fullTooltip;
    bothBadge.setAttribute('aria-label', fullTooltip);

    // --- Comment Section (Icon + Number stacked vertically) ---
    const commentSection = document.createElement('div');
    commentSection.className = 'cqd-both-section';
    
    // Comment icon (same size as other pills - 18px)
    const commentIcon = document.createElement('div');
    commentIcon.className = 'cqd-both-icon cqd-both-icon-comment';
    commentIcon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
    commentIcon.style.backgroundSize = '18px 18px';
    commentIcon.style.backgroundRepeat = 'no-repeat';
    commentIcon.style.backgroundPosition = 'center';
    commentIcon.style.filter = 'brightness(0) invert(1)';
    
    // Comment count (hidden by default, appears on hover)
    const commentValue = document.createElement('span');
    commentValue.className = 'cqd-both-value';
    commentValue.textContent = commentCount;
    
    commentSection.appendChild(commentIcon);
    commentSection.appendChild(commentValue);
    
    // --- Plus Sign (between the two sections) ---
    const plusSign = document.createElement('span');
    plusSign.className = 'cqd-both-plus';
    plusSign.textContent = '+';
    
    // --- Edit Section (Icon + Number stacked vertically) ---
    const editSection = document.createElement('div');
    editSection.className = 'cqd-both-section';
    
    // Edit icon (same size as other pills - 18px)
    const editIcon = document.createElement('div');
    editIcon.className = 'cqd-both-icon cqd-both-icon-edited';
    appendSvgFromString(editIcon, EDIT_ICON_SVG_RAW);
    const svg = editIcon.querySelector('svg');
    if (svg) {
      svg.style.width = '18px';
      svg.style.height = '18px';
    }
    
    // Edit diff value (hidden by default, appears on hover) - shows only the number
    const editValue = document.createElement('span');
    editValue.className = 'cqd-both-value';
    editValue.textContent = diffText || '✓';
    
    editSection.appendChild(editIcon);
    editSection.appendChild(editValue);
    
    // Assemble: Comment + Plus + Edit
    bothBadge.appendChild(commentSection);
    bothBadge.appendChild(plusSign);
    bothBadge.appendChild(editSection);

    // Click Handler
    bothBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerPulseEffect(post, 'both');
      triggerPostClick(post);
    });

    post.appendChild(bothBadge);
  } else {
    // Update existing badge
    if (bothBadge.title !== fullTooltip) {
      bothBadge.title = fullTooltip;
      bothBadge.setAttribute('aria-label', fullTooltip);
      const textSpan = bothBadge.querySelector('.cqd-flag-text');
      if (textSpan) textSpan.textContent = compactText;
    }
  }
}