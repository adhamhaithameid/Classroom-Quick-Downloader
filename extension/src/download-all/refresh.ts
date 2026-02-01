// filepath: extension/src/download-all/refresh.ts
/**
 * Download All refresh and update logic.
 */

import type { GroupState, FileEntry } from './types';
import {
  dirtyGroups,
  buttonToGroup,
  buttonToFile,
  refreshScheduled,
  setRefreshScheduled,
  MIN_FILES_FOR_DOWNLOAD_ALL,
  GROUP_FEEDBACK_SUCCESS_MS,
} from './state';
import { normalizeFileButtons } from './group-manager';
import { ensureDownloadAllButton } from './button-controller';
import { setProgressVisual } from './utils';
import { scheduleGroupReset, resetGroupVisuals } from './cancel-handler';
import { t } from '../../entrypoints/content/i18n';
import { CANCEL_ICON_SVG_URL } from '../../entrypoints/content/icons';

export { markGroupDirty } from './group-manager';

/**
 * Schedule a refresh of dirty groups.
 */
export function scheduleRefresh(): void {
  if (refreshScheduled) return;
  setRefreshScheduled(true);
  requestAnimationFrame(() => {
    setRefreshScheduled(false);
    dirtyGroups.forEach(updateGroupState);
    dirtyGroups.clear();
  });
}

/**
 * Update group state and UI.
 */
export function updateGroupState(group: GroupState): void {
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
    file.inProgress = someLoading && !someCancelled;
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

  const allSucceeded = downloaded === totalFiles && failed === 0 && totalFiles > 0;
  const allCompleted = downloaded + failed === totalFiles && inProgress === 0 && totalFiles > 0;

  btn.disabled = false;
  let mainText: string;
  let subText: string;
  let progressRatio = totalFiles > 0 ? downloaded / totalFiles : 0;

  const isHovering = btn.matches(':hover');
  
  if (group.cancelPending) {
    btn.classList.remove('cqd-all-cancel', 'cqd-all-success', 'cqd-all-error');
    btn.classList.add('cqd-all-cancelled');
    mainText = t('cancelled') || 'Cancelled';
    subText = '';
    
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) {
      iconEl.style.backgroundImage = '';
    }
    
    if (inProgress === 0) {
      scheduleGroupReset(group);
    }
  } else if (group.isBusy && group.activated && isHovering) {
    btn.classList.remove('cqd-all-success', 'cqd-all-error');
    btn.classList.add('cqd-all-cancel');
    mainText = t('cancelAll') || 'Cancel All';
    subText = '';

    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) {
      iconEl.style.transition = 'all 0.2s ease-out';
      iconEl.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      iconEl.style.backgroundSize = '18px 18px';
    }
    
  } else if (allSucceeded) {
    const iconEl = btn.querySelector<HTMLElement>('.cqd-download-all-icon');
    if (iconEl) iconEl.style.backgroundImage = '';
    
    mainText = t('downloaded') || 'Downloaded';
    subText = `${downloaded} / ${totalFiles}`;
    btn.classList.add('cqd-all-success');
    progressRatio = 1;
    scheduleGroupReset(group);
  } else if (allCompleted && failed > 0) {
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
