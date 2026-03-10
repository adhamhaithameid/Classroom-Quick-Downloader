// filepath: extension/tests/v2-correction-queue.test.ts
/**
 * Tests for the V2 Correction Queue.
 *
 * Tests priority ordering, dedup, backoff, processing, history,
 * flush, and idle scheduling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CorrectionQueue } from '../src/v2/repair/correction-queue';
import type { CorrectionHandler, CorrectionRecord, QueueStats } from '../src/v2/repair/correction-queue';
import type { CorrectionItem, CorrectionPriority, CorrectionOp } from '../src/v2/repair/deep-validator';
import { clearInstabilityState, recordCorrection } from '../src/v2/repair/deep-validator';

// ============================================================================
// HELPERS
// ============================================================================

function makeItem(overrides: Partial<CorrectionItem> = {}): CorrectionItem {
  const el = document.createElement('div');
  document.body.appendChild(el);

  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    op: 'inject-button',
    priority: 'MEDIUM',
    postId: 'test-post',
    element: el,
    reason: 'Test correction',
    detectedAt: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ============================================================================
// SETUP
// ============================================================================

let queue: CorrectionQueue;

beforeEach(() => {
  document.body.innerHTML = '';
  clearInstabilityState();
  queue = new CorrectionQueue();
});

afterEach(() => {
  queue.flush();
  document.body.innerHTML = '';
  clearInstabilityState();
});

// ============================================================================
// BASIC ENQUEUEING
// ============================================================================

describe('Basic enqueueing', () => {
  it('enqueues an item', () => {
    queue.enqueue(makeItem());
    expect(queue.size).toBe(1);
    expect(queue.hasPending).toBe(true);
  });

  it('enqueueAll adds multiple items', () => {
    queue.enqueueAll([makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })]);
    expect(queue.size).toBe(3);
  });

  it('peek returns highest priority item', () => {
    queue.enqueue(makeItem({ id: 'low', priority: 'LOW' }));
    queue.enqueue(makeItem({ id: 'high', priority: 'HIGH' }));
    queue.enqueue(makeItem({ id: 'critical', priority: 'CRITICAL' }));

    expect(queue.peek()!.id).toBe('critical');
  });
});

// ============================================================================
// PRIORITY ORDERING
// ============================================================================

describe('Priority ordering', () => {
  it('processes CRITICAL before HIGH', () => {
    const processed: string[] = [];
    queue.setHandler((item) => { processed.push(item.id); return true; });

    queue.enqueue(makeItem({ id: 'high', priority: 'HIGH' }));
    queue.enqueue(makeItem({ id: 'critical', priority: 'CRITICAL' }));

    queue.process();
    expect(processed[0]).toBe('critical');
    expect(processed[1]).toBe('high');
  });

  it('processes HIGH before MEDIUM', () => {
    const processed: string[] = [];
    queue.setHandler((item) => { processed.push(item.id); return true; });

    queue.enqueue(makeItem({ id: 'medium', priority: 'MEDIUM' }));
    queue.enqueue(makeItem({ id: 'high', priority: 'HIGH' }));

    queue.process();
    expect(processed[0]).toBe('high');
  });

  it('processes MEDIUM before LOW', () => {
    const processed: string[] = [];
    queue.setHandler((item) => { processed.push(item.id); return true; });

    queue.enqueue(makeItem({ id: 'low', priority: 'LOW' }));
    queue.enqueue(makeItem({ id: 'medium', priority: 'MEDIUM' }));

    queue.process();
    expect(processed[0]).toBe('medium');
  });

  it('full priority order: CRITICAL > HIGH > MEDIUM > LOW', () => {
    const processed: string[] = [];
    queue.setHandler((item) => { processed.push(item.priority); return true; });

    queue.enqueue(makeItem({ id: 'a', priority: 'LOW' }));
    queue.enqueue(makeItem({ id: 'b', priority: 'CRITICAL' }));
    queue.enqueue(makeItem({ id: 'c', priority: 'HIGH' }));
    queue.enqueue(makeItem({ id: 'd', priority: 'MEDIUM' }));

    queue.process();
    expect(processed).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });
});

// ============================================================================
// DEDUP
// ============================================================================

describe('Dedup', () => {
  it('rejects duplicate item.id', () => {
    queue.enqueue(makeItem({ id: 'same', priority: 'LOW' }));
    queue.enqueue(makeItem({ id: 'same', priority: 'LOW' }));
    expect(queue.size).toBe(1);
  });

  it('upgrades priority on duplicate', () => {
    queue.enqueue(makeItem({ id: 'same', priority: 'LOW' }));
    queue.enqueue(makeItem({ id: 'same', priority: 'CRITICAL' }));
    expect(queue.size).toBe(1);
    expect(queue.peek()!.priority).toBe('CRITICAL');
  });

  it('does NOT downgrade priority on duplicate', () => {
    queue.enqueue(makeItem({ id: 'same', priority: 'CRITICAL' }));
    queue.enqueue(makeItem({ id: 'same', priority: 'LOW' }));
    expect(queue.peek()!.priority).toBe('CRITICAL');
  });
});

// ============================================================================
// PROCESSING
// ============================================================================

describe('Processing', () => {
  it('calls handler for each item', () => {
    const handler = vi.fn(() => true);
    queue.setHandler(handler);
    queue.enqueue(makeItem({ id: 'a' }));
    queue.enqueue(makeItem({ id: 'b' }));

    queue.process();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it('returns count of processed items', () => {
    queue.setHandler(() => true);
    queue.enqueue(makeItem({ id: 'a' }));
    queue.enqueue(makeItem({ id: 'b' }));

    const count = queue.process();
    expect(count).toBe(2);
  });

  it('returns 0 when no handler', () => {
    queue.enqueue(makeItem());
    expect(queue.process()).toBe(0);
  });

  it('returns 0 when empty queue', () => {
    queue.setHandler(() => true);
    expect(queue.process()).toBe(0);
  });

  it('respects idle deadline', () => {
    queue.setHandler(() => true);
    for (let i = 0; i < 10; i++) {
      queue.enqueue(makeItem({ id: `item-${i}` }));
    }

    let calls = 0;
    const processed = queue.process(() => {
      calls++;
      return calls <= 3 ? 10 : 0; // Allow 3 items
    });

    expect(processed).toBeLessThanOrEqual(4);
    expect(queue.size).toBeGreaterThan(0);
  });

  it('skips disconnected elements', () => {
    const handler = vi.fn(() => true);
    queue.setHandler(handler);
    const el = document.createElement('div'); // Not in DOM
    queue.enqueue(makeItem({ element: el }));

    const processed = queue.process();
    // The item is dequeued and checked, but handler is NOT called
    // because the element is disconnected
    expect(handler).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
  });
});

// ============================================================================
// BACKOFF AND RETRY
// ============================================================================

describe('Backoff and retry', () => {
  it('re-enqueues failed items with incremented retryCount', () => {
    let attempt = 0;
    queue.setHandler(() => {
      attempt++;
      return attempt > 1; // Fail first, succeed second
    });
    queue.enqueue(makeItem({ id: 'fail-1', retryCount: 0 }));

    // First process: fails → re-enqueue with retryCount 1
    // Then immediately processes the re-enqueued item → succeeds
    queue.process();
    expect(queue.size).toBe(0);
    const history = queue.getHistory();
    // Find the failed attempt in history
    const failedEntry = history.find(h => !h.success);
    const successEntry = history.find(h => h.success);
    expect(failedEntry).toBeDefined();
    expect(successEntry).toBeDefined();
    expect(successEntry!.item.retryCount).toBe(1);
  });

  it('downgrades priority on retry', () => {
    let attempt = 0;
    queue.setHandler(() => {
      attempt++;
      return attempt > 1; // Fail first, succeed second
    });
    queue.enqueue(makeItem({ id: 'fail-high', priority: 'HIGH', retryCount: 0 }));

    queue.process();
    // The retried item should have MEDIUM priority
    const history = queue.getHistory();
    const successEntry = history.find(h => h.success);
    expect(successEntry).toBeDefined();
    expect(successEntry!.item.priority).toBe('MEDIUM');
  });

  it('marks as unstable after 3 failed corrections', () => {
    let callCount = 0;
    queue.setHandler(() => {
      callCount++;
      return false;
    });

    // 3 failures should trigger instability (via recordCorrection)
    queue.enqueue(makeItem({ id: 'unstable-item', retryCount: 0 }));
    queue.process(); // Fail 1 → re-enqueue

    queue.process(); // Fail 2 → re-enqueue

    queue.process(); // Fail 3 → unstable, NOT re-enqueued

    expect(queue.size).toBe(0); // Should be empty after becoming unstable
  });

  it('skips unstable items on enqueue', () => {
    // Make element unstable via direct API
    recordCorrection('unstable-id');
    recordCorrection('unstable-id');
    recordCorrection('unstable-id');

    queue.enqueue(makeItem({ id: 'unstable-id' }));
    expect(queue.size).toBe(0); // Should refuse to enqueue
  });
});

// ============================================================================
// HISTORY RING BUFFER
// ============================================================================

describe('History ring buffer', () => {
  it('records processed items in history', () => {
    queue.setHandler(() => true);
    queue.enqueue(makeItem({ id: 'tracked' }));
    queue.process();

    const history = queue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].success).toBe(true);
    expect(history[0].item.id).toBe('tracked');
  });

  it('records failed items in history', () => {
    queue.setHandler(() => false);
    queue.enqueue(makeItem({ id: 'failed' }));
    queue.process();

    const history = queue.getHistory();
    expect(history[0].success).toBe(false);
  });

  it('limits history to MAX_HISTORY (50)', () => {
    queue.setHandler(() => true);
    for (let i = 0; i < 60; i++) {
      queue.enqueue(makeItem({ id: `h-${i}` }));
    }
    queue.process();

    const history = queue.getHistory();
    expect(history.length).toBeLessThanOrEqual(50);
  });

  it('history is most-recent-first', () => {
    queue.setHandler(() => true);
    queue.enqueue(makeItem({ id: 'first' }));
    queue.enqueue(makeItem({ id: 'second' }));
    queue.process();

    const history = queue.getHistory();
    expect(history[0].item.id).toBe('second'); // Most recent first
  });
});

// ============================================================================
// FLUSH
// ============================================================================

describe('Flush', () => {
  it('clears all pending items', () => {
    queue.enqueue(makeItem({ id: 'a' }));
    queue.enqueue(makeItem({ id: 'b' }));
    expect(queue.size).toBe(2);

    queue.flush();
    expect(queue.size).toBe(0);
    expect(queue.hasPending).toBe(false);
  });

  it('is safe to call multiple times', () => {
    queue.flush();
    queue.flush();
    expect(queue.size).toBe(0);
  });
});

// ============================================================================
// STATS
// ============================================================================

describe('Stats', () => {
  it('tracks processed count', () => {
    queue.setHandler(() => true);
    queue.enqueue(makeItem({ id: 'a' }));
    queue.enqueue(makeItem({ id: 'b' }));
    queue.process();

    const stats = queue.getStats();
    expect(stats.processed).toBe(2);
  });

  it('tracks failed count', () => {
    queue.setHandler(() => false);
    queue.enqueue(makeItem({ id: 'a' }));
    queue.process();

    const stats = queue.getStats();
    // All 3 attempts fail (initial + 2 retries) before becoming unstable
    expect(stats.failed).toBe(3);
  });

  it('tracks byPriority breakdown', () => {
    queue.enqueue(makeItem({ id: 'a', priority: 'CRITICAL' }));
    queue.enqueue(makeItem({ id: 'b', priority: 'HIGH' }));
    queue.enqueue(makeItem({ id: 'c', priority: 'LOW' }));

    const stats = queue.getStats();
    expect(stats.byPriority.CRITICAL).toBe(1);
    expect(stats.byPriority.HIGH).toBe(1);
    expect(stats.byPriority.LOW).toBe(1);
    expect(stats.byPriority.MEDIUM).toBe(0);
  });

  it('resetStats clears counters but not queue', () => {
    queue.setHandler(() => true);
    queue.enqueue(makeItem({ id: 'a' }));
    queue.process();
    queue.enqueue(makeItem({ id: 'b' }));

    queue.resetStats();
    const stats = queue.getStats();
    expect(stats.processed).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.pending).toBe(1); // Queue still has items
  });
});
