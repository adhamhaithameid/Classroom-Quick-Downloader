// filepath: extension/entrypoints/content/button-state.ts
/**
 * Button state management and rendering.
 */

import type { ButtonState } from './types';
import {
  DOWNLOAD_ICON_SVG_URL,
  SUCCESS_ICON_SVG_URL,
  ERROR_ICON_SVG_URL,
  CANCEL_ICON_SVG_URL,
} from './icons';
import { t } from './i18n';

/**
 * State priority (higher = higher priority, blocks lower).
 */
export const STATE_PRIORITY: Record<ButtonState, number> = {
  success: 7,
  error: 6,
  cancelled: 5,
  cancel: 4,
  trying: 3,
  loading: 2,
  idle: 1,
};

const HOVER_STATES: readonly ButtonState[] = ['cancel'];
const TERMINAL_STATES: readonly ButtonState[] = ['success', 'error', 'cancelled'];
const ACTIVE_STATES: readonly ButtonState[] = ['loading', 'trying'];

/**
 * Get current button state from class names.
 */
export function getButtonState(button: HTMLButtonElement): ButtonState {
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  if (button.classList.contains('cqd-cancelled')) return 'cancelled';
  if (button.classList.contains('cqd-cancel')) return 'cancel';
  if (button.classList.contains('cqd-loading')) return 'loading';
  if (button.classList.contains('cqd-trying')) return 'trying';
  return 'idle';
}

/**
 * Check if state transition should be allowed.
 */
export function shouldAllowTransition(
  currentState: ButtonState,
  newState: ButtonState,
  isMouseOver: boolean
): boolean {
  // Always allow transition to idle (reset)
  if (newState === 'idle') return true;

  // Hover states can exit to active states when mouse leaves
  if ((HOVER_STATES as readonly string[]).includes(currentState) &&
      (ACTIVE_STATES as readonly string[]).includes(newState)) {
    return !isMouseOver;
  }

  // Terminal states block all transitions except to idle
  if ((TERMINAL_STATES as readonly string[]).includes(currentState)) {
    return false;
  }

  // Active states can transition to hover states, terminal states, or each other
  return true;
}

/**
 * Set button visual state.
 */
export function setButtonState(
  button: HTMLButtonElement,
  state: ButtonState,
  options?: { userMessage?: string }
): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  const errorDetail = button.querySelector<HTMLSpanElement>('.cqd-error-detail');

  if (!icon || !label || !errorDetail) return;

  const currentState = getButtonState(button);
  const isMouseOver = (button.dataset as any).cqdMouseOver === 'true';

  if (!shouldAllowTransition(currentState, state, isMouseOver)) {
    return;
  }

  // Reset classes
  button.classList.remove(
    'cqd-loading', 'cqd-trying', 'cqd-success',
    'cqd-error', 'cqd-cancel', 'cqd-cancelled'
  );
  icon.classList.remove('cqd-spinner', 'cqd-spin');
  icon.className = 'cqd-download-icon';
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '';
  label.textContent = t('download');
  errorDetail.textContent = '';
  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  button.classList.add(`cqd-${state}`);

  switch (state) {
    case 'idle':
      break;

    case 'loading':
      icon.style.backgroundImage = 'none';
      icon.className = 'cqd-download-icon cqd-spinner';
      label.textContent = t('downloading');
      button.disabled = false;
      if (isMouseOver) {
        applyHoverCancelVisual(button, icon, label);
      }
      break;

    case 'trying':
      icon.style.backgroundImage = 'none';
      icon.className = 'cqd-download-icon cqd-spinner';
      label.textContent = options?.userMessage || t('trying') || 'Retrying...';
      button.disabled = false;
      if (isMouseOver) {
        applyHoverCancelVisual(button, icon, label);
      }
      break;

    case 'cancel':
      button.disabled = false;
      label.textContent = t('cancel');
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;

    case 'cancelled':
      button.disabled = true;
      label.textContent = t('cancelled');
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;

    case 'success':
      button.classList.add('cqd-success');
      label.textContent = t('downloaded');
      icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;

    case 'error':
      button.disabled = true;
      label.textContent = options?.userMessage || t('error');
      errorDetail.textContent = options?.userMessage || '';
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
  }
}

/**
 * Apply cancel visual when hovering over active download.
 */
function applyHoverCancelVisual(
  button: HTMLButtonElement,
  icon: HTMLElement,
  label: HTMLSpanElement
): void {
  button.classList.add('cqd-cancel');
  label.textContent = t('cancel') || 'Cancel';
  icon.className = 'cqd-download-icon';
  icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '20px 20px';
}

/**
 * Set pill progress indicator on button.
 */
export function setPillProgress(button: HTMLButtonElement, fraction: number): void {
  const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  button.style.setProperty('--cqd-progress', `${percent}%`);
}
