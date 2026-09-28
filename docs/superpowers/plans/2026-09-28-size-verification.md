# Plan: Expected-Size Download Verification (bead `0h4d.1.5`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.5`
**Depends on:** — (integrates with 1.3's policy when both land) · **Blocks:** `0h4d.1.11`

## Goal

A truncated or empty download never reports success. Today the completion path (index.ts:440–488) verifies only `mime` — `bytesReceived`/`totalBytes` are read nowhere in the codebase.

## Architecture

- **Completion branch:** `index.ts` onChanged `complete` already calls `chrome.downloads.search({ id })` (:465) — the returned `DownloadItem` carries `bytesReceived`/`totalBytes`. Extend the verification: if `totalBytes > 0` and `bytesReceived !== totalBytes` → classify `SIZE_MISMATCH` and treat as transient-like (one policy retry via 1.3; before 1.3 merges, reuse the single `transientRetried` semantics).
- **Honest skip:** `totalBytes === 0` (unknown/no Content-Length, byte-served Drive ranges) → verify nothing, succeed as today — no false failures.
- **State machine:** completion verification event gains `expectedBytes?`/`receivedBytes?` detail (machine handles the new failure outcome as data); the mapper totals stay total (P5).
- **Simulator:** NEW `truncmid-` shape in `tests/simulator/` — declare Content-Length, serve half, destroy (the `destroyAfterSend` + `slowChunks` transport hooks already exist).
- **Failure copy:** `SIZE_MISMATCH` joins `failure-copy.ts` (1.4's table) — "The download was cut short" / "Retry".

## TDD Tasks

1. **Red:** corpus case `size-truncated` — both pure and production settle `failed` with `SIZE_MISMATCH`. **Green:** machine + index.ts verification.
2. **Red:** property P5 totality with the new outcome. **Green:** mapper.
3. **Red:** simulator journey — `truncmid-` fixture through a real qa-journey download: browser gets bytes but the flow refuses success, cancels, erases the partial (chrome.downloads.erase pattern exists in the HTML-refusal paths). **Green:** erase + settle wiring.
4. **Red:** honest-skip case — `totalBytes === 0` completes → success (regression guard against over-verification). **Green:** condition.
5. **Verify:** extension suite; qa-08 resilience journey extended with the truncation shape.

## Out of scope

Checksum verification (no trusted source hash exists); partial-resume.
