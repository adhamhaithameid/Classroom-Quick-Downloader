// filepath: extension/src/ui/popup/view-state.ts
/**
 * One decision type per popup view decision (bead 0fvf, census
 * 2026-11-14): what the popup shows derives from state through these pure
 * unions instead of scattered flag reads. Pure module — no React, no
 * chrome APIs. App keeps its state hooks; these derivations are the
 * single owner of each view decision.
 */

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
