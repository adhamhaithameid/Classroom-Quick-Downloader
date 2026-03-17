// filepath: entrypoints/download_all.content.ts
import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';
import { CANCEL_ICON_SVG_URL, DOWNLOAD_ICON_SVG_URL } from './content/icons';
import { isClassworkPost, isTopicView } from './content/tab-detector';


const DOWNLOAD_BTN_SELECTOR = '.cqd-download-all-btn';
const SINGLE_BTN_SELECTOR = '.cqd-download-btn';
// Updated to match both Stream (div) and Classwork (li) posts
const GROUP_SELECTOR = '[data-stream-item-id]';
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
        
        // Handle download button attribute changes
        if (
          target instanceof HTMLButtonElement &&
          target.classList.contains('cqd-download-btn')
        ) {
          const group = ensureButtonRegistered(target);
          if (group) markGroupDirty(group);
        }
        
        // Handle Classwork post fold/unfold (class changes on li elements)
        // When user opens/closes a post, the class changes from AZd1I to lXuxY (or vice versa)
        if (
          m.attributeName === 'class' &&
          target.matches('li[data-stream-item-id]')
        ) {
          // Check if this post has a Download All button
          const downloadAllBtn = target.querySelector<HTMLButtonElement>('.cqd-download-all-btn');
          if (downloadAllBtn) {
            const isCollapsed = isPostCollapsed(target);
            if (isCollapsed) {
              // Hide the button when post is folded (with fade-out)
              downloadAllBtn.classList.add('cqd-hidden');
            } else {
              // Show the button when post is unfolded (with fade-in)
              downloadAllBtn.classList.remove('cqd-hidden');
            }
          }
        }
        
        // Handle aria-expanded changes (also indicates fold/unfold)
        if (
          m.attributeName === 'aria-expanded' &&
          target.closest('li[data-stream-item-id]')
        ) {
          const postRoot = target.closest<HTMLElement>('li[data-stream-item-id]');
          if (postRoot) {
            const downloadAllBtn = postRoot.querySelector<HTMLButtonElement>('.cqd-download-all-btn');
            if (downloadAllBtn) {
              const isCollapsed = isPostCollapsed(postRoot);
              if (isCollapsed) {
                downloadAllBtn.classList.add('cqd-hidden');
              } else {
                downloadAllBtn.classList.remove('cqd-hidden');
              }
            }
          }
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
      attributeFilter: ['class', 'data-cqd-all-done', 'aria-expanded'],
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

  // Student Work page: submission cards may use different containers
  // Try common submission card patterns
  const submissionCard = btn.closest<HTMLElement>(
    '[data-submission-id], [data-studentid], [data-assignee-id], .nQ1Fvb, .TBvOpe'
  );
  if (submissionCard) return submissionCard;

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

/**
 * Checks if a Classwork post is collapsed (folded).
 * 
 * TOPIC VIEW (/tc/ URLs):
 * - Posts are ALWAYS expanded, never fold
 * - Uses div.etr9pd or div.i8Wprc elements
 * - Always return false (not collapsed)
 * 
 * LIST VIEW (/t/ URLs):
 * - OPEN posts have: aria-expanded="true" on the expand button AND class "lXuxY" on the li
 * - CLOSED posts have: aria-expanded="false" on the expand button AND class "AZd1I" on the li
 * 
 * @param postRoot The root element of the post
 * @returns True if the post is collapsed/folded
 */
function isPostCollapsed(postRoot: HTMLElement): boolean {
  // Only applies to Classwork posts
  if (!isClassworkPost(postRoot)) return false;
  
  // Topic view pages (/tc/ URLs) - posts are always expanded
  if (isTopicView()) {
    return false;
  }
  
  // For non-li elements (topic view posts), they're always expanded
  if (!postRoot.matches('li')) {
    return false;
  }
  
  // LIST VIEW: Check for aria-expanded attribute (most reliable)
  const expandButton = postRoot.querySelector<HTMLElement>('[aria-expanded]');
  if (expandButton) {
    const isExpanded = expandButton.getAttribute('aria-expanded') === 'true';
    if (!isExpanded) {
      return true; // Post is collapsed
    }
  }
  
  // LIST VIEW: Check for the lXuxY class (present when expanded)
  // Open posts have class "lXuxY", closed posts have "AZd1I"
  if (postRoot.classList.contains('AZd1I') || !postRoot.classList.contains('lXuxY')) {
    return true; // Post is collapsed
  }
  
  return false; // Post is expanded/open
}

function getCanonicalFileKey(btn: HTMLButtonElement): string {
  const ds = btn.dataset as any;
  const explicitFileKey = (ds.cqdFileKey || '').trim();
  if (explicitFileKey) return explicitFileKey;
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

  if (group.isBusy && group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
    group.resetTimeoutId = undefined;
  }

  const noneStarted = downloaded === 0 && failed === 0 && inProgress === 0;
  const allSucceeded = downloaded === totalFiles && failed === 0 && totalFiles > 0;
  const allCompleted = downloaded + failed === totalFiles && inProgress === 0 && totalFiles > 0;

  btn.disabled = false; // MUST be enabled to allow Cancel click!
  let mainText: string;
  let subText: string;
  let progressRatio = totalFiles > 0 ? downloaded / totalFiles : 0;

  // === REVERTED AUTO-SHOW CANCEL ===
  // User requested to ONLY show cancel state on hover.
  // BUT: If user IS hovering right now, we must ensure the state reflects that!
  // Otherwise update() will wipe the hover state.
  const isHovering = btn.matches(':hover');
  
  if (group.cancelPending) {
    btn.classList.remove('cqd-all-cancel', 'cqd-all-success', 'cqd-all-error');
    btn.classList.add('cqd-all-cancelled');
    mainText = t('cancelled') || 'Cancelled';
    subText = '';
    
    // Clear the inline X icon - use cancelled/X icon from CSS class instead
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) {
      iconEl.style.backgroundImage = ''; // Clear inline to let CSS take over
    }
    
    // Schedule reset when all downloads are done (cancelled or otherwise)
    if (inProgress === 0) {
      scheduleGroupReset(group);
    }
  } else if (group.isBusy && group.activated && isHovering) {
    // If busy and hovering, FORCE cancel state
    // This fixes the issue where updates wipe the cancel state
    btn.classList.remove('cqd-all-success', 'cqd-all-error');
    btn.classList.add('cqd-all-cancel');
    mainText = t('cancelAll') || 'Cancel All';
    subText = '';

    // Update icon to cancel/X
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) {
      iconEl.style.transition = 'all 0.2s ease-out';
      iconEl.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      iconEl.style.backgroundSize = '18px 18px';
    }
    
  } else if (allSucceeded) {
    // Clear inline icon style to revert to default checkmark/icon via class
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) iconEl.style.backgroundImage = '';
    
    mainText = t('downloaded') || 'Downloaded';
    subText = `${downloaded} / ${totalFiles}`;
    btn.classList.add('cqd-all-success');
    progressRatio = 1;
    scheduleGroupReset(group);
  } else if (allCompleted && failed > 0) {
    // Clear inline icon style
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) iconEl.style.backgroundImage = '';
    
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
    // Clear inline icon style
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) iconEl.style.backgroundImage = '';
    
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
    group.cancelPending = false; // CRITICAL: Reset cancel flag
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
    // Also trigger visual reset (just in case observer missed it or for safety)
    resetGroupVisuals(group);
    
    markGroupDirty(group);
    scheduleRefresh();
  }, GROUP_FEEDBACK_SUCCESS_MS);
}

function resetGroupVisuals(group: GroupState): void {
  for (const file of group.files.values()) {
    for (const btn of file.buttons) {
      if (!btn.isConnected) continue;
      
      // Remove all state classes
      btn.classList.remove('cqd-loading', 'cqd-trying', 'cqd-success', 'cqd-error', 'cqd-cancel', 'cqd-cancelled');
      btn.disabled = false;
      
      // Reset label
      const label = btn.querySelector<HTMLSpanElement>('.cqd-label');
      if (label) label.textContent = t('download') || 'Download';
      
      // Reset icon to download icon
      const icon = btn.querySelector<HTMLElement>('.cqd-download-icon');
      if (icon) {
        icon.classList.remove('cqd-spinner', 'cqd-spin');
        icon.className = 'cqd-download-icon';
        icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
        icon.style.backgroundSize = '';
      }
      
      // Clear error detail
      const errorDetail = btn.querySelector<HTMLElement>('.cqd-error-detail');
      if (errorDetail) errorDetail.textContent = '';
    }
  }
}

function findHeaderContainer(root: HTMLElement): HTMLElement | null {
  // Stream view: .N5dSp header
  const n5dsp = root.querySelector<HTMLElement>('.N5dSp');
  if (n5dsp) return n5dsp;

  // Topic View / Classwork: Find the header row (.RcHwO) which contains all header elements
  // This is the proper parent for button placement
  const headerRow = root.querySelector<HTMLElement>('.RcHwO');
  if (headerRow) return headerRow;

  // Classwork List View: The span with nZCyt class that contains data-stream-item-id
  // This is the main title row: icon, title "NN & CNN", comment count, date, three-dots
  const classworkTitleSpan = root.querySelector<HTMLElement>('span.nZCyt');
  if (classworkTitleSpan) return classworkTitleSpan;

  // Classwork view: header row within the collapsible list item
  // This is the row containing the assignment icon, title, and menu
  const classworkHeader = root.querySelector<HTMLElement>('.jWCzBe.gmNu1d');
  if (classworkHeader) return classworkHeader;

  // Stream view alternative: internal header
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
        '.N5dSp, .JZicYb.gmNu1d, .jWCzBe.gmNu1d, .nZCyt, .vFkiub.kpDQ8, .JZicYb',
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
  const root = group.root;
  
  // Check if this is a collapsed Classwork post - hide button if so
  if (isPostCollapsed(root)) {
    if (existing && existing.isConnected) {
      // Hide the existing button (with fade-out transition)
      existing.classList.add('cqd-hidden');
    }
    // Return existing or create a hidden placeholder
    if (existing) return existing;
  } else if (existing && existing.isConnected) {
    // Post is expanded - ensure button is visible (with fade-in transition)
    existing.classList.remove('cqd-hidden');
    return existing;
  }
  
  if (existing && existing.isConnected) return existing;

  const headerContainer = findHeaderContainer(root);
  const isClasswork = isClassworkPost(root);
  const isStreamView = root.matches('div[data-stream-item-id]');
  const isPostHeader = !!headerContainer && headerContainer.classList.contains('N5dSp');
  const isClassworkHeader = !!headerContainer && headerContainer.classList.contains('jWCzBe');
  const targetContainer = headerContainer || root;
  const isInHeader = !!headerContainer;

  targetContainer.style.setProperty('flex-wrap', 'wrap', 'important');
  targetContainer.style.setProperty('align-items', 'center', 'important');
  if (targetContainer.classList.contains('N5dSp')) {
    targetContainer.style.display = 'flex';
  }
  // Classwork header needs flex too
  if (targetContainer.classList.contains('jWCzBe')) {
    targetContainer.style.display = 'flex';
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-all-btn';
  
  if (isInHeader) {
    button.classList.add('cqd-in-header');
  }
  if (isClasswork) {
    button.classList.add('cqd-classwork');
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

  // Sync Observer: Force individual buttons to reset when Download All button resets
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
        
        // If transitioned from any terminal state to idle
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
    
    // Check actual group state, not just CSS class (user might click without hovering)
    if (group.isBusy && group.activated && !group.cancelPending) {
      handleCancelAllClick(group);
    } else if (!group.activated || !group.isBusy) {
      handleDownloadAllClick(group);
    }
  });

  let hoverTimeout: number | undefined;

  // Hover handlers for cancel state - shows IMMEDIATELY on hover
  button.addEventListener('mouseenter', () => {
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

  // Determine placement based on view type
  if (isClasswork && headerContainer) {
    placeDownloadButtonForClassworkView(button, root, headerContainer);
  } else if (isPostHeader && headerContainer) {
    placeDownloadButtonForPostView(button, headerContainer);
  } else if (isStreamView) {
    placeDownloadButtonForStreamView(button, headerContainer || root);
  } else {
    targetContainer.appendChild(button);
    button.style.marginInlineStart = '8px';
  }

  // Attach per-button visibility observer for accordion state (aria-expanded)
  // This ensures button hides when post is collapsed
  attachVisibilityObserver(root, button);

  group.downloadAllBtn = button;
  return button;
}

/**
 * Attaches a MutationObserver to manage button visibility based on post accordion state.
 * 
 * Per spec: The button must ONLY be visible when the post is EXPANDED (aria-expanded="true").
 * When the post is collapsed (aria-expanded="false"), the button is hidden.
 * 
 * Target: div[role="button"][aria-expanded] (Classes: .SFCE1b, .JUr7jb)
 * 
 * IMPORTANT: In Classwork List View, the postElement is div.sVNOQ (attachments container)
 * but the toggle is in the parent <li> element. We need to search upward.
 */
function attachVisibilityObserver(postElement: HTMLElement, button: HTMLElement): void {
  // Determine the search scope - for sVNOQ, search from parent li element
  let searchScope: HTMLElement = postElement;
  
  // If postElement is sVNOQ (Classwork/Topic view), the toggle is in parent li
  if (postElement.classList.contains('sVNOQ') || postElement.matches('div[data-stream-item-id]')) {
    const parentLi = postElement.closest<HTMLElement>('li[data-stream-item-id]');
    if (parentLi) {
      searchScope = parentLi;
    }
  }
  
  // Find the expansion trigger (accordion toggle button)
  const toggle = searchScope.querySelector<HTMLElement>('div[role="button"][aria-expanded]');
  
  if (!toggle) {
    // No accordion toggle found - button stays visible by default
    // This is normal for Stream view posts and Topic view which don't have accordions
    button.classList.remove('cqd-hidden');
    return;
  }
  
  // Function to update button visibility based on aria-expanded state
  // Uses CSS class toggle for smooth opacity transition
  const updateVisibility = () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      // Post is expanded - show button with fade-in
      button.classList.remove('cqd-hidden');
    } else {
      // Post is collapsed - hide button with fade-out
      button.classList.add('cqd-hidden');
    }
  };
  
  // Set initial visibility state
  updateVisibility();
  
  // Watch for aria-expanded attribute changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
        updateVisibility();
      }
    }
  });
  
  observer.observe(toggle, { 
    attributes: true,
    attributeFilter: ['aria-expanded']
  });
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
 * Places the Download All button in Classwork/Topic view posts.
 * 
 * REVISED STRATEGY (based on debug logs):
 * - headerContainer is often .vFkiub.kpDQ8 which IS the three-dots container
 * - We need to find the actual dots button INSIDE headerContainer
 * - Insert button BEFORE the dots button (not after/append)
 */
function placeDownloadButtonForClassworkView(
  button: HTMLButtonElement,
  root: HTMLElement,
  headerContainer: HTMLElement,
): void {
  // Style button for Classwork compact view
  button.classList.add('cqd-classwork-header');
  button.style.marginInlineEnd = '8px';
  button.style.flexShrink = '0';
  button.style.alignSelf = 'center';
  

  
  // =========================================================================
  // STRATEGY 1: headerContainer is the dots container (.vFkiub.kpDQ8 or .kpDQ8)
  // This is the most common case in Topic View - headerContainer CONTAINS the dots
  // =========================================================================
  
  if (headerContainer.classList.contains('kpDQ8') || headerContainer.classList.contains('vFkiub')) {

    
    // The dots container is often absolutely positioned, so we should NOT put button inside it
    // Instead, insert button as a SIBLING in the PARENT row
    const parentRow = headerContainer.parentElement;
    
    if (parentRow) {

      
      // Ensure parent is flex for horizontal layout
      parentRow.style.setProperty('display', 'flex', 'important');
      parentRow.style.setProperty('align-items', 'center', 'important');
      parentRow.style.setProperty('flex-wrap', 'nowrap', 'important');
      parentRow.style.setProperty('justify-content', 'flex-end', 'important');
      
      // Add margin to separate from dots
      button.style.marginInlineEnd = '8px';
      
      // Insert button as sibling BEFORE the dots container
      parentRow.insertBefore(button, headerContainer);

      return;
    }
    
    // Fallback: insert inside headerContainer if parent not available
    const dotsButton = headerContainer.querySelector<HTMLElement>(
      '[jscontroller="h38nBf"], [jscontroller="ZvHseb"], [jscontroller="PIVayb"], ' +
      '[aria-label*="More"], [aria-label*="more"], [aria-haspopup="menu"], ' +
      'div[role="button"], button'
    );
    
    if (dotsButton) {
      headerContainer.style.setProperty('display', 'flex', 'important');
      headerContainer.style.setProperty('align-items', 'center', 'important');
      headerContainer.insertBefore(button, dotsButton);

      return;
    }
    
    // No specific dots button found, insert as first child
    const firstChild = headerContainer.firstElementChild;
    if (firstChild) {
      headerContainer.insertBefore(button, firstChild);

    } else {
      headerContainer.appendChild(button);

    }
    return;
  }
  
  // =========================================================================
  // STRATEGY 2: Search parent containers for the dots
  // =========================================================================
  
  // Get the parent chain to search
  let searchContainer: HTMLElement = root;
  if (root.classList.contains('sVNOQ') && root.parentElement) {
    searchContainer = root.parentElement;
    if (searchContainer.parentElement) {
      // Go up another level to find the full post wrapper
      searchContainer = searchContainer.parentElement;
    }

  }
  
  const threeDotsSelectors = [
    '[jscontroller="h38nBf"]',
    '[jscontroller="ZvHseb"]',
    '[jscontroller="PIVayb"]',
    '[aria-label*="More"]',
    '[aria-label*="more"]',
    '[aria-haspopup="menu"]',
    '.vFkiub.kpDQ8',
    '.kpDQ8',
  ].join(', ');
  
  const threeDotsElement = searchContainer.querySelector<HTMLElement>(threeDotsSelectors);
  
  if (threeDotsElement) {

    
    const dotsParent = threeDotsElement.parentElement;
    if (dotsParent) {
      dotsParent.style.setProperty('display', 'flex', 'important');
      dotsParent.style.setProperty('align-items', 'center', 'important');
      dotsParent.insertBefore(button, threeDotsElement);

      return;
    }
  }
  
  // =========================================================================
  // STRATEGY 3: Known container selectors
  // =========================================================================
  
  const topicHeader = searchContainer.querySelector<HTMLElement>('.jWCzBe');
  if (topicHeader) {
    const topicMenu = topicHeader.querySelector<HTMLElement>('.WyjGac, .kpDQ8');
    if (topicMenu) {
      topicHeader.insertBefore(button, topicMenu);

      return;
    }
    topicHeader.appendChild(button);

    return;
  }
  
  const headerRow = searchContainer.querySelector<HTMLElement>('.RcHwO');
  if (headerRow) {
    headerRow.appendChild(button);

    return;
  }
  
  // =========================================================================
  // LAST RESORT: Append to headerContainer
  // =========================================================================

  
  // Try to prepend rather than append
  const firstElement = headerContainer.firstElementChild;
  if (firstElement) {
    headerContainer.insertBefore(button, firstElement);
  } else {
    headerContainer.appendChild(button);
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
  // Note: Don't disable button - user needs to be able to click Cancel All

  for (const file of group.files.values()) {
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    const s = getSingleButtonState(primary);
    // Include 'cancelled' so previously cancelled downloads can be restarted
    if (s === 'idle' || s === 'error' || s === 'cancelled') {
      primary.click();
    }
  }

  markGroupDirty(group);
  scheduleRefresh();
}

function handleCancelAllClick(group: GroupState): void {
  if (!group.activated || !group.isBusy) return;
  if (group.cancelPending) return;

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
    // Note: Don't disable button - updateDownloadAllButtonState handles state
  }

  // Cancel all in-progress files by sending cancel messages directly
  for (const file of group.files.values()) {
    if (!file.inProgress) continue;
    const primary = getPrimaryButton(file);
    if (!primary) continue;

    const fileName = (primary.dataset as any).cqdName || 'unknown';

    // Mark file as cancelled
    file.inProgress = false;
    file.failed = true;
    cancelledCount++;

    // Check if requestId exists in dataset
    const requestId = (primary.dataset as any).cqdRequestId;
    
    if (requestId) {
      requestIdFoundCount++;
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({type: 'CQD_CANCEL_DOWNLOAD', requestId });
          messagesSentCount++;
        } catch (err) {
          // Failed to send cancel message
        }
      }
    }
    
    // Update button visual state to cancelled - remove ALL state classes first
    primary.classList.remove('cqd-loading', 'cqd-trying', 'cqd-cancel', 'cqd-cancelled', 'cqd-success', 'cqd-error');
    primary.classList.add('cqd-cancelled');
    
    // Update button label and icon
    const label = primary.querySelector<HTMLSpanElement>('.cqd-label');
    const icon = primary.querySelector<HTMLElement>('.cqd-download-icon');
    if (label) {
      label.textContent = t('cancelled') || 'Cancelled';
    }
    if (icon) {
      // Remove spinner animation classes
      icon.classList.remove('cqd-spinner', 'cqd-spin');
      icon.className = 'cqd-download-icon'; // Reset to base class
      // Set cancel/X icon
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
    }
  }

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
