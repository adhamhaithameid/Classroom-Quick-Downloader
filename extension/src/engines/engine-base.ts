// filepath: extension/src/engines/engine-base.ts
/**
 * ============================================================================
 * ENGINE BASE FLAG — picks the base engine for mode 'v3' (2026-11-18 design)
 * ============================================================================
 *
 * engineBase selects what mode 'v3' falls back to when the Classroom API is
 * not configured (isApiConfigured() false — see v3/api/config.ts):
 *
 * - 'v2' (default, flag OFF): today's behavior byte-identical. The registry
 *   falls back to the V1+V2 shadow pair and the content mode gate keeps V1
 *   rendering in 'v3'.
 * - 'v3' (flag ON): engine-v3 is the base engine. The registry's fallback
 *   becomes pure V2 DOM (V3 renders through the V2 render layer), and the
 *   mode gate suppresses the V1 stacks in 'v3' to match — this also fixes
 *   the double-UI defect where V1 stacks ran alongside V3's V2-render output.
 *
 * The shipped default is 'v2' — this chat ships the code path OFF. Flipping
 * the shipped default to 'v3' is a later owner PR (one line here; see
 * docs/audit/2026-11-18-v3-base-design.md, Rollout). setEngineBase() exists
 * as a test seam and the future wiring point, not as a user setting.
 *
 * PERSISTENCE (82gr): `engineBase` below is module state, so the background
 * worker, every content script, the popup and the options page each hold
 * their OWN copy. The shared truth is chrome.storage.local under
 * ENGINE_BASE_STORAGE_KEY. setEngineBasePersisted() writes it; every context
 * awaits loadEngineBase() at init, before any gate reads the flag (content:
 * readMode() and the mode gate; popup and options: before first render;
 * background: at startup). No storage, a read failure or an invalid value all
 * mean 'v2' (OFF). Contexts already running do not follow a later flip: they
 * pick it up on their next load (page reload, popup open, worker wake).
 *
 * This module imports nothing from the v3 stack — like v3/api/config.ts,
 * both the engine registry and the content-script mode gate can depend on
 * it without dragging the v3 stack (or any browser API) into their bundles.
 */

/** Which engine family acts as the base for mode 'v3'. */
export type EngineBase = 'v2' | 'v3';

/** The flag. Module-scoped so a fresh module evaluation resets it to OFF. */
let engineBase: EngineBase = 'v2';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

/** Read the current base-engine flag. */
export function getEngineBase(): EngineBase {
  return engineBase;
}

/** Set the base-engine flag (test seam + future wiring point). */
export function setEngineBase(base: EngineBase): void {
  engineBase = base;
}

/** chrome.storage.local key holding the persisted base-engine flag. */
export const ENGINE_BASE_STORAGE_KEY = 'cqdEngineBase';

function isEngineBase(value: unknown): value is EngineBase {
  return value === 'v2' || value === 'v3';
}

/**
 * Apply a raw stored value. Absent (undefined) keeps the current value: the
 * fresh-context default is already OFF, and the test seam setEngineBase()
 * must survive a load against an empty store. A present but invalid value
 * is OFF.
 */
export function applyStoredEngineBase(value: unknown): EngineBase {
  if (value !== undefined) engineBase = isEngineBase(value) ? value : 'v2';
  return engineBase;
}

/**
 * Load the persisted flag into this context. Never rejects: a missing
 * chrome.storage or a failed read leaves the flag OFF ('v2').
 */
export async function loadEngineBase(): Promise<EngineBase> {
  try {
    const result = await chrome.storage.local.get(ENGINE_BASE_STORAGE_KEY);
    return applyStoredEngineBase(result?.[ENGINE_BASE_STORAGE_KEY]);
  } catch {
    engineBase = 'v2';
    return engineBase;
  }
}

/**
 * Persist the flag, then apply it here. Rejects when the write fails and
 * leaves this context unchanged, so it never runs ahead of the store.
 */
export async function setEngineBasePersisted(base: EngineBase): Promise<void> {
  await chrome.storage.local.set({ [ENGINE_BASE_STORAGE_KEY]: base });
  engineBase = base;
}
