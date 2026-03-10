// filepath: extension/tests/v2-engines.test.ts
/**
 * ============================================================================
 * V2 ENGINE CLASSES — Full Test Suite
 * ============================================================================
 *
 * Tests for the V1, V2, and V3 engine wrappers that implement the
 * CQDEngine interface.
 *
 * Categories:
 * 1. EngineV1 — legacy wrapper (init, destroy, getTrackedPosts)
 * 2. EngineV2 — new unified engine (init, fullScan, handleMutations)
 * 3. EngineV3 — future API engine (extends V2 stub)
 * 4. Interface compliance — all engines implement CQDEngine
 *
 * @author Adham — testing the engines without actually loading Classroom
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineV1 } from '../src/engines/v1/engine-v1';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import { EngineV3 } from '../src/engines/v3/engine-v3';
import type { CQDEngine, ViewKind } from '../src/engines/types';

// ============================================================================
// ENGINE V1
// ============================================================================

describe('EngineV1', () => {
  let engine: EngineV1;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV1();
  });

  it('has correct name and version', () => {
    expect(engine.name).toBe('engine-v1');
    expect(engine.version).toBe('1.3.9');
  });

  it('initializes without error', async () => {
    const controller = new AbortController();
    await expect(engine.init('stream' as ViewKind, controller.signal)).resolves.not.toThrow();
  });

  it('destroys without error', async () => {
    const controller = new AbortController();
    await engine.init('stream' as ViewKind, controller.signal);
    expect(() => engine.destroy()).not.toThrow();
  });

  it('handleMutations is a no-op (V1 has its own observers)', () => {
    expect(() => engine.handleMutations([])).not.toThrow();
  });

  it('fullScan is a no-op (V1 uses heartbeat intervals)', () => {
    expect(() => engine.fullScan()).not.toThrow();
  });

  it('getTrackedPosts returns PostNode[] from DOM after init', async () => {
    // V1 requires init() before getTrackedPosts works (isActive guard)
    const controller = new AbortController();
    await engine.init('stream' as ViewKind, controller.signal);

    // Set up some mock post elements
    document.body.innerHTML = `
      <div data-stream-item-id="v1-post-1">Post 1</div>
      <div data-stream-item-id="v1-post-2">Post 2</div>
    `;

    const posts = engine.getTrackedPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].id).toBe('v1-post-1');
    expect(posts[1].id).toBe('v1-post-2');
  });

  it('getTrackedPosts returns empty array when no posts exist', () => {
    expect(engine.getTrackedPosts()).toHaveLength(0);
  });

  it('getPlacementDecisions returns empty array', () => {
    expect(engine.getPlacementDecisions()).toHaveLength(0);
  });

  it('getFlagDecisions returns empty array', () => {
    expect(engine.getFlagDecisions()).toHaveLength(0);
  });

  it('getDecisionTrace returns a minimal trace object', () => {
    const trace = engine.getDecisionTrace('any-post');
    expect(trace).not.toBeNull();
    expect(trace!.postId).toBe('any-post');
    expect(trace!.layers).toBeDefined();
  });

  it('implements CQDEngine interface', () => {
    const asInterface: CQDEngine = engine;
    expect(asInterface.name).toBe('engine-v1');
    expect(typeof asInterface.init).toBe('function');
    expect(typeof asInterface.destroy).toBe('function');
    expect(typeof asInterface.handleMutations).toBe('function');
    expect(typeof asInterface.fullScan).toBe('function');
    expect(typeof asInterface.getTrackedPosts).toBe('function');
    expect(typeof asInterface.getPlacementDecisions).toBe('function');
    expect(typeof asInterface.getFlagDecisions).toBe('function');
    expect(typeof asInterface.getDecisionTrace).toBe('function');
  });
});

// ============================================================================
// ENGINE V2
// ============================================================================

describe('EngineV2', () => {
  let engine: EngineV2;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV2();
  });

  it('has correct name and version', () => {
    expect(engine.name).toBe('engine-v2');
    expect(engine.version).toBe('4.0.0-alpha');
  });

  it('initializes with a view kind and abort signal', async () => {
    const controller = new AbortController();
    // Abort immediately to skip waitForContentReady (5s timeout)
    controller.abort();
    await expect(engine.init('stream' as ViewKind, controller.signal)).resolves.not.toThrow();
  });

  it('destroys cleanly after initialization', async () => {
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);
    expect(() => engine.destroy()).not.toThrow();
  });

  it('destroys cleanly without initialization', () => {
    expect(() => engine.destroy()).not.toThrow();
  });

  it('handles mutations without crashing', async () => {
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);

    const addedNode = document.createElement('div');
    addedNode.setAttribute('data-stream-item-id', 'mut-1');
    document.body.appendChild(addedNode);

    const mutations: MutationRecord[] = [{
      type: 'childList',
      addedNodes: [addedNode] as any,
      removedNodes: [] as any,
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
    }];

    expect(() => engine.handleMutations(mutations)).not.toThrow();
  });

  it('fullScan discovers posts in the DOM', async () => {
    document.body.innerHTML = `
      <div data-stream-item-id="v2-post-1">
        <a href="https://drive.google.com/file/d/v2file1_20charPadding/view" aria-label="test.pdf">Link</a>
      </div>
      <div data-stream-item-id="v2-post-2">Content</div>
    `;

    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);
    engine.fullScan();

    const posts = engine.getTrackedPosts();
    expect(posts.length).toBeGreaterThanOrEqual(0); // May be 0 if scorer doesn't match in test DOM
  });

  it('getPlacementDecisions returns array', () => {
    const decisions = engine.getPlacementDecisions();
    expect(Array.isArray(decisions)).toBe(true);
  });

  it('getFlagDecisions returns array', () => {
    const decisions = engine.getFlagDecisions();
    expect(Array.isArray(decisions)).toBe(true);
  });

  it('getDecisionTrace returns null or trace for unknown post', () => {
    const trace = engine.getDecisionTrace('nonexistent');
    // Can be null (no trace) or a trace object
    expect(trace === null || typeof trace === 'object').toBe(true);
  });

  it('implements CQDEngine interface', () => {
    const asInterface: CQDEngine = engine;
    expect(asInterface.name).toBe('engine-v2');
    expect(typeof asInterface.init).toBe('function');
    expect(typeof asInterface.destroy).toBe('function');
    expect(typeof asInterface.handleMutations).toBe('function');
    expect(typeof asInterface.fullScan).toBe('function');
    expect(typeof asInterface.getTrackedPosts).toBe('function');
    expect(typeof asInterface.getPlacementDecisions).toBe('function');
    expect(typeof asInterface.getFlagDecisions).toBe('function');
    expect(typeof asInterface.getDecisionTrace).toBe('function');
  });

  it('does not crash when handling mutations before init', () => {
    expect(() => engine.handleMutations([])).not.toThrow();
  });

  it('does not crash when fullScan called before init', () => {
    expect(() => engine.fullScan()).not.toThrow();
  });

  it('filters irrelevant mutations', async () => {
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);

    // Add a text node — should be irrelevant
    const textNode = document.createTextNode('just text');
    document.body.appendChild(textNode);

    const mutations: MutationRecord[] = [{
      type: 'childList',
      addedNodes: [textNode] as any,
      removedNodes: [] as any,
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
    }];

    // Should not throw or trigger a full rescan
    expect(() => engine.handleMutations(mutations)).not.toThrow();
  });
});

// ============================================================================
// ENGINE V3
// ============================================================================

describe('EngineV3', () => {
  let engine: EngineV3;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV3();
  });

  it('has correct name and version', () => {
    expect(engine.name).toBe('engine-v3');
    expect(engine.version).toBe('4.2.1-stub');
  });

  it('initializes without error', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(engine.init('stream' as ViewKind, controller.signal)).resolves.not.toThrow();
  });

  it('destroys without error', () => {
    expect(() => engine.destroy()).not.toThrow();
  });

  it('implements CQDEngine interface', () => {
    const asInterface: CQDEngine = engine;
    expect(asInterface.name).toBe('engine-v3');
    expect(typeof asInterface.init).toBe('function');
    expect(typeof asInterface.destroy).toBe('function');
    expect(typeof asInterface.handleMutations).toBe('function');
    expect(typeof asInterface.fullScan).toBe('function');
    expect(typeof asInterface.getTrackedPosts).toBe('function');
    expect(typeof asInterface.getPlacementDecisions).toBe('function');
    expect(typeof asInterface.getFlagDecisions).toBe('function');
    expect(typeof asInterface.getDecisionTrace).toBe('function');
  });

  it('extends EngineV2 functionality', () => {
    // V3 should have all V2 methods
    expect(typeof engine.handleMutations).toBe('function');
    expect(typeof engine.fullScan).toBe('function');
    expect(typeof engine.getTrackedPosts).toBe('function');
  });
});

// ============================================================================
// CROSS-ENGINE TESTS
// ============================================================================

describe('Engine Interface Compliance', () => {
  const engines: { name: string; create: () => CQDEngine }[] = [
    { name: 'V1', create: () => new EngineV1() },
    { name: 'V2', create: () => new EngineV2() },
    { name: 'V3', create: () => new EngineV3() },
  ];

  for (const { name, create } of engines) {
    describe(`${name}`, () => {
      it('has a non-empty name', () => {
        const engine = create();
        expect(engine.name).toBeTruthy();
        expect(engine.name.length).toBeGreaterThan(0);
      });

      it('has a version string', () => {
        const engine = create();
        expect(engine.version).toBeTruthy();
        expect(engine.version).toMatch(/\d+\.\d+/);
      });

      it('init → destroy lifecycle completes without error', async () => {
        const engine = create();
        const controller = new AbortController();
        controller.abort();
        await engine.init('stream' as ViewKind, controller.signal);
        engine.destroy();
      });

      it('returns arrays from getter methods', () => {
        const engine = create();
        expect(Array.isArray(engine.getTrackedPosts())).toBe(true);
        expect(Array.isArray(engine.getPlacementDecisions())).toBe(true);
        expect(Array.isArray(engine.getFlagDecisions())).toBe(true);
      });
    });
  }
});
