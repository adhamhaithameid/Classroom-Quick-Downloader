// filepath: extension/src/adapters/clock/system-clock.ts
/**
 * Real ClockPort over Date and setTimeout. The ONLY place in the engine
 * program where Date.now and raw timers may appear (ADR-0007).
 */
import type { ClockPort, TimerHandle } from '../../contracts/ports';

export function createSystemClock(): ClockPort {
  return {
    now: () => Date.now(),

    setTimeout(callback, ms) {
      return globalThis.setTimeout(callback, ms) as TimerHandle;
    },

    clearTimeout(handle) {
      globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
    },
  };
}
