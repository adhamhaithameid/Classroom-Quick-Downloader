# Student Work Tab — Resolver Plan And Current Status

## Purpose

This document tracks the Student Work resolver strategy at a planning level.
For exact current runtime behavior, see:

- `extension/docs/student-work-current-flow.md`

## Problem Statement

Google Classroom Student Work links often start as:

- `https://classroom.google.com/g/tg/...`

Those links are not always directly downloadable and may hide the final Drive file URL.
The resolver must map each clicked Student Work item to the correct file without cross-student mixups.

## Strategy Decision (Implemented)

The project now uses a hybrid strategy:

1. Query-id fast path:
   - If the source URL already contains a direct file ID (`id`, `resourceId`, `fileId`), resolve immediately.
2. API snapshot fast path (strict):
   - Use published Classroom API snapshot only when hint matching is strong and unique.
   - Ambiguous or tied matches are rejected.
3. Silent iframe bridge fallback:
   - Resolve through hidden iframe on `g/tg` viewer routes.
   - Use strict extraction and per-submission hints to prevent repeated/wrong mapping.

## Important Constraint

- Popup fallback is intentionally disabled in the resolver path.
- Student Work resolution is now silent-only (no visible popup window during download resolve).

## Current Hardening Goals

- Preserve per-button mapping uniqueness in by-status boards.
- Avoid selecting first-match candidates when multiple students/files exist.
- Fail closed on ambiguity rather than returning a potentially wrong file.
- Keep button state transitions reliable (`trying -> loading -> success/error`) without stuck states.

## Status Checklist (As Of 2026-03-17)

- [x] Strict hint matching for API snapshot resolution
- [x] Ambiguity/tie rejection in snapshot and extractor paths
- [x] Silent iframe-based resolver bridge
- [x] Popup fallback removed from resolver execution
- [x] By-status mapping protections for per-student links
- [x] Student Work unit + e2e regression coverage

## Deferred / Future Work

- Improve extraction confidence scoring further for unusual Classroom payload shifts.
- Add additional telemetry around strict-resolution fallbacks (without exposing sensitive URLs).
- Evaluate long-term API-first mode once scope/permission UX is finalized.
