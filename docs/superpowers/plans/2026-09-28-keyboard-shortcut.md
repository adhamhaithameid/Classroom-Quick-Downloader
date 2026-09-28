# Plan: Keyboard Shortcut for Download All (bead `0h4d.1.9`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.9`
**Depends on:** — (rides the queue automatically once 1.2 lands) · **Blocks:** —

## Goal

`Alt+Shift+D` on a Classroom page triggers the same Download All flow as the button — zero content-script changes, zero new permissions.

## Architecture

- **Manifest:** `extension/wxt.config.ts` manifest gains `commands`: `{ 'download-all-classroom': { suggested_key: { default: 'Alt+Shift+D' }, description: … } }` (user-remappable at chrome://extensions/shortcuts — nothing to build).
- **Background:** `entrypoints/background/index.ts` — `chrome.commands.onCommand`: resolve the active tab; guard with the route classifier `classifyRoute(url)` (`src/v2/context/route-classifier.ts:179`) — only classroom routes proceed; send a command message to the tab (`chrome.tabs.sendMessage`) that the existing button-controller path (`src/download-all/button-controller.ts`) already answers — the keyboard path invokes the identical entry point the button click uses (so queue integration, group progress, cancel all inherit).
- **Non-Classroom tab:** no-op + badge hint via `icon-manager.ts` (a transient "⤓" badge, auto-clear) — never an error surface.
- **No content listener changes:** if the button-controller path is message-driven today, the command message reuses it; otherwise a thin `RUN_DOWNLOAD_ALL` message maps onto the same internal function.

## TDD Tasks

1. **Red:** `extension/tests/keyboard-command.test.ts` — onCommand with a Classroom URL dispatches the download-all command to the tab; non-Classroom URL dispatches nothing + sets the hint badge; no tab found → silent no-op. **Green:** index.ts listener + guard.
2. **Red:** manifest test — `commands` present with the suggested key (manifest-least-privilege-style guard). **Green:** wxt.config.
3. **Verify:** qa journey — keyboard path on the simulator's course page starts the identical flow (E2E, the button path's assertions reused).

## Out of scope

Configurable-in-extension shortcuts (browser UI owns it); additional shortcuts.
