# Plan: Options Page (bead `0h4d.1.8`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.8`
**Depends on:** — · **Unblocks:** future Pro config (3.1 template picker, 3.5 concurrency)

## Goal

Settings leave the popup; the popup stays a quick-glance surface. Advanced configuration gets room to grow (history export, queue concurrency, Pro template picker later).

## Architecture

- **New entrypoint:** `extension/entrypoints/options/` (`index.html` + `main.tsx`) — wxt auto-registers `options_ui` from the entrypoint directory; opened via `chrome.runtime.openOptionsPage()`.
- **Shared settings store:** extract from `App.tsx` (`DEFAULT_SETTINGS` at :75, per-key `chrome.storage.local` persistence like `cqdSettingsCollapsed` at :371) into NEW `extension/src/ui/settings/` — a versioned schema (`schemaVersion: 2`) with explicit migrations, one `load/save/watch` API both surfaces consume. Popup keeps quick toggles (engine mode, flags) + an "All settings" link; options carries everything.
- **Live-apply contract preserved:** toggles react immediately (same storage-watch path) — the popup's existing live-reaction tests keep passing.
- **Future-proof:** 1.2 queue concurrency, 1.6 history export, and 3.x Pro settings land here — the page is the config surface from now on.

## TDD Tasks

1. **Red:** `extension/tests/ui-settings-store.test.ts` — load defaults; save round-trip; `schemaVersion` migration v1→v2 (popup's implicit shape → versioned); watch fires on external change. **Green:** `src/ui/settings/store.ts`.
2. **Red:** popup regression — existing App tests green against the extracted store (behavior identical). **Green:** App.tsx refactor to consume the store.
3. **Red:** options render test — all settings present, toggles flip storage values, "Back to Classroom" affordance. **Green:** entrypoints/options/.
4. **Verify:** extension suite; `pnpm -C extension build` (options entrypoint bundles); popup visual guard still green.

## Out of scope

Sync-between-devices (never); per-course settings (3.x concern).
