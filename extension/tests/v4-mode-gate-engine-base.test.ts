// filepath: extension/tests/v4-mode-gate-engine-base.test.ts
/**
 * ============================================================================
 * MODE GATE x ENGINE BASE — flag-gated V1 suppression in mode 'v3'
 * ============================================================================
 *
 * Pins the mode-gate half of the engineBase flag (docs/audit/
 * 2026-11-18-v3-base-design.md, target-design item 3):
 * - Flag OFF: mode 'v3' does NOT suppress the V1 stacks (today, pinned).
 * - Flag ON ('v3'): the registry's 'v3' fallback is V2-only and V3 renders
 *   through the V2 render layer, so the V1 stacks stay inert in 'v3' too.
 *   Modes 'v2' (always suppresses) and 'legacy' (never) keep their meaning.
 *
 * Load idiom: v4-mode-gate.test.ts — dynamic import after vi.resetModules()
 * so the test's setEngineBase() call and the gate's getEngineBase() read hit
 * the SAME fresh engine-base instance (mode-gate → mode-controller →
 * engine-registry → engine-base). No timers are involved (the storage mock
 * answers callback-style synchronously), matching how that file's
 * isV1Suppressed/onEngineModeChange suites run under the global fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type OnChangedListener = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => void;

let onChangedListeners: OnChangedListener[] = [];

/** Point chrome.storage.local at a stored engine mode ('undefined' = empty). */
function storedMode(mode: string | undefined): void {
  chrome.storage.local.get = vi.fn().mockImplementation(
    (keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> =
        mode === undefined ? {} : { cqdV2Mode: mode };
      if (typeof cb === 'function') {
        cb(result);
        return undefined;
      }
      return Promise.resolve(result);
    },
  );
}

/** Fresh mode-gate + fresh engine-base, sharing one post-reset module graph. */
async function loadGateAndFlag() {
  const gate = await import('../entrypoints/content/mode-gate');
  const { setEngineBase } = await import('../src/engines/engine-base');
  return { gate, setEngineBase };
}

beforeEach(() => {
  vi.resetModules();
  onChangedListeners = [];
  storedMode(undefined);
  chrome.storage.onChanged.addListener = vi.fn((cb: OnChangedListener) => {
    onChangedListeners.push(cb);
  });
  chrome.storage.onChanged.removeListener = vi.fn((cb: OnChangedListener) => {
    const index = onChangedListeners.indexOf(cb);
    if (index >= 0) onChangedListeners.splice(index, 1);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */
/* isV1Suppressed                                                      */
/* ------------------------------------------------------------------ */

describe('isV1Suppressed with the engineBase flag', () => {
  it("flag OFF + mode 'v3' → false (today, pinned)", async () => {
    storedMode('v3');
    const { gate } = await loadGateAndFlag();
    await expect(gate.isV1Suppressed()).resolves.toBe(false);
  });

  it("flag ON + mode 'v3' → true (V2-only fallback, no V1 pair)", async () => {
    storedMode('v3');
    const { gate, setEngineBase } = await loadGateAndFlag();
    setEngineBase('v3');
    await expect(gate.isV1Suppressed()).resolves.toBe(true);
  });

  it("flag ON + mode 'v2' → true (V2 renders — unchanged by the flag)", async () => {
    storedMode('v2');
    const { gate, setEngineBase } = await loadGateAndFlag();
    setEngineBase('v3');
    await expect(gate.isV1Suppressed()).resolves.toBe(true);
  });

  it("flag ON + mode 'legacy' → false (rollback mode — unchanged by the flag)", async () => {
    storedMode('legacy');
    const { gate, setEngineBase } = await loadGateAndFlag();
    setEngineBase('v3');
    await expect(gate.isV1Suppressed()).resolves.toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* onEngineModeChange                                                  */
/* ------------------------------------------------------------------ */

describe('onEngineModeChange with the engineBase flag', () => {
  it("flag ON: immediate fire for stored 'v3' is suppressed", async () => {
    storedMode('v3');
    const { gate, setEngineBase } = await loadGateAndFlag();
    setEngineBase('v3');
    const cb = vi.fn();
    gate.onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('flag OFF: immediate fire for stored v3 stays unsuppressed (today, pinned)', async () => {
    storedMode('v3');
    const { gate } = await loadGateAndFlag();
    const cb = vi.fn();
    gate.onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(false);
  });

  it('flag ON: a live flip to v3 fires suppressed, a flip to legacy does not', async () => {
    storedMode('v2');
    const { gate, setEngineBase } = await loadGateAndFlag();
    setEngineBase('v3');
    const cb = vi.fn();
    gate.onEngineModeChange(cb);
    expect(cb).toHaveBeenLastCalledWith(true);

    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'v3' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(true);

    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'legacy' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(false);

    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'v2' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(true);
  });
});
