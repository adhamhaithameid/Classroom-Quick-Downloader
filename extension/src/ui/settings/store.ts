/**
 * ============================================================================
 * SETTINGS STORE — one load/save/watch API for popup + options
 * (bead 0h4d.1.8, plan docs/superpowers/plans/2026-09-28-options-page.md)
 * ============================================================================
 *
 * COMPAT CONSTRAINT: the keys stay FLAT in chrome.storage.local —
 * content scripts (v2_bootstrap.content, comment_frame.content,
 * edited_frame.content, content/flags.ts) and the background (index.ts,
 * utils/global-state.ts, src/v2/render/flag-renderer.ts) read them directly.
 * A nested v2 object would break every one of them, so schema v2 = the same
 * flat keys + a cqdSettingsSchemaVersion marker, with an explicit migration
 * that back-fills missing keys from defaults (storage self-heals to the
 * versioned shape on first load).
 *
 * Live-apply contract: toggles save optimistically; watchSettings delivers
 * normalized settings on any relevant storage change, so both surfaces react
 * live (the popup's existing behavior, now shared).
 */

export type SettingsKey =
  | 'extensionEnabled'
  | 'downloadAllEnabled'
  | 'commentsFlagEnabled'
  | 'editedFlagEnabled'
  | 'combinedFlagEnabled'
  | 'reducedMotionPreferred';

export type Settings = Record<SettingsKey, boolean>;

export const SETTINGS_KEYS: readonly SettingsKey[] = [
  'extensionEnabled',
  'downloadAllEnabled',
  'commentsFlagEnabled',
  'editedFlagEnabled',
  'combinedFlagEnabled',
  'reducedMotionPreferred',
];

export const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  downloadAllEnabled: true,
  commentsFlagEnabled: true,
  editedFlagEnabled: true,
  combinedFlagEnabled: true,
  // Opt-IN (Stillwater, audit finding 9): motion stays on unless the user
  // asks for calm. Every other key is on-unless-explicitly-false.
  reducedMotionPreferred: false,
};

export const SETTINGS_SCHEMA_VERSION = 2;
export const SETTINGS_SCHEMA_KEY = 'cqdSettingsSchemaVersion';

/**
 * Normalize one storage value against its key's default: a real boolean
 * wins; anything else (missing, removed, corrupt) falls back to the key's
 * default — so the on-by-default keys keep the popup's `!== false`
 * semantics, and reducedMotionPreferred (default false) cannot coerce a
 * missing value into ON.
 */
function coerce(key: SettingsKey, value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return DEFAULT_SETTINGS[key];
}

export interface MigrationResult {
  settings: Settings;
  /** Keys to persist when the payload was incomplete/older; null when current. */
  migrationWrites: Record<string, unknown> | null;
}

/**
 * Normalize a raw storage payload into Settings. Incomplete (pre-v2) payloads
 * back-fill from defaults and produce migration writes so storage self-heals
 * to the versioned shape.
 */
export function migrateRawSettings(raw: Record<string, unknown>): MigrationResult {
  const missing = SETTINGS_KEYS.filter((k) => typeof raw[k] !== 'boolean');
  const settings = {} as Settings;
  for (const k of SETTINGS_KEYS) settings[k] = coerce(k, raw[k]);
  if (missing.length > 0 || raw[SETTINGS_SCHEMA_KEY] !== SETTINGS_SCHEMA_VERSION) {
    const writes: Record<string, unknown> = {};
    for (const k of missing) writes[k] = settings[k];
    writes[SETTINGS_SCHEMA_KEY] = SETTINGS_SCHEMA_VERSION;
    return { settings, migrationWrites: writes };
  }
  return { settings, migrationWrites: null };
}

function storage(): chrome.storage.LocalStorageArea | undefined {
  return (globalThis as { chrome?: { storage?: { local?: chrome.storage.LocalStorageArea } } })
    .chrome?.storage?.local;
}

/** Read + normalize; a one-time migration write backfills and stamps v2. */
export async function loadSettings(): Promise<Settings> {
  const s = storage();
  if (!s) return { ...DEFAULT_SETTINGS };
  const raw = await new Promise<Record<string, unknown>>((resolve) => {
    try {
      s.get([...SETTINGS_KEYS, SETTINGS_SCHEMA_KEY], (res) => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve((res ?? {}) as Record<string, unknown>);
      });
    } catch {
      resolve({});
    }
  });
  const { settings, migrationWrites } = migrateRawSettings(raw);
  if (migrationWrites) {
    await new Promise<void>((resolve) => {
      try {
        s.set(migrationWrites, () => {
          void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
            ?.lastError;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }
  return settings;
}

/** Write one flat key (the popup's optimistic toggle path). */
export async function saveSetting(key: SettingsKey, value: boolean): Promise<void> {
  const s = storage();
  if (!s) return;
  await new Promise<void>((resolve) => {
    try {
      s.set({ [key]: value }, () => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Subscribe to live settings changes (storage.onChanged, local area, our
 * keys only). Returns the unsubscribe fn. Fires immediately per change with
 * the normalized settings.
 */
export function watchSettings(cb: (settings: Settings) => void): () => void {
  const onChanged = (
    globalThis as {
      chrome?: {
        storage?: { onChanged?: { addListener: (l: unknown) => void; removeListener: (l: unknown) => void } };
      };
    }
  ).chrome?.storage?.onChanged;
  if (!onChanged) return () => {};
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    const relevant = SETTINGS_KEYS.filter((k) => k in changes);
    if (relevant.length === 0) return;
    cb(relevant.reduce(
      (acc, k) => ({ ...acc, [k]: coerce(k, changes[k].newValue) }),
      { ...DEFAULT_SETTINGS },
    ) as Settings);
  };
  onChanged.addListener(listener);
  return () => onChanged.removeListener(listener);
}
