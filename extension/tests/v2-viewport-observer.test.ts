// filepath: extension/tests/v2-viewport-observer.test.ts
/**
 * ============================================================================
 * V2 VIEWPORT OBSERVER — Full Test Suite
 * ============================================================================
 *
 * Tests for the ViewportObserver — IntersectionObserver-based lazy injection
 * with 3 zones: visible, preload, offscreen.
 *
 * Note: IntersectionObserver isn't fully supported in jsdom/happy-dom,
 * so we mock it. The tests verify the LOGIC of zone classification
 * and callback behavior, not the actual intersection detection.
 *
 * Categories:
 * 1. Initial state — all elements start as offscreen
 * 2. Zone transitions — visible ↔ preload ↔ offscreen
 * 3. Callbacks — fire on zone change, not on stable
 * 4. Observe/unobserve — element tracking
 * 5. Disconnect — cleanup
 * 6. Summary — zone distribution
 *
 * @author Adham — mocking IntersectionObserver is an art form
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ViewportObserver,
  type ViewportChangeCallback,
  type ViewportZone,
} from '../src/v2/model/viewport-observer';

// ============================================================================
// MOCK IntersectionObserver
// ============================================================================

type IOCallback = (entries: IntersectionObserverEntry[]) => void;
type IOInstance = {
  callback: IOCallback;
  elements: Set<Element>;
  rootMargin: string;
};

let ioInstances: IOInstance[] = [];

function mockIntersectionObserver() {
  ioInstances = [];

  vi.stubGlobal('IntersectionObserver', class MockIO {
    private instance: IOInstance;

    constructor(callback: IOCallback, options?: IntersectionObserverInit) {
      this.instance = {
        callback,
        elements: new Set(),
        rootMargin: options?.rootMargin || '0px',
      };
      ioInstances.push(this.instance);
    }

    observe(el: Element) { this.instance.elements.add(el); }
    unobserve(el: Element) { this.instance.elements.delete(el); }
    disconnect() { this.instance.elements.clear(); }
  });
}

/**
 * Simulate an intersection event for a specific observer.
 */
function simulateIntersection(
  observerIndex: number,
  entries: { target: Element; isIntersecting: boolean }[],
) {
  const io = ioInstances[observerIndex];
  if (!io) throw new Error(`No IntersectionObserver at index ${observerIndex}`);

  io.callback(
    entries.map(e => ({
      target: e.target,
      isIntersecting: e.isIntersecting,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: e.isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: performance.now(),
    })),
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('ViewportObserver', () => {
  let callback: ReturnType<typeof vi.fn<ViewportChangeCallback>>;
  let viewportCallback: ViewportChangeCallback;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockIntersectionObserver();
    callback = vi.fn<ViewportChangeCallback>();
    viewportCallback = (element, newZone, previousZone) => {
      callback(element, newZone, previousZone);
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ========================================================================
  // INITIAL STATE
  // ========================================================================

  it('creates two IntersectionObservers (visible + preload)', () => {
    new ViewportObserver({ callback: viewportCallback });
    expect(ioInstances).toHaveLength(2);
  });

  it('observed elements start as offscreen', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');

    vp.observe(el);
    expect(vp.getZone(el)).toBe('offscreen');
  });

  it('returns null for unobserved elements', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');

    expect(vp.getZone(el)).toBeNull();
  });

  // ========================================================================
  // ZONE TRANSITIONS
  // ========================================================================

  it('transitions to visible when element enters viewport', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');
    vp.observe(el);

    // Visible observer (index 0) reports intersection
    simulateIntersection(0, [{ target: el, isIntersecting: true }]);

    expect(vp.getZone(el)).toBe('visible');
    expect(callback).toHaveBeenCalledWith(el, 'visible', 'offscreen');
  });

  it('transitions to preload when in preload range but not visible', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');
    vp.observe(el);

    // Preload observer (index 1) reports intersection, visible does not
    simulateIntersection(1, [{ target: el, isIntersecting: true }]);

    expect(vp.getZone(el)).toBe('preload');
    expect(callback).toHaveBeenCalledWith(el, 'preload', 'offscreen');
  });

  it('transitions back to offscreen when leaving preload range', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');
    vp.observe(el);

    // Enter preload
    simulateIntersection(1, [{ target: el, isIntersecting: true }]);
    callback.mockClear();

    // Leave preload
    simulateIntersection(1, [{ target: el, isIntersecting: false }]);

    expect(vp.getZone(el)).toBe('offscreen');
    expect(callback).toHaveBeenCalledWith(el, 'offscreen', 'preload');
  });

  it('transitions visible → preload when leaving viewport but still in preload range', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');
    vp.observe(el);

    // Enter both visible and preload
    simulateIntersection(0, [{ target: el, isIntersecting: true }]);
    simulateIntersection(1, [{ target: el, isIntersecting: true }]);
    callback.mockClear();

    // Leave visible, stay in preload
    simulateIntersection(0, [{ target: el, isIntersecting: false }]);

    expect(vp.getZone(el)).toBe('preload');
    expect(callback).toHaveBeenCalledWith(el, 'preload', 'visible');
  });

  it('does not fire callback when zone stays the same', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');
    vp.observe(el);

    // Enter visible
    simulateIntersection(0, [{ target: el, isIntersecting: true }]);
    callback.mockClear();

    // Visible again — same zone, no callback
    simulateIntersection(0, [{ target: el, isIntersecting: true }]);
    expect(callback).not.toHaveBeenCalled();
  });

  // ========================================================================
  // MULTIPLE ELEMENTS
  // ========================================================================

  it('tracks multiple elements independently', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    const el3 = document.createElement('div');

    vp.observe(el1);
    vp.observe(el2);
    vp.observe(el3);

    // el1 is visible, el2 is preload, el3 is offscreen
    simulateIntersection(0, [{ target: el1, isIntersecting: true }]);
    simulateIntersection(1, [{ target: el2, isIntersecting: true }]);

    expect(vp.getZone(el1)).toBe('visible');
    expect(vp.getZone(el2)).toBe('preload');
    expect(vp.getZone(el3)).toBe('offscreen');
  });

  // ========================================================================
  // OBSERVE / UNOBSERVE
  // ========================================================================

  it('observing the same element twice is idempotent', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');

    vp.observe(el);
    vp.observe(el);

    const summary = vp.getSummary();
    expect(summary.offscreen).toBe(1); // Only counted once
  });

  it('unobserve removes element from tracking', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');

    vp.observe(el);
    expect(vp.getZone(el)).toBe('offscreen');

    vp.unobserve(el);
    expect(vp.getZone(el)).toBeNull();
  });

  it('unobserve does not fire callback', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el = document.createElement('div');

    vp.observe(el);
    callback.mockClear();

    vp.unobserve(el);
    expect(callback).not.toHaveBeenCalled();
  });

  // ========================================================================
  // DISCONNECT
  // ========================================================================

  it('disconnect clears all tracked elements', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    vp.observe(el1);
    vp.observe(el2);

    vp.disconnect();

    expect(vp.getZone(el1)).toBeNull();
    expect(vp.getZone(el2)).toBeNull();
  });

  // ========================================================================
  // SUMMARY & HELPERS
  // ========================================================================

  it('getSummary returns correct zone counts', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });

    for (let i = 0; i < 5; i++) {
      const el = document.createElement('div');
      vp.observe(el);
    }

    // All start as offscreen
    const summary = vp.getSummary();
    expect(summary.visible).toBe(0);
    expect(summary.preload).toBe(0);
    expect(summary.offscreen).toBe(5);
  });

  it('getElementsInZone returns elements filtering by zone', () => {
    const vp = new ViewportObserver({ callback: viewportCallback });
    const visible = document.createElement('div');
    const offscreen = document.createElement('div');

    vp.observe(visible);
    vp.observe(offscreen);

    simulateIntersection(0, [{ target: visible, isIntersecting: true }]);

    expect(vp.getElementsInZone('visible')).toHaveLength(1);
    expect(vp.getElementsInZone('offscreen')).toHaveLength(1);
    expect(vp.getElementsInZone('preload')).toHaveLength(0);
  });

  it('respects custom preloadMargin option', () => {
    new ViewportObserver({
      callback: viewportCallback,
      preloadMargin: '200%',
    });

    expect(ioInstances).toHaveLength(2);
    expect(ioInstances[0].rootMargin).toBe('0px');
    expect(ioInstances[1].rootMargin).toBe('200%');
  });
});
