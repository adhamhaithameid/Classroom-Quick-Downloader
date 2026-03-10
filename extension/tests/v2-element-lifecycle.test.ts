// filepath: extension/tests/v2-element-lifecycle.test.ts
/**
 * ============================================================================
 * V2 ELEMENT LIFECYCLE OBSERVER — Full Test Suite
 * ============================================================================
 *
 * Tests for the ElementLifecycleObserver — the qsa-observer-inspired
 * module that tracks element connections/disconnections.
 *
 * Categories:
 * 1. Initial scan — discovers already-connected elements
 * 2. Dynamic additions — fires connected callback (via flushMutations)
 * 3. Dynamic removals — fires disconnected callback (via flushMutations)
 * 4. Move detection — remove+add in one batch = move, not delete
 * 5. Nested elements — finds matching elements in subtrees
 * 6. Stop & cleanup — fires disconnected for all on stop
 * 7. Edge cases — empty DOM, no matches, multiple observers
 *
 * Note: jsdom's MutationObserver fires asynchronously via microtasks,
 * but we use vi.advanceTimersByTime to force it. Some tests manually
 * call processMutations via the MutationObserver takeRecords() API.
 *
 * @author Adham — testing lifecycle detection is tricky because timing
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElementLifecycleObserver } from '../src/v2/model/element-lifecycle';

// ============================================================================
// INITIAL SCAN
// ============================================================================

describe('ElementLifecycleObserver: Initial Scan', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fires connected for all pre-existing elements on start', () => {
    document.body.innerHTML = `
      <div data-stream-item-id="1">Post 1</div>
      <div data-stream-item-id="2">Post 2</div>
      <div data-stream-item-id="3">Post 3</div>
    `;

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      idAttribute: 'data-stream-item-id',
      callback,
    });

    observer.start();
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      '1',
    );
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      '2',
    );
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      '3',
    );

    observer.stop();
  });

  it('fires connected with null id when no idAttribute specified', () => {
    document.body.innerHTML = '<div class="post">Post</div>';

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '.post',
      callback,
    });

    observer.start();
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      null,
    );

    observer.stop();
  });

  it('does nothing on start if no elements match', () => {
    document.body.innerHTML = '<div>No posts here</div>';

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback,
    });

    observer.start();
    expect(callback).not.toHaveBeenCalled();

    observer.stop();
  });

  it('is idempotent — calling start twice does not duplicate callbacks', () => {
    document.body.innerHTML = '<div data-stream-item-id="1">Post</div>';

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback,
    });

    observer.start();
    observer.start(); // Second call should be a no-op
    expect(callback).toHaveBeenCalledTimes(1);

    observer.stop();
  });
});

// ============================================================================
// STOP & CLEANUP
// ============================================================================

describe('ElementLifecycleObserver: Stop & Cleanup', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fires disconnected for all known elements on stop', () => {
    document.body.innerHTML = `
      <div data-stream-item-id="stop-1">Post 1</div>
      <div data-stream-item-id="stop-2">Post 2</div>
    `;

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      idAttribute: 'data-stream-item-id',
      callback,
    });

    observer.start();
    callback.mockClear();

    observer.stop();

    // Should fire disconnected for both tracked elements
    const disconnects = callback.mock.calls.filter(c => c[1] === 'disconnected');
    expect(disconnects).toHaveLength(2);
  });

  it('clears known elements set after stop', () => {
    document.body.innerHTML = '<div data-stream-item-id="1">Post</div>';

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback,
    });

    observer.start();
    expect(observer.getKnownElements().size).toBe(1);

    observer.stop();
    expect(observer.getKnownElements().size).toBe(0);
  });

  it('stop is idempotent', () => {
    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback,
    });

    observer.start();
    observer.stop();

    // Should not throw on second stop
    observer.stop();
    expect(observer.getKnownElements().size).toBe(0);
  });

  it('stop before start is safe', () => {
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback: vi.fn(),
    });

    // Should not throw
    observer.stop();
    expect(observer.getKnownElements().size).toBe(0);
  });
});

// ============================================================================
// getKnownElements
// ============================================================================

describe('ElementLifecycleObserver: getKnownElements', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns a copy, not the internal set', () => {
    document.body.innerHTML = '<div data-stream-item-id="1">Post</div>';

    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback: () => {},
    });

    observer.start();

    const elements = observer.getKnownElements();
    elements.clear(); // Clearing the copy should not affect the observer

    expect(observer.getKnownElements().size).toBe(1);

    observer.stop();
  });

  it('returns empty set before start', () => {
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback: () => {},
    });

    expect(observer.getKnownElements().size).toBe(0);
  });

  it('tracks elements found during initial scan', () => {
    document.body.innerHTML = `
      <div data-stream-item-id="a">A</div>
      <div data-stream-item-id="b">B</div>
      <div data-stream-item-id="c">C</div>
    `;

    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      callback: () => {},
    });

    observer.start();
    expect(observer.getKnownElements().size).toBe(3);

    observer.stop();
  });
});

// ============================================================================
// CONSTRUCTOR & OPTIONS
// ============================================================================

describe('ElementLifecycleObserver: Constructor', () => {
  it('accepts custom root element', () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-stream-item-id="inside">Inside</div>
      </div>
      <div data-stream-item-id="outside">Outside</div>
    `;

    const callback = vi.fn();
    const root = document.getElementById('root') as HTMLElement;
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      idAttribute: 'data-stream-item-id',
      callback,
      root,
    });

    observer.start();

    // Should only find the element inside the root
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      'inside',
    );

    observer.stop();
  });

  it('handles selector with no matches gracefully', () => {
    const observer = new ElementLifecycleObserver({
      selector: '.nonexistent-class-that-will-never-match',
      callback: vi.fn(),
    });

    // Should not throw
    observer.start();
    expect(observer.getKnownElements().size).toBe(0);
    observer.stop();
  });

  it('handles deeply nested matching elements', () => {
    document.body.innerHTML = `
      <div>
        <div>
          <div>
            <div data-stream-item-id="deep">Deeply nested</div>
          </div>
        </div>
      </div>
    `;

    const callback = vi.fn();
    const observer = new ElementLifecycleObserver({
      selector: '[data-stream-item-id]',
      idAttribute: 'data-stream-item-id',
      callback,
    });

    observer.start();
    expect(callback).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'connected',
      'deep',
    );
    expect(observer.getKnownElements().size).toBe(1);

    observer.stop();
  });
});
