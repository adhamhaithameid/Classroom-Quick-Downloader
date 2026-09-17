// filepath: extension/tests/bridge.test.ts
/**
 * BridgePort (S6/G2) — the ONE async hop between the page bus and the worker
 * bus. Contracts pinned here:
 *   - correlation: a response reaches the page side with the EXACT requestId
 *     it was sent under;
 *   - one handler at a time on the worker side; the previous handler is
 *     replaced (onRequest returns the off fn);
 *   - onResponse returns an idempotent unsubscribe;
 *   - the runtime adapters speak one message pair (CQD_BRIDGE_REQUEST /
 *     CQD_BRIDGE_RESPONSE) over chrome.runtime with the correlation id in the
 *     payload — no ad-hoc message shapes.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BridgePort, BridgeRequest } from '../src/contracts/ports';
import { createInMemoryBridge } from '../tests/fakes/fake-bridge-port';
import {
  createPageRuntimeBridge,
  createWorkerRuntimeBridge,
  BRIDGE_REQUEST_TYPE,
  BRIDGE_RESPONSE_TYPE,
} from '../src/adapters/bridge/runtime-bridge';

const req = (id: string, payload: unknown = { url: 'x' }): BridgeRequest => ({
  requestId: id,
  payload,
});

describe('in-memory bridge (fake)', () => {
  let page: BridgePort;
  let worker: BridgePort;

  beforeEach(() => {
    const pair = createInMemoryBridge();
    page = pair.page;
    worker = pair.worker;
  });

  it('delivers a request to the worker handler with the exact payload', () => {
    const seen: BridgeRequest[] = [];
    worker.onRequest((r) => seen.push(r));

    page.send(req('r-1', { a: 1 }));

    expect(seen).toEqual([{ requestId: 'r-1', payload: { a: 1 } }]);
  });

  it('loops a response back to the page side under the same requestId', () => {
    const answered: Array<{ id: string; response: unknown }> = [];
    page.onResponse((id, response) => answered.push({ id, response }));
    worker.onRequest((r) => worker.respond(r.requestId, { ok: true, for: r.requestId }));

    page.send(req('r-2'));

    expect(answered).toEqual([{ id: 'r-2', response: { ok: true, for: 'r-2' } }]);
  });

  it('onRequest returns an off fn that stops delivery', () => {
    const seen: BridgeRequest[] = [];
    const off = worker.onRequest((r) => seen.push(r));
    off();
    off(); // idempotent

    page.send(req('r-3'));

    expect(seen).toEqual([]);
  });

  it('supports multiple concurrent requests with distinct correlation', () => {
    const answered: Array<{ id: string; response: unknown }> = [];
    page.onResponse((id, response) => answered.push({ id, response }));
    worker.onRequest((r) => worker.respond(r.requestId, `ack-${r.requestId}`));

    page.send(req('r-a'));
    page.send(req('r-b'));

    expect(answered).toEqual([
      { id: 'r-a', response: 'ack-r-a' },
      { id: 'r-b', response: 'ack-r-b' },
    ]);
  });
});

describe('runtime bridge adapters (chrome.runtime pair)', () => {
  type Listener = (message: any, sender: any, respond: (r?: any) => void) => unknown;
  let onMessageListeners: Listener[];
  let sent: Array<{ type: string; body: any }>;

  beforeEach(() => {
    vi.resetModules();
    onMessageListeners = [];
    sent = [];
    (globalThis as any).chrome = {
      ...(globalThis as any).chrome,
      runtime: {
        ...(globalThis as any).chrome?.runtime,
        sendMessage: vi.fn((msg: any) => {
          sent.push({ type: msg.type, body: msg });
          return true;
        }),
        onMessage: {
          addListener: vi.fn((l: Listener) => onMessageListeners.push(l)),
          removeListener: vi.fn((l: Listener) => {
            const i = onMessageListeners.indexOf(l);
            if (i >= 0) onMessageListeners.splice(i, 1);
          }),
        },
        lastError: undefined,
      },
    };
  });

  const dispatch = (message: any, respond: (r?: any) => void = vi.fn()) => {
    for (const l of onMessageListeners) l(message, {}, respond);
  };

  it('page bridge sends CQD_BRIDGE_REQUEST with the correlation id', () => {
    const page = createPageRuntimeBridge();
    page.onResponse(() => undefined);

    page.send(req('r-9', { url: 'https://x' }));

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe(BRIDGE_REQUEST_TYPE);
    expect(sent[0].body.requestId).toBe('r-9');
    expect(sent[0].body.payload).toEqual({ url: 'https://x' });
  });

  it('worker bridge receives requests and its respond() answers under CQD_BRIDGE_RESPONSE', () => {
    const worker = createWorkerRuntimeBridge();
    const seen: BridgeRequest[] = [];
    worker.onRequest((r) => {
      seen.push(r);
      worker.respond(r.requestId, { status: 'success' });
    });

    // Simulate the runtime delivering a request sent by the page bridge.
    dispatch({ type: BRIDGE_REQUEST_TYPE, requestId: 'r-7', payload: { a: 1 } });

    expect(seen).toEqual([{ requestId: 'r-7', payload: { a: 1 } }]);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe(BRIDGE_RESPONSE_TYPE);
    expect(sent[0].body.requestId).toBe('r-7');
    expect(sent[0].body.response).toEqual({ status: 'success' });
  });

  it('page bridge routes a CQD_BRIDGE_RESPONSE to its onResponse handler', () => {
    const page = createPageRuntimeBridge();
    const answered: Array<{ id: string; response: unknown }> = [];
    page.onResponse((id, response) => answered.push({ id, response }));

    dispatch({ type: BRIDGE_RESPONSE_TYPE, requestId: 'r-5', response: { status: 'error' } });

    expect(answered).toEqual([{ id: 'r-5', response: { status: 'error' } }]);
  });

  it('ignores foreign message types and off() stops the listener', () => {
    const page = createPageRuntimeBridge();
    const answered: unknown[] = [];
    const off = page.onResponse(() => answered.push(1));

    dispatch({ type: 'SOMETHING_ELSE' });
    off();
    dispatch({ type: BRIDGE_RESPONSE_TYPE, requestId: 'r-1', response: null });

    expect(answered).toEqual([]);
  });

  it('worker onRequest handler that throws does not break the runtime channel', () => {
    const worker = createWorkerRuntimeBridge();
    worker.onRequest(() => {
      throw new Error('boom');
    });

    expect(() =>
      dispatch({ type: BRIDGE_REQUEST_TYPE, requestId: 'r-8', payload: null }),
    ).not.toThrow();
  });
});

// ===========================================================================
// z57 — worker answers are TAB-directed. chrome.runtime.sendMessage from the
// MV3 worker does not reach content-script onMessage listeners, so a request
// whose sender carries a tab must be answered over chrome.tabs.sendMessage;
// extension-page requesters (no tab) keep the runtime broadcast.
// ===========================================================================
describe('runtime bridge worker: tab-directed responses (z57)', () => {
  type Listener = (message: any, sender: any, respond: (r?: any) => void) => unknown;
  let onMessageListeners: Listener[];
  let sent: Array<{ type: string; body: any }>;
  let tabSent: Array<{ tabId: number; body: any }>;

  beforeEach(() => {
    vi.resetModules();
    onMessageListeners = [];
    sent = [];
    tabSent = [];
    (globalThis as any).chrome = {
      ...(globalThis as any).chrome,
      runtime: {
        ...(globalThis as any).chrome?.runtime,
        id: 'ext',
        sendMessage: vi.fn((msg: any) => {
          sent.push({ type: msg.type, body: msg });
          return true;
        }),
        onMessage: {
          addListener: vi.fn((l: Listener) => onMessageListeners.push(l)),
          removeListener: vi.fn(),
        },
        lastError: undefined,
      },
      tabs: {
        sendMessage: vi.fn((tabId: number, msg: any) => {
          tabSent.push({ tabId, body: msg });
          return true;
        }),
      },
    };
  });

  const dispatch = (message: any, sender: any) => {
    for (const l of onMessageListeners) l(message, sender, vi.fn());
  };

  it('responds over tabs.sendMessage to the tab that sent the request', () => {
    const worker = createWorkerRuntimeBridge();
    worker.onRequest((r) => worker.respond(r.requestId, { status: 'saved' }));

    dispatch(
      { type: BRIDGE_REQUEST_TYPE, requestId: 'tab-1', payload: {} },
      { id: 'ext', tab: { id: 42 } },
    );

    expect(tabSent).toHaveLength(1);
    expect(tabSent[0].tabId).toBe(42);
    expect(tabSent[0].body.type).toBe(BRIDGE_RESPONSE_TYPE);
    expect(tabSent[0].body.requestId).toBe('tab-1');
    expect(sent).toHaveLength(0);
  });

  it('keeps the runtime broadcast for requesters without a tab', () => {
    const worker = createWorkerRuntimeBridge();
    worker.onRequest((r) => worker.respond(r.requestId, { status: 'saved' }));

    dispatch({ type: BRIDGE_REQUEST_TYPE, requestId: 'page-1', payload: {} }, { id: 'ext' });

    expect(tabSent).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.requestId).toBe('page-1');
  });

  it('forgets the tab after answering — a late duplicate answer falls back to runtime', () => {
    const worker = createWorkerRuntimeBridge();
    worker.onRequest((r) => {
      worker.respond(r.requestId, { status: 'saved' });
      worker.respond(r.requestId, { status: 'saved' });
    });

    dispatch(
      { type: BRIDGE_REQUEST_TYPE, requestId: 'tab-2', payload: {} },
      { id: 'ext', tab: { id: 7 } },
    );

    // First (correct) answer rides tabs; the tab entry is dropped afterwards
    // (one answer per request — the service guards double settles upstream),
    // so a late duplicate cannot re-message the tab.
    expect(tabSent).toHaveLength(1);
    expect(tabSent[0].tabId).toBe(7);
    expect(sent).toHaveLength(1); // duplicate went over the runtime broadcast
  });
});
