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
  // Text: "{count} Comments"
  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-flag-text';
  // If count is 1, use singular? User said "{count} Comments" broadly, but let's be nice.
  // Actually user requirement: '"{count} Comments"'
  const text = `${count} ${t('comments')}`;
  labelDiv.textContent = text;

  badge.appendChild(iconDiv);
  badge.appendChild(labelDiv);

  // Tooltip (Native fallback)
  badge.title = text;
  badge.setAttribute('aria-label', text);

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

  // 2. Text Span
  // Text: "Edited (+{diffString})" OR "Edited"
  const labelDiv = document.createElement('span');
  labelDiv.className = 'cqd-flag-text';
  
  let text = t('edited');
  if (diffString) {
    text = `${t('edited')} (+${diffString})`;
  }
  labelDiv.textContent = text;

  badge.appendChild(iconDiv);
  badge.appendChild(labelDiv);

  // Tooltip
  // If we have a stored rich tooltip in data attribute, usage might be better, 
  // but factories usually are stateless. We'll use the generated text for now, 
  // or rely on the caller to set title if needed.
  badge.title = text;
  badge.setAttribute('aria-label', text);

  // Interaction
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerPulseEffect(post, 'edited');
    triggerPostClick(post);
  });

  return badge;
}