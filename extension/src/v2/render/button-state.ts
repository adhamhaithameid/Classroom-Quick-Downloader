// filepath: extension/src/v2/render/button-state.ts
/**
 * ============================================================================
 * BUTTON STATE (v2) — the per-file button state machine (z57 S1)
 * ============================================================================
 *
 * Mirrors V1's entrypoints/content/button-state.ts OUTCOME: state lives in
 * CSS classes on the button (cqd-loading / cqd-trying / cqd-success /
 * cqd-error / cqd-cancelled / cqd-cancel), the label carries the human text,
 * and the error detail span carries the failure message. Same state names,
 * same class names, same priority discipline (terminal states win) — so the
 * QA journeys' class assertions and the visual contract carry over to the v2
 * renderer unchanged.
 *
 * Icons are CSS-driven (see button-styles.ts): the class swap changes the
 * icon; no inline background-image juggling.
 */

export type V2ButtonState =
  | 'idle'
  | 'loading'
  | 'trying'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'cancel';

const STATE_CLASSES: readonly string[] = [
  'cqd-loading',
  'cqd-trying',
  'cqd-success',
  'cqd-error',
  'cqd-cancelled',
  'cqd-cancel',
];

/** Read the current state from the button's classes (highest priority wins). */
export function getButtonStateV2(button: HTMLElement): V2ButtonState {
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  if (button.classList.contains('cqd-cancelled')) return 'cancelled';
  if (button.classList.contains('cqd-cancel')) return 'cancel';
  if (button.classList.contains('cqd-trying')) return 'trying';
  if (button.classList.contains('cqd-loading')) return 'loading';
  return 'idle';
}

/**
 * Apply a state to a v2 download button: swaps the state class, sets the
 * label/error text, and toggles the disabled flag like V1 does.
 * `message` carries the user-facing failure text for error states.
 */
export function setButtonStateV2(
  button: HTMLButtonElement,
  state: V2ButtonState,
  options?: { message?: string },
): void {
  const label = button.querySelector<HTMLElement>('.cqd-label');
  const errorDetail = button.querySelector<HTMLElement>('.cqd-error-detail');

  // Terminal states block transitions until reset (V1 parity); idle always
  // applies so the auto-reset timers can always land.
  const current = getButtonStateV2(button);
  if (current === 'success' || current === 'error' || current === 'cancelled') {
    if (state !== 'idle') return;
  }

  button.classList.remove(...STATE_CLASSES);
  button.classList.add(`cqd-${state}`);
  button.disabled = state === 'cancelled';

  switch (state) {
    case 'idle':
      if (label) label.textContent = 'Download';
      if (errorDetail) errorDetail.textContent = '';
      break;
    case 'loading':
    case 'trying':
      if (label) label.textContent = state === 'trying' ? 'Retrying…' : 'Downloading…';
      if (errorDetail) errorDetail.textContent = '';
      break;
    case 'success':
      if (label) label.textContent = 'Downloaded';
      if (errorDetail) errorDetail.textContent = '';
      break;
    case 'error':
      if (label) label.textContent = options?.message || 'Error';
      if (errorDetail) errorDetail.textContent = options?.message || '';
      break;
    case 'cancel':
      if (label) label.textContent = 'Cancel';
      break;
    case 'cancelled':
      if (label) label.textContent = 'Cancelled';
      if (errorDetail) errorDetail.textContent = '';
      break;
  }
}
