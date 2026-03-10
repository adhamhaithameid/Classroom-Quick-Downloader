// filepath: extension/src/v2/orchestrator/mode-controller.ts
/**
 * ============================================================================
 * MODE CONTROLLER — The Gatekeeper for Engine Modes
 * ============================================================================
 *
 * This module handles reading and writing the engine mode setting
 * from chrome.storage, and wiring it to the EngineRegistry.
 *
 * The mode is stored in chrome.storage.local under the key 'cqdV2Mode'.
 * Possible values: 'legacy' | 'shadow' | 'v2' | 'v3'
 *
 * Why chrome.storage.local instead of .sync?
 * Because shadow mode is a per-device debugging tool. I don't want
 * someone turning on shadow mode on their laptop and having it
 * propagate to their school Chromebook. Each device should be
 * independent for testing purposes.
 *
 * The flow:
 * 1. Extension loads → readMode() reads from storage (default: 'legacy')
 * 2. Mode is set in the EngineRegistry
 * 3. User changes mode via debug panel → setMode() writes to storage
 * 4. Registry fires onModeChange callback → Orchestrator re-initializes
 *
 * Why not just put this in the registry? Separation of concerns.
 * The registry is a pure TypeScript class with no browser API deps.
 * This module handles the browser-specific chrome.storage integration.
 * This makes the registry testable with Vitest (no chrome mock needed).
 *
 * I also added a chrome.runtime.onMessage listener so the popup can
 * change the mode without the user needing to open the debug panel.
 * This is important for the rollback scenario — if V2 breaks something,
 * the user can switch back from the extension popup.
 *
 * @author Adham — keeping the popup → content script pipeline working
 * @since v4.0.0
 */

import type { EngineMode } from '../../engines/types';
import { engineRegistry } from '../../engines/engine-registry';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * The chrome.storage key for the engine mode.
 *
 * I prefixed it with 'cqdV2' so it doesn't collide with any
 * existing V1 storage keys. The V1 code uses 'cqd-' prefix
 * for its keys, so 'cqdV2Mode' is safe.
 */
const STORAGE_KEY = 'cqdV2Mode';

/**
 * The default mode when no setting is found in storage.
 *
 * CHANGED from 'legacy' to 'shadow' to start V2 validation:
 * - V1 (legacy) handles all rendering — user sees no difference
 * - V2 runs silently, logging detection results for comparison
 * - ShadowComparator reports mismatches every 10s
 *
 * The rollout plan:
 * 1. v4.0.0-alpha: Default 'shadow', V2 runs silently for validation
 * 2. v4.0.0: Default 'v2' after shadow validation succeeds
 * 3. v4.2.1: 'v3' available behind a flag (API-enhanced)
 *
 * To revert: set cqdV2Mode='legacy' in chrome.storage.local
 */
const DEFAULT_MODE: EngineMode = 'shadow';

// ============================================================================
// READ / WRITE
// ============================================================================

/**
 * Read the current mode from chrome.storage.
 *
 * Falls back to DEFAULT_MODE if:
 * - Storage is empty (first install)
 * - Storage has an invalid value (data corruption)
 * - Storage read fails (permissions issue, quota exceeded)
 *
 * I've wrapped everything in try/catch because chrome.storage can throw
 * in restricted contexts (like if the extension is suspended).
 */
export async function readMode(): Promise<EngineMode> {
  try {
    // chrome.storage might not be available in all contexts
    // (e.g., in Vitest tests without a chrome mock)
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      return DEFAULT_MODE;
    }

    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];

    if (isValidMode(stored)) {
      return stored;
    }

    return DEFAULT_MODE;
  } catch (e) {
    console.warn(`[CQD Mode] Failed to read mode from storage:`, e);
    return DEFAULT_MODE;
  }
}

/**
 * Write a mode to chrome.storage and update the registry.
 *
 * This is the "official" way to change the engine mode.
 * It writes to storage first (so the setting persists across reloads),
 * then updates the registry (which triggers the mode change callback
 * in the orchestrator).
 */
export async function setMode(mode: EngineMode): Promise<void> {
  if (!isValidMode(mode)) {
    console.error(`[CQD Mode] Invalid mode: "${mode}". Must be: legacy, shadow, v2, v3`);
    return;
  }

  try {
    // Write to storage
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: mode });
    }

    // Update the registry (fires the mode change callback)
    engineRegistry.setMode(mode);

    console.log(`[CQD Mode] Mode set to: ${mode}`);
  } catch (e) {
    console.error(`[CQD Mode] Failed to set mode:`, e);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the mode controller.
 *
 * Call this at startup to:
 * 1. Read the mode from storage
 * 2. Set it in the registry
 * 3. Set up the message listener for remote mode changes
 *
 * This should be called BEFORE the orchestrator starts so the
 * registry has the correct mode before any engines are initialized.
 */
export async function initModeController(): Promise<void> {
  // 1. Read saved mode
  const mode = await readMode();
  engineRegistry.setMode(mode);

  console.log(`[CQD Mode] Initialized with mode: ${mode}`);

  // 2. Listen for mode change messages from popup/background
  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'cqd-set-mode' && isValidMode(message.mode)) {
        setMode(message.mode).then(() => {
          sendResponse({ success: true, mode: message.mode });
        });
        return true; // Keep the message channel open for async response
      }
    });
  }

  // 3. Listen for storage changes (e.g., from another tab)
  if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newMode = changes[STORAGE_KEY].newValue;
        if (isValidMode(newMode)) {
          engineRegistry.setMode(newMode);
          console.log(`[CQD Mode] Mode updated from storage change: ${newMode}`);
        }
      }
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate that a value is a valid EngineMode.
 */
function isValidMode(value: unknown): value is EngineMode {
  return (
    typeof value === 'string' &&
    ['legacy', 'shadow', 'v2', 'v3'].includes(value)
  );
}
