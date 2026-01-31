// filepath: entrypoints/download_all.content.ts
import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';
import { CANCEL_ICON_SVG_URL } from './content/icons';


const DOWNLOAD_BTN_SELECTOR = '.cqd-download-all-btn';
const SINGLE_BTN_SELECTOR = '.cqd-download-btn';
const GROUP_SELECTOR = 'div[data-stream-item-id]';
const INJECTED_ATTR = 'data-cqd-injected';
const GROUP_FEEDBACK_SUCCESS_MS = 3000;
const MIN_FILES_FOR_DOWNLOAD_ALL = 2;

type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error' | 'cancel' | 'cancelled';

interface FileEntry {
  key: string;
  buttons: Set<HTMLButtonElement>;
  downloaded: boolean;
  failed: boolean;
  inProgress: boolean;
}

interface GroupState {
  root: HTMLElement;
  files: Map<string, FileEntry>;
  downloadAllBtn: HTMLButtonElement | null;
  activated: boolean;
  isBusy: boolean;
  cancelPending: boolean; // True when cancel has been requested
  resetTimeoutId?: number;
  currentRunId?: number;
}

const groupStates = new WeakMap<HTMLElement, GroupState>();
const buttonToGroup = new WeakMap<HTMLButtonElement, GroupState>();
const buttonToFile = new WeakMap<HTMLButtonElement, FileEntry>();
const dirtyGroups = new Set<GroupState>();
let refreshScheduled = false;

import { subscribeToGlobalState } from './content/flags';
import { getCancelHoldDelayMs } from './utils/analytics';

// Cached cancel hold delay
let cancelHoldDelayMs = 1000;
getCancelHoldDelayMs().then((ms) => {
  cancelHoldDelayMs = ms;
}).catch(() => { /* ignore */ });



// Per-tab runtime state
let running = false;
let globalObserver: MutationObserver | null = null;
let globalInterval: number | null = null;

// Clean up handler reference for removal
const scrollHandler = () => scheduleRefresh();

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    subscribeToGlobalState(
      () => startDownloadAllFeature(),
      () => stopDownloadAllFeature()
    );
  },
});

function startDownloadAllFeature() {
  if (running) return;
  running = true;

  injectStyles();
  safeSetDirection();

  registerButtonsInSubtree(document);

  window.addEventListener('scroll', scrollHandler, { passive: true });

  globalObserver = new MutationObserver((mutations) => {
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
    globalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-cqd-all-done'],
    });
  }

  globalInterval = window.setInterval(() => {
    if (!running) return;
    registerButtonsInSubtree(document);
    scheduleRefresh();
  }, 4000);
}

function stopDownloadAllFeature() {
  if (!running) return;
  running = false;

  window.removeEventListener('scroll', scrollHandler);

  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  if (globalInterval != null) {
    window.clearInterval(globalInterval);
    globalInterval = null;
  }
  
  refreshScheduled = false;

  // Cleanup UI
  document.querySelectorAll(DOWNLOAD_BTN_SELECTOR).forEach(btn => btn.remove());
  
  // Clear weak maps / state would be nice but difficult with WeakMap.
  // Instead we just remove our buttons.
  // The WeakMaps will naturally clean up if DOM nodes are removed, or stick around if not.
  // We should clear dirtyGroups at least.
  dirtyGroups.clear();
}

/* -----------------------------------------------------
 * Discovery & grouping
 * ---------------------------------------------------*/
function registerButtonsInSubtree(root: HTMLElement | Document): void {
  if (
    root instanceof HTMLButtonElement &&
    root.classList.contains('cqd-download-btn')
  ) {
    registerSingleButton(root);
  }
  const buttons = root.querySelectorAll<HTMLButtonElement>(SINGLE_BTN_SELECTOR);
  buttons.forEach((btn) => registerSingleButton(btn));
}

function registerSingleButton(btn: HTMLButtonElement): void {
  if (!btn.isConnected) return;
  if (buttonToGroup.has(btn) && buttonToFile.has(btn)) return;

  const groupRoot = findGroupRoot(btn);
  if (!groupRoot) return;

  let group = groupStates.get(groupRoot);
  if (!group) {
    group = {
      root: groupRoot,
      files: new Map<string, FileEntry>(),
      downloadAllBtn: null,
      activated: false,
      isBusy: false,
      cancelPending: false,
    };
    groupStates.set(groupRoot, group);
  }

  const key = getCanonicalFileKey(btn);
  let file = group.files.get(key);
  if (!file) {
    file = {
      key,
      buttons: new Set<HTMLButtonElement>(),
      downloaded: false,
      failed: false,
      inProgress: false,
    };
    group.files.set(key, file);
  }

  file.buttons.add(btn);
  buttonToGroup.set(btn, group);
  buttonToFile.set(btn, file);
  markGroupDirty(group);
}

function ensureButtonRegistered(btn: HTMLButtonElement): GroupState | null {
  let group: GroupState | undefined | null = buttonToGroup.get(btn);
  if (!group) {
    registerSingleButton(btn);
    group = buttonToGroup.get(btn);
  }
  return group ?? null;
}

function cleanupRemovedButtons(root: HTMLElement): void {
  const removedButtons = root.matches(SINGLE_BTN_SELECTOR)
    ? [root as HTMLButtonElement]
    : Array.from(root.querySelectorAll<HTMLButtonElement>(SINGLE_BTN_SELECTOR));

  removedButtons.forEach((btn) => {
    const group = buttonToGroup.get(btn);
    const file = buttonToFile.get(btn);

    if (!group || !file) return;

    file.buttons.delete(btn);
    buttonToGroup.delete(btn);
    buttonToFile.delete(btn);

    if (file.buttons.size === 0) {
      group.files.delete(file.key);
    }
    markGroupDirty(group);
  });
}

function findGroupRoot(btn: HTMLElement): HTMLElement | null {
  const post = btn.closest<HTMLElement>(GROUP_SELECTOR);
  if (post) return post;

  let node: HTMLElement | null = btn.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.querySelector('.N5dSp')) {
      return node;
    }
    node = node.parentElement;
  }

  const main =
    btn.closest<HTMLElement>('main') ||
    btn.closest<HTMLElement>('div[role="main"]');
  if (main) return main;

  return null;
}

function getCanonicalFileKey(btn: HTMLButtonElement): string {
  const ds = btn.dataset as any;
  const url = ds.cqdUrl || '';
  if (url) {
    const idMatch =
      url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&](?:id|resourceId|fileId)=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `drive-id-${idMatch[1]}`;
    }
    try {
      const u = new URL(url);
      u.searchParams.delete('authuser');
      u.searchParams.delete('u');
      u.searchParams.delete('hl');
      return u.toString();
    } catch {
      return url;
    }
  }
  if (ds.cqdName) {
    return `${ds.cqdName}::${ds.cqdExt || ''}`;
  }
  return `btn-${Math.random().toString(36).slice(2)}`;
}

function getPrimaryButton(file: FileEntry): HTMLButtonElement | null {
  if (file.buttons.size === 0) return null;
  let primaryVisible: HTMLButtonElement | null = null;
  let fallback: HTMLButtonElement | null = null;

  for (const btn of file.buttons) {
    if (!btn.isConnected) continue;
    if (!fallback) fallback = btn;
    if (!btn.offsetParent) continue;

    if (!primaryVisible) {
      primaryVisible = btn;
      continue;
    }
    const pos = primaryVisible.compareDocumentPosition(btn);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
      primaryVisible = btn;
    }
  }
  return primaryVisible || fallback;
}

function normalizeFileButtons(file: FileEntry): void {
  if (file.buttons.size <= 1) return;
  const primary = getPrimaryButton(file);
  if (!primary) return;

  for (const btn of file.buttons) {
    if (!btn.isConnected) continue;
    if (btn === primary) {
      btn.style.removeProperty('display');
      btn.style.removeProperty('visibility');
      btn.style.removeProperty('pointer-events');
    } else {
      btn.style.setProperty('display', 'none', 'important');
      btn.style.setProperty('pointer-events', 'none', 'important');
    }
  }
}

function markGroupDirty(group: GroupState): void {
  dirtyGroups.add(group);
}

function scheduleRefresh(): void {
  if (refreshScheduled) return;
  refreshScheduled = true;
  requestAnimationFrame(() => {
    refreshScheduled = false;
    dirtyGroups.forEach(updateGroupState);
    dirtyGroups.clear();
  });
}

function updateGroupState(group: GroupState): void {
  if (group.downloadAllBtn && !group.downloadAllBtn.isConnected) {
    group.downloadAllBtn = null;
    group.activated = false;
  }

  for (const [key, file] of Array.from(group.files.entries())) {
    for (const btn of Array.from(file.buttons)) {
      if (!btn.isConnected) {
        file.buttons.delete(btn);
        buttonToGroup.delete(btn);
        buttonToFile.delete(btn);
      }
    }
    if (file.buttons.size === 0) {
      group.files.delete(key);
      continue;
    }
    normalizeFileButtons(file);
  }

  const totalFiles = group.files.size;

  if (totalFiles < MIN_FILES_FOR_DOWNLOAD_ALL) {
    if (group.downloadAllBtn && group.downloadAllBtn.isConnected) {
      group.downloadAllBtn.remove();
    }
    group.downloadAllBtn = null;
    group.activated = false;
    group.isBusy = false;
    if (group.resetTimeoutId != null) {
      window.clearTimeout(group.resetTimeoutId);
      group.resetTimeoutId = undefined;
    }
    return;
  }

  const btn = ensureDownloadAllButton(group);
  const mainSpan = btn.querySelector<HTMLElement>('.cqd-download-all-main');
  const subSpan = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
  
  if (!mainSpan || !subSpan) return;

  if (!group.activated) {
    group.isBusy = false;
    btn.disabled = false;
    btn.classList.remove('cqd-all-success', 'cqd-all-error');
    mainSpan.textContent = t('downloadAll') || 'Download all';
    const fileLabel = totalFiles === 1 ? (t('file') || 'file') : (t('files') || 'files');
    subSpan.textContent = `${totalFiles} ${fileLabel}`;
    setProgressVisual(btn, 0);
    return; 
  }

  let downloaded = 0;
  let failed = 0;
  let inProgress = 0;

  for (const file of group.files.values()) {
    let someSuccess = file.downloaded;
    let someError = file.failed;
    let someLoading = file.inProgress;
    let someCancelled = false;

    for (const b of file.buttons) {
      if (!b.isConnected) continue;
      const cls = b.classList;
      const ds = b.dataset as any;
      const isLoading = cls.contains('cqd-loading') || cls.contains('cqd-trying');
      const isSuccess = cls.contains('cqd-success') || ds.cqdAllDone === 'true';
      const isError = cls.contains('cqd-error');
      const isCancelled = cls.contains('cqd-cancelled') || cls.contains('cqd-cancel');

      if (isLoading) someLoading = true;
      if (isSuccess) someSuccess = true;
      if (isError) someError = true;
      if (isCancelled) someCancelled = true;
    }

    file.downloaded = someSuccess;
    // Not in progress if cancelled
    file.inProgress = someLoading && !someCancelled;
    // Cancelled counts as failed (incomplete download)
    file.failed = !file.downloaded && (someError || someCancelled);

    if (file.downloaded) downloaded++;
    else if (file.inProgress) inProgress++;
    else if (file.failed) failed++;
  }

  group.isBusy = inProgress > 0;
  
  console.log('[CQD] updateDownloadAllButtonState -', {
    totalFiles,
    downloaded,
    failed,
    inProgress,
    isBusy: group.isBusy,
    activated: group.activated,
    cancelPending: group.cancelPending
  });

  if (group.isBusy && group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
    group.resetTimeoutId = undefined;
  }

  const noneStarted = downloaded === 0 && failed === 0 && inProgress === 0;
  const allSucceeded = downloaded === totalFiles && failed === 0 && totalFiles > 0;
  const allCompleted = downloaded + failed === totalFiles && inProgress === 0 && totalFiles > 0;

  btn.disabled = true;
  let mainText: string;
  let subText: string;
  let progressRatio = totalFiles > 0 ? downloaded / totalFiles : 0;

  // === REVERTED AUTO-SHOW CANCEL ===
  // User requested to ONLY show cancel state on hover
  // So we don't force 'cqd-all-cancel' unless user is hovering
  if (group.cancelPending) {
    console.log('[CQD] Showing cancelled state');
    btn.classList.remove('cqd-all-cancel', 'cqd-all-success', 'cqd-all-error');
    btn.classList.add('cqd-all-cancelled');
    mainText = t('cancelled') || 'Cancelled';
    subText = '';
  } else if (allSucceeded) {
    mainText = t('downloaded') || 'Downloaded';
    subText = `${downloaded} / ${totalFiles}`;
    btn.classList.add('cqd-all-success');
    progressRatio = 1;
    scheduleGroupReset(group);
  } else if (allCompleted && failed > 0) {
    if (downloaded === 0) {
      mainText = t('error') || 'Error';
      subText = `${failed} failed`;
      btn.classList.add('cqd-all-error');
      progressRatio = 0;
    } else {
      mainText = t('downloaded') || 'Downloaded';
      subText = `${downloaded} ok, ${failed} failed`;
      btn.classList.add('cqd-all-success');
    }
    scheduleGroupReset(group);
  } else {
    mainText = t('downloading') || 'Downloading…';
    if (failed === 0) {
      subText = `${downloaded} → ${totalFiles}`;
    } else {
      subText = `${downloaded} → ${totalFiles} (${failed} failed)`;
    }
  }

  mainSpan.textContent = mainText;
  subSpan.textContent = subText;
  setProgressVisual(btn, progressRatio);
}

function scheduleGroupReset(group: GroupState): void {
  if (group.resetTimeoutId != null) return;
  group.resetTimeoutId = window.setTimeout(() => {
    group.resetTimeoutId = undefined;
    group.activated = false;
    group.isBusy = false;
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
    markGroupDirty(group);
    scheduleRefresh();
  }, GROUP_FEEDBACK_SUCCESS_MS);
}

function findHeaderContainer(root: HTMLElement): HTMLElement | null {
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

function ensureDownloadAllButton(group: GroupState): HTMLButtonElement {
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

  const computed = window.getComputedStyle(targetContainer);
  if (computed.position === 'static') {
    targetContainer.style.position = 'relative';
  }

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[CQD] Button clicked. State:', { 
      isBusy: group.isBusy, 
      activated: group.activated, 
      cancelPending: group.cancelPending,
      filesInProgress: Array.from(group.files.values()).filter(f => f.inProgress).length
    });
    
    // Check actual group state, not just CSS class (user might click without hovering)
    if (group.isBusy && group.activated && !group.cancelPending) {
      console.log('[CQD] ✅ Cancel All button clicked - calling handler');
      handleCancelAllClick(group);
    } else if (!group.activated || !group.isBusy) {
      console.log('[CQD] ✅ Download All button clicked - calling handler');
      handleDownloadAllClick(group);
    } else {
      console.log('[CQD] ⚠️ Button clicked but already cancelled or not in valid state');
    }
  });

  let hoverTimeout: number | undefined;

  // Hover handlers for cancel state - shows IMMEDIATELY on hover
  button.addEventListener('mouseenter', () => {
    console.log('[CQD] Mouse enter. isBusy:', group.isBusy, 'activated:', group.activated);
    if (group.isBusy && group.activated && !group.cancelPending) {
      button.classList.add('cqd-all-cancel');
      const mainSpan = button.querySelector<HTMLElement>('.cqd-download-all-main');
      const subSpan = button.querySelector<HTMLElement>('.cqd-download-all-sub');
      const iconEl = button.querySelector<HTMLElement>('.cqd-download-all-icon');
      if (mainSpan) mainSpan.textContent = t('cancelAll') || 'Cancel All';
      if (subSpan) subSpan.textContent = '';
      // Show X icon for cancel with smooth transition
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
      // Restore original icon
      const iconEl = button.querySelector<HTMLElement>('.cqd-download-all-icon');
      if (iconEl) {
        iconEl.style.backgroundImage = '';
        iconEl.style.backgroundSize = '';
      }
      markGroupDirty(group);
      scheduleRefresh();
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
 * Robust 3-dots finder
 * Prioritizes the specific menu chunk ID provided by the user to ensure exact placement
 * and prevent jumping or language issues.
 */
function findThreeDots(container: HTMLElement): HTMLElement | null {
  // 1. Exact "Chunk" Wrapper (Stream View & Post View)
  const chunkWrapper = container.querySelector<HTMLElement>('[data-guided-help-id="streamItemActionMenuGH"]');
  if (chunkWrapper) return chunkWrapper;

  // 2. The kpDQ8 class (Action Menu Identifier) - Explicitly detected in first post
  const kp = container.querySelector<HTMLElement>('.kpDQ8');
  if (kp) return kp;

  // 3. Language-Agnostic Fallbacks
  const selectors = [
    '.pYTkkf-Bz112c-LgbsSe', // Class name for the button
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

function getDirectChild(parent: HTMLElement, descendant: HTMLElement): HTMLElement | null {
  let curr: HTMLElement | null = descendant;
  while (curr && curr.parentElement !== parent) {
    curr = curr.parentElement;
    if (!curr || curr === document.body) return null;
  }
  return curr;
}

function handleDownloadAllClick(group: GroupState): void {
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

  const btn = group.downloadAllBtn;
  if (btn) {
    btn.disabled = true;
  }

  for (const file of group.files.values()) {
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    const s = getSingleButtonState(primary);
    if (s === 'idle' || s === 'error') {
      primary.click();
    }
  }

  markGroupDirty(group);
  scheduleRefresh();
}

function handleCancelAllClick(group: GroupState): void {
  if (!group.activated || !group.isBusy) return;
  if (group.cancelPending) return;

  console.log('[CQD] Cancel All clicked - group has', group.files.size, 'files');

  group.cancelPending = true;
  let cancelledCount = 0;
  let requestIdFoundCount = 0;
  let messagesSentCount = 0;

  const btn = group.downloadAllBtn;
  if (btn) {
    btn.classList.remove('cqd-all-cancel');
    btn.classList.add('cqd-all-cancelled');
    const mainSpan = btn.querySelector<HTMLElement>('.cqd-download-all-main');
    const subSpan = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (mainSpan) mainSpan.textContent = t('cancelled') || 'Cancelled';
    if (subSpan) subSpan.textContent = '';
    // Show X icon for cancelled state
    if (iconEl) {
      iconEl.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      iconEl.style.backgroundSize = '18px 18px';
    }
    btn.disabled = true;
  }

  // Cancel all in-progress files by sending cancel messages directly
  for (const file of group.files.values()) {
    if (!file.inProgress) continue;
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    const fileName = (primary.dataset as any).cqdName || 'unknown';
    console.log('[CQD] Processing file for cancellation:', fileName);

    // Mark file as cancelled
    file.inProgress = false;
    file.failed = true;
    cancelledCount++;

    // Check if requestId exists in dataset
    const requestId = (primary.dataset as any).cqdRequestId;
    console.log('[CQD] Button requestId from dataset:', requestId, '| button:', primary);
    
    if (requestId) {
      requestIdFoundCount++;
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({type: 'CQD_CANCEL_DOWNLOAD', requestId });
          messagesSentCount++;
          console.log('[CQD] ✅ Sent cancel message for:', fileName, '| requestId:', requestId);
        } catch (err) {
          console.error('[CQD] ❌ Failed to send cancel message for:', fileName, '| error:', err);
        }
      } else {
        console.warn('[CQD] ⚠️ chrome.runtime not available');
      }
    } else {
      console.error('[CQD] ❌ NO requestId found in button dataset for:', fileName);
      console.log('[CQD] Button dataset:', primary.dataset);
    }
    
    // Update button visual state to cancelled  
    primary.classList.remove('cqd-loading', 'cqd-trying', 'cqd-cancel');
    primary.classList.add('cqd-cancelled');
    
    // Update button label
    const label = primary.querySelector<HTMLSpanElement>('.cqd-label');
    if (label) {
      label.textContent = 'Cancelled';
    }
  }

  console.log('[CQD] Cancel All Summary:');
  console.log('  - Files processed:', cancelledCount);
  console.log('  - RequestIDs found:', requestIdFoundCount);
  console.log('  - Cancel messages sent:', messagesSentCount);

  // Update group state immediately to reflect cancellations
  markGroupDirty(group);
  scheduleRefresh();

  // Reset group after a short delay
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
    scheduleRefresh();
  }, 1500);
}

function getSingleButtonState(btn: HTMLButtonElement): ButtonState {
  const cls = btn.classList;
  if (cls.contains('cqd-loading')) return 'loading';
  if (cls.contains('cqd-trying')) return 'trying';
  if (cls.contains('cqd-success')) return 'success';
  if (cls.contains('cqd-error')) return 'error';
  if ((btn.dataset as any).cqdAllDone === 'true') return 'success';
  return 'idle';
}

function setProgressVisual(btn: HTMLButtonElement, ratio: number): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  const percent = Math.round(clamped * 100);
  btn.style.setProperty('--cqd-progress', `${percent}%`);
}

function safeSetDirection(): void {
  try {
    const dir = getPageDirection();
    document.body.setAttribute('data-cqd-dir', dir);
  } catch {
    // ignore
  }
}

function getPageDirection(): 'ltr' | 'rtl' {
  const docDir = document.documentElement.dir || document.body.dir;
  if (docDir === 'rtl') return 'rtl';
  const computed = window.getComputedStyle(document.body).direction;
  return computed === 'rtl' ? 'rtl' : 'ltr';
}