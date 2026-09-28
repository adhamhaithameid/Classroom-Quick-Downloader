# Plan: Diagnostics Page (bead `0h4d.1.7`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.7`
**Depends on:** `0h4d.1.4` (reason taxonomy for the failure digest) · **Supports:** the support workflow (Phase 4); pairs with licensing ops (2.8)

## Goal

One click → a copyable, schema-versioned, PII-free report. Nothing is sent anywhere by the extension — the user pastes it into support (privacy posture preserved by construction).

## Architecture

- **Pure builder:** NEW `extension/src/diagnostics/build.ts` — `buildDiagnostics(inputs) → DiagnosticsReport` (schema `cqd-diagnostics/1`): extension version, browser UA, locale, engine mode, enabled flags (values, never personal data), queue state counts, history failure digest (last 20 `errorCode`s + counts — from `cqd_history_v1`, 1.6), storage usage, timestamps.
- **Scrubber:** allowlist-based (deny by default) applied at the builder boundary — unit-tested against PII patterns: emails, JWT/token shapes, URL query params, `authuser` account emails, Drive file IDs in URLs.
- **Page:** NEW `extension/entrypoints/diagnostics/` (small html+tsx) — render the report, Copy button (clipboard), Download as `.json`, regenerate.
- **Entry:** popup footer link + options page link (1.8).

## TDD Tasks

1. **Red:** `extension/tests/diagnostics-build.test.ts` — schema shape stable (snapshot); every field allowlisted; fuzzed inputs (fast-check): output contains no email/token/query-param patterns (regex corpus over 10k generated inputs). **Green:** build.ts + scrubber.
2. **Red:** report correctness — given seeded history/queue state, the digest counts match. **Green:** inputs wiring.
3. **Red:** page render + copy/download actions (jsdom patterns from popup tests). **Green:** entrypoints/diagnostics/.
4. **Verify:** extension suite; the scrubber's fuzz suite runs in CI (fast, pure).

## Out of scope

Auto-upload to support (never); screenshot capture.
