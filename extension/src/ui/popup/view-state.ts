// filepath: extension/src/ui/popup/view-state.ts
/**
 * One decision type per popup view decision (bead 0fvf, census
 * 2026-11-14): what the popup shows derives from state through these pure
 * unions instead of scattered flag reads. Pure module — no React, no
 * chrome APIs. App feeds its useReducer with these; the derivations are
 * the single owner of each view decision.
 */

import { DEFAULT_SETTINGS, type Settings } from '../settings/store';

/** The engine modes the popup exposes (#684). S13: the API (beta) option
 *  is the CONSENT surface (#398) — see App.tsx for the rendered contract. */
export type PopupEngineMode = 'legacy' | 'v2' | 'v3' | 'auto';

/**
 * Top-level view decision (was: bare isClassroomTab reads at the body
 * ternary and the brand dot). Loading is deliberately NOT a view here —
 * it is an in-body state: the classroom body renders while settings load,
 * with toggles disabled and a "Loading…" status label.
 */
export type PopupView = { kind: 'off-site' } | { kind: 'classroom' };

export function derivePopupView(isClassroomTab: boolean): PopupView {
  return isClassroomTab ? { kind: 'classroom' } : { kind: 'off-site' };
}

/**
 * Header status decision (was: the extensionStatusLabel if-chain folding
 * loadingState, settings presence, tab detection, and the enabled flag).
 */
export type ExtensionStatus = 'off-site' | 'loading' | 'enabled' | 'disabled';

export function deriveExtensionStatus(inputs: {
  settingsLoaded: boolean;
  isClassroomTab: boolean;
  isEnabled: boolean;
}): ExtensionStatus {
  if (!inputs.isClassroomTab) return 'off-site';
  if (!inputs.settingsLoaded) return 'loading';
  return inputs.isEnabled ? 'enabled' : 'disabled';
}

/**
 * Engine-control decision (was: bare engineModeLoading + apiConfirmOpen
 * reads at the EngineModeRow and confirm card).
 */
export type EngineRowView =
  | { phase: 'loading' }
  | { phase: 'ready'; mode: PopupEngineMode; confirmOpen: boolean };

export function deriveEngineRowView(inputs: {
  engineModeLoading: boolean;
  engineMode: PopupEngineMode;
  apiConfirmOpen: boolean;
}): EngineRowView {
  if (inputs.engineModeLoading) return { phase: 'loading' };
  return {
    phase: 'ready',
    mode: inputs.engineMode,
    confirmOpen: inputs.apiConfirmOpen,
  };
}

// ============================================================================
// CORE VIEW STATE (bead r5bu, 0fvf phase B): the six scattered hooks
// (settings, loadingState, isClassroomTab, engineMode, engineModeLoading,
// apiConfirmOpen) become one reducer with atomic transitions. Every action
// mirrors exactly one writer pair from App.tsx; the truth tables are pinned
// by tests/popup-core-reducer.test.ts.
// ============================================================================

export interface PopupCoreState {
  /** Null while the initial load is in flight (settingsLoading). */
  settings: Settings | null;
  settingsLoading: boolean;
  isClassroomTab: boolean;
  engine: {
    mode: PopupEngineMode;
    loading: boolean;
    confirmOpen: boolean;
  };
}

export const POPUP_CORE_INITIAL: PopupCoreState = {
  settings: null,
  settingsLoading: true,
  isClassroomTab: false,
  engine: { mode: 'v2', loading: true, confirmOpen: false },
};

export type PopupCoreAction =
  /** Non-extension environment (pnpm dev): defaults + loaded, enabled. */
  | { type: 'dev-fallback-settings' }
  /** Initial load completes: settings land AND loading flips atomically. */
  | { type: 'settings-loaded'; settings: Settings }
  /** Live watch sync — ignored while the initial load is in flight. */
  | { type: 'settings-synced'; settings: Settings }
  /** A handler already holding a full next Settings object. */
  | { type: 'settings-patched'; settings: Settings }
  | { type: 'tab-detected'; isClassroomTab: boolean }
  /** The cqdV2Mode storage read lands: mode + loading flip atomically. */
  | { type: 'engine-resolved'; mode: PopupEngineMode }
  /** No storage API (dev): loading flips without touching the default. */
  | { type: 'engine-load-skipped' }
  /** The storage listener updates ONLY the mode, never the loading flag. */
  | { type: 'engine-remote-updated'; mode: PopupEngineMode }
  /** Any engine pick while the card is open, or the decline button. */
  | { type: 'engine-confirm-closed' }
  /** The first unconfirmed v3 pick opens the card. */
  | { type: 'engine-confirm-opened' }
  /** commitEngineMode: the selection moved (persist + notify stay callers'). */
  | { type: 'engine-mode-committed'; mode: PopupEngineMode };

export function popupCoreReducer(
  state: PopupCoreState,
  action: PopupCoreAction,
): PopupCoreState {
  switch (action.type) {
    case 'dev-fallback-settings':
      // Was: setSettings(prev => ({ ...DEFAULT_SETTINGS, ...prev,
      // extensionEnabled: true })) + setLoadingState(false).
      return {
        ...state,
        settings: { ...DEFAULT_SETTINGS, ...(state.settings ?? {}), extensionEnabled: true },
        settingsLoading: false,
      };
    case 'settings-loaded':
      return { ...state, settings: action.settings, settingsLoading: false };
    case 'settings-synced':
      // Was: setSettings(prev => (prev ? updated : prev)) — syncs are
      // ignored until the initial load landed.
      return state.settings == null ? state : { ...state, settings: action.settings };
    case 'settings-patched':
      return { ...state, settings: action.settings };
    case 'tab-detected':
      return { ...state, isClassroomTab: action.isClassroomTab };
    case 'engine-resolved':
      return { ...state, engine: { ...state.engine, mode: action.mode, loading: false } };
    case 'engine-load-skipped':
      return { ...state, engine: { ...state.engine, loading: false } };
    case 'engine-remote-updated':
      return { ...state, engine: { ...state.engine, mode: action.mode } };
    case 'engine-confirm-closed':
      return { ...state, engine: { ...state.engine, confirmOpen: false } };
    case 'engine-confirm-opened':
      return { ...state, engine: { ...state.engine, confirmOpen: true } };
    case 'engine-mode-committed':
      return { ...state, engine: { ...state.engine, mode: action.mode } };
  }
}
