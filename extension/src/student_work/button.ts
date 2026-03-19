// filepath: extension/src/student_work/button.ts

import type { FileMeta } from '../../entrypoints/content/types';
import { getButtonState, setButtonState } from '../../entrypoints/content/button-state';
import { setPillProgress } from '../../entrypoints/content/button-state';
import {
  handleCancelClick,
  handleSingleDownloadClick,
  ensureMinLoading,
  showErrorState,
  waitForSuccessReset,
} from '../../entrypoints/content/download-handler';
import { CANCEL_ICON_SVG_URL } from '../../entrypoints/content/icons';
import { t } from '../../entrypoints/content/i18n';
import { isPageDark } from '../../entrypoints/content/theme';
import { pendingButtons } from '../../entrypoints/content/state';
import { isStudentWorkAttachmentUrl } from './url-classifier';
import { STUDENT_WORK_HINT_EXT_PARAM, STUDENT_WORK_HINT_NAME_PARAM } from './constants';
import {
  resolveStudentWorkUrl,
  type ResolveStudentWorkResult,
} from './resolver';

export interface StudentWorkButtonOptions {
  resolve?: (rawUrl: string, signal?: AbortSignal) => Promise<ResolveStudentWorkResult>;
}

// what on earth is a weakmap
const resolveControllers = new WeakMap<HTMLButtonElement, AbortController>();
const downloadWatchdogTimers = new WeakMap<HTMLButtonElement, number>();
const STUDENT_WORK_DOWNLOAD_WATCHDOG_MS = 45_000;
let statusBridgeSetup = false;

function findStudentWorkButtonByRequestId(requestId: string): HTMLButtonElement | null {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw="true"]');
  for (const button of buttons) {
    if ((button.dataset as any).cqdRequestId === requestId) return button;
  }
  return null;
}

function isButtonAwaitingTerminalStatus(button: HTMLButtonElement): boolean {
  return button.classList.contains('cqd-loading') || button.classList.contains('cqd-trying');
}

function resolveMessageFromReason(reason: string): string {
  // handle errors, mostly just guessing here tbh
  if (reason.includes('resolver_timeout')) {
    return 'Could not resolve file link in time.';
  }
  if (reason.includes('aborted')) {
    return t('cancelled') || 'Cancelled';
  }
  return 'Could not resolve Student Work file link.';
}

function withStudentWorkRequestNonce(rawUrl: string): string {
  // add cryptographically secure random nonce because caching is evil
  try {
    const parsed = new URL(rawUrl, window.location.href);
    parsed.searchParams.set('cqd_sw_req', `${Date.now()}-${crypto.randomUUID()}`);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function withStudentWorkResolverHints(rawUrl: string, fileMeta: FileMeta): string {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (!isStudentWorkAttachmentUrl(parsed.toString())) return parsed.toString();
    const hintName = (fileMeta.name || '').trim();
    const hintExt = (fileMeta.ext || '').trim();
    if (hintName.length > 0) {
      parsed.searchParams.set(STUDENT_WORK_HINT_NAME_PARAM, hintName);
    }
    if (hintExt.length > 0) {
      parsed.searchParams.set(STUDENT_WORK_HINT_EXT_PARAM, hintExt);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function ensureStudentWorkStatusBridge(): void {
  // connect to background. hope the message port doesn't die
  if (statusBridgeSetup) return;
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  statusBridgeSetup = true;

  chrome.runtime.onMessage.addListener((message: any) => {
    if (!message || message.type !== 'CQD_DOWNLOAD_STATUS') return;
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    if (!requestId) return;

    const pending = pendingButtons.get(requestId);
    const button = pending?.button || findStudentWorkButtonByRequestId(requestId);
    if (!button) return;
    const startedAt = pending?.startedAt ?? (Date.now() - 1_000);

    void (async () => {
      await ensureMinLoading(startedAt);

      const status = message.status as string | undefined;
      const userMessage = message.userMessage as string | undefined;
      const errorCode = message.errorCode as string | undefined;

      if (status === 'trying') {
        setButtonState(button, 'trying', { userMessage });
        return;
      }

      if (status === 'success' || status === 'complete') {
        clearDownloadWatchdog(button);
        pendingButtons.delete(requestId);
        if (button.classList.contains('cqd-cancelled')) {
          try {
            delete (button.dataset as any).cqdRequestId;
          } catch {
            // Ignore dataset cleanup errors.
          }
          return;
        }
        try {
          delete (button.dataset as any).cqdRequestId;
          (button.dataset as any).cqdAllDone = 'true';
        } catch {
          // Ignore dataset cleanup errors.
        }
        setPillProgress(button, 1);
        setButtonState(button, 'success');
        await waitForSuccessReset(button);
        return;
      }

      if (status === 'error' || status === 'interrupted' || status === 'blocked_html') {
        clearDownloadWatchdog(button);
        if ((status === 'interrupted' || status === 'error') && button.classList.contains('cqd-cancelled')) {
          pendingButtons.delete(requestId);
          return;
        }

        pendingButtons.delete(requestId);
        try {
          delete (button.dataset as any).cqdRequestId;
        } catch {
          // Ignore dataset cleanup errors.
        }

        if (errorCode === 'AUTH_CHECK') {
          await showErrorState(button, userMessage);
          return;
        }

        setPillProgress(button, 0);
        await showErrorState(button, userMessage);
      }
    })();
  });
}

function clearDownloadWatchdog(button: HTMLButtonElement): void {
  const timerId = downloadWatchdogTimers.get(button);
  if (timerId != null) {
    window.clearTimeout(timerId);
    downloadWatchdogTimers.delete(button);
  }
}

function armDownloadWatchdog(button: HTMLButtonElement): void {
  clearDownloadWatchdog(button);
  const timerId = window.setTimeout(() => {
    downloadWatchdogTimers.delete(button);
    if (!isButtonAwaitingTerminalStatus(button)) return;
    const requestId = ((button.dataset as any).cqdRequestId || '').trim();
    if (requestId) {
      pendingButtons.delete(requestId);
      try {
        delete (button.dataset as any).cqdRequestId;
      } catch {
        // Ignore dataset cleanup errors.
      }
    }
    setPillProgress(button, 0);
    void showErrorState(button, 'Download did not finish in time. Please retry.');
  }, STUDENT_WORK_DOWNLOAD_WATCHDOG_MS);
  downloadWatchdogTimers.set(button, timerId);
}

function buildButtonSkeleton(fileMeta: FileMeta): HTMLButtonElement {
  // DOM manipulation the old fashioned way. no react here bois
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  button.dataset.cqdSw = 'true';
  if (isPageDark()) {
    button.classList.add('cqd-theme-dark');
  }

  button.setAttribute('aria-label', `${t('ariaDownload')} ${fileMeta.name || ''}`);
  button.setAttribute('title', t('titleQuick'));

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = t('download');

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  button.addEventListener('mouseenter', () => {
    button.dataset.cqdMouseOver = 'true';
    const state = getButtonState(button);
    if (state === 'loading' || state === 'trying') {
      button.classList.add('cqd-cancel');
      const btnLabel = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
      if (btnLabel) btnLabel.textContent = t('cancel') || 'Cancel';
      if (icon) {
        icon.className = 'cqd-download-icon';
        icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      }
    }
  });

  button.addEventListener('mouseleave', () => {
    button.dataset.cqdMouseOver = 'false';
    const wasCancel = button.classList.contains('cqd-cancel');
    const isUnderlyingLoading = button.classList.contains('cqd-loading');
    const isUnderlyingTrying = button.classList.contains('cqd-trying');

    if (wasCancel) {
      button.classList.remove('cqd-cancel');
      const btnLabel = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');

      if (isUnderlyingLoading) {
        if (btnLabel) btnLabel.textContent = t('downloading') || 'Downloading...';
        if (icon) {
          icon.className = 'cqd-download-icon cqd-spinner';
          icon.style.backgroundImage = 'none';
        }
      } else if (isUnderlyingTrying) {
        if (btnLabel) btnLabel.textContent = t('trying') || 'Retrying...';
        if (icon) {
          icon.className = 'cqd-download-icon cqd-spinner';
          icon.style.backgroundImage = 'none';
        }
      }
    }
  });

  return button;
}

export function createStudentWorkButton(
  sourceUrl: string,
  fileMeta: FileMeta,
  options: StudentWorkButtonOptions = {},
): HTMLButtonElement {
  // the giant function that does everything. sorry for the tech debt!
  ensureStudentWorkStatusBridge();
  const resolver = options.resolve ?? ((rawUrl: string, signal?: AbortSignal) =>
    resolveStudentWorkUrl(rawUrl, { signal }));

  const button = buildButtonSkeleton(fileMeta);

  if (sourceUrl) button.dataset.cqdSwSourceUrl = sourceUrl;
  if (fileMeta?.name) button.dataset.cqdName = fileMeta.name;
  if (fileMeta?.ext) button.dataset.cqdExt = fileMeta.ext;

  const clickHandler = async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentState = getButtonState(button);
    if (currentState === 'cancel') {
      clearDownloadWatchdog(button);
      const resolvingController = resolveControllers.get(button);
      if (resolvingController) {
        resolvingController.abort();
        resolveControllers.delete(button);
        setButtonState(button, 'cancelled');
        window.setTimeout(() => {
          if (getButtonState(button) === 'cancelled') {
            setButtonState(button, 'idle');
          }
        }, 900);
        return;
      }

      await handleCancelClick(button);
      return;
    }

    if (currentState !== 'idle') return;
    if (!sourceUrl) return;
    clearDownloadWatchdog(button);

    const controller = new AbortController();
    resolveControllers.set(button, controller);
    setButtonState(button, 'trying', { userMessage: 'Resolving…' });

    let resolved: ResolveStudentWorkResult;
    try {
      resolved = await resolver(withStudentWorkResolverHints(sourceUrl, fileMeta), controller.signal);
    } finally {
      if (resolveControllers.get(button) === controller) {
        resolveControllers.delete(button);
      }
    }

    if (controller.signal.aborted) {
      clearDownloadWatchdog(button);
      return;
    }

    if (!resolved.ok || !resolved.url) {
      clearDownloadWatchdog(button);
      await showErrorState(button, resolveMessageFromReason(resolved.reason));
      return;
    }

    const requestScopedUrl = withStudentWorkRequestNonce(resolved.url);
    button.dataset.cqdUrl = requestScopedUrl;

    // Move from resolving visual to real download lifecycle.
    setButtonState(button, 'idle');
    armDownloadWatchdog(button);
    await handleSingleDownloadClick(button, requestScopedUrl, fileMeta);
  };

  button.addEventListener('click', clickHandler);
  button.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      void clickHandler(event);
    }
  });

  return button;
}
