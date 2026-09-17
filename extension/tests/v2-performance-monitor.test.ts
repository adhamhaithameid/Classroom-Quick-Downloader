// filepath: extension/tests/v2-performance-monitor.test.ts
/**
 * Tests for the V2 Performance Monitor.
 *
 * Tests timing API, percentile computation, decision trace storage,
 * injected element counting, and performance summaries.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PerformanceMonitor,
  computePercentiles,
} from '../src/v2/telemetry/performance-monitor';
import type {
  PerformanceSummary,
  TimingPercentiles,
} from '../src/v2/telemetry/performance-monitor';
import type { DecisionTrace, ViewKind } from '../src/engines/types';
import { EngineV2 } from '../src/engines/v2/engine-v2';

// ============================================================================
// SETUP
// ============================================================================

let monitor: PerformanceMonitor;

beforeEach(() => {
  document.body.innerHTML = '';
  monitor = new PerformanceMonitor();
});

afterEach(() => {
  monitor.reset();
  document.body.innerHTML = '';
});

// ============================================================================
// TIMER API
// ============================================================================

describe('Timer API', () => {
  it('startTimer + stopTimer records duration', () => {
    monitor.startTimer('test');
    const duration = monitor.stopTimer('test');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('stopTimer returns -1 for unknown label', () => {
    expect(monitor.stopTimer('nonexistent')).toBe(-1);
  });

  it('records timing in buffer', () => {
    monitor.startTimer('scan');
    monitor.stopTimer('scan');
    expect(monitor.getTimingCount('scan')).toBe(1);
  });

  it('records multiple timings for same label', () => {
    for (let i = 0; i < 5; i++) {
      monitor.startTimer('loop');
      monitor.stopTimer('loop');
    }
    expect(monitor.getTimingCount('loop')).toBe(5);
  });

  it('recordTiming adds a value directly', () => {
    monitor.recordTiming('manual', 3.5);
    monitor.recordTiming('manual', 7.2);
    expect(monitor.getTimingCount('manual')).toBe(2);
  });

  it('ring buffer caps at 100 entries', () => {
    for (let i = 0; i < 120; i++) {
      monitor.recordTiming('overflow', i);
    }
    expect(monitor.getTimingCount('overflow')).toBe(100);
  });

  it('getTimingLabels returns all labels', () => {
    monitor.recordTiming('a', 1);
    monitor.recordTiming('b', 2);
    monitor.recordTiming('c', 3);
    const labels = monitor.getTimingLabels();
    expect(labels).toContain('a');
    expect(labels).toContain('b');
    expect(labels).toContain('c');
  });
});

// ============================================================================
// PERCENTILES
// ============================================================================

describe('Percentiles', () => {
  it('getPercentiles returns null for unknown label', () => {
    expect(monitor.getPercentiles('unknown')).toBeNull();
  });

  it('getPercentiles returns correct stats for single value', () => {
    monitor.recordTiming('single', 5);
    const p = monitor.getPercentiles('single')!;
    expect(p.count).toBe(1);
    expect(p.min).toBe(5);
    expect(p.max).toBe(5);
    expect(p.mean).toBe(5);
    expect(p.p50).toBe(5);
    expect(p.p95).toBe(5);
    expect(p.p99).toBe(5);
  });

  it('getPercentiles returns correct stats for multiple values', () => {
    for (let i = 1; i <= 100; i++) {
      monitor.recordTiming('range', i);
    }
    const p = monitor.getPercentiles('range')!;
    expect(p.count).toBe(100);
    expect(p.min).toBe(1);
    expect(p.max).toBe(100);
    expect(p.mean).toBeCloseTo(50.5);
    expect(p.p50).toBeCloseTo(50.5, 0);
    expect(p.p95).toBeCloseTo(95.05, 0);
    expect(p.p99).toBeCloseTo(99.01, 0);
  });

  it('computePercentiles handles empty array', () => {
    const p = computePercentiles([]);
    expect(p.count).toBe(0);
    expect(p.min).toBe(0);
    expect(p.max).toBe(0);
  });

  it('computePercentiles handles two values', () => {
    const p = computePercentiles([10, 20]);
    expect(p.count).toBe(2);
    expect(p.min).toBe(10);
    expect(p.max).toBe(20);
    expect(p.mean).toBe(15);
    expect(p.p50).toBe(15); // Interpolated between 10 and 20
  });

  it('computePercentiles does not mutate input', () => {
    const input = [5, 1, 3, 2, 4];
    const copy = [...input];
    computePercentiles(input);
    expect(input).toEqual(copy);
  });
});

// ============================================================================
// DECISION TRACE STORAGE
// ============================================================================

describe('Decision trace storage', () => {
  function makeTrace(postId: string): DecisionTrace {
    return {
      postId,
      timestamp: Date.now(),
      viewKind: 'stream' as ViewKind,
      layers: [],
      exclusions: [],
      finalScore: 50,
      duration_ms: 1,
    };
  }

  it('addTrace stores a trace', () => {
    monitor.addTrace(makeTrace('p1'));
    expect(monitor.traceCount).toBe(1);
  });

  it('getTraces returns all traces', () => {
    monitor.addTrace(makeTrace('p1'));
    monitor.addTrace(makeTrace('p2'));
    expect(monitor.getTraces()).toHaveLength(2);
  });

  it('getTraceByPostId returns most recent for that post', () => {
    monitor.addTrace(makeTrace('p1'));
    monitor.addTrace(makeTrace('p2'));
    monitor.addTrace(makeTrace('p1')); // Second trace for p1

    const trace = monitor.getTraceByPostId('p1');
    expect(trace).not.toBeNull();
    expect(trace!.postId).toBe('p1');
  });

  it('getTraceByPostId returns null for unknown post', () => {
    expect(monitor.getTraceByPostId('unknown')).toBeNull();
  });

  it('ring buffer caps at 50 traces', () => {
    for (let i = 0; i < 60; i++) {
      monitor.addTrace(makeTrace(`post-${i}`));
    }
    expect(monitor.traceCount).toBe(50);
  });

  it('ring buffer evicts oldest traces', () => {
    for (let i = 0; i < 60; i++) {
      monitor.addTrace(makeTrace(`post-${i}`));
    }
    // First 10 should be evicted
    expect(monitor.getTraceByPostId('post-0')).toBeNull();
    expect(monitor.getTraceByPostId('post-9')).toBeNull();
    // Last ones should still be there
    expect(monitor.getTraceByPostId('post-59')).not.toBeNull();
    expect(monitor.getTraceByPostId('post-10')).not.toBeNull();
  });
});

// ============================================================================
// INJECTED ELEMENT COUNTING
// ============================================================================

describe('Injected element counting', () => {
  it('returns 0 for empty page', () => {
    expect(monitor.countInjectedElements()).toBe(0);
  });

  it('counts elements with data-cqd-injected', () => {
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('div');
      el.setAttribute('data-cqd-injected', 'true');
      document.body.appendChild(el);
    }
    expect(monitor.countInjectedElements()).toBe(5);
  });

  it('does not count elements without the attribute', () => {
    const el = document.createElement('div');
    el.className = 'regular';
    document.body.appendChild(el);
    expect(monitor.countInjectedElements()).toBe(0);
  });
});

// ============================================================================
// PERFORMANCE SUMMARY
// ============================================================================

describe('Performance summary', () => {
  it('returns all required fields', () => {
    const summary = monitor.getPerformanceSummary();
    expect(summary).toHaveProperty('scanTimings');
    expect(summary).toHaveProperty('mutationTimings');
    expect(summary).toHaveProperty('flagTimings');
    expect(summary).toHaveProperty('validationTimings');
    expect(summary).toHaveProperty('injectedElementCount');
    expect(summary).toHaveProperty('traceCount');
    expect(summary).toHaveProperty('totalTimersStored');
    expect(summary).toHaveProperty('uptime_ms');
  });

  it('scanTimings are null when no scan data', () => {
    const summary = monitor.getPerformanceSummary();
    expect(summary.scanTimings).toBeNull();
  });

  it('includes scan timing when data present', () => {
    monitor.recordTiming('fullScan', 5);
    monitor.recordTiming('fullScan', 7);
    const summary = monitor.getPerformanceSummary();
    expect(summary.scanTimings).not.toBeNull();
    expect(summary.scanTimings!.count).toBe(2);
  });

  it('tracks total timers stored', () => {
    monitor.recordTiming('a', 1);
    monitor.recordTiming('b', 2);
    monitor.recordTiming('a', 3);
    const summary = monitor.getPerformanceSummary();
    expect(summary.totalTimersStored).toBe(3);
  });

  it('uptime increases over time', () => {
    const s1 = monitor.getPerformanceSummary();
    expect(s1.uptime_ms).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// RESET
// ============================================================================

describe('Reset', () => {
  it('clears all timings', () => {
    monitor.recordTiming('test', 5);
    monitor.reset();
    expect(monitor.getTimingCount('test')).toBe(0);
    expect(monitor.getTimingLabels()).toHaveLength(0);
  });

  it('clears traces', () => {
    monitor.addTrace({
      postId: 'p1',
      timestamp: Date.now(),
      viewKind: 'stream' as ViewKind,
      layers: [],
      exclusions: [],
      finalScore: 0,
      duration_ms: 1,
    });
    monitor.reset();
    expect(monitor.traceCount).toBe(0);
  });

  it('clears active timers', () => {
    monitor.startTimer('active');
    monitor.reset();
    expect(monitor.stopTimer('active')).toBe(-1); // Timer was cleared
  });
});

// ============================================================================
// HANDLE MUTATIONS INSTRUMENTATION (Engine V4 S11 — G5 budget gate)
// ============================================================================
//
// The 'handleMutations' label is the fast-pass budget metric (<6ms p95,
// budget-controller FAST_PASS_TARGET). It is only a real measurement if
// EngineV2.handleMutations actually records it on every batch it handles —
// these tests drive the engine with real mutation batches and read the
// histogram back through the engine's own monitor.

describe('handleMutations instrumentation (S11)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** v2-engines idiom: init with a pre-aborted signal (skips content wait). */
  async function makeEngine(): Promise<EngineV2> {
    const engine = new EngineV2();
    const controller = new AbortController();
    controller.abort();
    await engine.init('stream' as ViewKind, controller.signal);
    return engine;
  }

  /** One real childList batch adding a post card to the live DOM. */
  function makeRelevantMutation(postId: string): MutationRecord[] {
    const addedNode = document.createElement('div');
    addedNode.setAttribute('data-stream-item-id', postId);
    document.body.appendChild(addedNode);

    return [{
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
  }

  /** Read the engine's own monitor (same private-state idiom as v2-engines). */
  function monitorOf(engine: EngineV2): PerformanceMonitor {
    return (engine as unknown as { performanceMonitor: PerformanceMonitor })
      .performanceMonitor;
  }

  it('records the handleMutations label after N real mutation batches', async () => {
    const engine = await makeEngine();

    for (let i = 0; i < 6; i++) {
      engine.handleMutations(makeRelevantMutation(`perf-post-${i}`));
    }

    const p = monitorOf(engine).getPercentiles('handleMutations');
    expect(p).not.toBeNull();
    expect(p!.count).toBe(6);
    expect(typeof p!.p95).toBe('number');
    // jsdom's clock quantizes to whole ms, so a real sub-ms batch can legiti-
    // mately record as 0 here; the deterministic >0 proof lives in the clock
    // test below and the live p95 budget check in qa-perf.
    expect(p!.p95).toBeGreaterThanOrEqual(0);

    engine.destroy();
  });

  it('grows the sample count with each handled batch', async () => {
    const engine = await makeEngine();

    for (let i = 0; i < 3; i++) {
      engine.handleMutations(makeRelevantMutation(`grow-a-${i}`));
    }
    expect(monitorOf(engine).getTimingCount('handleMutations')).toBe(3);

    for (let i = 0; i < 4; i++) {
      engine.handleMutations(makeRelevantMutation(`grow-b-${i}`));
    }
    expect(monitorOf(engine).getTimingCount('handleMutations')).toBe(7);

    engine.destroy();
  });

  it('measures real elapsed time — p95 > 0 under a monotonic clock', async () => {
    const engine = await makeEngine();

    // Stub the clock to advance on every read: if the timer window actually
    // wraps the mutation handling, the recorded duration must be > 0.
    let t = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (t += 0.5));
    try {
      engine.handleMutations(makeRelevantMutation('clock-post'));
    } finally {
      clock.mockRestore();
    }

    const p = monitorOf(engine).getPercentiles('handleMutations');
    expect(p).not.toBeNull();
    expect(p!.count).toBe(1);
    expect(p!.p95).toBeGreaterThan(0);

    engine.destroy();
  });

  it('exposes mutation timings via the public accessor', async () => {
    const engine = await makeEngine();

    engine.handleMutations(makeRelevantMutation('accessor-post'));

    const p = engine.getMutationTimings();
    expect(p).not.toBeNull();
    expect(p!.count).toBe(1);
    expect(typeof p!.p95).toBe('number');
    expect(p!.p95).toBeGreaterThanOrEqual(0);

    engine.destroy();
  });
});
