// filepath: extension/entrypoints/content/download-handler.ts
/**
 * Download button click handling and background communication.
 */

import type { FileMeta, PendingButton } from './types';
import {
  pendingButtons,
  getNextRequestId,
  cancelHoldDelayMs,
  FEEDBACK_ERROR_MS,
  FEEDBACK_CANCELLED_MS,
  FEEDBACK_SUCCESS_MS,
  LOADING_MIN_MS,
  MAX_TERMINAL_STATE_MS,
} from './state';
import { toDownloadUrl } from './url-utils';
import { getButtonState, setButtonState, setPillProgress } from './button-state';
import { t } from './i18n';

/** Simple delay utility */
// sleep sort incoming lol jk
// sleep sort incoming lol jk
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Ensure minimum loading time for UX */
export async function ensureMinLoading(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < LOADING_MIN_MS) await delay(LOADING_MIN_MS - elapsed);
}

/**
 * Find pending button entry by button element.
 */
export function findPendingButtonByElement(button: HTMLButtonElement): PendingButton | undefined {
  for (const pending of pendingButtons.values()) {
    if (pending.button === button) {
      return pending;
    }
  }
  return undefined;
}

/**
 * Handle cancel button click.
 */
// user clicked cancel. rip their download
// user clicked cancel. rip their download
export async function handleCancelClick(button: HTMLButtonElement): Promise<void> {
  const pending = findPendingButtonByElement(button);

  if (pending) {
    pendingButtons.delete(pending.requestId);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'CQD_CANCEL_DOWNLOAD',
          requestId: pending.requestId,
        });
      } catch (err) {
        // Error sending cancel message
      }
    }
  }

  button.classList.add('cqd-cancel-click-anim');
  setTimeout(() => button.classList.remove('cqd-cancel-click-anim'), 400);

  setButtonState(button, 'cancelled');

  const earliestReset = Date.now() + FEEDBACK_CANCELLED_MS;
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS;

  while (true) {
    await delay(200);
    if (getButtonState(button) !== 'cancelled') return;
    if (Date.now() >= maxReset) break;
    if (Date.now() >= earliestReset && !button.matches(':hover')) break;
  }

  if (getButtonState(button) === 'cancelled') {
    setButtonState(button, 'idle');
  }
}

/**
 * Start download via background script.
 */
export function startBackgroundDownload(
  requestId: string,
  url: string,
  fileMeta: FileMeta
): Promise<{ ok: boolean; userMessage?: string }> {
  const finalUrl = toDownloadUrl(url);
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, userMessage: t('runtimeError') || 'Runtime not available.' });
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { type: 'CQD_DOWNLOAD', url: finalUrl, requestId, fileMeta },
        (response: any) => {
          if (chrome.runtime.lastError || !response || response.started === false) {
            resolve({
              ok: false,
              userMessage: response?.userMessage || t('startError') || 'Could not start.',
            });
          } else {
            resolve({ ok: true });
          }
        }
      );
    } catch {
      resolve({ ok: false, userMessage: t('commError') || 'Comm error.' });
    }
  });
}

/**
 * Show error state and wait for reset.
 */
export async function showErrorState(
  button: HTMLButtonElement,
  userMessage?: string
): Promise<void> {
  setButtonState(button, 'error', { userMessage });

  const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS;

  while (true) {
    await delay(200);
    if (getButtonState(button) !== 'error') return;
    if (Date.now() >= maxReset) {
      setButtonState(button, 'idle');
      setPillProgress(button, 0);
      return;
    }
    if (Date.now() < earliestReset) continue;
    if (!button.matches(':hover')) {
      setButtonState(button, 'idle');
      setPillProgress(button, 0);
      return;
    }
  }
}

/**
 * Wait for success state to reset.
 */
export async function waitForSuccessReset(button: HTMLButtonElement): Promise<void> {
  const earliestReset = Date.now() + FEEDBACK_SUCCESS_MS;
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS;

  while (true) {
    await delay(200);
    if (getButtonState(button) !== 'success') return;
    if (Date.now() >= maxReset) break;
    if (Date.now() < earliestReset) continue;
    if (button.matches(':hover')) continue;
    break;
  }

  setButtonState(button, 'idle');
  setPillProgress(button, 0);
  try {
    delete (button.dataset as any).cqdAllDone;
  } catch { /* ignore */ }
}

/**
 * Handle single download button click.
 */
// here goes nothing! hope the backend doesn't crash 🤞🏻
// here goes nothing! hope the backend doesn't crash 🤞🏻
export async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
  fileMeta: FileMeta
): Promise<void> {
  if (!url) return;
  if (getButtonState(button) !== 'idle') return;

  setPillProgress(button, 0);

  const requestId = getNextRequestId();
  const startedAt = Date.now();
  pendingButtons.set(requestId, { button, requestId, fileMeta, startedAt });

  try {
    (button.dataset as any).cqdRequestId = requestId;
  } catch { /* ignore */ }

  setButtonState(button, 'loading');

  // Pre-download delay for cancel opportunity
  if (cancelHoldDelayMs > 0) {
    await delay(cancelHoldDelayMs);
    if (!pendingButtons.has(requestId)) return;
    const currentState = getButtonState(button);
    if (currentState === 'cancelled' || currentState === 'idle') return;
  }

  const startResult = await startBackgroundDownload(requestId, url, fileMeta);
  if (!startResult.ok) {
    pendingButtons.delete(requestId);
    await ensureMinLoading(startedAt);
    await showErrorState(button, startResult.userMessage);
  }
}
