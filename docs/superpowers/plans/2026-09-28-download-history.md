# Plan: Local Download History (bead `0h4d.1.6`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.6`
**Depends on:** `0h4d.1.1` (settle-point hook pattern) · **Blocks:** `0h4d.3.3` (duplicates), supports `0h4d.1.7`

## Goal

A local, persisted, searchable per-file history — the memory layer for duplicates (Pro) and support. PII-free by construction: filename, course title, size, date, status, URL host ONLY (no query params, no tokens — keeps Firefox `data_collection: none` honest).

## Architecture

- **Storage:** NEW `cqd_history_v1` — append-only array, cap 500 (LRU trim by `ts`), written with the analytics checksum pattern (`entrypoints/utils/analytics/storage.ts:451–521`: `computeChecksum` djb2 + `saveQueueWithIntegrity`/`loadQueueWithIntegrity` atomic pair) — corrupt history is sanitized, never crashes, and the UI never blocks on it.
- **Entry schema:** `{ id, ts, filename, ext, courseTitle?, bytes?, status: 'success' | 'failed', errorCode?, host }`. `bytes` from the 1.5 verification fields when known; `courseTitle` from the route context the download originated in (v2 route context, already resolved per page).
- **Write point:** one hook at terminal settlement in the background — the success path (`index.ts` `reportSuccess`, :455–486 area) and the classified fail paths (the settle points that already `recordDownloadEvent`). The status-listener seam (message-sender.ts) could host it, but settle points carry richer context — write at the settle points, deduped by `requestId`.
- **Popup UI:** History section in `App.tsx` — search box (filename/course substring), rows (icon by ext, name, relative date, status chip), per-row re-download (re-validates through `validateDownloadUrl` → `handleDownloadRequest` with a fresh requestId), Clear all (confirm).

## TDD Tasks

1. **Red:** `extension/tests/download-history.test.ts` — append/trim at cap 500; checksum mismatch → sanitize + `{valid:false}`; corrupt entries dropped; search filter; clear. **Green:** NEW `extension/src/history/history-store.ts` (pure storage ops, chrome.storage mocked).
2. **Red:** settle-point wiring — success + fail flows write one entry each with the PII-free schema (assert no query strings in `host`, no URL field). **Green:** settle hooks.
3. **Red:** restart persistence (entries survive; trim holds across sessions). **Green:** load path.
4. **Red:** popup History section render + re-download action. **Green:** App.tsx section.
5. **Verify:** extension suite + critical coverage (the store lives under background-adjacent utils — hold the 100% bar where the profile reaches).

## Out of scope

Export (options page, 1.8); cloud sync (never — local-only by design).
