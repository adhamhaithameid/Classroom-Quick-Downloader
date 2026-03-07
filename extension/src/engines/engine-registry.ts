// filepath: extension/src/engines/engine-registry.ts
/**
 * ============================================================================
 * ENGINE REGISTRY — The Switchboard Between V1, V2, and V3
 * ============================================================================
 *
 * This is the central registry that knows about all available engines
 * and controls which one is active. It's the glue between the
 * chrome.storage mode setting and the actual engine instances.
 *
 * The registry pattern is simple:
 * 1. At startup, register all available engines (V1, V2, V3)
 * 2. Read the user's mode preference from chrome.storage
 * 3. Activate the appropriate engine(s) based on the mode
 *
 * Mode → Engine mapping:
 * - 'legacy' → Only V1 runs (current behavior, zero risk)
 * - 'shadow' → V1 renders, V2 runs silently for comparison
 * - 'v2'     → Only V2 runs (the new hotness)
 * - 'v3'     → V2 + API integration (future Google API) - i hope this shit works fr
 *
 * The shadow mode is the secret sauce of the migration strategy.
 * We can ship shadow mode to 100% of users, collect telemetry
 * comparing V1 vs V2 decisions, fix any regressions, and THEN
 * flip to V2 mode with confidence. No big-bang migration.
 *
 * I learned this pattern from reading about how Facebook migrated
 * from their old React reconciler to Fiber. Ship them side by side,
 * compare, iterate, then switch. Genius.
 *
 * @author Adham — the one file that makes rollback safe 🤞🏻
 * @since v4.0.0
 */

import type { CQDEngine, EngineMode, ViewKind } from './types';

// ============================================================================
// REGISTRY CLASS
// ============================================================================

/**
 * EngineRegistry — manages the lifecycle of all engine versions.
 *
 * Usage in the orchestrator:
 *   const registry = new EngineRegistry();
 *   registry.register(v1Engine);
 *   registry.register(v2Engine);
 *   registry.setMode('shadow'); // V1 renders, V2 runs silently
 *
 *   // On navigation:
 *   const engines = registry.getActiveEngines();
 *   for (const engine of engines) {
 *     await engine.init(viewKind, signal);
 *   }
 *
 * The registry doesn't own the engines' lifecycle — it just knows
 * which ones should be active. The orchestrator handles init/destroy.
 */
export class EngineRegistry {
  /** All registered engine instances, keyed by name */
  private engines: Map<string, CQDEngine> = new Map();

  /** Current mode — determines which engines are active */
  private mode: EngineMode = 'legacy';

  /** Callback fired when the mode changes */
  private onModeChange: ((mode: EngineMode) => void) | null = null;

  // ========================================================================
  // REGISTRATION
  // ========================================================================

  /**
   * Register an engine instance.
   * Must be called before setMode to ensure engines are available.
   *
   * @param engine - The engine to register (V1, V2, or V3)
   * @throws Error if an engine with the same name is already registered
   */
  register(engine: CQDEngine): void {
    if (this.engines.has(engine.name)) {
      console.warn(
        `[CQD Registry] Engine "${engine.name}" is already registered. ` +
        `Replacing with new instance.`,
      );
    }
    this.engines.set(engine.name, engine);
    console.log(
      `[CQD Registry] Registered engine: ${engine.name} v${engine.version}`,
    );
  }

  /**
   * Unregister an engine by name.
   * The engine's destroy() method is NOT called here — the orchestrator
   * should handle cleanup before calling this.
   */
  unregister(name: string): void {
    this.engines.delete(name);
  }

  // ========================================================================
  // MODE MANAGEMENT
  // ========================================================================

  /**
   * Set the engine mode.
   *
   * This is the "big red button" that controls which engine(s) are active.
   * In the real app, this is called from:
   * 1. chrome.storage sync on startup (loads the user's preference)
   * 2. The debug panel (for live testing)
   * 3. chrome.runtime.onMessage (for remote toggling from popup)
   *
   * @param mode - The mode to switch to
   */
  setMode(mode: EngineMode): void {
    if (mode === this.mode) return;

    const previousMode = this.mode;
    this.mode = mode;

    console.log(
      `[CQD Registry] Mode changed: ${previousMode} → ${mode}`,
    );

    if (this.onModeChange) {
      this.onModeChange(mode);
    }
  }

  /**
   * Get the current mode.
   */
  getMode(): EngineMode {
    return this.mode;
  }

  /**
   * Set a callback for mode changes.
   * The orchestrator uses this to re-initialize engines when the user
   * switches modes from the debug panel.
   */
  setModeChangeCallback(callback: (mode: EngineMode) => void): void {
    this.onModeChange = callback;
  }

  // ========================================================================
  // ENGINE LOOKUP
  // ========================================================================

  /**
   * Get all engines that should be ACTIVE in the current mode.
   *
   * The mapping is:
   * - 'legacy' → [V1]         — business as usual
   * - 'shadow' → [V1, V2]     — V1 renders, V2 runs silently
   * - 'v2'     → [V2]         — V2 takes over
   * - 'v3'     → [V3]         — V2 + API (future)
   *
   * The first engine in the array is the "primary" — it handles rendering.
   * The rest are "secondary" — they run for comparison but don't render.
   */
  getActiveEngines(): CQDEngine[] {
    switch (this.mode) {
      case 'legacy':
        return this.getEnginesByNames(['engine-v1']);

      case 'shadow':
        // V1 first (primary/renders), V2 second (silent comparison)
        return this.getEnginesByNames(['engine-v1', 'engine-v2']);

      case 'v2':
        return this.getEnginesByNames(['engine-v2']);

      case 'v3':
        return this.getEnginesByNames(['engine-v3']);

      default:
        // Safety fallback — if somehow we get an unknown mode, use legacy
        console.warn(`[CQD Registry] Unknown mode "${this.mode}", falling back to legacy`);
        return this.getEnginesByNames(['engine-v1']);
    }
  }

  /**
   * Get the PRIMARY engine (the one that controls rendering).
   *
   * In shadow mode, the primary is V1 (the legacy engine).
   * In V2 mode, the primary IS V2.
   */
  getPrimaryEngine(): CQDEngine | null {
    const active = this.getActiveEngines();
    return active[0] ?? null;
  }

  /**
   * Get SECONDARY engines (run for comparison, don't render).
   * In shadow mode, this returns [V2].
   * In other modes, this returns [].
   */
  getSecondaryEngines(): CQDEngine[] {
    const active = this.getActiveEngines();
    return active.slice(1);
  }

  /**
   * Get a specific engine by name.
   */
  getEngine(name: string): CQDEngine | null {
    return this.engines.get(name) ?? null;
  }

  /**
   * Get all registered engines (regardless of whether they're active).
   */
  getAllRegistered(): CQDEngine[] {
    return Array.from(this.engines.values());
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Get engines by their names, filtering out any that aren't registered.
   * Logs a warning if a requested engine isn't found.
   */
  private getEnginesByNames(names: string[]): CQDEngine[] {
    const result: CQDEngine[] = [];
    for (const name of names) {
      const engine = this.engines.get(name);
      if (engine) {
        result.push(engine);
      } else {
        console.warn(
          `[CQD Registry] Engine "${name}" requested but not registered. ` +
          `Available engines: ${Array.from(this.engines.keys()).join(', ')}`,
        );
      }
    }
    return result;
  }

  /**
   * Get a human-readable summary of the registry state.
   */
  getSummary(): string {
    const registered = Array.from(this.engines.entries());
    const active = this.getActiveEngines().map(e => e.name);

    const lines: string[] = [
      `EngineRegistry:`,
      `  Mode: ${this.mode}`,
      `  Registered engines:`,
    ];

    for (const [name, engine] of registered) {
      const isActive = active.includes(name);
      const marker = isActive ? '🟢' : '⚪';
      lines.push(`    ${marker} ${name} v${engine.version}${isActive ? ' (active)' : ''}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * The global engine registry instance.
 *
 * I debated whether to use a singleton vs dependency injection.
 * Went with singleton because:
 * 1. There's only ever ONE registry per tab
 * 2. It needs to be accessible from the orchestrator AND the debug panel
 * 3. Making it injectable would add complexity for zero benefit
 *
 * If you're reading this thinking "singletons are bad!" — you're right
 * in most cases, but extension content scripts are basically a single
 * instance running in a single tab. There's no testing concern because
 * Vitest creates a fresh module scope per test anyway.
 */
export const engineRegistry = new EngineRegistry();
