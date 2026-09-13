// filepath: extension/tests/fakes/fake-bridge-port.ts
/**
 * BridgePort fake: an in-memory loopback pair. `send` on the page side
 * synchronously delivers to the worker handler; `respond` on the worker side
 * synchronously delivers to the page listener. No chrome.* anywhere.
 */
import type { BridgePort, BridgeRequest } from '../../src/contracts/ports';
import type { Unsubscribe } from '../../src/bus/event-bus';

export interface InMemoryBridgePair {
  page: BridgePort;
  worker: BridgePort;
}

export function createInMemoryBridge(): InMemoryBridgePair {
  let workerHandler: ((request: BridgeRequest) => void) | null = null;
  const pageListeners = new Set<(requestId: string, response: unknown) => void>();

  const page: BridgePort = {
    send(request: BridgeRequest): void {
      workerHandler?.(request);
    },
    respond(): void {
      // The page side never answers requests in this design.
    },
    onRequest(): Unsubscribe {
      return () => undefined;
    },
    onResponse(handler: (requestId: string, response: unknown) => void): Unsubscribe {
      pageListeners.add(handler);
      return () => {
        pageListeners.delete(handler);
      };
    },
  };

  const worker: BridgePort = {
    send(): void {
      // The worker side never originates requests in this design.
    },
    respond(requestId: string, response: unknown): void {
      for (const listener of pageListeners) listener(requestId, response);
    },
    onRequest(handler: (request: BridgeRequest) => void): Unsubscribe {
      workerHandler = handler;
      return () => {
        if (workerHandler === handler) workerHandler = null;
      };
    },
    onResponse(): Unsubscribe {
      return () => undefined;
    },
  };

  return { page, worker };
}
