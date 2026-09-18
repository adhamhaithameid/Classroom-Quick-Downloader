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
import { RouteWatcher } from '../src/v2/context/route-classifier';
import { Orchestrator } from '../src/v2/orchestrator/orchestrator';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import { engineRegistry } from '../src/engines/engine-registry';
import { ViewKind, type CQDEngine } from '../src/engines/types';

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
      characterData: true,
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

  it('a throwing subscription never starves its siblings in the same batch', () => {
    const port = new MutationObserverDomPort(document);
    const seen: MutationRecord[][] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    port.observe({ childList: true }, () => {
      throw new Error('subscriber A exploded');
    });
    port.observe({ childList: true }, (m) => seen.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    // The dispatch loop survives A's exception; B receives the SAME batch.
    expect(() => observer.emit([{ type: 'childList' }])).not.toThrow();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.length).toBe(1);

    // The failure is not silent (codebase idiom: prefixed console.warn)…
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();

    // …and later batches still reach BOTH subscriptions — A stays subscribed.
    observer.emit([{ type: 'childList' }]);
    expect(seen).toHaveLength(2);
    expect(port.subscriptionCount).toBe(2);
  });

  it('a throwing subscription does not block unsubscriptions made earlier in the batch', () => {
    // Ordering case: the throwing subscriber runs FIRST in Map insertion
    // order, and the healthy one after it must still run (the pre-fix bug
    // starves every subscription after the thrower for that batch).
    const port = new MutationObserverDomPort(document);
    const healthy: MutationRecord[][] = [];
    port.observe({ childList: true }, () => {
      throw new Error('first subscriber exploded');
    });
    port.observe({ childList: true }, (m) => healthy.push(m));
    const observer = FakeMutationObserver.instances[0]!;

    observer.emit([{ type: 'childList' }]);
    expect(healthy).toHaveLength(1);
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

// ===========================================================================
// S10 Task 5 — the adapter qa probe surface
// ===========================================================================

describe('S10: adapter observerCreatedCount + disposed probe getters', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('observerCreatedCount is a monotonic count of platform constructions', () => {
    const port = new MutationObserverDomPort(document);
    expect(port.observerCreatedCount).toBe(0);

    const off = port.observe({ childList: true }, () => {});
    expect(port.observerCreatedCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    // Unsubscribe (even the last one) never rebuilds — disconnect is reuse.
    off();
    expect(port.observerCreatedCount).toBe(1);

    // Only an owner dispose() + revival constructs a second observer.
    port.dispose();
    port.observe({ childList: true }, () => {});
    expect(port.observerCreatedCount).toBe(2);
    expect(FakeMutationObserver.instances).toHaveLength(2);
    port.dispose();
  });

  it('disposed flips true on dispose() and false again when observe revives', () => {
    const port = new MutationObserverDomPort(document);
    expect(port.disposed).toBe(false);

    port.observe({ childList: true }, () => {});
    expect(port.disposed).toBe(false);

    port.dispose();
    expect(port.disposed).toBe(true);

    port.observe({ childList: true }, () => {});
    expect(port.disposed).toBe(false);
    port.dispose();
  });
});

describe('S10: window.__cqdDomPortInfo — the page singleton qa probe', () => {
  type PortInfo = {
    subscriptionCount: () => number;
    observerCreatedCount: () => number;
    disposed: () => boolean;
  };
  const infoOf = () => (window as unknown as { __cqdDomPortInfo?: PortInfo }).__cqdDomPortInfo;

  beforeEach(() => {
    FakeMutationObserver.instances = [];
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    delete (window as { __cqdDomPortInfo?: unknown }).__cqdDomPortInfo;
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (window as unknown as { __cqdDomPort?: MutationObserverDomPort }).__cqdDomPort?.dispose();
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    delete (window as { __cqdDomPortInfo?: unknown }).__cqdDomPortInfo;
  });

  it('exposes live subscription/created/disposed state of the page port', () => {
    const port = getPageDomPort();
    const info = infoOf();
    expect(info).toBeDefined();

    expect(info!.subscriptionCount()).toBe(0);
    expect(info!.observerCreatedCount()).toBe(0);
    expect(info!.disposed()).toBe(false);

    const off = port.observe({ childList: true }, () => {});
    expect(info!.subscriptionCount()).toBe(1);
    expect(info!.observerCreatedCount()).toBe(1);

    off();
    expect(info!.subscriptionCount()).toBe(0);

    port.dispose();
    expect(info!.disposed()).toBe(true);
  });

  it('registers the info once — repeated getPageDomPort calls keep it stable', () => {
    getPageDomPort();
    const first = infoOf();
    getPageDomPort();
    expect(infoOf()).toBe(first);
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

// ===========================================================================
// S10 Task 2 — the v2 stack rides the shared page port
// ===========================================================================

/** jsdom's default document may lack a <title>; RouteWatcher guards on it. */
function ensureTitleElement(): void {
  if (!document.querySelector('title')) {
    document.head.appendChild(document.createElement('title'));
  }
}

function appendStreamPost(id: string): void {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', id);
  document.body.appendChild(post);
}

/** Immediate-resolving engine so handleViewChange reaches setupDomObserver. */
function makeInstantEngine(name = 'engine-v2'): CQDEngine {
  return {
    name,
    version: '0.0.0-s10-test',
    init: vi.fn(async () => {}),
    destroy: vi.fn(),
    handleMutations: vi.fn(),
    fullScan: vi.fn(),
    getTrackedPosts: vi.fn(() => []),
    getFlagDecisions: vi.fn(() => []),
    getPlacementDecisions: vi.fn(() => []),
    getDecisionTrace: vi.fn(() => null),
  } as unknown as CQDEngine;
}

describe('S10: EngineV2 waitForContentReady rides the shared page port', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    ensureTitleElement();
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
  });

  it('subscribes through the port while waiting and unsubscribes on ready', async () => {
    const port = getPageDomPort();
    const engine = new EngineV2();

    // init() is synchronous up to waitForContentReady — the transient
    // subscription is live by the time init returns its pending promise.
    const initPromise = engine.init(ViewKind.STREAM, new AbortController().signal);
    expect(port.subscriptionCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    // Content arrives → one childList batch through the ONE observer
    // resolves the wait and removes the transient subscription.
    appendStreamPost('s10-ready-post');
    FakeMutationObserver.instances[0]!.emit([{ type: 'childList' }]);
    await initPromise;

    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances).toHaveLength(1);
  });

  it('the abort path owns the unsubscribe: aborting the page signal removes the transient', async () => {
    const port = getPageDomPort();
    const controller = new AbortController();
    const engine = new EngineV2();

    const initPromise = engine.init(ViewKind.STREAM, controller.signal);
    expect(port.subscriptionCount).toBe(1);

    controller.abort();
    await initPromise;

    expect(port.subscriptionCount).toBe(0);
  });
});

describe('S10: the v2 stack shares ONE page observer end to end', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    ensureTitleElement();
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    engineRegistry.unregister('engine-v2');
    engineRegistry.setMode('legacy');
  });

  it('a default-mode page: orchestrator dom + RouteWatcher title + engine transient over exactly ONE observer', async () => {
    const port = getPageDomPort();
    engineRegistry.register(new EngineV2());
    engineRegistry.setMode('v2');

    const o = new Orchestrator();
    o.start();
    // RouteWatcher's <title> fallback is the first port subscription.
    expect(port.subscriptionCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    const hvc = (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/c/test-class');
    // engine-v2's waitForContentReady adds the transient during init…
    expect(port.subscriptionCount).toBe(2);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    // …content arrives, the transient returns to baseline…
    appendStreamPost('s10-e2e-post');
    FakeMutationObserver.instances[0]!.emit([{ type: 'childList' }]);
    await hvc;

    // …and the orchestrator's dom subscription takes its place. Still ONE
    // platform observer for domObserver + title + content-ready combined.
    expect(port.subscriptionCount).toBe(2);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    o.stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.observing).toBe(false);
  });

  it('RouteWatcher stop() removes only its title subscription; the observer stays alive for the orchestrator', async () => {
    const port = getPageDomPort();
    engineRegistry.register(makeInstantEngine());
    engineRegistry.setMode('v2');

    const o = new Orchestrator();
    o.start();
    expect(port.subscriptionCount).toBe(1); // title fallback

    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/c/test-class');
    expect(port.subscriptionCount).toBe(2); // + orchestrator dom

    // A second RouteWatcher (e.g. the next orchestrator generation) adds
    // its own title subscription, and stopping it must not touch anything else.
    const watcher = new RouteWatcher(vi.fn());
    watcher.start();
    expect(port.subscriptionCount).toBe(3);

    watcher.stop();
    expect(port.subscriptionCount).toBe(2);
    expect(FakeMutationObserver.instances[0]!.observing).toBe(true);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    o.stop();
  });
});
