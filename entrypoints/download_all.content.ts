// filepath: entrypoints/download_all.content.ts

import { injectStyles } from './content/styles';
import { t } from './content/i18n';
import { isPageDark } from './content/theme';

const DOWNLOAD_BTN_SELECTOR = '.cqd-download-btn';
const GROUP_SELECTOR = 'div[data-stream-item-id]';
const INJECTED_ATTR = 'data-cqd-injected';

type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error';

interface GroupState {
  root: HTMLElement;
  buttons: Set<HTMLButtonElement>;
  downloadAllBtn: HTMLButtonElement | null;
  activated: boolean;
  colors?: {
    normal: string;
    success: string;
  };
}

const groupStates = new WeakMap<HTMLElement, GroupState>();
const buttonToGroup = new WeakMap<HTMLButtonElement, GroupState>();

const dirtyGroups = new Set<GroupState>();
let refreshScheduled = false;

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    injectStyles();
    safeSetDirection();

    // Initial scan
    registerButtonsInSubtree(document);

    // Observe for new download buttons & state changes
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
            if (group) {
              markGroupDirty(group);
            }
          }
        }
      }

      scheduleRefresh();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Slow backup in case something slips through
    window.setInterval(() => {
      registerButtonsInSubtree(document);
      scheduleRefresh();
    }, 4000);
  },
});

/* -----------------------------------------------------
 * Group + button discovery
 * ---------------------------------------------------*/

function registerButtonsInSubtree(root: HTMLElement | Document): void {
  // If root itself is a download button
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

  // If we already know this button, we’re done
  if (buttonToGroup.has(btn)) {
    return;
  }

  const groupRoot = findGroupRoot(btn);
  if (!groupRoot) return;

  let group = groupStates.get(groupRoot);
  if (!group) {
    group = {
      root: groupRoot,
      buttons: new Set<HTMLButtonElement>(),
      downloadAllBtn: null,
      activated: false,
    };
    groupStates.set(groupRoot, group);
  }

  group.buttons.add(btn);
  buttonToGroup.set(btn, group);
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
    if (!group) return;
    group.buttons.delete(btn);
    buttonToGroup.delete(btn);
    markGroupDirty(group);
  });
}

function findGroupRoot(btn: HTMLElement): HTMLElement | null {
  // Prefer a stream post card
  const post = btn.closest<HTMLElement>(GROUP_SELECTOR);
  if (post) return post;

  // Fallback: details page main content
  const main =
    btn.closest<HTMLElement>('main') ||
    btn.closest<HTMLElement>('div[role="main"]');
  if (main) return main;

  return null;
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
 * Group state computation & UI
 * ---------------------------------------------------*/

function updateGroupState(group: GroupState): void {
  // Prune disconnected buttons
  for (const btn of Array.from(group.buttons)) {
    if (!btn.isConnected) {
      group.buttons.delete(btn);
      buttonToGroup.delete(btn);
    }
  }

  const total = group.buttons.size;

  if (total <= 2) {
    // Not enough files → remove "Download all"
    if (group.downloadAllBtn && group.downloadAllBtn.isConnected) {
      group.downloadAllBtn.remove();
    }
    group.downloadAllBtn = null;
    group.activated = false;
    return;
  }

  const btn = ensureDownloadAllButton(group);

  // Compute counts from per-file buttons
  let downloaded = 0;
  let failed = 0;
  let inProgress = 0;

  for (const fileBtn of group.buttons) {
    if (!fileBtn.isConnected) continue;

    const cls = fileBtn.classList;
    const isLoading =
      cls.contains('cqd-loading') || cls.contains('cqd-trying');
    const isSuccess = cls.contains('cqd-success');
    const isError = cls.contains('cqd-error');
    const prevDone = fileBtn.dataset.cqdAllDone === 'true';

    // Persistent "done" flag
    if (isLoading) {
      // New download attempt → reset any previous done flag
      if (prevDone) fileBtn.dataset.cqdAllDone = 'false';
    } else if (isSuccess) {
      fileBtn.dataset.cqdAllDone = 'true';
    }

    const done = fileBtn.dataset.cqdAllDone === 'true';
    if (done) downloaded++;
    if (isError) failed++;
    if (isLoading) inProgress++;
  }

  const noneStarted =
    downloaded === 0 && failed === 0 && inProgress === 0;
  const allSucceeded = downloaded === total && failed === 0 && total > 0;
  const allCompleted =
    downloaded + failed === total && inProgress === 0 && total > 0;

  if (!group.activated) {
    if (!noneStarted) {
      group.activated = true;
    }
  }

  const mainSpan = btn.querySelector<HTMLElement>('.cqd-download-all-main');
  const subSpan = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
  if (!mainSpan || !subSpan) return;

  // --- Idle (pre-click) view ---
  if (!group.activated || noneStarted) {
    group.activated = group.activated && !noneStarted;
    btn.disabled = false;
    btn.style.backgroundImage = '';
    mainSpan.textContent = t('downloadAll') || 'Download all';
    subSpan.textContent = `${total} files`;
    return;
  }

  // --- Active/progress view ---
  let mainText: string;
  let subText: string;

  if (allSucceeded) {
    // All good 🎉
    mainText = t('downloaded') || 'Downloaded';
    subText = `${downloaded} / ${total}`;
  } else if (allCompleted && failed > 0) {
    // Finished, but some errors
    mainText = t('downloaded') || 'Downloaded';
    if (downloaded === 0) {
      // Everything failed
      mainText = t('error') || 'Error';
      subText = `${failed} failed`;
    } else {
      subText = `${downloaded} ok, ${failed} failed`;
    }
  } else {
    // Mixed in-progress state
    mainText = t('downloading') || 'Downloading…';

    if (failed === 0) {
      // Simple progress: 3 -> 10
      subText = `${downloaded} -> ${total}`;
    } else {
      // Progress + failures
      subText = `${downloaded} -> ${total} (${failed} failed)`;
    }
  }

  mainSpan.textContent = mainText;
  subSpan.textContent = subText;

  // Gradient based on success ratio
  const successRatio = total > 0 ? downloaded / total : 0;
  const percent = Math.max(0, Math.min(100, Math.round(successRatio * 100)));
  applyGradient(btn, group, percent);
}

function ensureDownloadAllButton(group: GroupState): HTMLButtonElement {
  const existing = group.downloadAllBtn;
  if (existing && existing.isConnected) {
    return existing;
  }

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

  // Icon
  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper cqd-download-all-icon-wrapper';
  const icon = document.createElement('span');
  icon.className = 'cqd-download-all-icon';
  iconWrapper.appendChild(icon);

  // Labels
  const mainSpan = document.createElement('span');
  mainSpan.className = 'cqd-download-all-main';

  const subSpan = document.createElement('span');
  subSpan.className = 'cqd-download-all-sub';

  button.appendChild(iconWrapper);
  button.appendChild(mainSpan);
  button.appendChild(subSpan);

  // Positioning: ensure root can host an absolutely positioned pill
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
  group.activated = true;

  for (const fileBtn of group.buttons) {
    if (!fileBtn.isConnected) continue;
    const s = getSingleButtonState(fileBtn);
    // Only click idle/error buttons to either start or retry
    if (s === 'idle' || s === 'error') {
      fileBtn.click();
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
  return 'idle';
}

/* -----------------------------------------------------
 * Visual helpers
 * ---------------------------------------------------*/

function applyGradient(
  button: HTMLButtonElement,
  group: GroupState,
  percent: number,
): void {
  if (!group.colors) {
    const cs = window.getComputedStyle(button);
    const normal =
      cs.getPropertyValue('--cqd-color-normal').trim() || '#005DD7';
    const success =
      cs.getPropertyValue('--cqd-color-success').trim() || '#00A82D';
    group.colors = { normal, success };
  }

  const { normal, success } = group.colors!;
  const p = Math.max(0, Math.min(100, percent));

  if (p <= 0) {
    button.style.backgroundImage = '';
    return;
  }

  button.style.backgroundImage = `
    linear-gradient(
      to right,
      ${success} 0%,
      ${success} ${p}%,
      ${normal} ${p}%,
      ${normal} 100%
    )
  `;
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