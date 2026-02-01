// filepath: extension/src/download-all/group-manager.ts
/**
 * Group discovery and button registration.
 */

import type { GroupState, FileEntry } from './types';
import {
  groupStates,
  buttonToGroup,
  buttonToFile,
  dirtyGroups,
  SINGLE_BTN_SELECTOR,
  GROUP_SELECTOR,
} from './state';

/**
 * Register all download buttons in a subtree.
 */
export function registerButtonsInSubtree(root: HTMLElement | Document): void {
  if (
    root instanceof HTMLButtonElement &&
    root.classList.contains('cqd-download-btn')
  ) {
    registerSingleButton(root);
  }
  const buttons = root.querySelectorAll<HTMLButtonElement>(SINGLE_BTN_SELECTOR);
  buttons.forEach((btn) => registerSingleButton(btn));
}

/**
 * Register a single download button.
 */
export function registerSingleButton(btn: HTMLButtonElement): void {
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

/**
 * Ensure a button is registered and return its group.
 */
export function ensureButtonRegistered(btn: HTMLButtonElement): GroupState | null {
  let group: GroupState | undefined | null = buttonToGroup.get(btn);
  if (!group) {
    registerSingleButton(btn);
    group = buttonToGroup.get(btn);
  }
  return group ?? null;
}

/**
 * Cleanup buttons that have been removed from DOM.
 */
export function cleanupRemovedButtons(root: HTMLElement): void {
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

/**
 * Find the group root element for a button.
 */
export function findGroupRoot(btn: HTMLElement): HTMLElement | null {
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

/**
 * Get canonical file key from button data.
 */
export function getCanonicalFileKey(btn: HTMLButtonElement): string {
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

/**
 * Mark a group as needing refresh.
 */
export function markGroupDirty(group: GroupState): void {
  dirtyGroups.add(group);
}

/**
 * Get the primary button for a file.
 */
export function getPrimaryButton(file: FileEntry): HTMLButtonElement | null {
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

/**
 * Normalize visibility of file buttons (show only primary).
 */
export function normalizeFileButtons(file: FileEntry): void {
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
