// filepath: extension/src/v2/render/download-all-controller.ts
/**
 * ============================================================================
 * DOWNLOAD ALL CONTROLLER (v2) — the group state machine (z57 S3)
 * ============================================================================
 *
 * Ports V1's Download All run machine (entrypoints/download_all.content.ts +
 * src/download-all/*) onto the v2 page-bus pipeline. The UX contract the qa
 * journeys pin (qa-02) is preserved verbatim:
 *
 * - one group per ≥2-file post (rendering) — this module owns the RUN
 * - click starts a staggered run (1 s per-file stagger = V1's
 *   cancelHoldDelayMs window), issuing download:requested per file through
 *   the SAME single-file publish path (one request issuer per file)
 * - progress sub-text during the run ("0 → 3"), success sub-text ("3 / 3"),
 *   error sub-text ("2 failed"), auto-reset after the 3 s GROUP_FEEDBACK
 *   window, per-file buttons carry their own states
 * - cancel: a click while the run is busy engages cancellation — every
 *   in-flight request gets the EXISTING CQD_CANCEL_DOWNLOAD runtime message
 *   (the background machine answers it; V1 parity), files flip to
 *   cqd-cancelled, the group shows cqd-all-cancelled and resets after 1.5 s
 * - hover during a busy run shows the cqd-all-cancel "Cancel All" affordance
 * - partial failure is a SUCCESS state by design ("d ok, f failed"), matching
 *   V1 and the qa-02 error fixture (cqd-all-error needs ALL files failed)
 *
 * cqd-all-* classes are the group's state carriers, exactly like V1's.
 */

import type { RequestId, AcquireOutcome } from '../../contracts/topics';
import { getButtonStateV2, setButtonStateV2 } from './button-state';
import {
  handleSingleDownloadClickV2,
  onSettled,
  setDownloadAllHandler,
  type DownloadRuntime,
} from './download-controller';

// ============================================================================
// TIMINGS — V1 parity (entrypoints/content/state.ts + download-all/state.ts)
// ============================================================================

/** Per-file stagger = V1's cancelHoldDelayMs (the cancel-opportunity window). */
export const PER_FILE_STAGGER_MS = 1000;
/** V1's GROUP_FEEDBACK_SUCCESS_MS — how long the terminal state stays visible. */
export const GROUP_FEEDBACK_MS = 3000;
/** V1's post-cancel reset delay. */
export const GROUP_CANCELLED_RESET_MS = 1500;

// ============================================================================
// TYPES
// ============================================================================

type GroupFileState = 'pending' | 'loading' | 'success' | 'error' | 'cancelled';

interface GroupFile {
  fileId: string;
  button: HTMLButtonElement;
  url: string;
  name: string;
  ext: string;
  state: GroupFileState;
  requestId: RequestId | null;
}

interface GroupRun {
  root: HTMLElement;
  groupButton: HTMLButtonElement;
  files: GroupFile[];
  cancelPending: boolean;
  resetTimer: ReturnType<typeof setTimeout> | null;
  hoverListeners: Array<() => void>;
}

const runs = new Map<string, GroupRun>();
const decoratedButtons = new WeakSet<HTMLButtonElement>();

/** Minimal runtime surface, injectable for tests. */
export interface GroupRuntime {
  sendMessage(message: unknown): void;
}

let runtime: GroupRuntime | null = null;
let offSettled: (() => void) | null = null;

/**
 * Install the group controller: registers the Download All click handler and
 * the settled listener. Returns the uninstall fn (tests, engine destroy).
 * Passing `null` explicitly installs with NO runtime — production bootstrap
 * does this and cancel falls back to chrome.runtime (see getRuntime).
 */
export function installDownloadAllController(injectRuntime?: GroupRuntime | null): () => void {
  if (injectRuntime !== undefined) runtime = injectRuntime;
  setDownloadAllHandler(handleDownloadAllClickV2);
  offSettled = onSettled(handleFileSettled);
  return uninstallDownloadAllController;
}

export function uninstallDownloadAllController(): void {
  setDownloadAllHandler(() => {});
  offSettled?.();
  offSettled = null;
  for (const run of runs.values()) teardownRun(run);
  runs.clear();
}

/** Test/destroy hook: drop every run (buttons die with the page anyway). */
export function resetDownloadAllController(): void {
  for (const run of runs.values()) teardownRun(run);
  runs.clear();
}

// ============================================================================
// RUN LIFECYCLE
// ============================================================================

/**
 * The delegated Download All click. Busy run → cancel; otherwise start.
 * (V1's ensureDownloadAllButton click semantics.)
 */
export function handleDownloadAllClickV2(postId: string, groupButton: HTMLButtonElement): void {
  const run = runs.get(postId);
  if (run && !isRunSettled(run)) {
    cancelRun(run);
    return;
  }
  if (run) {
    // Previous run finished and reset — restart clean.
    teardownRun(run);
    runs.delete(postId);
  }
  startRun(postId, groupButton);
}

function startRun(postId: string, groupButton: HTMLButtonElement): void {
  const root =
    groupButton.closest<HTMLElement>('[data-stream-item-id]') ??
    groupButton.parentElement ??
    document.body;

  // Enumerate the group's single-file buttons from the DOM (self-contained —
  // no engine coupling), deduped by canonical file id.
  const seen = new Set<string>();
  const files: GroupFile[] = [];
  for (const btn of root.querySelectorAll<HTMLButtonElement>('.cqd-download-btn')) {
    const fileId = btn.getAttribute('data-cqd-file-id') || '';
    if (!fileId || seen.has(fileId)) continue;
    seen.add(fileId);
    files.push({
      fileId,
      button: btn,
      url: btn.dataset.cqdUrl || '',
      name: btn.dataset.cqdName || '',
      ext: btn.dataset.cqdExt || '',
      state: 'pending',
      requestId: null,
    });
  }
  if (files.length === 0) return;

  const run: GroupRun = {
    root,
    groupButton,
    files,
    cancelPending: false,
    resetTimer: null,
    hoverListeners: [],
  };
  runs.set(postId, run);
  decorateGroupButton(run);

  // Staggered starts — the first file enters the pipeline on the click
  // itself; each subsequent file follows PER_FILE_STAGGER_MS later (V1's
  // cancel-window rhythm: the group stays busy right after the click).
  const startFile = (file: GroupFile): void => {
    if (run.cancelPending || runs.get(postId) !== run) return;
    if (getButtonStateV2(file.button) !== 'idle') {
      // Another actor owns this button — count it as-is.
      file.state = stateOfButton(file.button);
      updateRunUI(run);
      return;
    }
    const requestId = handleSingleDownloadClickV2(
      file.button,
      file.fileId,
      file.url,
      file.name,
      file.ext,
    );
    if (requestId) {
      file.requestId = requestId;
      file.state = 'loading';
    } else {
      file.state = stateOfButton(file.button);
    }
    updateRunUI(run);
  };

  files.forEach((file, index) => {
    if (index === 0) {
      startFile(file);
      return;
    }
    setTimeout(() => startFile(file), index * PER_FILE_STAGGER_MS);
  });

  updateRunUI(run);
}

/** One file's request settled — promote the group machine. */
function handleFileSettled(requestId: RequestId, outcome: AcquireOutcome): void {
  for (const run of runs.values()) {
    const file = run.files.find((f) => f.requestId === requestId);
    if (!file) continue;

    switch (outcome.status) {
      case 'saved':
        file.state = 'success';
        break;
      case 'cancelled':
        file.state = 'cancelled';
        break;
      default:
        file.state = 'error';
        break;
    }
    updateRunUI(run);
    return;
  }
}

// ============================================================================
// CANCEL
// ============================================================================

/** Cancel a busy run: CQD_CANCEL_DOWNLOAD per in-flight file (V1 parity). */
export function cancelRun(run: GroupRun): void {
  if (run.cancelPending) return;
  run.cancelPending = true;

  for (const file of run.files) {
    // Loading files get the cancel message; not-yet-started ones simply never
    // start (startFile checks cancelPending). Both end up cancelled — every
    // file in a cancelled run is accounted for immediately.
    if (file.state !== 'loading' && file.state !== 'pending') continue;
    file.state = 'cancelled';
    if (file.requestId) {
      getRuntime()?.sendMessage({ type: 'CQD_CANCEL_DOWNLOAD', requestId: file.requestId });
    }
    setButtonStateV2(file.button, 'cancelled');
  }

  updateRunUI(run);

  // V1: the cancelled group resets after 1.5 s.
  scheduleRunReset(run, GROUP_CANCELLED_RESET_MS);
}

// ============================================================================
// GROUP UI — the cqd-all-* contract
// ============================================================================

function updateRunUI(run: GroupRun): void {
  const btn = run.groupButton;
  if (!btn.isConnected) {
    teardownRun(run);
    return;
  }

  const total = run.files.length;
  const done = run.files.filter((f) => f.state === 'success').length;
  const failed = run.files.filter(
    (f) => f.state === 'error' || f.state === 'cancelled',
  ).length;
  const busy = run.files.some((f) => f.state === 'loading' || f.state === 'pending');

  const main = btn.querySelector<HTMLElement>('.cqd-download-all-main');
  const sub = btn.querySelector<HTMLElement>('.cqd-download-all-sub');

  // Terminal: every file reached an end state.
  if (!busy) {
    if (run.cancelPending) {
      btn.classList.remove('cqd-all-success', 'cqd-all-error', 'cqd-all-cancel');
      btn.classList.add('cqd-all-cancelled');
      if (main) main.textContent = 'Cancelled';
      if (sub) sub.textContent = '';
      if (!run.resetTimer) scheduleRunReset(run, GROUP_CANCELLED_RESET_MS);
      return;
    }

    btn.classList.remove('cqd-all-cancel');
    if (failed === 0) {
      btn.classList.add('cqd-all-success');
      if (main) main.textContent = 'Downloaded';
      if (sub) sub.textContent = `${done} / ${total}`;
    } else if (done === 0) {
      btn.classList.add('cqd-all-error');
      if (main) main.textContent = 'Error';
      if (sub) sub.textContent = `${failed} failed`;
    } else {
      // Partial failure is a SUCCESS state by design (V1 + qa-02 fixture).
      btn.classList.add('cqd-all-success');
      if (main) main.textContent = 'Downloaded';
      if (sub) sub.textContent = `${done} ok, ${failed} failed`;
    }
    scheduleRunReset(run, GROUP_FEEDBACK_MS);
    return;
  }

  // Busy: progress sub-text, cancel affordance on hover.
  btn.classList.remove('cqd-all-success', 'cqd-all-error');
  if (main) main.textContent = 'Downloading…';
  if (sub) {
    sub.textContent =
      failed > 0 ? `${done} → ${total} (${failed} failed)` : `${done} → ${total}`;
  }
}

/** Busy-run hover shows the Cancel All affordance (V1 mouseenter parity). */
function decorateGroupButton(run: GroupRun): void {
  const btn = run.groupButton;
  if (decoratedButtons.has(btn)) return;
  decoratedButtons.add(btn);

  const enter = () => {
    const busy = run.files.some((f) => f.state === 'loading' || f.state === 'pending');
    if (!busy || run.cancelPending) return;
    btn.classList.add('cqd-all-cancel');
    const main = btn.querySelector<HTMLElement>('.cqd-download-all-main');
    const sub = btn.querySelector<HTMLElement>('.cqd-download-all-sub');
    if (main) main.textContent = 'Cancel All';
    if (sub) sub.textContent = '';
  };
  const leave = () => {
    if (run.cancelPending) return;
    if (btn.classList.contains('cqd-all-cancel')) {
      btn.classList.remove('cqd-all-cancel');
      updateRunUI(run);
    }
  };
  btn.addEventListener('mouseenter', enter);
  btn.addEventListener('mouseleave', leave);
  run.hoverListeners.push(
    () => btn.removeEventListener('mouseenter', enter),
    () => btn.removeEventListener('mouseleave', leave),
  );
}

function scheduleRunReset(run: GroupRun, delayMs: number): void {
  if (run.resetTimer) clearTimeout(run.resetTimer);
  run.resetTimer = setTimeout(() => {
    run.resetTimer = null;
    if (!isRunSettled(run) && !run.cancelPending) {
      // A new run started while the timer was pending — ignore.
      return;
    }
    const postId = [...runs.entries()].find(([, r]) => r === run)?.[0];
    teardownRun(run);
    if (postId) runs.delete(postId);
  }, delayMs);
}

function teardownRun(run: GroupRun): void {
  if (run.resetTimer) {
    clearTimeout(run.resetTimer);
    run.resetTimer = null;
  }
  for (const off of run.hoverListeners) off();
  run.hoverListeners = [];
  resetGroupButtonVisual(run.groupButton);
}

/** Restore the group button's idle visuals ("N files" sub-text). */
export function resetGroupButtonVisual(button: HTMLButtonElement): void {
  button.classList.remove(
    'cqd-all-success',
    'cqd-all-error',
    'cqd-all-cancel',
    'cqd-all-cancelled',
  );
  const main = button.querySelector<HTMLElement>('.cqd-download-all-main');
  const sub = button.querySelector<HTMLElement>('.cqd-download-all-sub');
  const count = button.getAttribute('data-cqd-group-count');
  if (main) main.textContent = 'Download all';
  if (sub) sub.textContent = count ? `${count} ${count === '1' ? 'file' : 'files'}` : '';
}

// ============================================================================
// HELPERS
// ============================================================================

function stateOfButton(button: HTMLButtonElement): GroupFileState {
  const s = getButtonStateV2(button);
  if (s === 'success') return 'success';
  if (s === 'error') return 'error';
  if (s === 'cancelled' || s === 'cancel') return 'cancelled';
  if (s === 'loading' || s === 'trying') return 'loading';
  return 'pending';
}

function isRunSettled(run: GroupRun): boolean {
  return !run.files.some((f) => f.state === 'loading' || f.state === 'pending');
}

function getRuntime(): GroupRuntime | null {
  // Lazy chrome.runtime fallback — same idiom as download-controller.ts.
  // The bootstrap installs this controller with no runtime; without the
  // fallback, CQD_CANCEL_DOWNLOAD messages were silently dropped (UI flipped
  // to cancelled while the background kept downloading).
  if (runtime) return runtime;
  if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
    runtime = {
      sendMessage: (message: unknown) => {
        try {
          chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
        } catch { /* channel down — nothing to cancel */ }
      },
    };
  }
  return runtime;
}

/** Test hook: the live run for a post (read-only view). */
export function getRunFor(postId: string): Readonly<GroupRun> | undefined {
  return runs.get(postId);
}
