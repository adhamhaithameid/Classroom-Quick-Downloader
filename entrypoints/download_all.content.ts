// filepath: entrypoints/download_all.content.ts

import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';

const DOWNLOAD_BTN_SELECTOR = '.cqd-download-btn';
const GROUP_SELECTOR = 'div[data-stream-item-id]';
const INJECTED_ATTR = 'data-cqd-injected';

// Keep this in sync with FEEDBACK_SUCCESS_MS in content/index.ts
const GROUP_FEEDBACK_SUCCESS_MS = 3000;

type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error';

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
  resetTimeoutId?: number;
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
    injectStyles();
    safeSetDirection();

    // Initial discovery
    registerButtonsInSubtree(document);

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

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-cqd-all-done'], // watch per-file status
    });

    // Backup scan (in case we miss something)
    window.setInterval(() => {
      registerButtonsInSubtree(document);
      scheduleRefresh();
    }, 4000);
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

function findGroupRoot(btn: HTMLElement): HTMLElement | null {
  const post = btn.closest<HTMLElement>(GROUP_SELECTOR);
  if (post) return post;

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

    // Only consider visually laid-out elements as "visible"
    if (!btn.offsetParent) continue;

    if (!primaryVisible) {
      primaryVisible = btn;
      continue;
    }

    // Choose the last one in DOM order (more likely to be the "real" visible one)
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
      // Primary stays visible & clickable
      btn.style.removeProperty('display');
      btn.style.removeProperty('visibility');
      btn.style.removeProperty('pointer-events');
    } else {
      // Hide duplicates so we don't see a second layer of blue circles
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
  // Prune dead buttons and normalize duplicates per file
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

  // Require at least 2 files to show "Download all"
  if (totalFiles < 2) {
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

  // Aggregate current DOM state directly from the single-file buttons
  let downloaded = 0;
  let failed = 0;
  let inProgress = 0;

  for (const file of group.files.values()) {
    let someSuccess = false;
    let someError = false;
    let someLoading = false;

    for (const b of file.buttons) {
      if (!b.isConnected) continue;
      const cls = b.classList;

      const isLoading =
        cls.contains('cqd-loading') || cls.contains('cqd-trying');
      const isSuccess =
        cls.contains('cqd-success') ||
        (b.dataset as any).cqdAllDone === 'true';
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

  // If new downloads started, cancel any pending reset timer
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

  // Activation check: once any file has started, we consider the run "active"
  if (!group.activated && !noneStarted) {
    group.activated = true;
  }

  // Reset visual classes
  btn.classList.remove('cqd-all-success', 'cqd-all-error');

  // Idle state: no downloads yet OR everything went back to idle
  if (!group.activated || noneStarted) {
    group.activated = group.activated && !noneStarted;
    group.isBusy = false;
    btn.disabled = false;
    mainSpan.textContent = t('downloadAll') || 'Download all';
    subSpan.textContent = `${totalFiles} files`;
    setProgressVisual(btn, 0);
    return;
  }

  // From here: run is active or we’re in the success/error feedback window
  btn.disabled = true;

  // Active/completed states
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
    // In progress
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
    markGroupDirty(group);
    scheduleRefresh();
  }, GROUP_FEEDBACK_SUCCESS_MS);
}

/* -----------------------------------------------------
 * Download all click
 * ---------------------------------------------------*/

function ensureDownloadAllButton(group: GroupState): HTMLButtonElement {
  const existing = group.downloadAllBtn;
  if (existing && existing.isConnected) return existing;

  const root = group.root;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-all-btn';
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

  // Root container must allow the button to overflow slightly
  const computed = window.getComputedStyle(root);
  if (computed.position === 'static') {
    root.style.position = 'relative';
  }
  root.style.setProperty('overflow', 'visible', 'important');
  root.style.setProperty('contain', 'none', 'important');

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDownloadAllClick(group);
  });

  root.appendChild(button);
  group.downloadAllBtn = button;

  return button;
}

function handleDownloadAllClick(group: GroupState): void {
  // If anything is currently running or still in feedback, ignore clicks
  if (group.isBusy || group.activated) return;

  group.activated = true;

  // Cancel any pending reset from a previous run
  if (group.resetTimeoutId != null) {
    window.clearTimeout(group.resetTimeoutId);
    group.resetTimeoutId = undefined;
  }

  const btn = group.downloadAllBtn;
  if (btn) {
    btn.disabled = true;
  }

  // Trigger at most ONE primary button per file, and only if idle/error
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