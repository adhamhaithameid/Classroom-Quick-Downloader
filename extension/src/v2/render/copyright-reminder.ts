// filepath: extension/src/v2/render/copyright-reminder.ts
/**
 * ============================================================================
 * COPYRIGHT REMINDER — the one-time gate before the first classroom-wide run
 * (legal round 2, surface 04 Treatment 1, legal-round2.html)
 * ============================================================================
 *
 * Owner-approved treatment: before the FIRST classroom-wide download run, a
 * small dialog states the duty in two short sentences and asks for one
 * specific check ("I will use these files for my own study"). The check
 * unlocks the run; dismissal without the check ("Not now", Escape) blocks it
 * and writes nothing. Shown once per profile: the acknowledgement persists in
 * the flat settings key copyrightReminderAcknowledged (default false — the
 * store's compat rules keep every key flat; content scripts and the
 * background read them directly).
 *
 * PLACEMENT DECISION (per the owner's integration note): the gate lives at
 * the classroom-download-controller's click path. The controller already
 * owns Classroom-page DOM (button + style injection), and the popup never
 * triggers classroom-wide runs — so the dialog renders in the page, in the
 * same light-DOM, inline-style convention as the controller's button. The
 * controller injects this module through ClassroomDownloadDeps.copyrightGate
 * so tests can stub the moment.
 *
 * Accessibility: role="dialog" + aria-modal, focus moves to the checkbox on
 * open, Tab wraps inside the dialog, Escape cancels, focus returns to the
 * classroom button on close. Motion: a short fade, disabled under
 * prefers-reduced-motion. Copy: short sentences, plain words, no fear
 * language, no legalese (hardcoded English — the content scripts' current
 * convention; the i18n sweep bead will adopt it).
 */

import { loadSettings, saveSetting } from '../../ui/settings/store';

export const COPYRIGHT_DIALOG_LABEL = 'One quick word before your first full download';
export const COPYRIGHT_CHECK_LABEL = 'I will use these files for my own study';

const SCRIM_ID = 'cqd-ip-reminder-scrim';
const STYLE_ID = 'cqd-ip-reminder-style';

interface ActiveDialog {
  promise: Promise<boolean>;
  resolve: (proceed: boolean) => void;
  scrim: HTMLDivElement;
  anchor: HTMLElement | null;
}

let active: ActiveDialog | null = null;

/** Flat-key read through the shared settings store (load normalizes). */
export async function isCopyrightReminderAcknowledged(): Promise<boolean> {
  const settings = await loadSettings();
  return settings.copyrightReminderAcknowledged;
}

/** The full gate: acknowledged → true without UI; otherwise show once. */
export async function ensureCopyrightReminderAcknowledged(
  anchor?: HTMLElement | null,
): Promise<boolean> {
  if (await isCopyrightReminderAcknowledged()) return true;
  const proceed = await requestCopyrightAcknowledgement(anchor);
  if (proceed) {
    await saveSetting('copyrightReminderAcknowledged', true);
  }
  return proceed;
}

/**
 * Show the dialog and resolve true only when the user ticks the check and
 * presses Download. Resolves the SAME promise if a dialog is already open.
 */
export function requestCopyrightAcknowledgement(
  anchor?: HTMLElement | null,
): Promise<boolean> {
  if (active) return active.promise;

  ensureStyle();
  const scrim = document.createElement('div');
  scrim.id = SCRIM_ID;
  scrim.className = 'cqd-ip-reminder-scrim';
  scrim.innerHTML = `
    <div class="cqd-ip-reminder-dialog" data-cqd-ip-dialog role="dialog" aria-modal="true" aria-label="${COPYRIGHT_DIALOG_LABEL}">
      <h4>One quick word before your first full download</h4>
      <p>Materials in a classroom belong to the people who made them — your teachers and school.</p>
      <p>Keep the files for your own study, and follow your school's rules.</p>
      <label class="cqd-ip-reminder-check">
        <input type="checkbox" data-cqd-ip-check />
        <span>${COPYRIGHT_CHECK_LABEL}</span>
      </label>
      <div class="cqd-ip-reminder-actions">
        <button type="button" class="cqd-ip-reminder-cancel" data-cqd-ip-cancel>Not now</button>
        <button type="button" class="cqd-ip-reminder-go" data-cqd-ip-go disabled>Download</button>
      </div>
    </div>
  `;
  document.body.appendChild(scrim);

  const dialogEl = scrim.querySelector<HTMLElement>('[data-cqd-ip-dialog]')!;
  const checkbox = scrim.querySelector<HTMLInputElement>('[data-cqd-ip-check]')!;
  const goBtn = scrim.querySelector<HTMLButtonElement>('[data-cqd-ip-go]')!;
  const cancelBtn = scrim.querySelector<HTMLButtonElement>('[data-cqd-ip-cancel]')!;

  let settled = false;
  let resolveFn: (proceed: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    resolveFn = resolve;
  });

  const close = (proceed: boolean): void => {
    if (settled) return;
    settled = true;
    scrim.remove();
    active = null;
    // Focus returns to the classroom button (or the anchor) on close.
    if (anchor && document.contains(anchor)) anchor.focus();
    resolveFn(proceed);
  };

  active = { promise, resolve: resolveFn, scrim, anchor: anchor ?? null };

  checkbox.addEventListener('change', () => {
    goBtn.disabled = !checkbox.checked;
  });
  goBtn.addEventListener('click', () => close(true));
  cancelBtn.addEventListener('click', () => close(false));
  dialogEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(false);
      return;
    }
    if (event.key === 'Tab') {
      // Light focus trap: wrap within the dialog's focusable controls.
      const focusables = [checkbox, cancelBtn, goBtn];
      const index = focusables.indexOf(document.activeElement as HTMLInputElement | HTMLButtonElement);
      const delta = event.shiftKey ? -1 : 1;
      const next = (index + delta + focusables.length) % focusables.length;
      event.preventDefault();
      focusables[next].focus();
    }
  });

  checkbox.focus();
  return promise;
}

/** Test hook: drop module state and any open dialog DOM. */
export function resetCopyrightReminderForTests(): void {
  document.getElementById(SCRIM_ID)?.remove();
  active = null;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cqd-ip-reminder-scrim {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
  display: grid; place-items: center;
  font-family: 'Google Sans', Roboto, Arial, sans-serif;
  animation: cqd-ip-fade 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cqd-ip-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .cqd-ip-reminder-scrim { animation: none; }
}
.cqd-ip-reminder-dialog {
  width: calc(100% - 48px); max-width: 304px;
  background: #ffffff; color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.cqd-ip-reminder-dialog h4 {
  font-size: 13px; font-weight: 600; line-height: 1.35;
  margin: 0 0 6px;
}
.cqd-ip-reminder-dialog p {
  font-size: 11px; color: #6b7280; line-height: 1.55;
  margin: 0 0 8px;
}
.cqd-ip-reminder-check {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 11px; color: #6b7280; line-height: 1.5;
  margin: 10px 0 12px; cursor: pointer;
}
.cqd-ip-reminder-check input { margin-top: 2px; accent-color: #16a34a; }
.cqd-ip-reminder-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.cqd-ip-reminder-cancel, .cqd-ip-reminder-go {
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 11px; font-weight: 600; padding: 7px 12px;
  font-family: inherit;
  transition: background 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .cqd-ip-reminder-cancel, .cqd-ip-reminder-go { transition: none; }
}
.cqd-ip-reminder-cancel { background: rgba(15, 23, 42, 0.06); color: #6b7280; }
.cqd-ip-reminder-cancel:hover { background: rgba(15, 23, 42, 0.1); color: #0f172a; }
.cqd-ip-reminder-go { background: #16a34a; color: #ffffff; }
.cqd-ip-reminder-go:hover:enabled { background: #15803d; }
.cqd-ip-reminder-go:disabled { opacity: 0.4; cursor: not-allowed; }
.cqd-ip-reminder-dialog:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
`;
  document.head.appendChild(style);
}
