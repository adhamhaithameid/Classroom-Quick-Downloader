// filepath: extension/tests/fakes/fake-scheduler-port.ts
/**
 * SchedulerPort fake: idle work runs only when the test flushes it.
 */
import type { SchedulerPort } from '../../src/contracts/ports';
import type { Unsubscribe } from '../../src/bus/event-bus';

export interface FakeSchedulerPort extends SchedulerPort {
  /** Run every scheduled callback in schedule order; clears the queue. */
  flush(): void;
  /** Number of callbacks waiting for a flush. */
  readonly queuedCount: number;
}

export function createFakeSchedulerPort(): FakeSchedulerPort {
  let queue: Array<() => void> = [];

  return {
    scheduleIdle(callback) {
      queue.push(callback);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        queue = queue.filter((cb) => cb !== callback);
      };
    },

    flush() {
      const snapshot = queue;
      queue = [];
      for (const callback of snapshot) callback();
    },

    get queuedCount() {
      return queue.length;
    },
  };
}
