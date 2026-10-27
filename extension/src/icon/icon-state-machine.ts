/**
 * Pure toolbar-icon state machine (bead 08fg.1). Phases: idle → active
 * (spinner while the download queue holds active items) → success-flash /
 * error-flash on drain → idle. No chrome.* dependencies: timers and the
 * render sink are injected, so transitions and timer hygiene are unit-
 * testable (tests/icon-state-machine.test.ts). The background adapter that
 * maps renders to setIcon calls lives in entrypoints/background/icon-animation.ts.
 */

export type IconPhase = 'idle' | 'active' | 'success-flash' | 'error-flash' | 'disabled';

/** Terminal download outcomes the flash decision understands. */
export type SettleKind = 'success' | 'fail' | 'cancelled';

export interface IconTimers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface IconRender {
  phase: IconPhase;
  /** Spinner frame index; valid while phase is 'active', 0 otherwise. */
  frameIndex: number;
}

export interface IconStateSnapshot extends IconRender {
  activeCount: number;
  enabled: boolean;
}

/** Must match the generated frame assets in src/icon/fx/ (spin-{0..7}-*). */
export const SPIN_FRAME_COUNT = 8;
export const DEFAULT_FRAME_MS = 100;
export const DEFAULT_FLASH_MS = 1500;

export interface IconStateMachine {
  setEnabled(enabled: boolean): void;
  setActiveCount(count: number): void;
  notifySettled(kind: SettleKind): void;
  getState(): IconStateSnapshot;
  /** Live timer handles; must be 0 in idle and disabled (SW hygiene). */
  activeTimerCount(): number;
  dispose(): void;
}

export function createIconStateMachine(deps: {
  timers: IconTimers;
  onChange: (render: IconRender) => void;
  frameMs?: number;
  flashMs?: number;
}): IconStateMachine {
  const frameMs = deps.frameMs ?? DEFAULT_FRAME_MS;
  const flashMs = deps.flashMs ?? DEFAULT_FLASH_MS;

  let enabled = true;
  let activeCount = 0;
  let phase: IconPhase = 'idle';
  let frameIndex = 0;
  let sawSuccess = false;
  let sawFail = false;
  let intervalHandle: unknown = null;
  let flashHandle: unknown = null;

  function timersLive(): number {
    return (intervalHandle !== null ? 1 : 0) + (flashHandle !== null ? 1 : 0);
  }

  function clearTimers(): void {
    if (intervalHandle !== null) {
      deps.timers.clearInterval(intervalHandle);
      intervalHandle = null;
    }
    if (flashHandle !== null) {
      deps.timers.clearTimeout(flashHandle);
      flashHandle = null;
    }
  }

  function emit(): void {
    deps.onChange({ phase, frameIndex });
  }

  function setPhase(next: IconPhase, nextFrame = frameIndex): void {
    if (phase === next && frameIndex === nextFrame) return;
    phase = next;
    frameIndex = nextFrame;
    emit();
  }

  function startActive(): void {
    clearTimers();
    sawSuccess = false;
    sawFail = false;
    intervalHandle = deps.timers.setInterval(() => {
      frameIndex = (frameIndex + 1) % SPIN_FRAME_COUNT;
      emit();
    }, frameMs);
    setPhase('active', 0);
  }

  function settleAfterDrain(): void {
    clearTimers();
    const flash = sawFail ? 'error-flash' : sawSuccess ? 'success-flash' : null;
    if (flash === null) {
      setPhase('idle');
      return;
    }
    flashHandle = deps.timers.setTimeout(() => {
      flashHandle = null;
      setPhase('idle');
    }, flashMs);
    setPhase(flash);
  }

  return {
    setEnabled(next: boolean): void {
      if (next === enabled) return;
      enabled = next;
      if (!enabled) {
        clearTimers();
        setPhase('disabled', 0);
        return;
      }
      if (activeCount > 0) startActive();
      else setPhase('idle', 0);
    },

    setActiveCount(count: number): void {
      const prev = activeCount;
      activeCount = Math.max(0, count);
      if (!enabled || prev === activeCount) return;
      if (activeCount > 0) {
        if (phase !== 'active') startActive();
        return;
      }
      settleAfterDrain();
    },

    notifySettled(kind: SettleKind): void {
      if (kind === 'success') sawSuccess = true;
      else if (kind === 'fail') sawFail = true;
    },

    getState(): IconStateSnapshot {
      return { phase, frameIndex, activeCount, enabled };
    },

    activeTimerCount: timersLive,

    dispose: clearTimers,
  };
}
