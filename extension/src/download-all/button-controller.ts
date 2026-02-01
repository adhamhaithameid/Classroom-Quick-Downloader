// filepath: extension/src/download-all/button-controller.ts
/**
 * Download All button creation and event handling.
 */

import type { GroupState } from './types';
import { groupStates, GROUP_SELECTOR, INJECTED_ATTR } from './state';
import { getPrimaryButton, markGroupDirty } from './group-manager';
import { getSingleButtonState } from './utils';
import { handleCancelAllClick, resetGroupVisuals } from './cancel-handler';
import { t } from '../../entrypoints/content/i18n';
import { isPageDark } from '../../entrypoints/content/theme';
import { CANCEL_ICON_SVG_URL } from '../../entrypoints/content/icons';

// Forward declaration for circular dependency
let scheduleRefreshFn: () => void;

export function setScheduleRefresh(fn: () => void): void {
  scheduleRefreshFn = fn;
}

/**
 * Find header container in group.
 */
export function findHeaderContainer(root: HTMLElement): HTMLElement | null {
  const n5dsp = root.querySelector<HTMLElement>('.N5dSp');
  if (n5dsp) return n5dsp;

  const internalHeader =
    root.querySelector<HTMLElement>('.JZicYb.gmNu1d') ||
    root.querySelector<HTMLElement>('.JZicYb');
  if (internalHeader) return internalHeader;

  let current: HTMLElement | null = root;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;

    const headers = Array.from(
      parent.querySelectorAll<HTMLElement>(
        '.N5dSp, .JZicYb.gmNu1d, .N5dSp, .JZicYb',
      ),
    );

    let best: HTMLElement | null = null;
    for (const h of headers) {
      const rel = h.compareDocumentPosition(current);
      const isBefore = !!(rel & Node.DOCUMENT_POSITION_FOLLOWING);
      const isDisconnected = !!(rel & Node.DOCUMENT_POSITION_DISCONNECTED);

      if (isDisconnected || !isBefore) continue;

      if (!best) {
        best = h;
      } else {
        const rel2 = best.compareDocumentPosition(h);
        const hAfterBest = !!(rel2 & Node.DOCUMENT_POSITION_FOLLOWING);
        if (hAfterBest) best = h;
      }
    }
    if (best) return best;
    current = parent;
  }
  return null;
}

/**
 * Find three-dots menu button.
 */
function findThreeDots(container: HTMLElement): HTMLElement | null {
  const chunkWrapper = container.querySelector<HTMLElement>('[data-guided-help-id="streamItemActionMenuGH"]');
  if (chunkWrapper) return chunkWrapper;

  const kp = container.querySelector<HTMLElement>('.kpDQ8');
  if (kp) return kp;

  const selectors = [
    '.pYTkkf-Bz112c-LgbsSe',
    'div[role="button"][aria-haspopup="true"]',
    'div[role="button"][aria-haspopup="menu"]',
    'button[aria-haspopup="menu"]'
  ];
  
  for (const sel of selectors) {
    const el = container.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Get direct child of parent that contains descendant.
 */
function getDirectChild(parent: HTMLElement, descendant: HTMLElement): HTMLElement | null {
  let curr: HTMLElement | null = descendant;
  while (curr && curr.parentElement !== parent) {
    curr = curr.parentElement;
    if (!curr || curr === document.body) return null;
  }
  return curr;
}

/**
 * Place button for post view.
 */
function placeDownloadButtonForPostView(
  button: HTMLButtonElement,
  headerContainer: HTMLElement,
): void {
  const searchRoot = headerContainer;
  const rawDots = findThreeDots(searchRoot);
  const threeDots = rawDots ? getDirectChild(searchRoot, rawDots) : null;

  if (threeDots && threeDots !== button) {
    const dotsParent = threeDots.parentElement as HTMLElement | null;
    if (dotsParent) {
      let rightWrapper = dotsParent.querySelector<HTMLElement>(
        '[data-cqd-right-wrapper="1"]',
      );
      const dotsComputed = window.getComputedStyle(threeDots);

      if (!rightWrapper || !rightWrapper.contains(threeDots)) {
        rightWrapper = document.createElement('span');
        rightWrapper.dataset.cqdRightWrapper = '1';
        rightWrapper.style.display = 'inline-flex';
        rightWrapper.style.alignItems = 'center';
        rightWrapper.style.gap = '8px';
        
        if (dotsComputed.marginLeft === 'auto') {
          threeDots.style.marginLeft = '0';
          rightWrapper.style.marginLeft = 'auto';
        }
        
        dotsParent.insertBefore(rightWrapper, threeDots);
        rightWrapper.appendChild(threeDots);
      }
      
      rightWrapper.insertBefore(button, rightWrapper.firstChild);
      button.style.marginInlineEnd = '4px';
      return;
    }
  }

  searchRoot.appendChild(button);
  button.style.marginInlineStart = '8px';
}

/**
 * Place button for stream view.
 */
function placeDownloadButtonForStreamView(
  button: HTMLButtonElement,
  targetContainer: HTMLElement,
): void {
  const rawDots = findThreeDots(targetContainer);
  const threeDots = rawDots ? getDirectChild(targetContainer, rawDots) : null;

  if (threeDots && threeDots !== button) {
    targetContainer.insertBefore(button, threeDots);
    button.style.marginInlineEnd = '8px';
    button.style.marginInlineStart = '8px';
  } else {
    targetContainer.appendChild(button);
    button.style.marginInlineStart = '8px';
  }
}

/**
 * Create or get the Download All button for a group.
 */
export function ensureDownloadAllButton(group: GroupState): HTMLButtonElement {
  const existing = group.downloadAllBtn;
  if (existing && existing.isConnected) return existing;

  const root = group.root;
  const headerContainer = findHeaderContainer(root);
  const isStreamView = root.matches(GROUP_SELECTOR);
  const isPostHeader = !!headerContainer && headerContainer.classList.contains('N5dSp');
  const targetContainer = headerContainer || root;
  const isInHeader = !!headerContainer;

  targetContainer.style.setProperty('flex-wrap', 'wrap', 'important');
  targetContainer.style.setProperty('align-items', 'center', 'important');
  if (targetContainer.classList.contains('N5dSp')) {
    targetContainer.style.display = 'flex';
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-all-btn';
  
  if (isInHeader) {
    button.classList.add('cqd-in-header');
  }
  button.setAttribute(INJECTED_ATTR, 'true');
  if (isPageDark()) {
    button.classList.add('cqd-theme-dark');
  }
  button.setAttribute(
    'aria-label',
    t('downloadAll') || 'Download all attachments in this post',
  );
  button.title = t('downloadAll') || 'Download all';

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper cqd-download-all-icon-wrapper';
  const icon = document.createElement('span');
  icon.className = 'cqd-download-all-icon';
  iconWrapper.appendChild(icon);

  const mainSpan = document.createElement('span');
  mainSpan.className = 'cqd-download-all-main';
  const subSpan = document.createElement('span');
  subSpan.className = 'cqd-download-all-sub';

  button.appendChild(iconWrapper);
  button.appendChild(mainSpan);
  button.appendChild(subSpan);

  // Sync observer for class changes
  const syncObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'class') {
        const oldClasses = m.oldValue || '';
        const wasCancelled = oldClasses.includes('cqd-all-cancelled');
        const wasSuccess = oldClasses.includes('cqd-all-success');
        const wasError = oldClasses.includes('cqd-all-error');
        
        const isCancelled = button.classList.contains('cqd-all-cancelled');
        const isSuccess = button.classList.contains('cqd-all-success');
        const isError = button.classList.contains('cqd-all-error');
        
        if ((wasCancelled || wasSuccess || wasError) && !isCancelled && !isSuccess && !isError) {
          resetGroupVisuals(group);
        }
      }
    }
  });
  syncObserver.observe(button, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  const computed = window.getComputedStyle(targetContainer);
  if (computed.position === 'static') {
    targetContainer.style.position = 'relative';
  }

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (group.isBusy && group.activated && !group.cancelPending) {
      handleCancelAllClick(group);
    } else if (!group.activated || !group.isBusy) {
      handleDownloadAllClick(group);
    }
  });

  let hoverTimeout: number | undefined;

  button.addEventListener('mouseenter', () => {
    if (group.isBusy && group.activated && !group.cancelPending) {
      button.classList.add('cqd-all-cancel');
      const mainSpan = button.querySelector<HTMLElement>('.cqd-download-all-main');
      const subSpan = button.querySelector<HTMLElement>('.cqd-download-all-sub');
      const iconEl = button.querySelector<HTMLElement>('.cqd-download-all-icon');
      if (mainSpan) mainSpan.textContent = t('cancelAll') || 'Cancel All';
      if (subSpan) subSpan.textContent = '';
      if (iconEl) {
        iconEl.style.transition = 'all 0.2s ease-out';
        iconEl.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
        iconEl.style.backgroundSize = '18px 18px';
      }
    }
  });

  button.addEventListener('mouseleave', () => {
    if (hoverTimeout) {
      window.clearTimeout(hoverTimeout);
      hoverTimeout = undefined;
    }
    if (button.classList.contains('cqd-all-cancel') && !group.cancelPending) {
      button.classList.remove('cqd-all-cancel');
      const iconEl = button.querySelector<HTMLElement>('.cqd-download-all-icon');
      if (iconEl) {
        iconEl.style.backgroundImage = '';
        iconEl.style.backgroundSize = '';
      }
      markGroupDirty(group);
      if (scheduleRefreshFn) scheduleRefreshFn();
    }
  });

  if (isPostHeader && headerContainer) {
    placeDownloadButtonForPostView(button, headerContainer);
  } else if (isStreamView) {
    placeDownloadButtonForStreamView(button, headerContainer || root);
  } else {
    targetContainer.appendChild(button);
    button.style.marginInlineStart = '8px';
  }

  group.downloadAllBtn = button;
  return button;
}

/**
 * Handle Download All click.
 */
export function handleDownloadAllClick(group: GroupState): void {
  if (group.isBusy || group.activated) return;

  group.activated = true;
  group.isBusy = true;
  group.currentRunId = Date.now();
  try {
    group.root.dataset.cqdGroupActive = '1';
  } catch {
    /* ignore */
  }

  for (const file of group.files.values()) {
    file.downloaded = false;
    file.failed = false;
    file.inProgress = false;
  }

  if (group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
    group.resetTimeoutId = undefined;
  }

  for (const file of group.files.values()) {
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    const s = getSingleButtonState(primary);
    if (s === 'idle' || s === 'error' || s === 'cancelled') {
      primary.click();
    }
  }

  markGroupDirty(group);
  if (scheduleRefreshFn) scheduleRefreshFn();
}
