# CQD Reliability Gate — Free-Plan Exit Criteria (bead `0h4d.1.11`)

**Date:** 2026-09-30 · **Owner:** Adham Haitham · **Status:** definitions public; measurement pending
**Closes:** Phase 1 (Free completion v1.9) → opens the Phase 2 frontier

The owner's directive was "100% working" before any monetization exists. No software
is literally 100% across every network, browser, and Google change — so the intent is
converted into a **measured, honest, pass/fail bar**. This document is that bar: the
definitions, the measurement sources, and the evidence log. It is public *before* the
measurement window starts so the criteria cannot drift to fit the numbers.

---

## The bar (all five must hold at gate time)

| # | Criterion | Threshold | Source |
|---|-----------|-----------|--------|
| 1 | First-attempt success rate | ≥ **99.5%** | `site:v1:reliability` KV (0h4d.1.10) |
| 2 | Eventual success rate (within the backoff policy) | ≥ **99.9%** | same |
| 3 | Measured on **both** Chromium and Firefox | samples > 0 for each; no family below thresholds | 1.10 metric (browser slicing is a named follow-up — until the counters carry success×retries×browser, family coverage is evidenced by the live-classroom suite on both browsers) |
| 4 | Zero open P0/P1 bugs | audit of GitHub issues + beads, listed in the evidence log | tracker sweep |
| 5 | Queue, backoff, size verification **shipped in a store release** | store versions ≥ the release containing PRs #800/#801/#803 | store health endpoints + draft-release checklist |

Supporting (not gating): live-Classroom suite (real classroom.google.com harness,
student + teacher profiles) green **N ≥ 3 consecutive runs** — runs alongside the
window as an early-warning signal; a red run during the window pauses the clock.

## Definitions (operationalized)

- **First-attempt success:** a terminal `success` whose `download_retries = 0`.
- **Eventual success:** a terminal `success` at any retry bucket within the policy
  cap (3 total attempts; the `3+` bucket counts — the policy itself caps there).
- **Denominator:** terminal outcomes only — `success + fail`. `cancelled` downloads
  are the user's own action and are excluded. Timeouts that later settle as failures
  count once (as failures).
- **Window:** rolling 7 days is the target; the current counters are **lifetime**
  (honestly labeled `window: "lifetime"` in the metric payload). The 7-day view is a
  named follow-up on the DO counters (success×retries timestamps); if not shipped by
  gate time, the gate uses lifetime rates **plus** the live-classroom suite as the
  recency check, and the evidence log says exactly that.
- **Precision:** two decimals (99.97, never "100%"). Zero samples → `null`, never 100%.

## Measurement inputs

1. **`site:v1:reliability`** — computed hourly by the worker cron from the Durable
   Object counters; served at `/admin/website/reliability`. Fields: `firstAttemptRate`,
   `eventualRate`, `samples`, `window`.
2. **Live-classroom suite** — `QA_LIVE_CLASSROOM=1` journeys on real
   classroom.google.com with the login-once profiles (student + teacher).
3. **Tracker sweep** — `bd` + GitHub issues filtered to open P0/P1.
4. **Store health** — AMO API v5 + the worker store-scrape for CWS/Edge versions.

## Gate session protocol (HITL)

1. Confirm criterion 5 first (store release live on all three stores).
2. Pull the metric; record the exact JSON payload in the evidence log.
3. Run the live-classroom suite ×3; record run ids + outcomes.
4. Sweep P0/P1; list each with its disposition.
5. **Pass** → fill the evidence log, close `0h4d.1.11`, open the Phase 2 frontier.
   **Fail** → the failing criterion names the fix (new bead or reopened one); the
   window restarts after the fix ships.

## Evidence log

| Date | Criterion | Value / Result | Source link | Notes |
|------|-----------|----------------|-------------|-------|
| — | — | — | — | *(measurement window not yet started — awaiting store publish)* |

## Prerequisites still open

- **Store publish of the 1.8.7 line on CWS + Edge** (Firefox is live; the draft
  release carries the zips + checklist) — owner console action. *The features ride
  the next ladder release; the gate measures whichever store release carries them.*
- **7-day window** after that publish, with no P0/P1 regressions during it.
