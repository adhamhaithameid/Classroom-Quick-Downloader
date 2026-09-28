# Plan: Surface Failure Reasons in the UI (bead `0h4d.1.4`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.4`
**Depends on:** — · **Blocks:** `0h4d.1.7` (diagnostics), supports `0h4d.1.11`

## Goal

Every terminal failure shows its classified reason + one action verb, in-page on the settled button and in the popup failed list. Zero new error classes — the taxonomy (11 corpus classes + `SIZE_MISMATCH` when 1.5 lands) is the single join key.

## Architecture

- **Data table:** NEW `extension/src/core/acquire/failure-copy.ts` — `FAILURE_COPY: Record<errorCode, { title: string; action: string }>` (e.g. `DOWNLOAD_START_TIMEOUT` → "The download could not be started" / "Try again"; `AUTH_ALL_FAILED` → "Access denied for all your accounts" / "Open the file in Drive"; `DISK_FULL` → "Disk is full" / "Free up space").
- **In-page:** `entrypoints/content/message-handler.ts` — the `CQD_DOWNLOAD_STATUS` failure branch currently renders a generic error state (button-state.ts); extend it to render a chip: title + action, looked up via `chrome.i18n.getMessage` (content scripts may use chrome.i18n directly). Unknown errorCode → generic fallback (never raw codes).
- **Popup:** `App.tsx` failed rows add the reason line (popup i18n via the existing `entrypoints/popup/i18n.ts` pipeline).
- **Locales:** new message keys flow through the translation source → `pnpm -C extension run locales:generate` → `_locales` (147 locales) with the existing CI no-drift check as the gate.

## TDD Tasks

1. **Red:** `extension/tests/failure-copy.test.ts` — corpus-driven: every errorCode in the taxonomy (import the corpus's class list) has a copy entry with non-empty title/action; unknown codes fall back. **Green:** failure-copy.ts.
2. **Red:** content render test — a settled failure status with `errorCode: 'DISK_FULL'` renders the chip text from the en locale. **Green:** message-handler + button-state chip.
3. **Red:** popup failed-row test. **Green:** App.tsx row.
4. **Red:** locale drift — `locales:generate` runs clean and the CI check passes with the new keys. **Green:** translation-source additions.
5. **Verify:** extension suite; `pnpm -C extension run locales:generate && git diff --exit-code _locales` (no drift).

## Out of scope

Per-failure deep-link help pages; telemetry on chip impressions.
