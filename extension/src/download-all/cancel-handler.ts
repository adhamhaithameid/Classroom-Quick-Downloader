// filepath: extension/src/download-all/cancel-handler.ts
/**
 * Download All cancellation logic.
 */

import type { GroupState } from './types';
import { GROUP_FEEDBACK_SUCCESS_MS, dirtyGroups } from './state';
import { getPrimaryButton, markGroupDirty } from './group-manager';
import { t } from '../../entrypoints/content/i18n';
import { CANCEL_ICON_SVG_URL, DOWNLOAD_ICON_SVG_URL } from '../../entrypoints/content/icons';

// Forward declaration for circular dependency
let scheduleRefreshFn: () => void;

export function setScheduleRefresh(fn: () => void): void {
  scheduleRefreshFn = fn;
}

/**
 * Schedule a group reset after completion.
 */
export function scheduleGroupReset(group: GroupState): void {
  if (group.resetTimeoutId != null) return;
  group.resetTimeoutId = window.setTimeout(() => {
    group.resetTimeoutId = undefined;
    group.activated = false;
    group.isBusy = false;
    group.cancelPending = false;
    group.currentRunId = undefined;
    try {
      delete group.root.dataset.cqdGroupActive;
    } catch {
      /* ignore */
    }
    for (const file of group.files.values()) {
      file.downloaded = false;
      file.failed = false;
      file.inProgress = false;
    }
    resetGroupVisuals(group);
    
    markGroupDirty(group);
    if (scheduleRefreshFn) scheduleRefreshFn();
  }, GROUP_FEEDBACK_SUCCESS_MS);
}

/**
 * Reset visual state of all buttons in group.
 */
export function resetGroupVisuals(group: GroupState): void {
  for (const file of group.files.values()) {
    for (const btn of file.buttons) {
      if (!btn.isConnected) continue;
      
      btn.classList.remove('cqd-loading', 'cqd-trying', 'cqd-success', 'cqd-error', 'cqd-cancel', 'cqd-cancelled');
      btn.disabled = false;
      
      const label = btn.querySelector<HTMLSpanElement>('.cqd-label');
      if (label) label.textContent = t('download') || 'Download';
      
      const icon = btn.querySelector<HTMLElement>('.cqd-download-icon');
      if (icon) {
        icon.classList.remove('cqd-spinner', 'cqd-spin');
        icon.className = 'cqd-download-icon';
        icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
        icon.style.backgroundSize = '';
      }
      
      const errorDetail = btn.querySelector<HTMLElement>('.cqd-error-detail');
      if (errorDetail) errorDetail.textContent = '';
    }
  }
}

/**
 * Handle Cancel All click.
 */
export function handleCancelAllClick(group: GroupState): void {
  if (!group.activated || !group.isBusy) return;
  if (group.cancelPending) return;

  group.cancelPending = true;

  const btn = group.downloadAllBtn;
  if (btn) {
    btn.classList.remove('cqd-all-cancel');
    btn.classList.add('cqd-all-cancelled');
    const mainSpan = btn.querySelector<HTMLElement>('.cqd-download-all-main');
    const subSpan = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (mainSpan) mainSpan.textContent = t('cancelled') || 'Cancelled';
    if (subSpan) subSpan.textContent = '';
    if (iconEl) {
      iconEl.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      iconEl.style.backgroundSize = '18px 18px';
    }
  }

  // Cancel all in-progress files
  for (const file of group.files.values()) {
    if (!file.inProgress) continue;
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    file.inProgress = false;
    file.failed = true;

    const requestId = (primary.dataset as any).cqdRequestId;
    if (requestId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'CQD_CANCEL_DOWNLOAD', requestId });
      } catch {
        // ignore
      }
    }
    
    primary.classList.remove('cqd-loading', 'cqd-trying', 'cqd-cancel', 'cqd-cancelled', 'cqd-success', 'cqd-error');
    primary.classList.add('cqd-cancelled');
    
    const label = primary.querySelector<HTMLSpanElement>('.cqd-label');
    const icon = primary.querySelector<HTMLElement>('.cqd-download-icon');
    if (label) {
      label.textContent = t('cancelled') || 'Cancelled';
    }
    if (icon) {
      icon.classList.remove('cqd-spinner', 'cqd-spin');
      icon.className = 'cqd-download-icon';
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
    }
  }

  markGroupDirty(group);
  if (scheduleRefreshFn) scheduleRefreshFn();

  // Reset group after delay
  if (group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
  }
  group.resetTimeoutId = window.setTimeout(() => {
    group.resetTimeoutId = undefined;
    group.activated = false;
    group.isBusy = false;
    group.cancelPending = false;
    group.currentRunId = undefined;
    try {
      delete group.root.dataset.cqdGroupActive;
    } catch {
      /* ignore */
    }
    for (const file of group.files.values()) {
      file.downloaded = false;
      file.failed = false;
      file.inProgress = false;
    }
    if (btn) {
      btn.classList.remove('cqd-all-cancelled');
    }
    markGroupDirty(group);
    if (scheduleRefreshFn) scheduleRefreshFn();
  }, 1500);
}
