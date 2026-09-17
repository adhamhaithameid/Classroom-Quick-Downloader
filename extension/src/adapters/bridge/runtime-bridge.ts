// filepath: extension/src/adapters/bridge/runtime-bridge.ts
/**
 * ============================================================================
 * RUNTIME BRIDGE — BridgePort over chrome.runtime messaging (S6, G2)
 * ============================================================================
 *
 * The design's one async hop between the page bus and the worker bus: the
 * page side `send`s a BridgeRequest as a `CQD_BRIDGE_REQUEST` message; the
 * worker side answers with `bridge.respond()` → a `CQD_BRIDGE_RESPONSE`
 * message. Correlation is the requestId carried in the payload — never the
 * sender identity, never a shared counter.
 *
 * Adapters import contracts only (fitness rule). Both halves guard their
 * handlers: a throwing handler must not break the messaging channel.
 */
import type { BridgePort, BridgeRequest } from '../../contracts/ports';
import type { Unsubscribe } from '../../bus/event-bus';

export const BRIDGE_REQUEST_TYPE = 'CQD_BRIDGE_REQUEST';
export const BRIDGE_RESPONSE_TYPE = 'CQD_BRIDGE_RESPONSE';

interface RequestMessage {
  type: typeof BRIDGE_REQUEST_TYPE;
  requestId: string;
  payload: unknown;
}

interface ResponseMessage {
  type: typeof BRIDGE_RESPONSE_TYPE;
  requestId: string;
  response: unknown;
}

type MessageListener = (message: unknown, sender: unknown) => void;

/**
 * Bounded worker-side tracking: Maps/Sets that correlate requests must not
 * grow without bound (a request that is never answered would otherwise pin
 * its entry forever). The cap is FIFO — the OLDEST entries fall out first —
 * so recent correlation always survives. Applies to any insertion-ordered
 * store exposing size/keys/delete (Map and Set both qualify).
 */
export const BRIDGE_TRACKING_CAP = 500;

export function capInsertionOrder<K>(
  store: { readonly size: number; keys(): IterableIterator<K>; delete(key: K): boolean },
  cap: number = BRIDGE_TRACKING_CAP,
): void {
  while (store.size > cap) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) return;
    store.delete(oldest);
  }
}

function subscribe(listener: MessageListener): Unsubscribe {
  const wrapped = (message: unknown, sender: unknown): boolean => {
    // Same-extension traffic only, per the repo's listener convention; the
    // bridge answers via separate messages, never the sendResponse callback,
    // so every invocation returns false synchronously.
    const senderId = (sender as { id?: string } | undefined)?.id;
    if (senderId !== chrome.runtime.id) return false;
    // z57: the sender is forwarded — the worker side needs the asking tab to
    // answer over tabs.sendMessage (worker→content requires a tab hop).
    listener(message, sender);
    return false;
  };
  chrome.runtime.onMessage.addListener(wrapped);
  return () => {
    try {
      chrome.runtime.onMessage.removeListener(wrapped);
    } catch {
      // Channel already torn down.
    }
  };
}

/** Page side: sends requests into the runtime, receives responses back. */
export function createPageRuntimeBridge(): BridgePort {
  const responseListeners = new Set<(requestId: string, response: unknown) => void>();

  subscribe((message) => {
    const m = message as Partial<ResponseMessage>;
    if (m?.type !== BRIDGE_RESPONSE_TYPE || typeof m.requestId !== 'string') return;
    for (const listener of responseListeners) {
      try {
        listener(m.requestId, m.response);
      } catch {
        // A bad page-side listener must not starve the others.
      }
    }
  });

  return {
    send(request: BridgeRequest): void {
      const message: RequestMessage = {
        type: BRIDGE_REQUEST_TYPE,
        requestId: request.requestId,
        payload: request.payload,
      };
      try {
        chrome.runtime.sendMessage(message, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Background asleep or channel down — the request simply goes
        // unanswered; the page-side flow settles on its own timeout path.
      }
    },
    respond(): void {
      // The page side never answers requests in this design.
    },
    onRequest(): Unsubscribe {
      return () => undefined;
    },
    onResponse(handler: (requestId: string, response: unknown) => void): Unsubscribe {
      responseListeners.add(handler);
      return () => {
        responseListeners.delete(handler);
      };
    },
  };
}

/** Worker side: receives requests from the runtime, answers them. */
export function createWorkerRuntimeBridge(): BridgePort {
  let handler: ((request: BridgeRequest) => void) | null = null;

  /**
   * z57: answers must reach the CONTENT SCRIPT that asked. chrome.runtime
   * .sendMessage from the worker does not deliver to content-script onMessage
   * listeners — every other worker→content path in this codebase (V1's
   * CQD_DOWNLOAD_STATUS, the popup toggles) rides chrome.tabs.sendMessage.
   * The request sender carries the asking tab, so remember it per requestId
   * and answer over tabs. S11 (S10 parked): when the tab is UNKNOWN — never
   * seen, evicted from the bounded FIFO, or already forgotten after a first
   * answer — the response is DROPPED, not broadcast: a runtime broadcast
   * cannot reach the asking content script anyway, but it WOULD land in
   * extension pages (popup/options) that have no business receiving stray
   * bridge responses. A known-but-closed tab is indistinguishable from a live
   * one before sending; tabs.sendMessage then fails silently into
   * chrome.runtime.lastError, which likewise never reaches extension pages.
   */
  const requestingTab = new Map<string, number | undefined>();

  subscribe((message, sender) => {
    const m = message as Partial<RequestMessage>;
    if (m?.type !== BRIDGE_REQUEST_TYPE || typeof m.requestId !== 'string') return;
    const tabId = (sender as { tab?: { id?: number } } | undefined)?.tab?.id;
    requestingTab.set(m.requestId, tabId);
    // A request whose handler never answers would pin its tab entry forever.
    capInsertionOrder(requestingTab);
    try {
      handler?.({ requestId: m.requestId, payload: m.payload });
    } catch {
      // A throwing request handler must not break the messaging channel;
      // the request goes unanswered and the page side settles on timeout.
    }
  });

  return {
    send(): void {
      // The worker side never originates requests in this design.
    },
    respond(requestId: string, response: unknown): void {
      const tabId = requestingTab.get(requestId);
      // S11: no requesting tab (unknown / evicted / already answered) → DROP.
      // The runtime broadcast that used to sit here sprayed CQD_BRIDGE_RESPONSE
      // into extension pages (popup/options) — never the asking content script.
      if (typeof tabId !== 'number') {
        requestingTab.delete(requestId);
        return;
      }
      const message: ResponseMessage = {
        type: BRIDGE_RESPONSE_TYPE,
        requestId,
        response,
      };
      try {
        chrome.tabs.sendMessage(tabId, message, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Page gone before the answer — nothing to do.
      } finally {
        if (requestingTab.has(requestId)) requestingTab.delete(requestId);
      }
    },
    onRequest(h: (request: BridgeRequest) => void): Unsubscribe {
      handler = h;
      return () => {
        if (handler === h) handler = null;
      };
    },
    onResponse(): Unsubscribe {
      return () => undefined;
    },
  };
}
