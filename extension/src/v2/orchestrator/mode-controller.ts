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
 * 1. Extension loads → readMode() reads from storage (default: 'v2',
 *    DEFAULT_MODE below)
 * 2. Mode is set in the EngineRegistry
 * 3. User changes mode via the popup's engine control → setMode() writes to storage
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
import { isApiConfigured } from '../../engines/v3/api/config';
import { decideRoute, type CandidateInput } from '../../engines/router/router-policy';
import { ROUTER_STATS_STORAGE_KEY, type RouterStatsState } from '../../engines/router/router-stats';

/**
 * A stored mode may be 'auto' (bead hhpa.3): the router resolves it to a
 * concrete EngineMode from the local outcome stats before the registry
 * sees it. The registry API stays concrete-only by design.
 */
export type StoredEngineMode = EngineMode | 'auto';

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
 * z57 (S10 tail, 2026-09-17): the flip to 'v2' is RESTORED. The S10
 * rollback (back to 'legacy', after eb93be36) existed because v2 mode had
 * no interactive download path. That parity gap is closed:
 * - delegated button clicks publish 'download:requested' on the page bus
 *   and the S6 bridge relay → background machine settles them (S1)
 * - v2 discovers docs/sheets/slides/drawings anchors like V1 (S2)
 * - the Download All group machine runs staggered bus requests with
 *   cancel over CQD_CANCEL_DOWNLOAD (S3)
 * - v2 badges carry the exact V1 markup contract the QA journeys pin (S4)
 * Legacy stays available as the explicit rollback mode via the popup's
 * engine-mode control (cqdV2Mode='legacy').
 *
 * Rollout history:
 * 1. 'shadow' was reverted to an explicit opt-in (2026-08) after it
 *    shipped double scanning as a permanent CPU/battery tax (D9)
 * 2. Default flipped to 'v2' (S10 T4, eb93be36) — REVERTED to 'legacy'
 *    after fresh-build QA acceptance failed (interactive parity gap)
 * 3. Re-flipped to 'v2' (z57) once V2 reached interactive parity and the
 *    qa-chromium journeys passed on a fresh v2-default build
 * 4. 'v3' stays behind a flag until the identity permission lands
 *
 * To roll back: set cqdV2Mode='legacy' in chrome.storage.local
 * (or use the popup's engine-mode control).
 */
/**
 * The shipped default mode, exported so tests (and docs) can assert it:
 * docs and code must never disagree about this again (D9).
 */
export const DEFAULT_MODE: EngineMode = 'v2';

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

    if (stored === 'auto') {
      return resolveAutoMode();
    }

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
 * Resolve the stored 'auto' mode (bead hhpa.3) into a concrete EngineMode
 * from the router's local outcome stats. Availability: legacy and v2 are
 * always candidates; v3 only when the API is configured. Any failure —
 * storage, junk state, policy surprise — falls back to DEFAULT_MODE, so
 * selecting Auto can never leave a tab without an engine.
 *
 * The factory default stays 'v2'; 'auto' is a per-device opt-in the user
 * picks in the popup. Default-on awaits the owner's review of shadow data.
 */
export async function resolveAutoMode(): Promise<EngineMode> {
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return DEFAULT_MODE;
    const got = await chrome.storage.local.get(ROUTER_STATS_STORAGE_KEY);
    const state = got?.[ROUTER_STATS_STORAGE_KEY] as RouterStatsState | undefined;
    const modes: Array<'legacy' | 'v2' | 'v3'> = ['legacy', 'v2', 'v3'];
    const candidates: CandidateInput[] = modes.map((mode) => {
      const modeStats = state?.ring?.[mode];
      let attempts = 0;
      let saved = 0;
      let failureStreak = 0;
      if (Array.isArray(modeStats)) {
        for (let i = modeStats.length - 1; i >= 0; i -= 1) {
          const status = modeStats[i]?.status;
          if (status === 'cancelled') continue;
          attempts += 1;
          if (status === 'saved') saved += 1;
        }
        // Streak: trailing consecutive non-saved counted outcomes.
        for (let i = modeStats.length - 1; i >= 0; i -= 1) {
          const status = modeStats[i]?.status;
          if (status === 'cancelled') continue;
          if (status === 'saved') break;
          failureStreak += 1;
        }
      }
      return {
        mode,
        available: mode === 'v3' ? isApiConfigured() : true,
        attempts,
        saved,
        failureStreak,
      };
    });
    const totalAttempts = candidates.reduce((sum, candidate) => sum + candidate.attempts, 0);
    if (totalAttempts === 0) {
      // No data yet (fresh Auto opt-in): keep the factory default instead
      // of the policy's arbitrary first pick among unproven candidates.
      return DEFAULT_MODE;
    }
    const decision = decideRoute({ candidates, currentMode: null, lastSwitchAt: null, now: Date.now() });
    return decision.chosen ?? DEFAULT_MODE;
  } catch (e) {
    console.warn('[CQD Mode] auto resolution failed, using default:', e);
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
      if (message?.type === 'cqd-set-mode' && isValidStoredMode(message.mode)) {
        const apply = async (): Promise<EngineMode> => {
          if (message.mode === 'auto') return resolveAutoMode();
          return message.mode;
        };
        void apply()
          .then((resolved) => setMode(resolved).then(() => resolved))
          .then((resolved) => {
            sendResponse({ success: true, mode: resolved });
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
        if (newMode === 'auto') {
          void resolveAutoMode().then((resolved) => {
            engineRegistry.setMode(resolved);
            console.log(`[CQD Mode] Auto resolved to: ${resolved}`);
          });
        } else if (isValidMode(newMode)) {
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

/** Storage validity: concrete modes plus the router's 'auto' opt-in. */
function isValidStoredMode(value: unknown): value is StoredEngineMode {
  return value === 'auto' || isValidMode(value);
}
