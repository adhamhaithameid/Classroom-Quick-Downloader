// extension/tests/v4-roles.test.ts
//
// Role-module tests for S5 "roles behind the bus" (design §4).
// One describe block per role; new roles append below.
import { describe, it, expect, vi } from 'vitest';

import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { ViewKind, type PostNode, type FileNode } from '../src/engines/types';
import { DetectEngine, type DetectSource } from '../src/roles/detect-engine';

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
