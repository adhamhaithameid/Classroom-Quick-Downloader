// filepath: entrypoints/content/flags.ts
/**
 * FLAGS - Universal V4 "Hover Intelligence" Smart Pills
 * 
 * Structure: Container > [Icon] + [Text Span (hidden by default)]
 * Animation: Text expands vertically on hover with smooth transition
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

export const ENABLE_KEY = 'extensionEnabled';

type StateCallback = () => void;

/**
 * Subscribes to the global extension enabled state.
 */
export function subscribeToGlobalState(
  onEnabled: StateCallback,
  onDisabled?: StateCallback
): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    try { onEnabled(); } catch {}
    return () => {};
  }

  const handleState = (isEnabled: boolean) => {
    try {
      if (isEnabled) {
        onEnabled();
      } else {
        onDisabled?.();
      }
    } catch (e) {
      console.warn('[CQD] Error in state callback', e);
    }
  };

  chrome.storage.local.get(ENABLE_KEY, (result: { [key: string]: any }) => {
    const isEnabled = chrome.runtime.lastError ? true : (result[ENABLE_KEY] !== false);
    handleState(isEnabled);
  });

  const listener = (changes: any, area: string) => {
    if (area === 'local' && changes[ENABLE_KEY]) {
      const newValue = changes[ENABLE_KEY].newValue !== false;
      handleState(newValue);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Legacy one-shot check.
 */
export function whenExtensionEnabled(
  onEnabled: StateCallback,
  onDisabled?: StateCallback,
): void {
  subscribeToGlobalState(onEnabled, onDisabled);
}

// ============================================================================
// SMART PILL BADGE FACTORY (Hover Intelligence)
// ============================================================================

import { COMMENT_ICON_URL, EDIT_ICON_SVG_RAW, appendSvgFromString } from './icons';
import { t } from './i18n';
import { triggerPulseEffect, markTargetElements } from './pulse-effect';
import { triggerPostClick } from './both-badge';

const INJECTED_ATTR = 'data-cqd-injected';

/**
 * Creates the Comment Badge with Smart Pill structure
 * 
 * Structure:
 * <div class="cqd-flag cqd-comment-badge">
 *   <div class="cqd-flag-icon" style="background-image: ..."></div>
 *   <span class="cqd-flag-text">{count}</span>
 * </div>
 */
export function createCommentBadge(post: HTMLElement, count: number): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-comment-badge cqd-flag';
  badge.setAttribute(INJECTED_ATTR, 'true');
  
  // Dark mode check
  if (document.body.classList.contains('cqd-theme-dark') || post.classList.contains('cqd-theme-dark')) {
    badge.classList.add('cqd-theme-dark');
  }

  // 1. Icon Container
  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-flag-icon';
  iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
  iconDiv.style.backgroundSize = '18px 18px';
  iconDiv.style.backgroundRepeat = 'no-repeat';
  iconDiv.style.backgroundPosition = 'center';
  iconDiv.style.filter = 'brightness(0) invert(1)'; // White icon
  
  // 2. Text Span (Shows count only, expands on hover)
  const labelSpan = document.createElement('span');
  labelSpan.className = 'cqd-flag-text';
  labelSpan.textContent = String(count);

  badge.appendChild(iconDiv);
  badge.appendChild(labelSpan);

  // Tooltip (Full text for accessibility)
  const tooltipText = `${count} ${t('comments')}`;
  badge.title = tooltipText;
  badge.setAttribute('aria-label', tooltipText);

  // Interaction
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerPulseEffect(post, 'comment');
    triggerPostClick(post);
  });

  return badge;
}

/**
 * Creates the Edited Badge with Smart Pill structure
 * 
 * Structure:
 * <div class="cqd-flag cqd-edited-badge">
 *   <div class="cqd-flag-icon cqd-edited-icon">[SVG]</div>
 *   <span class="cqd-flag-text">+{diffString}</span>
 * </div>
 */
export function createEditedBadge(post: HTMLElement, diffString: string | null): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-edited-badge cqd-flag';
  badge.setAttribute(INJECTED_ATTR, 'true');

  if (document.body.classList.contains('cqd-theme-dark') || post.classList.contains('cqd-theme-dark')) {
    badge.classList.add('cqd-theme-dark');
  }

  // 1. Icon Container with SVG
  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-flag-icon cqd-edited-icon';
  appendSvgFromString(iconDiv, EDIT_ICON_SVG_RAW);

  // 2. Text Span (Shows ONLY the diff time, no words)
  const labelSpan = document.createElement('span');
  labelSpan.className = 'cqd-flag-text';
  
  // Show only the diff time (e.g. "+2d") - NO WORDS
  if (diffString) {
    labelSpan.textContent = `+${diffString}`;
  } else {
    labelSpan.textContent = '✓'; // Checkmark if no diff available
  }

  badge.appendChild(iconDiv);
  badge.appendChild(labelSpan);

  // Tooltip (Full text)
  let tooltipText = t('edited');
  if (diffString) {
    tooltipText = `${t('edited')} (+${diffString})`;
  }
  badge.title = tooltipText;
  badge.setAttribute('aria-label', tooltipText);

  // Interaction
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerPulseEffect(post, 'edited');
    triggerPostClick(post);
  });

  return badge;
}