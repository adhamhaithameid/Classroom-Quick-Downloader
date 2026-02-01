// filepath: extension/entrypoints/content/observers.ts
/**
 * DOM observers and scanning logic for button injection.
 */

import type { QueryRoot } from './types';
import {
  scanTimeoutId,
  setScanTimeoutId,
  observer,
  setObserver,
  rescanIntervalId,
  setRescanIntervalId,
  effectiveEnabled,
  setEffectiveEnabled,
  initialized,
  setInitialized,
  RESCAN_DEBOUNCE_MS,
  RESCAN_INTERVAL_MS,
  CLASSROOM_URL_PATTERN,
  DRIVE_ANCHOR_SELECTOR,
  ATTACHMENT_CONTAINER_SELECTOR,
  INJECTED_ATTR,
  PROCESSED_ATTR,
} from './state';
import { extractDriveUrlFromAnchor, findDriveUrl } from './url-utils';
import { injectButtonIntoAttachment } from './button-factory';
import { injectStyles } from './styles';

/**
 * Check if current page is Google Classroom.
 */
export function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

/**
 * Check if container has an injected button.
 */
export function hasInjectedButton(container: HTMLElement): boolean {
  return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
}

/**
 * Schedule a scan for attachments.
 */
export function scheduleScan(): void {
  if (scanTimeoutId !== null) {
    window.clearTimeout(scanTimeoutId);
  }
  setScanTimeoutId(window.setTimeout(() => {
    setScanTimeoutId(null);
    scanForAttachments(document);
  }, RESCAN_DEBOUNCE_MS));
}

/**
 * Inject buttons for single file attachments.
 */
export function injectSingleFileButtons(root: QueryRoot = document): void {
  const anchors = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR)
  );

  for (const anchor of anchors) {
    const url = extractDriveUrlFromAnchor(anchor);
    if (!url) continue;

    const container =
      (anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) as HTMLElement | null) ||
      anchor.parentElement ||
      anchor;

    if (!container) continue;

    if (container.hasAttribute(PROCESSED_ATTR)) {
      if (!hasInjectedButton(container)) {
        container.removeAttribute(PROCESSED_ATTR);
      } else {
        continue;
      }
    }

    injectButtonIntoAttachment(container, url);
  }

  // Handle data-drive-id elements
  const metaElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]'
    )
  );

  for (const el of metaElements) {
    if (el.hasAttribute(PROCESSED_ATTR)) {
      if (!hasInjectedButton(el)) {
        el.removeAttribute(PROCESSED_ATTR);
      } else {
        continue;
      }
    }

    const url = findDriveUrl(el);
    if (!url) continue;

    injectButtonIntoAttachment(el, url);
  }
}

/**
 * Scan for attachments and inject buttons.
 */
export function scanForAttachments(root: QueryRoot = document): void {
  if (!isGoogleClassroom()) return;
  if (!effectiveEnabled) return;
  injectSingleFileButtons(root);
}

/**
 * Set up mutation observer and scroll listener.
 */
export function setupObservers(): void {
  if (typeof document === 'undefined') return;
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', () => setupObservers(), { once: true });
    return;
  }

  window.addEventListener('scroll', scheduleScan, { passive: true });

  if (observer) return;

  const obs = new MutationObserver((mutations) => {
    const roots = new Set<QueryRoot>();
    let shouldScan = false;

    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof HTMLElement) {
        if (m.target.hasAttribute(PROCESSED_ATTR) && !hasInjectedButton(m.target)) {
          roots.add(m.target);
          shouldScan = true;
        }
        continue;
      }

      if (m.type !== 'childList') continue;

      const isInternal = Array.from(m.addedNodes).some(
        (n) => n.nodeType === Node.ELEMENT_NODE &&
          (n as Element).hasAttribute(INJECTED_ATTR)
      );
      if (isInternal) continue;

      shouldScan = true;
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          roots.add(node as HTMLElement);
        }
      });
      if (m.target instanceof HTMLElement) {
        roots.add(m.target);
      }
    }

    if (shouldScan) {
      if (roots.size === 0) {
        scheduleScan();
      } else {
        roots.forEach((root) => scanForAttachments(root));
        scheduleScan();
      }
    }
  });

  obs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-cqd-processed'],
  });

  setObserver(obs);

  if (rescanIntervalId == null) {
    setRescanIntervalId(window.setInterval(() => scheduleScan(), RESCAN_INTERVAL_MS));
  }

  scheduleScan();
}

/**
 * Apply effective state and notify background.
 */
export function applyEffectiveState(enabled: boolean): void {
  setEffectiveEnabled(enabled);
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({
        type: 'CQD_EFFECTIVE_STATE_CHANGED',
        enabled,
      });
    } catch { /* ignore */ }
  }
}

/**
 * Start CQD for this tab.
 */
export function startCQD(): void {
  if (initialized) return;
  if (!isGoogleClassroom()) return;
  setInitialized(true);
  injectStyles();
  setupObservers();
  applyEffectiveState(true);
}

/**
 * Stop CQD for this tab.
 */
export function stopCQD(): void {
  if (!initialized) return;
  setInitialized(false);

  if (observer) {
    observer.disconnect();
    setObserver(null);
  }

  if (scanTimeoutId !== null) {
    window.clearTimeout(scanTimeoutId);
    setScanTimeoutId(null);
  }

  if (rescanIntervalId !== null) {
    window.clearInterval(rescanIntervalId);
    setRescanIntervalId(null);
  }

  window.removeEventListener('scroll', scheduleScan);

  try {
    const injectedButtons = document.querySelectorAll<HTMLElement>('.cqd-download-btn');
    injectedButtons.forEach((btn) => btn.remove());
  } catch { /* ignore */ }

  applyEffectiveState(false);
}
