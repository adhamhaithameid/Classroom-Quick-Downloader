// filepath: extension/entrypoints/content/mode-gate.ts
/**
 * MODE GATE — keeps the V1 self-starting stacks inert while V2 renders.
 * ============================================================================
 *
 * The engine mode lives in chrome.storage.local under 'cqdV2Mode' and is
 * owned by src/v2/orchestrator/mode-controller.ts. While the mode is 'v2'
 * the V2 engine owns rendering, so the six V1 self-starting stacks must
 * not start. Every other mode lets V1 behave exactly as before:
 *   - 'legacy' → V1 renders (rollback mode)
 *   - 'shadow' → V1 renders, V2 compares silently
 *   - 'v3'     → flag OFF: the registry falls back to the V1+V2 shadow
 *                pair until the identity permission lands, so V1 keeps
 *                rendering. Flag ON (engineBase='v3', engine-base.ts):
 *                the fallback is V2-only and V3 renders through the V2
 *                render layer, so the V1 stacks stay inert here too.
 *
 * The flow:
 * 1. A V1 entrypoint wraps its start/stop pair in gateV1Stack()
 * 2. onEngineModeChange fires immediately with the current suppression
 * 3. chrome.storage.onChanged re-fires it on live mode flips
 * 4. Suppressed → the stack's own stop path runs; unsuppressed → the
 *    stack hot-starts if the entrypoint's own gating wanted it running
 *
 * The single source of truth for the storage key and the default mode is
 * mode-controller.ts, which exports MODE_STORAGE_KEY and isValidMode — this
 * module consumes them instead of holding its own copy (#887).
 *
 * @author Adham — one gate to keep the rollback honest
 * @since v4.1.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

import {
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  isValidMode,
  readMode,
} from '../../src/v2/orchestrator/mode-controller';
import { getEngineBase } from '../../src/engines/engine-base';
import type { EngineMode } from '../../src/engines/types';

export type { EngineMode };

/**
 * The registry-alignment rule for V1 suppression: 'v2' always suppresses
 * (V2 runs alone there). 'v3' suppresses only when the engineBase flag is
 * ON — the registry's 'v3' fallback is then V2-only and V3 renders through
 * the V2 render layer, so the V1 stacks have no rendering job in 'v3'
 * (this also fixes the double-UI defect in v3 mode). With the flag OFF
 * this reduces to exactly the historical rule: mode === 'v2'.
 */
function suppressesV1(mode: EngineMode): boolean {
  return mode === 'v2' || (mode === 'v3' && getEngineBase() === 'v3');
}

/**
 * True when the V1 self-starting stacks must stay inert (V2 renders).
 *
 * Suppression mirrors the registry's getActiveEngines() semantics via
 * suppressesV1(): mode 'v2', plus mode 'v3' when engineBase is 'v3'.
 * Storage-empty and invalid values fall back to DEFAULT_MODE.
 */
export async function isV1Suppressed(): Promise<boolean> {
  try {
    return suppressesV1(await readMode());
  } catch {
    return suppressesV1(DEFAULT_MODE);
  }
}

/**
 * Fires immediately with the current suppression, then on every
 * chrome.storage.onChanged flip of the engine-mode key.
 * Returns an unsubscribe function.
 */
export function onEngineModeChange(cb: (suppressed: boolean) => void): () => void {
  const suppressedFrom = (mode: unknown): boolean =>
    suppressesV1(isValidMode(mode) ? mode : DEFAULT_MODE);

  const safeCb = (suppressed: boolean): void => {
    try {
      cb(suppressed);
    } catch (e) {
      console.warn('[CQD ModeGate] suppression callback failed:', e);
    }
  };

  if (typeof chrome !== 'undefined' && chrome?.storage?.local?.get) {
    try {
      // Callback style: resolves synchronously in tests, async in production.
      chrome.storage.local.get(MODE_STORAGE_KEY, (result: Record<string, unknown>) => {
        safeCb(suppressedFrom(result?.[MODE_STORAGE_KEY]));
      });
    } catch (e) {
      console.warn('[CQD ModeGate] initial mode read failed:', e);
    }
  } else {
    safeCb(DEFAULT_MODE === 'v2');
  }

  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) {
    return () => {};
  }

  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    const change = changes[MODE_STORAGE_KEY];
    if (!change) return;
    safeCb(suppressedFrom(change.newValue));
  };

  try {
    chrome.storage.onChanged.addListener(listener);
  } catch (e) {
    console.warn('[CQD ModeGate] failed to subscribe to storage changes:', e);
    return () => {};
  }

  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener);
    } catch { /* ignore */ }
  };
}

/**
 * Wraps a V1 stack's start/stop pair with the engine-mode gate.
 *
 * The returned pair is a drop-in replacement for the callbacks the
 * entrypoint used to pass to subscribeToGlobalState: the stack starts
 * only when the caller's own gating asks for it AND the mode is not
 * 'v2'. A live flip to 'v2' runs the stack's own stop path; a flip away
 * from 'v2' hot-starts it if the caller's gating wanted it running.
 */
export function gateV1Stack(opts: {
  start: () => void;
  stop: () => void;
}): { start: () => void; stop: () => void } {
  const { start, stop } = opts;
  // null until the first mode read lands; wanted tracks whether the
  // caller's own gating (enabled flag, tab state, ...) currently asks
  // for the stack — suppression must not flip that decision.
  let suppressed: boolean | null = null;
  let wanted = false;

  const apply = (): void => {
    if (suppressed === null) return;
    if (wanted && !suppressed) {
      start();
    } else {
      stop();
    }
  };

  onEngineModeChange((s) => {
    suppressed = s;
    apply();
  });

  return {
    start() {
      wanted = true;
      if (suppressed === null) {
        // First request may race the initial mode read — resolve, then apply.
        void isV1Suppressed().then((s) => {
          if (suppressed === null) {
            suppressed = s;
            apply();
          }
        });
        return;
      }
      apply();
    },
    stop() {
      wanted = false;
      apply();
    },
  };
}
