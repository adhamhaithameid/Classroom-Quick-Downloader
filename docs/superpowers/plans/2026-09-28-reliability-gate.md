# Plan: Reliability Gate (bead `0h4d.1.11`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.11`
**Depends on:** `0h4d.1.2` (queue), `0h4d.1.3` (backoff), `0h4d.1.5` (size verification) — the gate runs after they ship in a store release
**Closes:** Phase 1 → opens the Phase 2 frontier (2.1 immediately; 2.2–2.9 via their edges)

## Goal

Convert the owner's "100% working" intent into a measured, honest, pass/fail bar — then pass it and record the evidence.

## The bar (from the roadmap, operationalized)

1. ≥ **99.5%** first-attempt success and ≥ **99.9%** eventual success on the 0h4d.1.10 metric (rolling 7-day window), measured on BOTH Chromium and Firefox, with sample counts shown.
2. **Zero open P0/P1 bugs** at gate time (GitHub issues + beads audited).
3. **Live-Classroom suite green N ≥ 3 consecutive runs** (real classroom.google.com harness, student+teacher profiles).
4. Queue + backoff + size verification **shipped in a store release** (not just main).
5. The metric definitions are public in `docs/RELIABILITY_GATE.md` — stronger than a promise, because failures are detected, retried, explained, and recoverable by construction.

## Execution shape (HITL — the gate is a decision session, not code)

1. NEW `docs/RELIABILITY_GATE.md` — the definitions above, how each is measured (which KV/dashboard/suite), and the evidence log template (date, numbers, run links, signature).
2. Gate session (owner + agent): pull the 1.10 numbers; audit P0/P1; run the live harness ×N (HITL login profile exists); fill the evidence log.
3. Pass → close the bead → Phase 2 frontier opens. Fail → the miss names the fix (a new bead or a reopened one), gate re-runs after.

## Tasks

1. Write `docs/RELIABILITY_GATE.md` (this plan's bar + evidence template).
2. Land it (docs PR) so the definitions are public before the measurement window starts.
3. After 1.2/1.3/1.5 ship to stores: schedule the measurement window (7 days of telemetry) → gate session → evidence → close/open.

## Out of scope

Changing thresholds without the owner; gate-by-vibes ("it feels stable").
