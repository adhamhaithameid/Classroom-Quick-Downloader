// filepath: extension/src/download-all/index.ts
/**
 * Download All module entry point.
 * Provides the main feature start/stop functions.
 */

import {
  running,
  setRunning,
  globalObserver,
  setGlobalObserver,
  globalInterval,
  setGlobalInterval,
  dirtyGroups,
  setCancelHoldDelayMs,
  DOWNLOAD_BTN_SELECTOR,
  SINGLE_BTN_SELECTOR,
} from './state';
import { registerButtonsInSubtree, ensureButtonRegistered, cleanupRemovedButtons, markGroupDirty } from './group-manager';
import { scheduleRefresh } from './refresh';
import { safeSetDirection } from './utils';
import { setScheduleRefresh as setScheduleRefreshCancel } from './cancel-handler';
import { setScheduleRefresh as setScheduleRefreshButton } from './button-controller';
import { injectStyles } from '../../entrypoints/content/styles';
import { getCancelHoldDelayMs } from '../shared/analytics';

// Wire up circular dependency
setScheduleRefreshCancel(scheduleRefresh);
setScheduleRefreshButton(scheduleRefresh);

// Initialize cancel hold delay
getCancelHoldDelayMs().then((ms) => {
  setCancelHoldDelayMs(ms);
}).catch(() => { /* ignore */ });

// Clean up handler reference
const scrollHandler = () => scheduleRefresh();

/**
 * Start the Download All feature.
 */
export function startDownloadAllFeature(): void {
  if (running) return;
  setRunning(true);

  injectStyles();
  safeSetDirection();

  registerButtonsInSubtree(document);

  window.addEventListener('scroll', scrollHandler, { passive: true });

  const observer = new MutationObserver((mutations) => {
    if (!running) return;
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          registerButtonsInSubtree(node);
        });
        m.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          cleanupRemovedButtons(node);
        });
      } else if (m.type === 'attributes') {
        const target = m.target as HTMLElement;
        if (
          target instanceof HTMLButtonElement &&
          target.classList.contains('cqd-download-btn')
        ) {
          const group = ensureButtonRegistered(target);
          if (group) markGroupDirty(group);
        }
      }
    }
    scheduleRefresh();
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-cqd-all-done'],
    });
  }
  setGlobalObserver(observer);

  const interval = window.setInterval(() => {
    if (!running) return;
    registerButtonsInSubtree(document);
    scheduleRefresh();
  }, 4000);
  setGlobalInterval(interval);
}

/**
 * Stop the Download All feature.
 */
export function stopDownloadAllFeature(): void {
  if (!running) return;
  setRunning(false);

  window.removeEventListener('scroll', scrollHandler);

  if (globalObserver) {
    globalObserver.disconnect();
    setGlobalObserver(null);
  }

  if (globalInterval != null) {
    window.clearInterval(globalInterval);
    setGlobalInterval(null);
  }

  // Cleanup UI
  document.querySelectorAll(DOWNLOAD_BTN_SELECTOR).forEach(btn => btn.remove());
  dirtyGroups.clear();
}

// Re-export types
export type { ButtonState, FileEntry, GroupState } from './types';
