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
      const engineV2 = new EngineV2();
      engineRegistry.register(new EngineV1());
      engineRegistry.register(engineV2);
      engineRegistry.register(new EngineV3());

      console.log('[CQD V2 Bootstrap] Engines registered:', engineRegistry.getSummary());

      // 1b. S11 additive: extension-world perf probe — `__cqdPerfSnapshot()`
      //     returns the V2 engine's live timing histograms (currently the
      //     handleMutations fast-pass label, the <6ms p95 budget metric) plus
      //     the #615 selector audit (hash-id fallback rate — the Classroom
      //     markup-drift early warning, ENGINE_V4_SYSTEM_DESIGN §5 rule 1).
      //     Getter-shaped like __cqdDomPortInfo so every call reads current
      //     state, and plain-object/number-only so it serializes over CDP.
      //     Content scripts run in an isolated world, so the page's main
      //     world never sees this; qa-perf reads it over CDP Runtime.evaluate.
      const perfHost = window as unknown as {
        __cqdPerfSnapshot?: () => {
          handleMutations: import('../src/v2/telemetry/performance-monitor').TimingPercentiles | null;
          selectorStats: import('../src/engines/types').SelectorStats;
        };
      };
      perfHost.__cqdPerfSnapshot ??= () => ({
        handleMutations: engineV2.getMutationTimings(),
        selectorStats: engineV2.getSelectorStats(),
      });

      // 2. Initialize mode controller
      //    Reads cqdV2Mode from chrome.storage.local (default: 'legacy' —
      //    shadow is an explicit opt-in, see mode-controller.ts D9)
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

      // 3b. Bridge relay (S6/G2): page bus download topics cross the
      //     BridgePort to the background worker. Inert until something
      //     publishes download:requested — zero behavior change today.
      const { createPageRuntimeBridge } = await import('../src/adapters/bridge/runtime-bridge');
      const { wireBridgeRelay } = await import('../src/v2/orchestrator/bridge-relay');
      wireBridgeRelay(orchestrator.getBus(), createPageRuntimeBridge());

      // 3c. Download path (z57 S1): the page-side caller for the bridge —
      //     delegated button clicks publish download:requested on the page
      //     bus and drive button states from download:settled. Wired before
      //     the orchestrator's first scan so a click can never race the bus.
      const { wireDownloadPath } = await import('../src/v2/render/download-controller');
      wireDownloadPath(orchestrator.getBus());

      // 3d. Download All group machine (z57 S3): the Download All run state
      //     machine driving staggered per-file requests through the same bus
      //     path, with cancel over the existing CQD_CANCEL_DOWNLOAD message.
      await import('../src/v2/render/download-all-controller').then((m) =>
        m.installDownloadAllController(),
      );

      // 3d-2. Classroom-wide download (csaa.6): the "Download all classroom
      //     files" button for v3 mode on classwork routes. Rendering is gated
      //     structurally — only EngineV3 calls ensureClassroomButton, and v3
      //     mode already implies isApiConfigured + explicit API-beta consent.
      await import('../src/v2/render/classroom-download-controller').then((m) =>
        m.installClassroomDownloadController({ bus: orchestrator.getBus() }),
      );

      // 3e. Live flag toggles (z57 S4): the popup's cqd-flag-toggle message
      //     flips badge visibility without a reload (qa-03 golden rule 8).
      //     Inert in non-v2 modes — the badge registry is empty when V2
      //     doesn't render, so V1's own listeners stay the only handlers.
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        const { applyFlagToggle } = await import('../src/v2/render/flag-renderer');
        chrome.runtime.onMessage.addListener((message: { type?: string; flag?: string; enabled?: boolean }) => {
          if (!message || message.type !== 'cqd-flag-toggle') return;
          if (message.flag === 'commentsFlagEnabled' || message.flag === 'editedFlagEnabled') {
            applyFlagToggle(message.flag, message.enabled !== false);
          }
        });
      }

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
