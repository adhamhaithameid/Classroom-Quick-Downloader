// extension/tests/v4-roles.test.ts
//
// Role-module tests for S5 "roles behind the bus" (design §4).
// One describe block per role; new roles append below.
import { describe, it, expect, vi } from 'vitest';
import { beforeEach } from 'vitest';

import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { ViewKind, type PostNode, type FileNode, type FlagDecision, type PlacementDecision } from '../src/engines/types';
import { DetectEngine, type DetectSource } from '../src/roles/detect-engine';
import { ComputeEngine, type ComputeSource } from '../src/roles/compute-engine';
import { RenderEngine, type RenderSource } from '../src/roles/render-engine';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import { engineRegistry } from '../src/engines/engine-registry';

// ---------------------------------------------------------------------------
// Fixtures — shapes pinned to src/engines/types.ts (PostNode / FileNode)
// ---------------------------------------------------------------------------

function makeFileNode(overrides: Partial<FileNode> = {}): FileNode {
  return {
    canonicalId: 'drive-file-1',
    name: 'slides.pdf',
    ext: 'pdf',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-file-1',
    element: document.createElement('a'),
    idSource: 'data-drive-id',
    ...overrides,
  };
}

function makePost(id: string, files: FileNode[], overrides: Partial<PostNode> = {}): PostNode {
  return {
    id,
    element: document.createElement('div'),
    viewKind: ViewKind.STREAM,
    files,
    flags: null,
    lastScannedAt: 0,
    ...overrides,
  };
}

function makeSource(posts: PostNode[]): DetectSource {
  return { getTrackedPosts: vi.fn(() => posts) };
}

describe('DetectEngine role (S5)', () => {
  it("publishes 'post:scanned' with the source's tracked posts array verbatim (same reference)", () => {
    const posts = [makePost('p1', [makeFileNode()])];
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['post:scanned'][] = [];
    bus.subscribe('post:scanned', (p) => seen.push(p));

    new DetectEngine(bus, makeSource(posts)).onScanComplete();

    expect(seen).toHaveLength(1);
    expect(seen[0].posts).toBe(posts); // read VERBATIM — not copied, not reshaped
  });

  it("publishes one 'file:discovered' per post that has files, mapping FileNode to the FileRef payload", () => {
    const posts = [
      makePost('p1', [
        makeFileNode({
          canonicalId: 'file-a',
          name: 'a.pdf',
          ext: 'pdf',
          downloadUrl: 'https://example.com/a',
          idSource: 'url-parse',
        }),
        makeFileNode({
          canonicalId: 'file-b',
          name: 'b.doc',
          ext: 'doc',
          downloadUrl: 'https://example.com/b',
          idSource: 'data-id-combo',
        }),
      ]),
      makePost('p2', [
        makeFileNode({
          canonicalId: 'file-c',
          name: 'c.png',
          ext: 'png',
          downloadUrl: 'https://example.com/c',
        }),
      ]),
    ];
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['file:discovered'][] = [];
    bus.subscribe('file:discovered', (p) => seen.push(p));

    new DetectEngine(bus, makeSource(posts)).onScanComplete();

    // FileNode → FileRef: canonicalId→fileId, downloadUrl→url, ext→ext,
    // name→name. element/idSource are dropped (DOM + derivation details).
    expect(seen).toEqual([
      {
        postId: 'p1',
        files: [
          { fileId: 'file-a', url: 'https://example.com/a', ext: 'pdf', name: 'a.pdf' },
          { fileId: 'file-b', url: 'https://example.com/b', ext: 'doc', name: 'b.doc' },
        ],
      },
      {
        postId: 'p2',
        files: [{ fileId: 'file-c', url: 'https://example.com/c', ext: 'png', name: 'c.png' }],
      },
    ]);
  });

  it("does NOT publish 'file:discovered' for posts without files", () => {
    const posts = [makePost('p1', [makeFileNode()]), makePost('p2', [])];
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['file:discovered'][] = [];
    bus.subscribe('file:discovered', (p) => seen.push(p));

    new DetectEngine(bus, makeSource(posts)).onScanComplete();

    expect(seen).toEqual([
      {
        postId: 'p1',
        files: [{ fileId: 'drive-file-1', url: 'https://drive.google.com/uc?export=download&id=drive-file-1', ext: 'pdf', name: 'slides.pdf' }],
      },
    ]);
  });

  it("publishes 'post:scanned' with [] (topic still carried) and no 'file:discovered' for empty tracked posts", () => {
    const empty: PostNode[] = [];
    const bus = createEventBus<PageTopicMap>();
    const scanned: PageTopicMap['post:scanned'][] = [];
    const discovered: PageTopicMap['file:discovered'][] = [];
    bus.subscribe('post:scanned', (p) => scanned.push(p));
    bus.subscribe('file:discovered', (p) => discovered.push(p));

    new DetectEngine(bus, makeSource(empty)).onScanComplete();

    expect(scanned).toHaveLength(1);
    expect(scanned[0].posts).toBe(empty);
    expect(discovered).toEqual([]);
  });

  it("isolates a throwing source: publishes nothing that cycle and no exception escapes onScanComplete()", () => {
    const bus = createEventBus<PageTopicMap>();
    const scanned: unknown[] = [];
    const discovered: unknown[] = [];
    bus.subscribe('post:scanned', (p) => scanned.push(p));
    bus.subscribe('file:discovered', (p) => discovered.push(p));
    const source: DetectSource = {
      getTrackedPosts: vi.fn(() => {
        throw new Error('scanner blew up');
      }),
    };

    expect(() => new DetectEngine(bus, source).onScanComplete()).not.toThrow();
    expect(scanned).toEqual([]);
    expect(discovered).toEqual([]);
  });

  it('recovers on the next cycle after a source throw', () => {
    const posts = [makePost('p1', [makeFileNode()])];
    const bus = createEventBus<PageTopicMap>();
    const scanned: PageTopicMap['post:scanned'][] = [];
    bus.subscribe('post:scanned', (p) => scanned.push(p));
    let throwNext = true;
    const source: DetectSource = {
      getTrackedPosts: vi.fn(() => {
        if (throwNext) throw new Error('transient');
        return posts;
      }),
    };
    const engine = new DetectEngine(bus, source);

    engine.onScanComplete(); // source throws — isolated, nothing published
    throwNext = false;
    engine.onScanComplete();

    expect(scanned).toEqual([{ posts }]);
  });
});

// ---------------------------------------------------------------------------
// ComputeEngine fixtures — FlagDecision / PlacementDecision (engines/types.ts)
// ---------------------------------------------------------------------------

function makeFlagDecision(postId: string, overrides: Partial<FlagDecision> = {}): FlagDecision {
  return {
    postId,
    commentScore: 42,
    editedScore: 10,
    commentCount: 3,
    editedDiff: null,
    exclusionPenalties: [],
    finalVerdict: 'comment',
    confidence: 'high',
    trace: {
      postId,
      timestamp: 0,
      viewKind: ViewKind.STREAM,
      layers: [],
      exclusions: [],
      finalScore: 42,
      duration_ms: 1,
    },
    ...overrides,
  };
}

function makePlacementDecision(fileId: string, overrides: Partial<PlacementDecision> = {}): PlacementDecision {
  return {
    fileId,
    targetElement: document.createElement('div'),
    insertionPoint: 'append',
    anchorSelector: '[data-stream-item-id]',
    confidence: 90,
    reasonCodes: ['closest-action-bar'],
    fallbackUsed: false,
    ...overrides,
  };
}

function makeComputeSource(flags: FlagDecision[], placements: PlacementDecision[]): ComputeSource {
  return {
    getFlagDecisions: vi.fn(() => flags),
    getPlacementDecisions: vi.fn(() => placements),
  };
}

describe('ComputeEngine role (S5)', () => {
  it("publishes 'decision:flags' and 'decision:placement' with the source's arrays verbatim (same references)", () => {
    const flags = [makeFlagDecision('p1'), makeFlagDecision('p2', { finalVerdict: 'none' })];
    const placements = [
      makePlacementDecision('drive-file-1'),
      makePlacementDecision('drive-file-2', { insertionPoint: 'prepend' }),
    ];
    const bus = createEventBus<PageTopicMap>();
    const seenFlags: PageTopicMap['decision:flags'][] = [];
    const seenPlacements: PageTopicMap['decision:placement'][] = [];
    bus.subscribe('decision:flags', (p) => seenFlags.push(p));
    bus.subscribe('decision:placement', (p) => seenPlacements.push(p));

    new ComputeEngine(bus, makeComputeSource(flags, placements)).onDecisionsComputed();

    expect(seenFlags).toHaveLength(1);
    expect(seenFlags[0].decisions).toBe(flags); // read VERBATIM — not cloned, not filtered
    expect(seenPlacements).toHaveLength(1);
    expect(seenPlacements[0].decisions).toBe(placements); // read VERBATIM — not cloned, not filtered
  });

  it("publishes both topics with [] when the source has no decisions (topics still carried)", () => {
    const flags: FlagDecision[] = [];
    const placements: PlacementDecision[] = [];
    const bus = createEventBus<PageTopicMap>();
    const seenFlags: PageTopicMap['decision:flags'][] = [];
    const seenPlacements: PageTopicMap['decision:placement'][] = [];
    bus.subscribe('decision:flags', (p) => seenFlags.push(p));
    bus.subscribe('decision:placement', (p) => seenPlacements.push(p));

    new ComputeEngine(bus, makeComputeSource(flags, placements)).onDecisionsComputed();

    expect(seenFlags).toHaveLength(1);
    expect(seenFlags[0].decisions).toBe(flags);
    expect(seenPlacements).toHaveLength(1);
    expect(seenPlacements[0].decisions).toBe(placements);
  });

  it("isolates a throwing source: publishes nothing that cycle and no exception escapes onDecisionsComputed()", () => {
    const bus = createEventBus<PageTopicMap>();
    const seenFlags: unknown[] = [];
    const seenPlacements: unknown[] = [];
    bus.subscribe('decision:flags', (p) => seenFlags.push(p));
    bus.subscribe('decision:placement', (p) => seenPlacements.push(p));
    const source: ComputeSource = {
      getFlagDecisions: vi.fn(() => {
        throw new Error('decision pipeline blew up');
      }),
      getPlacementDecisions: vi.fn(() => [makePlacementDecision('drive-file-1')]),
    };

    expect(() => new ComputeEngine(bus, source).onDecisionsComputed()).not.toThrow();
    expect(seenFlags).toEqual([]);
    expect(seenPlacements).toEqual([]);
  });

  it('recovers on the next cycle after a source throw', () => {
    const flags = [makeFlagDecision('p1')];
    const placements = [makePlacementDecision('drive-file-1')];
    const bus = createEventBus<PageTopicMap>();
    const seenFlags: PageTopicMap['decision:flags'][] = [];
    const seenPlacements: PageTopicMap['decision:placement'][] = [];
    bus.subscribe('decision:flags', (p) => seenFlags.push(p));
    bus.subscribe('decision:placement', (p) => seenPlacements.push(p));
    let throwNext = true;
    const source: ComputeSource = {
      getFlagDecisions: vi.fn(() => flags),
      getPlacementDecisions: vi.fn(() => {
        if (throwNext) throw new Error('transient');
        return placements;
      }),
    };
    const engine = new ComputeEngine(bus, source);

    engine.onDecisionsComputed(); // source throws — isolated, nothing published (no half-cycle)
    throwNext = false;
    engine.onDecisionsComputed();

    expect(seenFlags).toEqual([{ decisions: flags }]);
    expect(seenPlacements).toEqual([{ decisions: placements }]);
  });
});

// ---------------------------------------------------------------------------
// RenderEngine fixtures — stub source exposing getLastRenderApplied()
// ---------------------------------------------------------------------------

type RenderAppliedItem = { postId: string; kind: 'button' | 'flag' | 'all' };

function makeRenderSource(applied: RenderAppliedItem[]): RenderSource {
  return { getLastRenderApplied: vi.fn(() => applied) };
}

describe('RenderEngine role (S5)', () => {
  it("publishes one 'render:applied' per applied item with the exact payload { postId, kind }", () => {
    const applied: RenderAppliedItem[] = [
      { postId: 'p1', kind: 'flag' },
      { postId: 'p2', kind: 'button' },
      { postId: 'p3', kind: 'all' },
    ];
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['render:applied'][] = [];
    bus.subscribe('render:applied', (p) => seen.push(p));

    new RenderEngine(bus, makeRenderSource(applied)).onRenderApplied();

    expect(seen).toHaveLength(3);
    expect(seen).toEqual([
      { postId: 'p1', kind: 'flag' },
      { postId: 'p2', kind: 'button' },
      { postId: 'p3', kind: 'all' },
    ]);
    // Carried VERBATIM — each published payload is the source's own item
    expect(seen[0]).toBe(applied[0]);
    expect(seen[1]).toBe(applied[1]);
    expect(seen[2]).toBe(applied[2]);
  });

  it("publishes nothing for an empty applied list (no 'render:applied' at all)", () => {
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['render:applied'][] = [];
    bus.subscribe('render:applied', (p) => seen.push(p));

    new RenderEngine(bus, makeRenderSource([])).onRenderApplied();

    expect(seen).toEqual([]);
  });

  it("isolates a throwing source: publishes nothing that cycle and no exception escapes onRenderApplied()", () => {
    const bus = createEventBus<PageTopicMap>();
    const seen: unknown[] = [];
    bus.subscribe('render:applied', (p) => seen.push(p));
    const source: RenderSource = {
      getLastRenderApplied: vi.fn(() => {
        throw new Error('render state blew up');
      }),
    };

    expect(() => new RenderEngine(bus, source).onRenderApplied()).not.toThrow();
    expect(seen).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EngineV2.getLastRenderApplied — the RenderSource the RenderEngine role reads.
// Setup idiom copied from tests/v2-engines.test.ts D8 tests (that file is the
// behavior-unchanged proof and is intentionally NOT edited by this sprint).
// ---------------------------------------------------------------------------

describe('EngineV2 render-applied record (S5)', () => {
  let engine: EngineV2;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV2();
  });

  // D8 helper, copied verbatim from tests/v2-engines.test.ts: seed the
  // engine's private state with one detected comment flag so the render
  // strategy has something to render.
  function injectDetectedFlag(target: EngineV2, postId: string, element: HTMLElement): void {
    const decision = {
      postId,
      commentScore: 100,
      editedScore: 0,
      commentCount: 3,
      editedDiff: null,
      exclusionPenalties: [],
      finalVerdict: 'comment' as const,
      confidence: 'high' as const,
      trace: {
        postId,
        timestamp: Date.now(),
        viewKind: 'stream' as ViewKind,
        layers: [],
        exclusions: [],
        finalScore: 100,
        duration_ms: 0,
      },
    };
    (target as unknown as { flagDecisions: Map<string, unknown> }).flagDecisions.set(postId, decision);
    (target as unknown as { postMap: Map<string, unknown> }).postMap.set(postId, {
      id: postId,
      element,
      viewKind: 'stream',
      files: [],
      flags: decision,
      lastScannedAt: Date.now(),
    });
  }

  // Seed one placement decision (one file button on an anchor inside the
  // post) plus the post/file state renderPlacedButtons resolves files from.
  function injectPlacement(
    target: EngineV2,
    postId: string,
    postEl: HTMLElement,
    anchorEl: HTMLElement,
    fileId: string,
  ): void {
    (target as unknown as { postMap: Map<string, unknown> }).postMap.set(postId, {
      id: postId,
      element: postEl,
      viewKind: 'stream',
      files: [
        {
          canonicalId: fileId,
          element: anchorEl,
          idSource: 'data-drive-id',
          name: 'handout.pdf',
          ext: 'pdf',
          downloadUrl: 'https://example.com/handout.pdf',
        },
      ],
      flags: null,
      lastScannedAt: Date.now(),
    });
    (target as unknown as { placementDecisions: unknown[] }).placementDecisions.push({
      fileId,
      targetElement: anchorEl,
      insertionPoint: 'append',
      anchorSelector: '[data-stream-item-id]',
      confidence: 90,
      reasonCodes: ['closest-action-bar'],
      fallbackUsed: false,
    });
  }

  it('records flag renders: after a render cycle that applies a flag, the record is non-empty and matches what rendered', async () => {
    const post = document.createElement('article');
    post.setAttribute('data-stream-item-id', 'render-post-1');
    document.body.appendChild(post);
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);

    injectDetectedFlag(engine, 'render-post-1', post);

    engineRegistry.setMode('v2');
    (engine as unknown as { renderDetectedFlags: () => void }).renderDetectedFlags();

    // The badge rendered AND the record matches it — one entry per applied item
    expect(post.querySelector('[data-cqd-v2-flag="badge"]')).not.toBeNull();
    expect(engine.getLastRenderApplied()).toEqual([{ postId: 'render-post-1', kind: 'flag' }]);
    engineRegistry.setMode('shadow');
  });

  it('resets per cycle: a cycle with nothing to render leaves the record empty', async () => {
    const post = document.createElement('article');
    post.setAttribute('data-stream-item-id', 'render-post-2');
    document.body.appendChild(post);
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);

    injectDetectedFlag(engine, 'render-post-2', post);

    engineRegistry.setMode('v2');
    (engine as unknown as { renderDetectedFlags: () => void }).renderDetectedFlags();
    expect(engine.getLastRenderApplied()).toHaveLength(1);

    // Next cycle has nothing to render (shadow mode — V1 owns rendering):
    // the record is reset even though the previous cycle recorded an entry.
    engineRegistry.setMode('shadow');
    (engine as unknown as { renderDetectedFlags: () => void }).renderDetectedFlags();
    expect(engine.getLastRenderApplied()).toEqual([]);
  });

  it('shares one record per render cycle: button entries append after flag entries, kind distinguishes them', async () => {
    const post = document.createElement('article');
    post.setAttribute('data-stream-item-id', 'render-post-3');
    const anchor = document.createElement('a');
    post.appendChild(anchor);
    document.body.appendChild(post);
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);

    injectDetectedFlag(engine, 'render-post-3', post);
    injectPlacement(engine, 'render-post-3', post, anchor, 'render-file-3');

    // Same order as the fullScan pipeline (engine-v2.ts:389-390):
    // flags render first, buttons second — one shared per-cycle record.
    engineRegistry.setMode('v2');
    (engine as unknown as { renderDetectedFlags: () => void }).renderDetectedFlags();
    (engine as unknown as { renderPlacedButtons: () => void }).renderPlacedButtons();

    expect(engine.getLastRenderApplied()).toEqual([
      { postId: 'render-post-3', kind: 'flag' },
      { postId: 'render-post-3', kind: 'button' },
    ]);
    // Both applications truly happened in the DOM. z57 S1: a button never
    // lands inside an anchor — append-onto-an-anchor degrades to insert-after
    // (V1 outcome parity), so the button is the anchor's sibling in the post.
    expect(post.querySelector('[data-cqd-v2-flag="badge"]')).not.toBeNull();
    expect(post.querySelector('button.cqd-download-btn')).not.toBeNull();
    engineRegistry.setMode('shadow');
  });
});

// ===========================================================================
// HardenEngine role (S5, task 5) — appended block; everything above is
// byte-untouched. Imports live here because ES import declarations hoist to
// module scope, so the file's original header did not need editing.
//
// Correction route pinned by reading the code: QueueStats
// (v2/repair/correction-queue.ts) exposes NO monotonic count that grows when
// corrections are queued — `pending` shrinks on process/flush and dedup makes
// re-enqueues invisible, `processed`/`failed` grow on outcomes not queueing,
// `unstableSkipped` grows on skips, `historySize` is a 50-cap ring buffer.
// So 'correction:needed' is event-triggered via HardenEngine.reportCorrection,
// fed by EngineV2's additive optional onCorrectionSeen hook (undefined by
// default), never polled from stats.
// ===========================================================================

import {
  HardenEngine,
  type HardenSource,
  type BudgetSnapshot,
  type QueueStats,
} from '../src/roles/harden-engine';
import type { ThrottleLevel } from '../src/contracts/topics';

// -- Fixtures: full structural mirrors of the engine's real snapshot/stats
//    shapes (v2/telemetry/budget-controller.ts, v2/repair/correction-queue.ts).

function makeBudgetSnapshot(throttleLevel: ThrottleLevel): BudgetSnapshot {
  return {
    fastPassAvg_ms: 5.2,
    fastPassP95_ms: 11.4,
    cpuPerSecond_ms: 31.7,
    postCount: 120,
    injectedElementCount: 340,
    currentDebounce_ms: 80,
    throttleLevel,
    violations: [],
    hardCapHit: false,
  };
}

function makeCorrectionStats(pending = 0): QueueStats {
  return {
    pending,
    processed: 0,
    failed: 0,
    unstableSkipped: 0,
    historySize: 0,
    byPriority: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  };
}

/** Source serving snapshots in order (the last one repeats on extra calls). */
function makeHardenSource(
  snapshots: BudgetSnapshot[],
  stats: QueueStats = makeCorrectionStats(),
): HardenSource {
  let i = 0;
  return {
    getBudgetSnapshot: vi.fn(() => snapshots[Math.min(i++, snapshots.length - 1)]),
    getCorrectionStats: vi.fn(() => stats),
  };
}

describe('HardenEngine role (S5)', () => {
  it("the baseline call is silent — even when it already reads a throttled level", () => {
    const bus = createEventBus<PageTopicMap>();
    const throttles: PageTopicMap['budget:throttle'][] = [];
    bus.subscribe('budget:throttle', (p) => throttles.push(p));

    const engine = new HardenEngine(bus, makeHardenSource([makeBudgetSnapshot('critical')]));
    engine.onCycleChecks(); // first read: establishes the baseline, publishes nothing
    engine.onCycleChecks(); // still 'critical' — stable after baseline, still silent

    expect(throttles).toEqual([]);
  });

  it("publishes 'budget:throttle' { level } only when the level differs from the previous call, silent while stable", () => {
    const bus = createEventBus<PageTopicMap>();
    const throttles: PageTopicMap['budget:throttle'][] = [];
    bus.subscribe('budget:throttle', (p) => throttles.push(p));

    const engine = new HardenEngine(
      bus,
      makeHardenSource([
        makeBudgetSnapshot('normal'),   // baseline — silent
        makeBudgetSnapshot('normal'),   // stable — silent
        makeBudgetSnapshot('elevated'), // changed — publish
        makeBudgetSnapshot('elevated'), // stable — silent
        makeBudgetSnapshot('critical'), // changed — publish
        makeBudgetSnapshot('normal'),   // changed back — publish
      ]),
    );
    for (let n = 0; n < 6; n++) engine.onCycleChecks();

    expect(throttles).toEqual([
      { level: 'elevated' },
      { level: 'critical' },
      { level: 'normal' },
    ]);
  });

  it("reportCorrection publishes 'correction:needed' with the CorrectionItem verbatim (same reference)", () => {
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['correction:needed'][] = [];
    bus.subscribe('correction:needed', (p) => seen.push(p));

    // Shape mirrors the rich v2 CorrectionItem that flows through the
    // engine's handleCorrection → onCorrectionSeen wiring.
    const item = {
      id: 'corr-1',
      op: 'inject-button',
      priority: 'HIGH',
      postId: 'p1',
      fileId: 'drive-file-1',
      element: document.createElement('button'),
      reason: 'button missing after navigation',
      detectedAt: 1726000000000,
      retryCount: 0,
    };

    new HardenEngine(bus, makeHardenSource([makeBudgetSnapshot('normal')])).reportCorrection(item);

    expect(seen).toHaveLength(1);
    expect(seen[0].item).toBe(item); // published VERBATIM — not copied, not reshaped
  });

  it("the no-correction case publishes nothing — cycles with pending queue stats never synthesize 'correction:needed'", () => {
    const bus = createEventBus<PageTopicMap>();
    const seen: PageTopicMap['correction:needed'][] = [];
    bus.subscribe('correction:needed', (p) => seen.push(p));

    // Realistic stats with corrections sitting in the queue: the cycle path
    // must NOT poll them into events (the pinned callback-route contract —
    // QueueStats has no monotonic queued-count to delta over).
    const engine = new HardenEngine(
      bus,
      makeHardenSource(
        [makeBudgetSnapshot('normal'), makeBudgetSnapshot('normal')],
        makeCorrectionStats(3),
      ),
    );
    engine.onCycleChecks();
    engine.onCycleChecks();

    expect(seen).toEqual([]);
  });

  it("isolates a throwing source getter: no publish, no escape, baseline survives, next call recovers", () => {
    const bus = createEventBus<PageTopicMap>();
    const throttles: PageTopicMap['budget:throttle'][] = [];
    bus.subscribe('budget:throttle', (p) => throttles.push(p));

    let level: ThrottleLevel = 'normal';
    let throwNext = false;
    const source: HardenSource = {
      getBudgetSnapshot: vi.fn(() => {
        if (throwNext) throw new Error('budget controller blew up');
        return makeBudgetSnapshot(level);
      }),
      getCorrectionStats: vi.fn(() => makeCorrectionStats()),
    };
    const engine = new HardenEngine(bus, source);

    engine.onCycleChecks(); // baseline: 'normal', silent
    level = 'elevated';
    throwNext = true;
    expect(() => engine.onCycleChecks()).not.toThrow(); // source throw isolated
    expect(throttles).toEqual([]); // nothing published that cycle
    throwNext = false;
    engine.onCycleChecks(); // recovery: 'elevated' vs the surviving baseline → publish

    expect(throttles).toEqual([{ level: 'elevated' }]);
  });

  it("a throw on the very first call leaves no baseline: the next successful read becomes the silent baseline", () => {
    const bus = createEventBus<PageTopicMap>();
    const throttles: PageTopicMap['budget:throttle'][] = [];
    bus.subscribe('budget:throttle', (p) => throttles.push(p));

    let throwNext = true;
    const source: HardenSource = {
      getBudgetSnapshot: vi.fn(() => {
        if (throwNext) throw new Error('transient');
        return makeBudgetSnapshot('critical');
      }),
      getCorrectionStats: vi.fn(() => makeCorrectionStats()),
    };
    const engine = new HardenEngine(bus, source);

    expect(() => engine.onCycleChecks()).not.toThrow(); // first read throws — isolated
    throwNext = false;
    engine.onCycleChecks(); // 'critical' — becomes the baseline, silent
    engine.onCycleChecks(); // still 'critical' — silent
    expect(throttles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EngineV2.onCorrectionSeen — the additive publish hook the HardenEngine role
// is fed by. Private-method access idiom copied from the render-applied
// describe above (v2-engines.test.ts remains the untouched behavior proof).
// ---------------------------------------------------------------------------

describe('EngineV2 correction-seen hook (S5)', () => {
  let engine: EngineV2;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV2();
  });

  function makeV2CorrectionItem(): {
    id: string; op: 'update-flag'; priority: 'HIGH'; postId: string;
    element: HTMLElement; reason: string; detectedAt: number; retryCount: number;
  } {
    return {
      id: 'corr-hook-1',
      op: 'update-flag', // handled without needing tracked post state
      priority: 'HIGH',
      postId: 'hook-post-1',
      element: document.createElement('div'),
      reason: 'verdict drifted',
      detectedAt: 1726000000000,
      retryCount: 0,
    };
  }

  async function initAborted(): Promise<void> {
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);
  }

  it('is undefined by default and leaves correction handling unchanged when unset', async () => {
    await initAborted();
    expect(engine.onCorrectionSeen).toBeUndefined();

    const handled = (
      engine as unknown as {
        handleCorrection: (item: ReturnType<typeof makeV2CorrectionItem>) => boolean;
      }
    ).handleCorrection(makeV2CorrectionItem());

    expect(handled).toBe(true); // handled normally — no hook, no throw
  });

  it('calls an assigned onCorrectionSeen once per handled correction with the exact item', async () => {
    await initAborted();
    const seen: unknown[] = [];
    engine.onCorrectionSeen = (item) => { seen.push(item); };

    const item = makeV2CorrectionItem();
    const handled = (
      engine as unknown as { handleCorrection: (i: typeof item) => boolean }
    ).handleCorrection(item);

    expect(handled).toBe(true);
    expect(seen).toEqual([item]);
    expect(seen[0]).toBe(item); // verbatim
  });
});
