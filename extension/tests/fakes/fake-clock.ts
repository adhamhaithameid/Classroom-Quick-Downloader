// filepath: extension/tests/fakes/fake-clock.ts
/**
 * Deterministic ClockPort fake. Nothing fires until advance() is called,
 * so tests control time exactly — the same determinism the accuracy
 * program demands of detection.
 */
import type { ClockPort, TimerHandle } from '../../src/contracts/ports';

interface FakeTimer {
  id: number;
  fireAt: number;
  callback: () => void;
}

export interface FakeClock extends ClockPort {
  /** Move the clock forward, firing any timers whose deadline has passed. */
  advance(ms: number): void;
  /** Number of timers currently scheduled. */
  readonly pendingCount: number;
}

export function createFakeClock(startAt = 0): FakeClock {
  let now = startAt;
  let nextId = 1;
  const timers = new Map<number, FakeTimer>();

  return {
    now: () => now,

    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { id, fireAt: now + Math.max(0, ms), callback });
      return id as TimerHandle;
    },

    clearTimeout(handle) {
      const id = handle as number;
      timers.delete(id);
    },

    advance(ms) {
      const target = now + ms;
      // Fire in deadline order; equal deadlines keep insertion order.
      const due = [...timers.values()]
        .filter((t) => t.fireAt <= target)
        .sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
      for (const timer of due) {
        if (!timers.has(timer.id)) continue; // cancelled by an earlier callback
        timers.delete(timer.id);
        now = Math.max(now, timer.fireAt);
        timer.callback();
      }
      now = target;
    },

    get pendingCount() {
      return timers.size;
    },
  };
}
