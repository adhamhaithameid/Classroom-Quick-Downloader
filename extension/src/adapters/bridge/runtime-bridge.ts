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

type MessageListener = (message: unknown) => void;

function subscribe(listener: MessageListener): Unsubscribe {
  const wrapped = (message: unknown) => listener(message);
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

  subscribe((message) => {
    const m = message as Partial<RequestMessage>;
    if (m?.type !== BRIDGE_REQUEST_TYPE || typeof m.requestId !== 'string') return;
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
      const message: ResponseMessage = {
        type: BRIDGE_RESPONSE_TYPE,
        requestId,
        response,
      };
      try {
        chrome.runtime.sendMessage(message, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Page gone before the answer — nothing to do.
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
