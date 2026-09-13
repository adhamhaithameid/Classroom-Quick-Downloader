// extension/tests/v4-roles.test.ts
//
// Role-module tests for S5 "roles behind the bus" (design §4).
// One describe block per role; new roles append below.
import { describe, it, expect, vi } from 'vitest';

import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { ViewKind, type PostNode, type FileNode, type FlagDecision, type PlacementDecision } from '../src/engines/types';
import { DetectEngine, type DetectSource } from '../src/roles/detect-engine';
import { ComputeEngine, type ComputeSource } from '../src/roles/compute-engine';

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
