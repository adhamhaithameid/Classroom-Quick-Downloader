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
 * This module imports nothing from the v3 stack — like v3/api/config.ts,
 * both the engine registry and the content-script mode gate can depend on
 * it without dragging the v3 stack (or any browser API) into their bundles.
 */

/** Which engine family acts as the base for mode 'v3'. */
export type EngineBase = 'v2' | 'v3';

/** The flag. Module-scoped so a fresh module evaluation resets it to OFF. */
let engineBase: EngineBase = 'v2';

/** Read the current base-engine flag. */
export function getEngineBase(): EngineBase {
  return engineBase;
}

/** Set the base-engine flag (test seam + future wiring point). */
export function setEngineBase(base: EngineBase): void {
  engineBase = base;
}
