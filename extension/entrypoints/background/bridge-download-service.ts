// filepath: extension/entrypoints/background/bridge-download-service.ts
/**
 * ============================================================================
 * BRIDGE DOWNLOAD SERVICE — worker side of the S6 bridge (G2)
 * ============================================================================
 *
 * A CQD_BRIDGE_REQUEST carrying { file, nameHint } drives the EXISTING
 * download state machine (handleDownloadRequest) — the bridge is a caller,
 * not a second machine. The machine's terminal statuses answer the bridge
 * exactly once per requestId, mapped onto the AcquireOutcome contract:
 *
 *   success            → saved
 *   error AUTH_ALL_FAILED → auth-exhausted
 *   error (other)      → failed
 *   interrupted        → failed
 *   blocked_html       → blocked
 *   cancelled          → cancelled
 *   trying             → progress (never settles)
 *
 * A synchronous refusal (respondOnce({ started: false })) settles immediately
 * as `blocked`. The mapping fires from the sendStatusToTab seam, so it works
 * for bridge-originated downloads that have no originating tab.
 */
import type { BridgePort } from '../../src/contracts/ports';
import type { AcquireOutcome, AcquireOutcomeStatus } from '../../src/contracts/topics';
import type { DownloadStatus } from './types';
import { handleDownloadRequest } from './download-handler';
import { setDownloadStatusListener } from './message-sender';
import { capInsertionOrder } from '../../src/adapters/bridge/runtime-bridge';

interface BridgeDownloadPayload {
  file: { url: string; ext?: string; name?: string };
  nameHint?: unknown;
}

/** Pure status → outcome mapping (unit-tested directly). */
export function mapStatusToOutcome(
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string,
): AcquireOutcome {
  let outcome: AcquireOutcomeStatus;
  switch (status) {
    case 'success':
    case 'complete':
      outcome = 'saved';
      break;
    case 'error':
      outcome = errorCode === 'AUTH_ALL_FAILED' ? 'auth-exhausted' : 'failed';
      break;
    case 'interrupted':
      outcome = 'failed';
      break;
    case 'blocked_html':
      outcome = 'blocked';
      break;
    default:
      outcome = 'failed';
  }
  const result: AcquireOutcome = { status: outcome };
  if (userMessage) result.detail = userMessage;
  return result;
}

/**
 * Serve bridge download requests on the worker side. Returns the off fn:
 * detaches the status observer and stops serving requests.
 */
export function startBridgeDownloadService(worker: BridgePort): () => void {
  const settled = new Set<string>();
  const accepted = new Set<string>();

  const settleOnce = (requestId: string, outcome: AcquireOutcome): void => {
    if (settled.has(requestId)) return;
    settled.add(requestId);
    // Bounded memory: ancient settled ids fall out FIFO (the "exactly once"
    // guarantee holds for any live request — 500+ newer settles mean the old
    // page is long gone).
    capInsertionOrder(settled);
    worker.respond(requestId, outcome);
  };

  setDownloadStatusListener((pending, status, userMessage, errorCode) => {
    // Only statuses for requests the bridge originated.
    if (!accepted.has(pending.requestId)) return;
    if (status === 'trying') return; // progress, not a settle
    settleOnce(pending.requestId, mapStatusToOutcome(status, userMessage, errorCode));
  });

  const offRequests = worker.onRequest(({ requestId, payload }) => {
    const { file } = (payload ?? {}) as BridgeDownloadPayload;
    accepted.add(requestId);
    // Bounded memory: requests unanswered for 500+ newer requests age out.
    capInsertionOrder(accepted);
    if (!file?.url) {
      settleOnce(requestId, { status: 'blocked', detail: 'Bridge request missing file URL.' });
      return;
    }

    const respond = (response?: { started: boolean; userMessage?: string }): void => {
      if (response && response.started === false) {
        settleOnce(requestId, {
          status: 'blocked',
          detail: response.userMessage ?? 'Download blocked.',
        });
      }
      // started:true settles later, via the status seam above.
    };

    handleDownloadRequest(
      {
        type: 'CQD_DOWNLOAD',
        url: file.url,
        requestId,
        fileMeta: { ext: file.ext, name: file.name },
      },
      // No originating tab: the bridge requester lives on the page bus.
      { tab: { id: undefined } } as chrome.runtime.MessageSender,
      respond as (response?: unknown) => void,
    );
  });

  return () => {
    offRequests();
    setDownloadStatusListener(null);
  };
}
