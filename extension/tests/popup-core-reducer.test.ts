import { describe, expect, it } from 'vitest';
import {
  POPUP_CORE_INITIAL,
  popupCoreReducer,
  type PopupCoreAction,
} from '../src/ui/popup/view-state';
import type { Settings } from '../src/ui/settings/store';

// ============================================================================
// Popup core view-state reducer (bead r5bu, 0fvf phase B). One reducer owns
// the six former view hooks with atomic transitions. Each action mirrors
// exactly one App.tsx writer; these tests pin the truth tables that keep the
// migration behavior-identical.
// ============================================================================

const run = (state = POPUP_CORE_INITIAL, ...actions: PopupCoreAction[]) =>
  actions.reduce(popupCoreReducer, state);

const SETTINGS = {
  extensionEnabled: true,
  apiBetaConfirmed: false,
} as unknown as Settings; // shape-extras irrelevant to the reducer

describe('popupCoreReducer — settings load', () => {
  it('the initial load lands settings AND flips loading atomically', () => {
    const next = run(POPUP_CORE_INITIAL, { type: 'settings-loaded', settings: SETTINGS });
    expect(next.settings).toBe(SETTINGS);
    expect(next.settingsLoading).toBe(false);
  });

  it('the dev fallback merges defaults over null, enables, and loads', () => {
    const next = run(POPUP_CORE_INITIAL, { type: 'dev-fallback-settings' });
    expect(next.settings).toMatchObject({ extensionEnabled: true });
    expect(next.settingsLoading).toBe(false);
  });

  it('live syncs are IGNORED while the initial load is still in flight', () => {
    const next = run(POPUP_CORE_INITIAL, { type: 'settings-synced', settings: SETTINGS });
    expect(next.settings).toBeNull();
    expect(next.settingsLoading).toBe(true);
  });

  it('live syncs apply once settings exist', () => {
    const loaded = run(POPUP_CORE_INITIAL, { type: 'settings-loaded', settings: SETTINGS });
    const updated = { ...SETTINGS, extensionEnabled: false } as unknown as Settings;
    const next = run(loaded, { type: 'settings-synced', settings: updated });
    expect(next.settings).toBe(updated);
  });

  it('patches apply verbatim (toggle and consent handlers build the object)', () => {
    const loaded = run(POPUP_CORE_INITIAL, { type: 'settings-loaded', settings: SETTINGS });
    const patched = { ...SETTINGS, extensionEnabled: false } as unknown as Settings;
    const next = run(loaded, { type: 'settings-patched', settings: patched });
    expect(next.settings).toBe(patched);
    expect(next.settingsLoading).toBe(false);
  });
});

describe('popupCoreReducer — tab detection', () => {
  it('follows the detector verdict in both directions', () => {
    expect(run(POPUP_CORE_INITIAL, { type: 'tab-detected', isClassroomTab: true }).isClassroomTab).toBe(true);
    expect(run(POPUP_CORE_INITIAL, { type: 'tab-detected', isClassroomTab: false }).isClassroomTab).toBe(false);
  });
});

describe('popupCoreReducer — engine', () => {
  it('the storage read resolves mode and loading TOGETHER', () => {
    const next = run(POPUP_CORE_INITIAL, { type: 'engine-resolved', mode: 'v3' });
    expect(next.engine).toEqual({ mode: 'v3', loading: false, confirmOpen: false });
  });

  it('a skipped load flips loading without touching the default mode', () => {
    const next = run(POPUP_CORE_INITIAL, { type: 'engine-load-skipped' });
    expect(next.engine).toEqual({ mode: 'v2', loading: false, confirmOpen: false });
  });

  it('the storage listener updates ONLY the mode, never the loading flag', () => {
    const mid = run(POPUP_CORE_INITIAL, { type: 'engine-load-skipped' });
    const next = run(mid, { type: 'engine-remote-updated', mode: 'legacy' });
    expect(next.engine).toEqual({ mode: 'legacy', loading: false, confirmOpen: false });
    // And while still loading, a remote update must not clear the loading flag.
    const early = run(POPUP_CORE_INITIAL, { type: 'engine-remote-updated', mode: 'legacy' });
    expect(early.engine.loading).toBe(true);
  });

  it('the confirm card opens for the first v3 pick and closes on any pick', () => {
    const opened = run(POPUP_CORE_INITIAL, { type: 'engine-confirm-opened' });
    expect(opened.engine.confirmOpen).toBe(true);
    const closed = run(opened, { type: 'engine-confirm-closed' });
    expect(closed.engine.confirmOpen).toBe(false);
  });

  it('committing a mode moves the selection and leaves the card alone', () => {
    const opened = run(POPUP_CORE_INITIAL, { type: 'engine-confirm-opened' });
    const next = run(opened, { type: 'engine-mode-committed', mode: 'legacy' });
    expect(next.engine.mode).toBe('legacy');
    expect(next.engine.confirmOpen).toBe(true);
  });
});
