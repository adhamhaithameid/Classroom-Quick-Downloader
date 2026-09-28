# Plan: Site Reliability Metric (bead `0h4d.1.10`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.10`
**Depends on:** — (pure backend derivation from telemetry that already flows) · **Blocks:** `0h4d.1.11`

## Goal

First-attempt and eventual success rates, measured from real telemetry, sliced by browser family — the number the reliability gate (1.11) certifies.

## Definitions (operationalized)

- **First-attempt success:** terminal `success` with zero retries (`transientRetried`/`startRetried`/retryCount all false/0).
- **Eventual success:** terminal `success` after ≤ maxAttempts policy retries (1.3's cap).
- **Denominator:** terminal outcomes only — `success` + `failed` classes; `cancelled` and `timeout-then-retry-pending` excluded.
- **Window:** rolling 7 days; slices: Chromium / Firefox; precision 2 decimals (99.97, never "100%").

## Architecture

- **Events already flow:** extension → worker ingest carries sanitized `type/status/error_type/file_type` (analytics/index.ts:50–90) and the retry flags in the event fields; D1 event archive (`event-archive.ts`) retains 1 year.
- **Aggregation:** `cloudflare-worker/src/index.ts` `scheduled()` (:3231, the existing cron) gains a step: NEW `src/reliability.ts` — `computeReliability(events) → { firstAttemptRate, eventualRate, samples, byBrowser }`, idempotent per window → KV `site:v1:reliability` (the `STORE_STATS_KV_KEY` pattern, index.ts:485).
- **Surface 1 — admin dashboard:** new card in `cloudflare-worker/dashboard/` (trend-strip card precedent) showing both rates + sample counts + last-computed-at.
- **Surface 2 — the gate doc:** 1.11 pulls from this KV; diagnostics (1.7) may link it.

## TDD Tasks

1. **Red:** `cloudflare-worker/tests/reliability.test.ts` — synthetic event batches: mixed retries/cancels/browsers → exact rates; window boundary (event at day 8 excluded); idempotent recompute; empty window → `null` rates (never 100% on zero samples). **Green:** `src/reliability.ts`.
2. **Red:** cron step test — scheduled handler writes KV; dashboard card renders the payload. **Green:** index.ts step + dashboard card.
3. **Verify:** worker suite (`pnpm -C cloudflare-worker test`, 1,011+ tests stay green); deploy smoke unaffected.

## Out of scope

Public metric page (post-gate decision); per-course slicing (privacy-minimizing aggregation only).
