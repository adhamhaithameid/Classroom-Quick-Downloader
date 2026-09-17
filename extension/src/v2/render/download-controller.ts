// filepath: extension/src/v2/render/download-controller.ts
/**
 * ============================================================================
 * DOWNLOAD CONTROLLER (v2) — clicks → page bus → settled → button states
 * ============================================================================
 *
 * The interactive half v2 mode was missing (bead z57): V2 rendered buttons
 * nobody handled. This module owns the click lifecycle:
 *
 *   click (.cqd-download-btn)  → publish 'download:requested' on the page bus
 *   bridge relay (S6)          → worker download machine → 'download:settled'
 *   settled for our requestId  → v2 button state (success/error/cancelled)
 *
 * The bridge relay + worker service settle the request; this module is the
 * page-side caller. One delegated click handler per post root (button-renderer
 * setupDelegatedClickHandler), one settled subscription per page.
 *
 * Cancel parity with V1: clicking a button that is mid-flight cancels it via
 * the EXISTING CQD_CANCEL_DOWNLOAD runtime message (the background machine
 * already answers it; V1's download-handler.ts does exactly this). The
 * cancelled outcome is applied locally — the worker's own-cancel path clears
 * the pending without settling the bridge request.
 */

import type { EventBus } from '../../bus/event-bus';
import type { PageTopicMap, RequestId } from '../../contracts/topics';
import type { Unsubscribe } from '../../bus/event-bus';
import { getButtonStateV2, setButtonStateV2 } from './button-state';
import { setupDelegatedClickHandler } from './button-renderer';

// ============================================================================
// MODULE STATE — one page-wide instance, wired by v2_bootstrap
// ============================================================================

interface PendingEntry {
  button: HTMLButtonElement;
  startedAt: number;
}

const pending = new Map<RequestId, PendingEntry>();
/** Secondary settled listeners — the Download All group controller registers here. */
const settledListeners = new Set<(requestId: RequestId) => void>();

let requestSeq = 0;
let busRef: EventBus<PageTopicMap> | null = null;

/** Minimal runtime surface, injectable for tests. */
export interface DownloadRuntime {
  sendMessage(message: unknown): void;
}

let runtime: DownloadRuntime | null = null;

/** Test/destroy hook: drop all in-flight state and detach the bus. */
export function resetDownloadController(): void {
  pending.clear();
  settledListeners.clear();
  requestSeq = 0;
  busRef = null;
  runtime = null;
}

/**
 * Wire the controller to a page bus. Subscribes 'download:settled' and keeps
 * the subscription for the page lifetime; returns the unsubscribe fn.
 */
export function wireDownloadPath(
  bus: EventBus<PageTopicMap>,
  injectRuntime?: DownloadRuntime | null,
): Unsubscribe {
  if (injectRuntime !== undefined) runtime = injectRuntime;
  busRef = bus;

  const off = bus.subscribe('download:settled', ({ requestId, outcome }) => {
    const entry = pending.get(requestId);
    if (entry) {
      pending.delete(requestId);
      applyOutcome(entry.button, outcome.status, outcome.detail);
    }
    // Fan out to dependent controllers (Download All group machine).
    for (const listener of settledListeners) {
      try {
        listener(requestId);
      } catch (e) {
        console.warn('[CQD V2 Download] settled listener failed:', e);
      }
    }
  });

  return () => {
    off();
    busRef = null;
  };
}

/** Register a secondary settled listener (group controller). Returns off fn. */
export function onSettled(listener: (requestId: RequestId) => void): Unsubscribe {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

// ============================================================================
// DELEGATED CLICK WIRING — one handler per post root
// ============================================================================

/**
 * Attach the delegated click handler to a post root (idempotent — the
 * renderer keeps a WeakSet of wired roots). Called by
 * EngineV2.renderPlacedButtons: the render step owns the button lifecycle,
 * so the click wiring lives in the same seam.
 */
export function ensurePostClickWiring(postEl: HTMLElement): void {
  setupDelegatedClickHandler(
    postEl,
    (fileId, url, name, ext, button) => {
      handleSingleDownloadClickV2(button, fileId, url, name, ext);
    },
    (postId, button) => {
      onDownloadAllClickV2(postId, button);
    },
  );
}

// ============================================================================
// SINGLE-FILE CLICK
// ============================================================================

/**
 * Handle one single-file download click: derive the FileRef + NameHint from
 * the button's own dataset (discovery already resolved the download URL),
 * publish 'download:requested', and flip the button to loading. A second
 * click while mid-flight cancels (V1's cancel affordance, parity outcome).
 */
export function handleSingleDownloadClickV2(
  button: HTMLButtonElement,
  fileId: string,
  url: string,
  name: string,
  ext: string,
): void {
  if (!url) return;

  const state = getButtonStateV2(button);
  if (state === 'loading' || state === 'trying') {
    cancelInFlight(button);
    return;
  }
  if (state !== 'idle') return;

  const requestId = nextRequestId();
  pending.set(requestId, { button, startedAt: Date.now() });
  try {
    (button.dataset as Record<string, string>).cqdRequestId = requestId;
  } catch { /* ignore */ }

  setButtonStateV2(button, 'loading');
  publishRequest(requestId, { fileId, url, ext, name });
}

// ============================================================================
// DOWNLOAD ALL CLICK — delegated to the group controller when present
// ============================================================================

/**
 * Hook the Download All group controller installs (Stage 3). Until it is
 * present the click is inert — the group button renders but has no pipeline,
 * exactly the failure mode this sprint removes.
 */
let downloadAllHandler: ((postId: string, button: HTMLButtonElement) => void) | null = null;

export function setDownloadAllHandler(
  handler: (postId: string, button: HTMLButtonElement) => void,
): void {
  downloadAllHandler = handler;
}

/** Delegated Download All click entry (called from the post-root dispatcher). */
export function onDownloadAllClickV2(postId: string, button: HTMLButtonElement): void {
  downloadAllHandler?.(postId, button);
}

// ============================================================================
// PUBLISH + CANCEL + SETTLE
// ============================================================================

function nextRequestId(): RequestId {
  requestSeq += 1;
  return `cqd-${Date.now()}-${requestSeq}`;
}

function publishRequest(
  requestId: RequestId,
  file: { fileId: string; url: string; ext: string; name: string },
): void {
  if (!busRef) {
    // No bus (bootstrap never ran) — fail the button honestly instead of
    // leaving it spinning forever.
    const entry = pending.get(requestId);
    if (entry) {
      pending.delete(requestId);
      applyOutcome(entry.button, 'failed', 'Download pipeline unavailable.');
    }
    return;
  }
  const stem = file.name ? file.name.replace(/\.[^.]+$/, '') : file.fileId;
  busRef.publish('download:requested', {
    requestId,
    file: {
      fileId: file.fileId,
      url: file.url,
      ext: file.ext || undefined,
      name: file.name || undefined,
    },
    nameHint: {
      preferredStem: stem || 'file',
      ext: file.ext || '',
      source: 'aria',
    },
  });
}

/** Cancel one in-flight request: CQD_CANCEL_DOWNLOAD + local cancelled state. */
export function cancelInFlight(button: HTMLButtonElement): void {
  const ds = button.dataset as Record<string, string>;
  const requestId = ds.cqdRequestId;
  if (requestId && pending.has(requestId)) {
    pending.delete(requestId);
    getRuntime()?.sendMessage({ type: 'CQD_CANCEL_DOWNLOAD', requestId });
  }
  setButtonStateV2(button, 'cancelled');
}

/** The pending entry for a request id (group controller bookkeeping). */
export function getPendingButton(requestId: RequestId): HTMLButtonElement | undefined {
  return pending.get(requestId)?.button;
}

/** True when a request id is still in flight. */
export function isRequestInFlight(requestId: RequestId): boolean {
  return pending.has(requestId);
}

/** Map an AcquireOutcome status onto the V1 button-state outcome. */
function applyOutcome(
  button: HTMLButtonElement,
  status: PageTopicMap['download:settled']['outcome']['status'],
  detail?: string,
): void {
  switch (status) {
    case 'saved':
      setButtonStateV2(button, 'success');
      scheduleReset(button, 2000);
      break;
    case 'cancelled':
      setButtonStateV2(button, 'cancelled');
      scheduleReset(button, 1500);
      break;
    case 'blocked':
    case 'auth-exhausted':
    case 'failed':
    case 'browser-fail':
    case 'timeout':
      setButtonStateV2(button, 'error', { message: detail });
      scheduleReset(button, 3000);
      break;
  }
}

const resetTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

function scheduleReset(button: HTMLButtonElement, delayMs: number): void {
  const existing = resetTimers.get(button);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    resetTimers.delete(button);
    // The priority gate in setButtonStateV2 lets idle always apply: the
    // terminal state auto-resets like V1's FEEDBACK windows.
    setButtonStateV2(button, 'idle');
  }, delayMs);
  resetTimers.set(button, handle);
}

function getRuntime(): DownloadRuntime | null {
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
