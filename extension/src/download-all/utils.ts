// filepath: extension/src/download-all/utils.ts
/**
 * Download All utility functions.
 */

import type { ButtonState } from './types';

/**
 * Get the state of a single download button.
 */
export function getSingleButtonState(btn: HTMLButtonElement): ButtonState {
  const cls = btn.classList;
  if (cls.contains('cqd-loading')) return 'loading';
  if (cls.contains('cqd-trying')) return 'trying';
  if (cls.contains('cqd-success')) return 'success';
  if (cls.contains('cqd-error')) return 'error';
  if (cls.contains('cqd-cancelled')) return 'cancelled';
  if (cls.contains('cqd-cancel')) return 'cancel';
  if ((btn.dataset as any).cqdAllDone === 'true') return 'success';
  return 'idle';
}

/**
 * Set progress visual on button.
 */
export function setProgressVisual(btn: HTMLButtonElement, ratio: number): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  const percent = Math.round(clamped * 100);
  btn.style.setProperty('--cqd-progress', `${percent}%`);
}

/**
 * Get page text direction.
 */
export function getPageDirection(): 'ltr' | 'rtl' {
  const docDir = document.documentElement.dir || document.body.dir;
  if (docDir === 'rtl') return 'rtl';
  const computed = window.getComputedStyle(document.body).direction;
  return computed === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Safely set direction attribute on body.
 */
export function safeSetDirection(): void {
  try {
    const dir = getPageDirection();
    document.body.setAttribute('data-cqd-dir', dir);
  } catch {
    // ignore
  }
}
