// extension/tests/v4-orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';

// Isolate the orchestrator singleton per test (established repo idiom).
// NOTE: paths are '../src/...' — this file lives in extension/tests/, so
// '../..' would escape the extension root and the mock would never apply.
// registryState lets the Task 6 cycle tests install a stub primary engine;
// with nothing installed the registry behaves exactly as before (no active
// engines, no primary), so the pre-existing tests below are unaffected.
const registryState = vi.hoisted(() => ({
  primary: null as Record<string, unknown> | null,
}));
vi.mock('../src/engines/engine-registry', () => ({
  engineRegistry: {
    getActiveEngines: vi.fn(() => (registryState.primary ? [registryState.primary] : [])),
    getEngine: vi.fn(() => null),
    getMode: vi.fn(() => 'legacy'),
    setModeChangeCallback: vi.fn(),
    getSummary: vi.fn(() => ''),
    getPrimaryEngine: vi.fn(() => registryState.primary),
  },
}));
vi.mock('../src/v2/context/route-classifier', () => ({
  RouteWatcher: class { start() {} stop() {} },
  isClassroomUrl: vi.fn((url: string) => url.includes('classroom.google.com')),
}));
vi.mock('../src/v2/compat/shadow-compare', () => ({ ShadowComparator: class {} }));

import { Orchestrator } from '../src/v2/orchestrator/orchestrator';
import { ViewKind } from '../src/engines/types';
import { getPageDomPort } from '../src/adapters/dom/mutation-observer-dom-port';

describe('Orchestrator page bus (S5)', () => {
  it('exposes a page bus and publishes route:changed for an accepted view', async () => {
    const o = new Orchestrator();
    o.start();
    const bus = o.getBus();
    const seen: Array<{ view: ViewKind; url: string }> = [];
    bus.subscribe('route:changed', (p) => seen.push(p));
    // Reach into the private lifecycle through the mode-change callback the
    // registry captured — the same path production navigation uses.
    // (Alternative: call (o as any).handleViewChange(...) — allowed, test-only.)
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/a/not-in-any-class');
    expect(seen).toEqual([{ view: ViewKind.STREAM, url: 'https://classroom.google.com/u/0/a/not-in-any-class' }]);
  });

  it('does NOT publish route:changed for rejected views', async () => {
    const o = new Orchestrator();
    o.start();
    const seen: unknown[] = [];
    o.getBus().subscribe('route:changed', (p) => seen.push(p));
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.UNKNOWN, null, 'https://example.com');
    expect(seen).toEqual([]);
  });
});

// ===========================================================================
// S5 Task 6 — the orchestrator publishes every scan cycle through the roles
// ===========================================================================

import { beforeEach, afterEach } from 'vitest';

/**
 * Captures the callback the orchestrator hands to `new MutationObserver` so
 * tests can drive scan cycles directly. Swapped in per-test with
 * vi.stubGlobal — the orchestrator resolves the global at setupDomObserver()
 * time, so no import-order tricks are needed.
 */
class CapturingMutationObserver {
  static callbacks: MutationCallback[] = [];
  /** S10: construction counter — the single-observer gate counts instantiations. */
  static instances: CapturingMutationObserver[] = [];
  observing = true;
  observe(): void {}
  disconnect(): void {
    this.observing = false;
  }
  takeRecords(): MutationRecord[] {
    return [];
  }
  constructor(cb: MutationCallback) {
    CapturingMutationObserver.callbacks.push(cb);
    CapturingMutationObserver.instances.push(this);
  }
}

/** A minimal-but-shaped MutationRecord; the callback only forwards it. */
function makeMutationRecords(): MutationRecord[] {
  return [
    {
      type: 'childList',
      target: document.body,
      addedNodes: [] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
    },
  ];
}

/**
 * Fixtures for a V2-shaped stub engine: full CQDEngine surface plus all
 * three S5 additive getters. The arrays are hoisted so tests can pin the
 * verbatim-reference payload contract with toBe().
 */
function makeV2ShapeFixtures() {
  const fileNode = {
    canonicalId: 'drive-file-1',
    name: 'slides.pdf',
    ext: 'pdf',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-1',
    element: document.createElement('a'),
    idSource: 'data-drive-id' as const,
  };
  const post = {
    id: 'p1',
    element: document.createElement('div'),
    viewKind: ViewKind.STREAM,
    files: [fileNode],
    flags: null,
    lastScannedAt: 0,
  };
  const posts = [post];
  const flagDecisions = [
    {
      postId: 'p1',
      commentScore: 0,
      editedScore: 0,
      commentCount: null,
      editedDiff: null,
      exclusionPenalties: [],
      finalVerdict: 'none' as const,
      confidence: 'high' as const,
      trace: {
        postId: 'p1',
        timestamp: 0,
        viewKind: ViewKind.STREAM,
        layers: [],
        exclusions: [],
        finalScore: 0,
        duration_ms: 0,
      },
    },
  ];
  const placementDecisions = [
    {
      fileId: 'drive-file-1',
      targetElement: document.createElement('div'),
      insertionPoint: 'append' as const,
      anchorSelector: 'div',
      confidence: 90,
      reasonCodes: [],
      fallbackUsed: false,
    },
  ];
  const renderApplied = [{ postId: 'p1', kind: 'button' as const }];

  let throttleLevel: 'normal' | 'elevated' = 'normal';
  return {
    posts,
    flagDecisions,
    placementDecisions,
    renderApplied,
    setThrottle(level: 'normal' | 'elevated') {
      throttleLevel = level;
    },
    stub: {
      name: 'stub-engine-v2',
      version: '0.0.0-test',
      init: vi.fn(async () => {}),
      destroy: vi.fn(),
      handleMutations: vi.fn(),
      fullScan: vi.fn(),
      getTrackedPosts: vi.fn(() => posts),
      getFlagDecisions: vi.fn(() => flagDecisions),
      getPlacementDecisions: vi.fn(() => placementDecisions),
      getDecisionTrace: vi.fn(() => null),
      getLastRenderApplied: vi.fn(() => renderApplied),
      getBudgetSnapshot: vi.fn(() => ({
        fastPassAvg_ms: 1,
        fastPassP95_ms: 2,
        cpuPerSecond_ms: 3,
        postCount: 1,
        injectedElementCount: 1,
        currentDebounce_ms: 50,
        throttleLevel,
        violations: [],
        hardCapHit: false,
      })),
      getCorrectionStats: vi.fn(() => ({
        pending: 0,
        processed: 0,
        failed: 0,
        unstableSkipped: 0,
        historySize: 0,
        byPriority: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      })),
    },
  };
}

type LogEntry = { topic: string; payload: unknown };

/** Subscribe one recorder to every page topic, pushing into a shared log. */
function recordAllTopics(bus: ReturnType<Orchestrator['getBus']>, log: LogEntry[]): void {
  const topics = [
    'route:changed',
    'post:scanned',
    'file:discovered',
    'decision:flags',
    'decision:placement',
    'render:applied',
    'correction:needed',
    'budget:throttle',
    'download:requested',
    'download:progress',
    'download:settled',
  ] as const;
  for (const topic of topics) {
    bus.subscribe(topic, (payload) => {
      log.push({ topic, payload });
    });
  }
}

/** Drive one accepted view change and return the captured observer callback. */
async function startWithStub(o: Orchestrator): Promise<MutationCallback> {
  await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
    .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/c/test-class');
  const cb =
    CapturingMutationObserver.callbacks[CapturingMutationObserver.callbacks.length - 1];
  expect(cb).toBeDefined();
  return cb;
}

describe('Orchestrator cycle publishing (S5 Task 6)', () => {
  let log: LogEntry[];

  beforeEach(() => {
    CapturingMutationObserver.callbacks.length = 0;
    registryState.primary = null;
    log = [];
    vi.stubGlobal('MutationObserver', CapturingMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    registryState.primary = null;
  });

  it('publishes every scan cycle through the four roles in order render → detect → compute → harden', async () => {
    const f = makeV2ShapeFixtures();
    registryState.primary = f.stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const drive = await startWithStub(o);
    recordAllTopics(o.getBus(), log);

    // Cycle 1 — harden establishes its baseline and is silent by contract.
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(log.map((e) => e.topic)).toEqual([
      'render:applied',
      'post:scanned',
      'file:discovered',
      'decision:flags',
      'decision:placement',
    ]);

    // Cycle 2 — throttle level changes: budget:throttle publishes, last.
    log.length = 0;
    f.setThrottle('elevated');
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(log.map((e) => e.topic)).toEqual([
      'render:applied',
      'post:scanned',
      'file:discovered',
      'decision:flags',
      'decision:placement',
      'budget:throttle',
    ]);

    // Exact payloads, carried verbatim from the primary engine.
    const byTopic = (t: string) => log.filter((e) => e.topic === t).map((e) => e.payload);
    expect(byTopic('render:applied')[0]).toBe(f.renderApplied[0]); // same object
    const scanned = byTopic('post:scanned')[0] as { posts: unknown[] };
    expect(scanned.posts[0]).toBe(f.posts[0]); // verbatim reference, not a copy
    const discovered = byTopic('file:discovered')[0] as { postId: string; files: unknown[] };
    expect(discovered.postId).toBe('p1');
    expect(discovered.files).toEqual([
      {
        fileId: 'drive-file-1',
        url: 'https://drive.google.com/uc?export=download&id=drive-file-1',
        ext: 'pdf',
        name: 'slides.pdf',
      },
    ]);
    const flags = byTopic('decision:flags')[0] as { decisions: unknown[] };
    expect(flags.decisions[0]).toBe(f.flagDecisions[0]); // verbatim reference
    const placements = byTopic('decision:placement')[0] as { decisions: unknown[] };
    expect(placements.decisions[0]).toBe(f.placementDecisions[0]); // verbatim reference
    expect(byTopic('budget:throttle')).toEqual([{ level: 'elevated' }]);
    expect(byTopic('correction:needed')).toEqual([]); // event-triggered, never polled

    o.stop();
  });

  it('with a V1-shaped primary (no render/harden getters), only post:scanned + decision topics publish and nothing throws', async () => {
    const v1Post = {
      id: 'v1-post',
      element: document.createElement('div'),
      viewKind: ViewKind.STREAM,
      files: [], // live DOM query over a bare jsdom body — no files
      flags: null,
      lastScannedAt: 0,
    };
    const v1Stub = {
      name: 'stub-engine-v1',
      version: '0.0.0-test',
      init: vi.fn(async () => {}),
      destroy: vi.fn(),
      handleMutations: vi.fn(),
      fullScan: vi.fn(),
      getTrackedPosts: vi.fn(() => [v1Post]),
      getFlagDecisions: vi.fn(() => []),
      getPlacementDecisions: vi.fn(() => []),
      getDecisionTrace: vi.fn(() => null),
      // EngineV1 has NO getLastRenderApplied / getBudgetSnapshot / getCorrectionStats.
    };
    registryState.primary = v1Stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const drive = await startWithStub(o);
    recordAllTopics(o.getBus(), log);

    expect(() => drive(makeMutationRecords(), {} as MutationObserver)).not.toThrow();
    expect(log.map((e) => e.topic)).toEqual(['post:scanned', 'decision:flags', 'decision:placement']);
    const scanned = log[0].payload as { posts: unknown[] };
    expect(scanned.posts[0]).toBe(v1Post);

    o.stop();
  });
});

// ===========================================================================
// S5 final-review fix wave — the correction hook is actually wired, and the
// throttle baseline survives engine swaps
// ===========================================================================

/**
 * The REAL CorrectionItem the engine's hook receives — deep-validator's
 * richer shape (v2/repair/deep-validator.ts), not the page-topic mirror.
 * Type-only import: erased at runtime, so the module mocks above are
 * untouched and the real module is never loaded.
 */
import type { CorrectionItem as DeepCorrectionItem } from '../src/v2/repair/deep-validator';

describe('Orchestrator correction wiring + throttle baseline (S5 final-review fix)', () => {
  let log: LogEntry[];

  beforeEach(() => {
    CapturingMutationObserver.callbacks.length = 0;
    registryState.primary = null;
    log = [];
    vi.stubGlobal('MutationObserver', CapturingMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    registryState.primary = null;
  });

  it('wires the primary engine\'s onCorrectionSeen hook to the harden role — invoking it publishes correction:needed exactly once, verbatim', async () => {
    const f = makeV2ShapeFixtures();
    // Mirror a real EngineV2 instance: the hook is a DECLARED class field,
    // present on the object but undefined until the orchestrator assigns it.
    const stub: typeof f.stub & {
      onCorrectionSeen?: (item: DeepCorrectionItem) => void;
    } = { ...f.stub, onCorrectionSeen: undefined };
    registryState.primary = stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const drive = await startWithStub(o);
    recordAllTopics(o.getBus(), log);

    // Cycle 1 — publishCycleTopics runs and wires the hook on the stub (it
    // also establishes the harden throttle baseline). No corrections yet.
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(log.filter((e) => e.topic === 'correction:needed')).toEqual([]);

    // Engine-shaped CorrectionItem, per deep-validator's real shape. The
    // engine hands this to the wired hook during handleCorrection; here we
    // play the engine's side.
    const item: DeepCorrectionItem = {
      id: 'corr-1',
      op: 'inject-button',
      priority: 'HIGH',
      postId: 'p1',
      element: document.createElement('button'),
      reason: 'button missing after render',
      detectedAt: 1234,
      retryCount: 0,
    };
    stub.onCorrectionSeen?.(item);

    // Exactly one 'correction:needed', wrapping the item VERBATIM (same
    // object reference — no copy, no reshape; harden's payload contract).
    const corrections = log.filter((e) => e.topic === 'correction:needed');
    expect(corrections).toHaveLength(1);
    const payload = corrections[0].payload as { item: DeepCorrectionItem };
    expect(Object.keys(payload)).toEqual(['item']);
    expect(payload.item).toBe(item);

    o.stop();
  });

  it('keeps the throttle baseline across an engine swap — elevated → swap → elevated stays silent, then normal publishes once', async () => {
    const first = makeV2ShapeFixtures();
    const second = makeV2ShapeFixtures();
    // Both engines report 'elevated' — the point is that the BASELINE (not
    // the engine instance) decides silence across the swap.
    first.setThrottle('elevated');
    second.setThrottle('elevated');
    registryState.primary = first.stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const drive = await startWithStub(o);
    recordAllTopics(o.getBus(), log);
    const throttleEvents = () =>
      log.filter((e) => e.topic === 'budget:throttle').map((e) => e.payload);

    // Cycle 1 — first primary establishes the baseline at 'elevated' (silent
    // by contract).
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(throttleEvents()).toEqual([]);

    // Engine swap. The roles were built once in start() and resolve the
    // primary lazily per cycle, so the HardenEngine instance — and its
    // baseline — survive the swap ("effective level" semantics, intended).
    registryState.primary = second.stub as unknown as Record<string, unknown>;

    // Cycle 2 — swapped-in engine ALSO reports elevated: baseline persists,
    // nothing publishes.
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(throttleEvents()).toEqual([]);

    // Cycle 3 — swapped-in engine drops to normal: exactly one edge event.
    second.setThrottle('normal');
    drive(makeMutationRecords(), {} as MutationObserver);
    expect(throttleEvents()).toEqual([{ level: 'normal' }]);

    o.stop();
  });
});

// ===========================================================================
// S10 Task 2 — the orchestrator's dom observer rides the SHARED page port
// ===========================================================================

describe('Orchestrator observes through the shared page port (S10)', () => {
  beforeEach(() => {
    CapturingMutationObserver.callbacks.length = 0;
    CapturingMutationObserver.instances.length = 0;
    registryState.primary = null;
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
    vi.stubGlobal('MutationObserver', CapturingMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    registryState.primary = null;
    delete (window as { __cqdDomPort?: unknown }).__cqdDomPort;
  });

  it('subscribes once through the page port; page aborts unsubscribe (never dispose); stop() disposes', async () => {
    const f = makeV2ShapeFixtures();
    registryState.primary = f.stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const port = getPageDomPort();

    // Accepted view → exactly ONE dom subscription and ONE observer construction.
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/c/test-class');
    expect(port.subscriptionCount).toBe(1);
    expect(CapturingMutationObserver.instances).toHaveLength(1);

    // A second page (abortCurrentPage path) unsubscribes + resubscribes —
    // the shared port is NOT disposed, and the platform observer is revived,
    // never reconstructed.
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/c/test-class-2');
    expect(port.subscriptionCount).toBe(1);
    expect(CapturingMutationObserver.instances).toHaveLength(1);

    // Scan cycles still flow through the port's dispatch to the engines.
    const drive = CapturingMutationObserver.callbacks[CapturingMutationObserver.callbacks.length - 1]!;
    expect(() => drive(makeMutationRecords(), {} as MutationObserver)).not.toThrow();
    expect(f.stub.handleMutations).toHaveBeenCalledWith(makeMutationRecords());

    // stop() is the only place that disposes the shared port.
    o.stop();
    expect(port.subscriptionCount).toBe(0);
    expect(CapturingMutationObserver.instances[0]!.observing).toBe(false);
  });

  it('mutations delivered through the port publish the same S5 cycle topics (behavior parity)', async () => {
    const f = makeV2ShapeFixtures();
    registryState.primary = f.stub as unknown as Record<string, unknown>;

    const o = new Orchestrator();
    o.start();
    const drive = await startWithStub(o);
    const log: LogEntry[] = [];
    recordAllTopics(o.getBus(), log);

    drive(makeMutationRecords(), {} as MutationObserver);

    expect(log.map((e) => e.topic)).toEqual([
      'render:applied',
      'post:scanned',
      'file:discovered',
      'decision:flags',
      'decision:placement',
    ]);

    o.stop();
  });
});
