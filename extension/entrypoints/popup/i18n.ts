// filepath: extension/entrypoints/popup/i18n.ts
/**
 * Popup i18n — chrome.i18n.getMessage with a TRANSLATIONS-style en fallback.
 *
 * Message names live in the generated chrome.i18n catalog
 * (`extension/_locales/en/messages.json`, produced by tools/generate-locales.mjs
 * from TRANSLATIONS in entrypoints/content/i18n.ts — the single source of
 * truth). The `fallback` strings below must stay byte-identical to the en
 * catalog entries; tests/popup-i18n.test.ts pins that coupling, and the
 * runtime fallback keeps the popup correct when chrome.i18n is unavailable
 * (dev preview) or a locale table lacks a key.
 *
 * Bead 770 scope boundary (deliberate, do not widen without a new bead):
 * ONLY the settings section headers and the Engine Mode row are wired here.
 * The rest of the popup (brand header, analytics card, toggle labels,
 * changelog, About/share/footer) remains literal English until its own
 * follow-up — i18n-ing the whole popup was explicitly out of 770's scope.
 */

export const POPUP_MESSAGES = {
  popupExtensionSettings: { name: 'popup_extension_settings', fallback: 'Extension Settings' },
  popupSettingsSectionGeneral: { name: 'popup_settings_section_general', fallback: 'General' },
  popupSettingsSectionEngine: { name: 'popup_settings_section_engine', fallback: 'Engine' },
  popupSettingsSectionFlags: { name: 'popup_settings_section_flags', fallback: 'Flags' },
  popupEngineMode: { name: 'popup_engine_mode', fallback: 'Engine Mode' },
  popupEngineModeLegacy: { name: 'popup_engine_mode_legacy', fallback: 'Legacy' },
  popupEngineModeNew: { name: 'popup_engine_mode_new', fallback: 'New' },
  popupEngineModeApi: { name: 'popup_engine_mode_api', fallback: 'API (beta)' },
} as const;

export type PopupMessageKey = keyof typeof POPUP_MESSAGES;

/** Resolve a popup string: chrome.i18n catalog first, en fallback second. */
export function popupMessage(key: PopupMessageKey): string {
  const entry = POPUP_MESSAGES[key];
  try {
    // Read dynamically so test stubs and non-extension environments resolve
    // the same way; chrome.i18n returns '' for missing messages, which must
    // fall through to the en fallback rather than rendering an empty label.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (globalThis as any).chrome?.i18n?.getMessage?.(entry.name);
    if (typeof message === 'string' && message.length > 0) return message;
  } catch {
    // getMessage throwing (no extension context) is not fatal — fall back.
  }
  return entry.fallback;
}
