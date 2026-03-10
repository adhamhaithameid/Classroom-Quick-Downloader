// filepath: entrypoints/v2_bootstrap.content.ts
/**
 * ============================================================================
 * V2 BOOTSTRAP — Wires the Multi-Engine Architecture into the Extension
 * ============================================================================
 *
 * This content script is the bridge between the engine architecture
 * (EngineV1, EngineV2, EngineV3, EngineRegistry, Orchestrator) and
 * the browser extension runtime.
 *
 * Without this script, all the V2 code is dead — it only runs in tests.
 * This script:
 *   1. Creates engine instances and registers them in the registry
 *   2. Initializes the mode controller (reads cqdV2Mode from storage)
 *   3. Starts the orchestrator (route watching + engine lifecycle)
 *
 * The orchestrator then takes over:
 *   - RouteWatcher detects the current Classroom page type (ViewKind)
 *   - Registry returns the active engines for the current mode
 *   - Each engine's init() is called with the ViewKind + AbortSignal
 *   - A shared MutationObserver feeds mutations to all active engines
 *
 * Mode behavior:
 *   'legacy' → [EngineV1] active (V1 wrapper — existing scripts handle everything)
 *   'shadow' → [EngineV1, EngineV2] active (V1 renders, V2 runs silently)
 *   'v2'     → [EngineV2] active (V2 takes over rendering)
 *   'v3'     → [EngineV3] active (V2 + API integration — future)
 *
 * IMPORTANT: This script uses dynamic imports to prevent module-level
 * crashes from breaking other content scripts. If V2 code fails to
 * load, legacy features continue to work unaffected.
 *
 * @author Adham — finally connecting the engine to the car
 * @since v4.0.0
 */

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  async main() {
    try {
      // Dynamic imports to prevent module-level errors from
      // breaking other content scripts (legacy downloads, flags, etc.)
      const [
        { EngineV1, EngineV2, EngineV3, engineRegistry },
        { initModeController },
        { orchestrator },
      ] = await Promise.all([
        import('../src/engines'),
        import('../src/v2/orchestrator/mode-controller'),
        import('../src/v2/orchestrator/orchestrator'),
      ]);

      // 1. Register engine instances
      engineRegistry.register(new EngineV1());
      engineRegistry.register(new EngineV2());
      engineRegistry.register(new EngineV3());

      console.log('[CQD V2 Bootstrap] Engines registered:', engineRegistry.getSummary());

      // 2. Initialize mode controller
      //    Reads cqdV2Mode from chrome.storage.local (default: 'shadow')
      //    Sets up message listener for popup → content script mode changes
      //    Sets up storage.onChanged listener for cross-tab mode sync
      await initModeController();

      console.log('[CQD V2 Bootstrap] Mode controller initialized, mode:', engineRegistry.getMode());

      // 3. Start the orchestrator
      //    Creates RouteWatcher (URL → ViewKind classification)
      //    Sets mode-change callback for live switching
      //    Initializes engines for the current page
      //    In shadow mode: starts ShadowComparator for V1 vs V2 comparison
      orchestrator.start();

      console.log('[CQD V2 Bootstrap] Orchestrator started');

      // 4. Initialize debug panel (Ctrl+Shift+D to toggle)
      try {
        const { initDebugPanel } = await import('../src/v2/debug/debug-panel');
        await initDebugPanel();
      } catch {
        // Debug panel is non-critical — silently skip on error
      }
    } catch (e) {
      // This MUST NOT propagate — legacy features must keep working
      console.error('[CQD V2 Bootstrap] Failed to initialize (legacy unaffected):', e);
    }
  },
});
