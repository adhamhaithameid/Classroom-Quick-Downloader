import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  loadSettings,
  migrateRawSettings,
  saveSetting,
  watchSettings,
} from '../src/ui/settings/store';

// ============================================================================
// SETTINGS STORE (bead 0h4d.1.8, plan
// docs/superpowers/plans/2026-09-28-options-page.md). One load/save/watch
// API shared by popup + options. COMPAT CONSTRAINT: the five keys stay FLAT
// in chrome.storage.local — content scripts and the background read them
// directly (v2_bootstrap.content, flags.ts, global-state.ts, index.ts).
// v2 = the same flat keys + a cqdSettingsSchemaVersion marker, with explicit
// migration that fills missing keys from defaults.
// ============================================================================

type LocalArea = {
  get: (keys: unknown, cb: (r: unknown) => void) => void;
  set: (kv: unknown, cb?: () => void) => void;
};

function installStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  const setSpy = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
    Object.assign(store, kv);
    cb?.();
  });
  const getSpy = vi.fn((keys: unknown, cb: (r: unknown) => void) => {
    const res: Record<string, unknown> = {};
    if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
    else res[keys as string] = store[keys as string];
    cb(res);
  });
  (chrome.storage.local as unknown as LocalArea).get = getSpy as unknown as LocalArea['get'];
  (chrome.storage.local as unknown as LocalArea).set = setSpy as unknown as LocalArea['set'];
  return { store, setSpy, getSpy };
}

describe('settings store (0h4d.1.8)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (chrome.storage.onChanged as any) = { addListener: vi.fn(), removeListener: vi.fn() };
  });

  it('exposes the five flat keys (compat: content scripts read them directly)', () => {
    expect([...SETTINGS_KEYS].sort()).toEqual([
      'combinedFlagEnabled',
      'commentsFlagEnabled',
      'downloadAllEnabled',
      'editedFlagEnabled',
      'extensionEnabled',
    ]);
    expect(DEFAULT_SETTINGS).toEqual({
      extensionEnabled: true,
      downloadAllEnabled: true,
      commentsFlagEnabled: true,
      editedFlagEnabled: true,
      combinedFlagEnabled: true,
    });
  });

  it('migrateRawSettings fills missing keys from defaults and stamps schema v2', () => {
    const { settings, migrationWrites } = migrateRawSettings({ commentsFlagEnabled: false });
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, commentsFlagEnabled: false });
    expect(migrationWrites!.cqdSettingsSchemaVersion).toBe(2);
    // The filled keys are persisted so storage self-heals to the versioned shape.
    expect(migrationWrites!.extensionEnabled).toBe(true);
    expect(migrationWrites!.downloadAllEnabled).toBe(true);
    expect(migrationWrites!.editedFlagEnabled).toBe(true);
    expect(migrationWrites!.combinedFlagEnabled).toBe(true);
  });

  it('migrateRawSettings passes a complete v2 payload through without writes', () => {
    const full = {
      extensionEnabled: false,
      downloadAllEnabled: true,
      commentsFlagEnabled: true,
      editedFlagEnabled: true,
      combinedFlagEnabled: false,
      cqdSettingsSchemaVersion: 2,
    };
    const { settings, migrationWrites } = migrateRawSettings(full);
    expect(settings.extensionEnabled).toBe(false);
    expect(settings.combinedFlagEnabled).toBe(false);
    expect(migrationWrites).toBeNull();
  });

  it('loadSettings reads and normalizes storage (false respected, missing defaulted)', async () => {
    installStorage({ extensionEnabled: false });
    const settings = await loadSettings();
    expect(settings.extensionEnabled).toBe(false);
    expect(settings.downloadAllEnabled).toBe(true);
  });

  it('saveSetting writes the flat key', async () => {
    const { store } = installStorage();
    await saveSetting('commentsFlagEnabled', false);
    expect(store.commentsFlagEnabled).toBe(false);
  });

  it('watchSettings fires on relevant local changes with normalized settings', () => {
    installStorage();
    const seen: Array<Record<string, boolean>> = [];
    const unwatch = watchSettings((s) => seen.push({ ...s }));

    const listener = (chrome.storage.onChanged.addListener as any).mock.calls[0][0];
    listener(
      { extensionEnabled: { newValue: false } },
      'local',
    );
    expect(seen[seen.length - 1].extensionEnabled).toBe(false);

    // Other areas/keys are ignored.
    listener({ somethingElse: { newValue: 1 } }, 'local');
    listener({ extensionEnabled: { newValue: true } }, 'sync');
    expect(seen).toHaveLength(1);

    unwatch();
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
  });

  it('loadSettings runs the migration write once when keys are missing', async () => {
    const { setSpy } = installStorage({ commentsFlagEnabled: false });
    await loadSettings();
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cqdSettingsSchemaVersion: 2, extensionEnabled: true }),
      expect.any(Function),
    );
  });
});
