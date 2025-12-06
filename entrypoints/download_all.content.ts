// filepath: entrypoints/download_all.content.ts
import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';
import { whenExtensionEnabled } from './content/flags';

const DOWNLOAD_BTN_SELECTOR = '.cqd-download-btn';
const GROUP_SELECTOR = 'div[data-stream-item-id]';
const INJECTED_ATTR = 'data-cqd-injected';
// Keep this in sync with FEEDBACK_SUCCESS_MS in content/index.ts
const GROUP_FEEDBACK_SUCCESS_MS = 3000;
// Show "Download all" only when there are at least 2 files
const MIN_FILES_FOR_DOWNLOAD_ALL = 2;

type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error';

interface FileEntry {
  key: string;
  buttons: Set<HTMLButtonElement>;
  downloaded: boolean;   // latched success for current batch
  failed: boolean;       // latched error for current batch
  inProgress: boolean;   // any button loading
}

interface GroupState {
  root: HTMLElement;
  files: Map<string, FileEntry>;
  downloadAllBtn: HTMLButtonElement | null;
  activated: boolean;     // batch has been triggered at least once
  isBusy: boolean;        // any file still in progress
  resetTimeoutId?: number;
  currentRunId?: number;
}

const groupStates = new WeakMap<HTMLElement, GroupState>();
const buttonToGroup = new WeakMap<HTMLButtonElement, GroupState>();
const buttonToFile = new WeakMap<HTMLButtonElement, FileEntry>();
const dirtyGroups = new Set<GroupState>();

let refreshScheduled = false;

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // ⬇️ Only run this script when the extension is enabled
    whenExtensionEnabled(() => {
      injectStyles();
      safeSetDirection();

      // Initial discovery
      registerButtonsInSubtree(document);

      // Scroll listener (Fixes missing buttons after hard scroll)
      window.addEventListener('scroll', scheduleRefresh, { passive: true });

      const observer = new MutationObserver((mutations) => {
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

      // Backup scan
      window.setInterval(() => {
        registerButtonsInSubtree(document);
        scheduleRefresh();
      }, 4000);
    });
  },
});

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
  const buttons = root.querySelectorAll<HTMLButtonElement>(DOWNLOAD_BTN_SELECTOR);
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
  let group = buttonToGroup.get(btn);
  if (!group) {
    registerSingleButton(btn);
    group = buttonToGroup.get(btn) || null;
  }
  return group;
}

function cleanupRemovedButtons(root: HTMLElement): void {
  const removedButtons = root.matches(DOWNLOAD_BTN_SELECTOR)
    ? [root as HTMLButtonElement]
    : Array.from(root.querySelectorAll<HTMLButtonElement>(DOWNLOAD_BTN_SELECTOR));

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

/**
 * Group root:
 * - Stream:  div[data-stream-item-id] per card
 * - Post view: nearest ancestor that contains a .N5dSp header
 * - Fallback: <main> / [role="main"]
 */
function findGroupRoot(btn: HTMLElement): HTMLElement | null {
  // 1) Stream card on the main stream page
  const post = btn.closest<HTMLElement>(GROUP_SELECTOR);
  if (post) return post;

  // 2) Post view: walk up ancestors until we find a container
  //    that has a .N5dSp header inside it. That container will
  //    include both header (author, date, 3-dots) and attachments.
  let node: HTMLElement | null = btn.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.querySelector('.N5dSp')) {
      return node;
    }
    node = node.parentElement;
  }

  // 3) Generic fallback to main content container
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

/* -----------------------------------------------------
 * File-level helpers (primary button & dedup)
 * ---------------------------------------------------*/
function getPrimaryButton(file: FileEntry): HTMLButtonElement | null {
  if (file.buttons.size === 0) return null;

  let primaryVisible: HTMLButtonElement | null = null;
  let fallback: HTMLButtonElement | null = null;

  for (const btn of file.buttons) {
    if (!btn.isConnected) continue;
    if (!fallback) fallback = btn;

    // Only consider laid-out elements as visible
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

/* -----------------------------------------------------
 * Refresh pipeline
 * ---------------------------------------------------*/
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

/* -----------------------------------------------------
 * Group state + visual update
 * ---------------------------------------------------*/
function updateGroupState(group: GroupState): void {
  // If the download button was removed by DOM updates (virtual scroll),
  // reset it so it can be re-inserted.
  if (group.downloadAllBtn && !group.downloadAllBtn.isConnected) {
    group.downloadAllBtn = null;
    group.activated = false; 
  }

  // Prune + dedup per file
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

  // Only show "Download all" if we have at least MIN_FILES_FOR_DOWNLOAD_ALL files
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

  // Aggregate per-file state from underlying single buttons,
  // but LATCH success/error for the whole batch.
  let downloaded = 0;
  let failed = 0;
  let inProgress = 0;

  for (const file of group.files.values()) {
    let someSuccess = file.downloaded; // latch
    let someError = file.failed;       // latch
    let someLoading = file.inProgress;

    for (const b of file.buttons) {
      if (!b.isConnected) continue;
      const cls = b.classList;
      const ds = b.dataset as any;

      const isLoading =
        cls.contains('cqd-loading') || cls.contains('cqd-trying');
      const isSuccess =
        cls.contains('cqd-success') || ds.cqdAllDone === 'true';
      const isError = cls.contains('cqd-error');

      if (isLoading) someLoading = true;
      if (isSuccess) someSuccess = true;
      if (isError) someError = true;
    }

    file.downloaded = someSuccess;
    file.inProgress = someLoading;
    file.failed = !file.downloaded && someError;

    if (file.downloaded) downloaded++;
    else if (file.inProgress) inProgress++;
    else if (file.failed) failed++;
  }

  group.isBusy = inProgress > 0;

  // If new downloads are in progress, kill any pending reset timer
  if (group.isBusy && group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
    group.resetTimeoutId = undefined;
  }

  const mainSpan = btn.querySelector<HTMLElement>('.cqd-download-all-main');
  const subSpan = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
  if (!mainSpan || !subSpan) return;

  const noneStarted = downloaded === 0 && failed === 0 && inProgress === 0;
  const allSucceeded =
    downloaded === totalFiles && failed === 0 && totalFiles > 0;
  const allCompleted =
    downloaded + failed === totalFiles && inProgress === 0 && totalFiles > 0;

  // Once any file starts, we consider the run "active"
  if (!group.activated && !noneStarted) {
    group.activated = true;
  }

  btn.classList.remove('cqd-all-success', 'cqd-all-error');

  // Idle state: nothing started or we've fully reset
  if (!group.activated || noneStarted) {
    group.activated = group.activated && !noneStarted;
    group.isBusy = false;
    btn.disabled = false;
    mainSpan.textContent = t('downloadAll') || 'Download all';
    const fileLabel = totalFiles === 1 ? 'file' : 'files';
    subSpan.textContent = `${totalFiles} ${fileLabel}`;
    setProgressVisual(btn, 0);
    return;
  }

  // From here: batch has been activated (and may be in progress or in feedback)
  btn.disabled = true;
  let mainText: string;
  let subText: string;
  let progressRatio = totalFiles > 0 ? downloaded / totalFiles : 0;

  if (allSucceeded) {
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
    // Still in progress
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
  if (group.resetTimeoutId != null) return; // already scheduled
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
    // Clear latched per-file state for the next run
    for (const file of group.files.values()) {
      file.downloaded = false;
      file.failed = false;
      file.inProgress = false;
    }
    markGroupDirty(group);
    scheduleRefresh();
  }, GROUP_FEEDBACK_SUCCESS_MS);
}

/* -----------------------------------------------------
 * Header lookup + Download all creation
 * ---------------------------------------------------*/
/**
 * Find the *header row* for this specific group:
 * - Prefer header inside the same container (post view)
 * - Otherwise, for a stream card: look for a header sibling above the
 * data-stream-item container, but do NOT fall back to a global header.
 */
function findHeaderContainer(root: HTMLElement): HTMLElement | null {
  // 1) Prefer .N5dSp as explicitly requested by user (Post View Header)
  // We search for it inside the root.
  const n5dsp = root.querySelector<HTMLElement>('.N5dSp');
  if (n5dsp) return n5dsp;

  // 2) Look *inside* the root itself (standard stream item or alternate view)
  const internalHeader =
    root.querySelector<HTMLElement>('.JZicYb.gmNu1d') ||
    root.querySelector<HTMLElement>('.JZicYb');
  if (internalHeader) return internalHeader;

  // 3) Walk ancestors and, for each parent, find the last header that appears
  //    before `root` in DOM order, within that parent's subtree.
  let current: HTMLElement | null = root;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const parent = current.parentElement;
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

  // 4) No header found locally; caller will fall back to root itself.
  return null;
}

/**
 * STREAM vs POST placement:
 * - Stream view (div[data-stream-item-id]): use the simple insertBefore logic that already worked.
 * - Post view (.N5dSp header): wrap 3-dots + download-all in a right-side wrapper to keep 3-dots anchored.
 */
function ensureDownloadAllButton(group: GroupState): HTMLButtonElement {
  const existing = group.downloadAllBtn;
  if (existing && existing.isConnected) return existing;

  const root = group.root;
  const headerContainer = findHeaderContainer(root);
  const isStreamView = root.matches(GROUP_SELECTOR);
  const isPostHeader =
    !!headerContainer && headerContainer.classList.contains('N5dSp');
  const targetContainer = headerContainer || root;
  const isInHeader = !!headerContainer;

  // Layout tweaks so the header/root can host our button without clipping
  targetContainer.style.setProperty('flex-wrap', 'wrap', 'important');
  targetContainer.style.setProperty('align-items', 'center', 'important');
  if (targetContainer.classList.contains('N5dSp')) {
    // Post header container is normally flex, but be safe.
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

  // NOTE: Removed `overflow: visible` and `contain: none` enforcement on root
  // to avoid reshaping the whole post.

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDownloadAllClick(group);
  });

  // --- CASE 1: Post view (.N5dSp header) → wrapper around 3-dots ---
  if (isPostHeader && headerContainer) {
    placeDownloadButtonForPostView(button, headerContainer);
  }
  // --- CASE 2: Stream view (div[data-stream-item-id]) ---
  else if (isStreamView) {
    placeDownloadButtonForStreamView(button, headerContainer || root);
  }
  // --- CASE 3: Generic fallback ---
  else {
    targetContainer.appendChild(button);
    button.style.marginInlineStart = '8px';
  }

  group.downloadAllBtn = button;
  return button;
}

/**
 * Post view: keep the 3-dots anchored by wrapping it together with Download All
 * in a small inline-flex wrapper that carries the "right side" behavior.
 */
function placeDownloadButtonForPostView(
  button: HTMLButtonElement,
  headerContainer: HTMLElement,
): void {
  const searchRoot = headerContainer;
  const threeDots =
    searchRoot.querySelector<HTMLElement>(
      'div[role="button"][aria-haspopup="true"]',
    ) ||
    searchRoot.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="options"]',
    ) ||
    searchRoot.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="menu"]',
    ) ||
    searchRoot.querySelector<HTMLElement>('.pYTkkf-Bz112c-LgbsSe');

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
        
        // If the 3-dots uses margin-left:auto to pin itself right, move that onto the wrapper
        if (dotsComputed.marginLeft === 'auto') {
          threeDots.style.marginLeft = '0';
          rightWrapper.style.marginLeft = 'auto';
        }
        
        // Replace 3-dots position with wrapper, then move 3-dots inside
        dotsParent.insertBefore(rightWrapper, threeDots);
        rightWrapper.appendChild(threeDots);
      }
      
      // [Download all][⋮] — keeps the ⋮ visually at the same right anchor
      rightWrapper.insertBefore(button, rightWrapper.firstChild);
      button.style.marginInlineEnd = '4px';
      return;
    }
  }

  // Fallback: just append at the end of header
  searchRoot.appendChild(button);
  button.style.marginInlineStart = '8px';
}

/**
 * Stream view: reuse the simple, working "insertBefore" behavior that you had.
 * It places Download All just before the menu button in the same header row.
 */
function placeDownloadButtonForStreamView(
  button: HTMLButtonElement,
  targetContainer: HTMLElement,
): void {
  const threeDots =
    targetContainer.querySelector<HTMLElement>(
      'div[role="button"][aria-haspopup="true"]',
    ) ||
    targetContainer.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="options"]',
    ) ||
    targetContainer.querySelector<HTMLElement>(
      'div[role="button"][aria-label*="menu"]',
    ) ||
    targetContainer.querySelector<HTMLElement>('.pYTkkf-Bz112c-LgbsSe');

  if (
    threeDots &&
    threeDots !== button &&
    threeDots.parentNode === targetContainer
  ) {
    targetContainer.insertBefore(button, threeDots);
    button.style.marginInlineEnd = '8px';
    button.style.marginInlineStart = '8px';
  } else {
    // Fallback: just append to end
    targetContainer.appendChild(button);
    button.style.marginInlineStart = '8px';
  }
}

/* -----------------------------------------------------
 * Download all click
 * ---------------------------------------------------*/
function handleDownloadAllClick(group: GroupState): void {
  // If a batch is already active or in feedback, ignore clicks
  if (group.isBusy || group.activated) return;

  group.activated = true;
  group.isBusy = true;
  group.currentRunId = Date.now();
  try {
    group.root.dataset.cqdGroupActive = '1';
  } catch {
    /* ignore */
  }

  // Reset latched state for this new run
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

  // Trigger at most one primary button per file
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

function getSingleButtonState(btn: HTMLButtonElement): ButtonState {
  const cls = btn.classList;
  if (cls.contains('cqd-loading')) return 'loading';
  if (cls.contains('cqd-trying')) return 'trying';
  if (cls.contains('cqd-success')) return 'success';
  if (cls.contains('cqd-error')) return 'error';
  if ((btn.dataset as any).cqdAllDone === 'true') return 'success';
  return 'idle';
}

/* -----------------------------------------------------
 * Visuals: progress → CSS vars
 * ---------------------------------------------------*/
function setProgressVisual(btn: HTMLButtonElement, ratio: number): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  const percent = Math.round(clamped * 100);
  btn.style.setProperty('--cqd-progress', `${percent}%`);
}

/* -----------------------------------------------------
 * Direction helper
 * ---------------------------------------------------*/
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