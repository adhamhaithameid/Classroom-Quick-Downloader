// filepath: entrypoints/content/flags.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

export const ENABLE_KEY = 'extensionEnabled';

type StateCallback = () => void;

/**
 * Subscribes to the global extension enabled state.
 * - Checks initial state and calls onEnabled() or onDisabled().
 * - Listens for changes and calls the appropriate callback.
 * - Returns a cleanup function to remove the listener.
 */
export function subscribeToGlobalState(
  onEnabled: StateCallback,
  onDisabled?: StateCallback
): () => void {
  // If no chrome API, assume enabled (dev/test env)
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

  // 1. Initial Check
  chrome.storage.local.get(ENABLE_KEY, (result: { [key: string]: any }) => {
    // If error, fail-open (true)
    const isEnabled = chrome.runtime.lastError ? true : (result[ENABLE_KEY] !== false);
    handleState(isEnabled);
  });

  // 2. Change Listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Legacy one-shot check, updated to use new key.
 * Prefer subscribeToGlobalState for dynamic toggling.
 */
export function whenExtensionEnabled(
  onEnabled: StateCallback,
  onDisabled?: StateCallback,
): void {
  subscribeToGlobalState(onEnabled, onDisabled);
}

// ============================================================================
// BADGE FACTORY FUNCTIONS (Hover Intelligence)
// ============================================================================

import { COMMENT_ICON_URL, EDIT_ICON_SVG_RAW, appendSvgFromString } from './icons';
import { t } from './i18n';
import { triggerPulseEffect, markTargetElements } from './pulse-effect';
import { triggerPostClick } from './both-badge';

const INJECTED_ATTR = 'data-cqd-injected';

/**
 * Creates the expanding Comment Badge
 * Structure: [Icon] [Span: "5 Comments"]
 */
export function createCommentBadge(post: HTMLElement, count: number): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-comment-badge cqd-flag'; // Base class + specific
  badge.setAttribute(INJECTED_ATTR, 'true');
  
  // Theme check
  if (document.body.classList.contains('cqd-theme-dark') || post.classList.contains('cqd-theme-dark')) {
    badge.classList.add('cqd-theme-dark');
  }

  // 1. Icon Container
  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-flag-icon';
  iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
  // Invert color for dark mode/white text logic is handled by CSS filter
  
  // 2. Text Span (Hidden by default, expands on hover)
  // Text: Just the count number
  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-flag-text';
  labelDiv.textContent = String(count);

  badge.appendChild(iconDiv);
  badge.appendChild(labelDiv);

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
 * Creates the expanding Edited Badge
 * Structure: [Icon] [Span: "Edited (+2d)"]
 */
export function createEditedBadge(post: HTMLElement, diffString: string | null): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-edited-badge cqd-flag';
  badge.setAttribute(INJECTED_ATTR, 'true');

  if (document.body.classList.contains('cqd-theme-dark') || post.classList.contains('cqd-theme-dark')) {
    badge.classList.add('cqd-theme-dark');
  }

  // 1. Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'cqd-flag-icon cqd-edited-icon';
  appendSvgFromString(iconDiv, EDIT_ICON_SVG_RAW);

  // 2. Text Span (shows diff if available, or empty)
  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-flag-text';
  
  // Show diff time if available, otherwise show nothing (icon only)
  if (diffString) {
    labelDiv.textContent = `+${diffString}`;
  }

  badge.appendChild(iconDiv);
  badge.appendChild(labelDiv);

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