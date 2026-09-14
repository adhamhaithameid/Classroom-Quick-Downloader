// filepath: extension/tests/v4-single-observer.test.ts
/**
 * Engine V4 S10 fitness — the DomPort multiplexer: ONE real MutationObserver
 * per DomPort instance serves N subscriptions, with per-subscription batch
 * filtering done at dispatch (attributeFilter lives with the subscribers,
 * never with the platform observer). Later S10 tasks append here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DomPort } from '../src/contracts/ports';
import {
  MutationObserverDomPort,
  createMutationObserverDomPort,
  getPageDomPort,
} from '../src/adapters/dom/mutation-observer-dom-port';

type MutationCallback = (mutations: MutationRecord[]) => void;

/** Fill a partial record into the full shape the port callbacks receive. */
function asRecord(partial: Partial<MutationRecord>): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: [],
    removedNodes: [],
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
    ...partial,
  } as MutationRecord;
}

/**
 * Platform MutationObserver stand-in: records constructions, observe/disconnect
 * calls, and lets tests push batches through the real multiplexer dispatch.
 */
class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];

  callback: MutationCallback;
  observedTarget: Node | null = null;
  observedInit: MutationObserverInit | null = null;
  observing = false;
  disconnectCount = 0;

  constructor(callback: MutationCallback) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(target: Node, init: MutationObserverInit): void {
    this.observedTarget = target;
    this.observedInit = init;
    this.observing = true;
  }

  disconnect(): void {
    this.disconnectCount += 1;
    this.observing = false;
  }

  /** Deliver a batch of synthetic records through the multiplexer. */
  emit(parts: Array<Partial<MutationRecord>>): void {
    this.callback(parts.map(asRecord));
  }

  /** Deliver an exact pre-built batch (identity preserved end to end). */
  emitRecords(records: MutationRecord[]): void {
    this.callback(records);
  }
}

describe('DomPort multiplexer: one observer, many subscriptions', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates exactly ONE MutationObserver for any number of subscriptions', () => {
    const port = new MutationObserverDomPort(document);
    // Lazy: nothing is constructed until the first observe().
    expect(FakeMutationObserver.instances).toHaveLength(0);

    port.observe({ childList: true, subtree: true }, () => {});
    port.observe({ attributes: true, attributeFilter: ['class'] }, () => {});
    port.observe({ childList: true }, () => {});
    port.observe({}, () => {});

    expect(FakeMutationObserver.instances).toHaveLength(1);
  });

  it('observes the port document with the documented superset init', () => {
    const port = new MutationObserverDomPort(document);
    port.observe({ attributes: true, attributeFilter: ['href'] }, () => {});

    const observer = FakeMutationObserver.instances[0]!;
    expect(observer.observing).toBe(true);
    expect(observer.observedTarget).toBe(document);
    expect(observer.observedInit).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
    });
    // attributeFilter stays out of the observer level so every attribute
    // record flows in; narrowing is per subscription at dispatch.
    expect(observer.observedInit?.attributeFilter).toBeUndefined();
  });

  it('does not deliver childList-only batches to attribute-filtered subscriptions', () => {
    const port = new MutationObserverDomPort(document);
    const attrSeen: MutationRecord[][] = [];
    const childSeen: MutationRecord[][] = [];
    port.observe({ attributes: true, attributeFilter: ['class'] }, (m) => attrSeen.push(m));
    port.observe({ childList: true, subtree: true }, (m) => childSeen.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    observer.emit([{ type: 'childList' }, { type: 'childList' }]);
    expect(attrSeen).toHaveLength(0);
    expect(childSeen).toHaveLength(1);
  });

  it('does not deliver attribute-only batches to childList subscriptions', () => {
    const port = new MutationObserverDomPort(document);
    const attrSeen: MutationRecord[][] = [];
    const childSeen: MutationRecord[][] = [];
    port.observe({ attributes: true, attributeFilter: ['class'] }, (m) => attrSeen.push(m));
    port.observe({ childList: true, subtree: true }, (m) => childSeen.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    observer.emit([{ type: 'attributes', attributeName: 'style' }]);
    // style ∉ [class] → the filtered subscription stays silent too.
    expect(attrSeen).toHaveLength(0);
    expect(childSeen).toHaveLength(0);
  });

  it('delivers the FULL batch, unchanged, to a subscription whose filter matches', () => {
    const port = new MutationObserverDomPort(document);
    const attrSeen: MutationRecord[][] = [];
    port.observe({ attributes: true, attributeFilter: ['class'] }, (m) => attrSeen.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    const batch: MutationRecord[] = [
      asRecord({ type: 'childList' }),
      asRecord({ type: 'attributes', attributeName: 'class' }),
    ];
    observer.emitRecords(batch);

    // Not a narrowed subset: the exact batch array the observer saw.
    expect(attrSeen).toHaveLength(1);
    expect(attrSeen[0]).toBe(batch);
  });

  it('subscribers with neither childList nor attributes receive every batch', () => {
    const port = new MutationObserverDomPort(document);
    const seen: MutationRecord[][] = [];
    port.observe({}, (m) => seen.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    observer.emit([{ type: 'childList' }]);
    observer.emit([{ type: 'attributes', attributeName: 'data-anything' }]);
    expect(seen).toHaveLength(2);
  });

  it('unsubscribes only that callback and leaves the other live', () => {
    const port = new MutationObserverDomPort(document);
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = port.observe({ childList: true }, first);
    port.observe({ childList: true }, second);
    const observer = FakeMutationObserver.instances[0]!;

    offFirst();
    offFirst(); // idempotent
    observer.emit([{ type: 'childList' }]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(port.subscriptionCount).toBe(1);
    // The shared observer survives while a subscription remains.
    expect(observer.observing).toBe(true);
  });

  it('disconnects the real observer on the LAST unsubscribe; re-observe revives it', () => {
    const port = new MutationObserverDomPort(document);
    const offA = port.observe({ childList: true }, () => {});
    const offB = port.observe({ attributes: true, attributeFilter: ['class'] }, () => {});
    const observer = FakeMutationObserver.instances[0]!;

    offA();
    expect(observer.observing).toBe(true); // B still subscribed
    offB();
    expect(observer.observing).toBe(false);
    expect(observer.disconnectCount).toBe(1);

    // Re-observe revives the SAME observer — never a second construction.
    port.observe({ childList: true }, () => {});
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(observer.observing).toBe(true);
  });

  it('tracks subscriptionCount for the qa probe', () => {
    const port = new MutationObserverDomPort(document);
    expect(port.subscriptionCount).toBe(0);
    const off = port.observe({ childList: true }, () => {});
    expect(port.subscriptionCount).toBe(1);
    off();
    expect(port.subscriptionCount).toBe(0);
  });

  it('dispose() disconnects and clears everything; observe afterwards starts clean', () => {
    const port = new MutationObserverDomPort(document);
    port.observe({ childList: true }, () => {});
    port.observe({ attributes: true, attributeFilter: ['class'] }, () => {});
    const observer = FakeMutationObserver.instances[0]!;

    port.dispose();
    expect(observer.observing).toBe(false);
    expect(port.subscriptionCount).toBe(0);

    // Owner teardown dropped the observer; a post-dispose subscribe builds a
    // fresh one rather than talking to the disposed instance.
    port.observe({ childList: true }, () => {});
    expect(FakeMutationObserver.instances).toHaveLength(2);
    expect(FakeMutationObserver.instances[1]!.observing).toBe(true);
  });

  it('stale unsubscribe handles after dispose() are inert no-ops', () => {
    const port = new MutationObserverDomPort(document);
    const off = port.observe({ childList: true }, () => {});
    port.dispose();

    expect(() => off()).not.toThrow();
    expect(port.subscriptionCount).toBe(0);
  });

  it('the createMutationObserverDomPort factory still satisfies the DomPort contract', () => {
    const port: DomPort = createMutationObserverDomPort(document);
    expect(port.querySelectorAll('body')).toHaveLength(1);
  });
});

describe('getPageDomPort per-page singleton', () => {
  beforeEach(() => {
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
  });

  afterEach(() => {
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
  });

  it('returns the same MutationObserverDomPort instance on repeated calls', () => {
    const first = getPageDomPort();
    const second = getPageDomPort();

    expect(second).toBe(first);
    expect(first).toBeInstanceOf(MutationObserverDomPort);
    expect((window as { __cqdDomPort?: unknown }).__cqdDomPort).toBe(first);
    // The singleton serves THE page document.
    expect(first.document).toBe(window.document);
  });
});

describe('multiplexer over the real platform observer', () => {
  beforeEach(() => {
    // The global setup fakes timers; mutation delivery needs the real event loop.
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
  });

  it('delivers real childList mutations and revives after unsubscribe + re-observe', async () => {
    const port = new MutationObserverDomPort(document);
    const seen: MutationRecord[][] = [];
    const off = port.observe({ childList: true, subtree: true }, (m) => seen.push(m));

    document.body.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.length).toBeGreaterThan(0);

    // Last unsubscribe disconnects; a later subscribe delivers again.
    off();
    const revived: MutationRecord[][] = [];
    port.observe({ childList: true }, (m) => revived.push(m));
    document.body.appendChild(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revived).toHaveLength(1);

    port.dispose();
  });

  it('does not deliver real childList mutations to an attribute-filtered subscription', async () => {
    const port = new MutationObserverDomPort(document);
    const attrSeen: MutationRecord[][] = [];
    const off = port.observe(
      { attributes: true, attributeFilter: ['class'] },
      (m) => attrSeen.push(m),
    );

    document.body.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(attrSeen).toHaveLength(0);

    off();
    port.dispose();
  });
});
