// filepath: entrypoints/content/reduce-motion.ts
/**
 * ============================================================================
 * REDUCE MOTION — in-app animation kill switch, mirrored onto the page
 * ============================================================================
 *
 * The user-facing reducedMotionPreferred key lives FLAT in
 * chrome.storage.local (src/ui/settings/store.ts compat rule) and defaults
 * to false — motion is on unless the user asks for calm (Stillwater, audit
 * finding 9).
 *
 * This module mirrors the setting onto the page as the .cqd-reduce-motion
 * class on <html> (same pattern as body.cqd-theme-dark) and re-applies it
 * live on storage changes, so a popup/options toggle reaches open Classroom
 * tabs without a reload. The injected sheets (content/styles.ts,
 * v2 button-styles.ts / flag-styles.ts) scope their animation collapse to
 * CQD's own artifacts under that class — never to the host page — and each
 * ALSO carries the OS-level prefers-reduced-motion media query, which holds
 * regardless of this setting.
 *
 * Idempotent per page: repeated installs (the V1 sheets and the v2
 * bootstrap can both call installReduceMotion) share one storage listener
 * through the global guard.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

/** The flat storage key — keep in sync with src/ui/settings/store.ts. */
export const REDUCE_MOTION_KEY = 'reducedMotionPreferred';

/** Root class consumed by every CQD stylesheet's reduce-motion rules. */
export const REDUCE_MOTION_CLASS = 'cqd-reduce-motion';

/** Apply the mirror class to <html>. Safe to call repeatedly. */
export function applyReduceMotionClass(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, on);
}

/** Storage semantics for this key: explicit true is ON, everything else OFF. */
function isOn(value: unknown): boolean {
  return value === true;
}

let installed = false;

/**
 * Read the saved setting, then follow storage changes live. Install once
 * per page; later calls are no-ops.
 */
export function installReduceMotion(): void {
  if (installed) return;
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
  installed = true;

  try {
    chrome.storage.local.get(REDUCE_MOTION_KEY, (result: Record<string, unknown>) => {
      const value = chrome.runtime?.lastError ? undefined : result?.[REDUCE_MOTION_KEY];
      applyReduceMotionClass(isOn(value));
    });
  } catch {
    return;
  }

  try {
    if (!chrome.storage.onChanged) return;
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string): void => {
      if (area !== 'local' || !(REDUCE_MOTION_KEY in (changes ?? {}))) return;
      applyReduceMotionClass(isOn(changes[REDUCE_MOTION_KEY]?.newValue));
    };
    chrome.storage.onChanged.addListener(listener);
  } catch {
    // One-shot read already applied; live sync is best-effort.
  }
}
