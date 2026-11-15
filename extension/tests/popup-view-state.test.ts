import { describe, expect, it } from 'vitest';
import {
  deriveEngineRowView,
  deriveExtensionStatus,
  derivePopupView,
} from '../src/ui/popup/view-state';

// ============================================================================
// Popup view-state unions (bead 0fvf, census 2026-11-14). One decision
// type per popup view decision; App.tsx renders through these derivations.
// Behavior contract pinned here (same truth table the flag reads encoded):
//  - the body ternary follows TAB DETECTION only — loading keeps rendering
//    the classroom body;
//  - the status label folds tab + settings load + enabled;
//  - the engine row is 'loading' until the storage read lands, then ready
//    with the confirm card flag.
// ============================================================================

describe('derivePopupView', () => {
  it('renders the classroom body exactly when tab detection says classroom', () => {
    expect(derivePopupView(true)).toEqual({ kind: 'classroom' });
    expect(derivePopupView(false)).toEqual({ kind: 'off-site' });
  });
});

describe('deriveExtensionStatus', () => {
  it('off-site wins regardless of load state (Open on Google Classroom)', () => {
    expect(deriveExtensionStatus({ settingsLoaded: false, isClassroomTab: false, isEnabled: true })).toBe('off-site');
    expect(deriveExtensionStatus({ settingsLoaded: true, isClassroomTab: false, isEnabled: false })).toBe('off-site');
  });

  it('loading is an in-classroom state (body still renders, toggles disabled)', () => {
    expect(deriveExtensionStatus({ settingsLoaded: false, isClassroomTab: true, isEnabled: true })).toBe('loading');
  });

  it('a loaded classroom tab reports the enabled flag', () => {
    expect(deriveExtensionStatus({ settingsLoaded: true, isClassroomTab: true, isEnabled: true })).toBe('enabled');
    expect(deriveExtensionStatus({ settingsLoaded: true, isClassroomTab: true, isEnabled: false })).toBe('disabled');
  });
});

describe('deriveEngineRowView', () => {
  it('stays loading while the storage read is in flight, whatever the flags say', () => {
    expect(deriveEngineRowView({ engineModeLoading: true, engineMode: 'v2', apiConfirmOpen: false })).toEqual({ phase: 'loading' });
    expect(deriveEngineRowView({ engineModeLoading: true, engineMode: 'v3', apiConfirmOpen: true })).toEqual({ phase: 'loading' });
  });

  it('ready carries the resolved mode and the confirm card flag', () => {
    expect(deriveEngineRowView({ engineModeLoading: false, engineMode: 'v2', apiConfirmOpen: false })).toEqual({
      phase: 'ready',
      mode: 'v2',
      confirmOpen: false,
    });
    expect(deriveEngineRowView({ engineModeLoading: false, engineMode: 'v3', apiConfirmOpen: true })).toEqual({
      phase: 'ready',
      mode: 'v3',
      confirmOpen: true,
    });
  });
});
