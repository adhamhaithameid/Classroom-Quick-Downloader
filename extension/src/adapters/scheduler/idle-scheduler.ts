// filepath: extension/src/adapters/scheduler/idle-scheduler.ts
/**
 * Real SchedulerPort. Prefers requestIdleCallback (Chrome/Edge); falls back
 * to a timeout where it is missing (Firefox) so behavior, not availability,
 * decides when background work runs.
 */
import type { SchedulerPort } from '../../contracts/ports';
import type { Unsubscribe } from '../../bus/event-bus';

const FALLBACK_TIMEOUT_MS = 50;

export function createIdleScheduler(): SchedulerPort {
  return {
    scheduleIdle(callback): Unsubscribe {
      const schedule = (
        globalThis as typeof globalThis & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;

      if (schedule) {
        const handle = schedule(callback, { timeout: FALLBACK_TIMEOUT_MS * 20 });
        return () => {
          (
            globalThis as typeof globalThis & {
              cancelIdleCallback?: (handle: number) => void;
            }
          ).cancelIdleCallback?.(handle);
        };
      }

      const handle = globalThis.setTimeout(callback, FALLBACK_TIMEOUT_MS);
      return () => {
        globalThis.clearTimeout(handle);
      };
    },
  };
}
