// filepath: extension/entrypoints/content/message-handler.ts
/**
 * Message handling for popup and download status updates.
 */

import type { ButtonState } from './types';
import {
  pendingButtons,
  desiredEnabled,
  setDesiredEnabled,
  effectiveEnabled,
  globalEnabled,
  setGlobalEnabled,
} from './state';
import { getButtonState, setButtonState, setPillProgress } from './button-state';
import { ensureMinLoading, waitForSuccessReset, showErrorState } from './download-handler';
import { startCQD, stopCQD, isGoogleClassroom } from './observers';
import { subscribeToGlobalState } from './flags';

/**
 * Recompute effective state from global and tab flags.
 */
export function recomputeEffectiveStateFromFlags(): void {
  const shouldEnable = globalEnabled && desiredEnabled;
  if (shouldEnable) {
    startCQD();
  } else {
    stopCQD();
  }
}

/**
 * Set up message listeners for popup and background communication.
 */
export function setupMessageListeners(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: any): void | true => {
      if (!message) return;

      // Popup asks for this tab's state
      if (message.type === 'CQD_POPUP_QUERY_STATE') {
        try {
          sendResponse({ desiredEnabled, effectiveEnabled });
        } catch { /* ignore */ }
        return true;
      }

      // Popup sets desired state for this tab
      if (message.type === 'CQD_POPUP_SET_DESIRED_STATE') {
        setDesiredEnabled(!!message.enabled);
        recomputeEffectiveStateFromFlags();
        try {
          sendResponse({ desiredEnabled, effectiveEnabled });
        } catch { /* ignore */ }
        return true;
      }

      // Download status update from background
      if (message.type === 'CQD_DOWNLOAD_STATUS') {
        const requestId = message.requestId as string | undefined;
        if (!requestId) return;

        const pending = pendingButtons.get(requestId);
        if (!pending) return;

        const { button, startedAt } = pending;

        (async () => {
          await ensureMinLoading(startedAt);

          const status = message.status as
            | ButtonState
            | 'blocked_html'
            | 'interrupted'
            | 'complete';
          const userMessage = message.userMessage as string | undefined;
          const errorCode = message.errorCode as string | undefined;

          if (status === 'trying') {
            setButtonState(button, 'trying', { userMessage });
            return;
          }

          if (status === 'success' || status === 'complete') {
            pendingButtons.delete(requestId);
            try {
              (button.dataset as any).cqdAllDone = 'true';
            } catch { /* ignore */ }
            setPillProgress(button, 1);
            setButtonState(button, 'success');
            await waitForSuccessReset(button);
            return;
          }

          if (status === 'error' || status === 'interrupted' || status === 'blocked_html') {
            // Don't overwrite cancelled state
            if ((status === 'interrupted' || status === 'error') &&
                button.classList.contains('cqd-cancelled')) {
              pendingButtons.delete(requestId);
              return;
            }

            if (errorCode === 'AUTH_CHECK') {
              await showErrorState(button, userMessage);
              return;
            }

            pendingButtons.delete(requestId);
            setPillProgress(button, 0);
            await showErrorState(button, userMessage);
          }
        })();
        return;
      }
    }
  );
}

/**
 * Initialize the content script.
 */
export function initContentScript(): void {
  if (!isGoogleClassroom()) return;

  // Request icon update
  try {
    chrome.runtime.sendMessage({ type: 'CQD_UPDATE_ICON' });
  } catch { /* ignore */ }

  // Subscribe to global enable/disable state
  subscribeToGlobalState(
    () => {
      setGlobalEnabled(true);
      setDesiredEnabled(true);
      recomputeEffectiveStateFromFlags();
    },
    () => {
      setGlobalEnabled(false);
      stopCQD();
    }
  );

  // Set up message listeners
  setupMessageListeners();
}
