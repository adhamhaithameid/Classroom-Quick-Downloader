# Engine V4 S12 — Accuracy Ratchet & Closeout (Gates G4/G6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** G4: corpus C1 exact (knownFailures driven to zero), C2 floors raised to measured values, mutation score ≥ 80% on `src/core/**`, decision trace shipped (#399 — field-report-to-corpus-case path per ADR-0008). G6 groundwork: corpus checksum manifest, ADR-0008 → Accepted, docs closeout. (Epic close itself is the final session step, after S13.)

**Architecture:** The 4 knownFailures are real detection gaps (fixtures: fx-classwork-material-comments, fx-mixed-links-comments, syn-hu-both-flags, syn-hu-edited-only) — each gets TDD diagnosis → fix in `src/detect|decide` (corpus-first per ADR-0008 C3) → remove from knownFailures in the same PR. Floors only move up, and only to measured post-fix values. Stryker on `src/core` with a CI nightly job. Decision trace: the engine already records `DecisionTrace` (engine-v2 decisionTraces map, getDecisionTrace(postId)) — the gap is a SURFACE: debug-panel trace viewer + "export corpus case" JSON (trace + PostObservation.debug → expected.json skeleton) so a field report becomes a labelled case without guessing.

**Tech Stack:** Vitest, Stryker (new devDep), fast-check (new devDep, property tests per ADR-0008), debug panel (existing).

**Spec:** ADR-0008 (`docs/adr/0008-accuracy-definition-and-gates.md` — C1/C2/property tests/checksum/trace requirements), master plan §5 G4/G6 §6 S12 row, bead `1yf.12`, gh #399 #681 #685; S12 also owns #614/#615 metadata-zone triage (selector audit shipped in S11; the metadata-zone scoping triage = examine whether comment/edited detection should ignore the metadata zone — fold into the knownFailures diagnosis where relevant) and bead `770` (popup i18n + default_locale wiring).

## Global Constraints

- ADR-0008 ratchet discipline: floors only UP; knownFailures only SHRINK; a behavior change re-labels affected corpus cases in the SAME PR.
- Full verification per §11 before close. Parallel session interleave: pathspec-limited commits, ≤100-char headers, Write/Edit tools, no pushes.
- The 11 pre-existing acquire-corpus unit failures belong to the analytics session's uncommitted background work — do NOT chase; if they are fixed by that session mid-sprint, re-baseline.
- Never touch website/*, cloudflare-worker/*, root package.json verify:contract.

## Tasks

### Task 1: Drive the 4 knownFailures to zero
For EACH case (fx-classwork-material-comments, fx-mixed-links-comments, syn-hu-both-flags, syn-hu-edited-only): reproduce via Tier B runner (`npx vitest run tests/accuracy -t <caseId>`), diagnose the detector gap (keyword tables? normalization? metadata-zone scoping?), fix minimally in src/detect|decide with a unit test, verify the case goes green, REMOVE it from accuracy-budget.json knownFailures. Commit per case: `fix(engine): <case> detection gap closed, knownFailure removed (S12)`. If a case is judged mis-labelled (fixture truth wrong), correct expected.json WITH evidence in the commit message (ADR-0008 allows re-labelling with justification).

### Task 2: Raise C2 floors
After Task 1: run the corpus, read measured commentRecall/editedRecall, raise accuracy-budget.json floors to min(measured, round to 3 decimals). Only up. Commit: `chore(engine): raise C2 recall floors to measured values (S12)`.

### Task 3: Mutation testing ≥ 80% on src/core
1. Add stryker (devDep) + extension/stryker.config.json: mutate src/core/**, test runner vitest, incremental file, mutator defaults, thresholds { high: 80, low: 70, break: null } (score reported, >= 80 required by our CI step check).
2. `pnpm -C extension run test:mutation` script; FIRST RUN: record the baseline score + surviving mutants; fix the meaningful survivors (each: unit test proving the mutant's behavior is real) OR document acceptable survivors (equivalent mutants) in docs/engine/mutation-notes-2026-09.md. Iterate to ≥ 80%.
3. Nightly CI job (nightly-tests.yml): run test:mutation, file issue on failure.
4. Commit: `test(engine): stryker on core — mutation score >= 80 (S12)`.

### Task 4: fast-check property tests (ADR-0008)
Property tests (fast-check devDep) for the pure parsers: core/name/{sanitize,strip,derive,verify}, core/detect/numerals, and the download-URL pure rules wherever they live in core. Properties: sanitize idempotence + illegal-char elimination + length clamp; strip never empties a plausible name; numerals parse bounds; URL validator rejects non-https/non-allowlist for ANY generated input. Commit: `test(engine): fast-check property tests for core parsers (S12)`.

### Task 5: Decision trace surface (#399)
1. Debug panel: trace viewer section — per-post DecisionTrace rendering (layers, exclusions, finalScore) fed by engine getDecisionTrace(postId); add an "export corpus case" action: JSON {pageUrl-ish metadata minus PII, expected skeleton from the trace+PostObservation.debug, caseId slug, note} downloaded via blob. Tests: panel renders trace from a stubbed engine; export produces the documented shape.
2. Commit: `feat(engine): decision trace viewer + corpus-case export (S12, #399)`.

### Task 6: Corpus checksum manifest + ADR-0008 Accepted + bead 770
1. tools/accuracy-corpus-manifest.mjs (or extension/tools): sha256 per corpus file + manifest.json; test asserts manifest matches (silently edited label = build failure, ADR-0008); regeneration script documented.
2. ADR-0008 status → Accepted (evidence links: budget, mutation score, trace surface, this log).
3. Bead 770: popup i18n via chrome.i18n + wxt.config default_locale + build wiring (the coupling that T4-S11 deferred). Tests: popup renders from _locales.
4. Commits per item.

### Task 7: Closeout
Full verification (unit incl. mutation script run, accuracy incl. new floors, goldens, qa 16/0/1); session log docs/session-logs/<date>-engine-v4-s12-accuracy-ratchet.md; ENGINE_TASK_LIST S12 row; bd close 1yf.12 with G4 evidence. G6 checklist prepared but executed at epic close (after S13).

## Self-Review

- G4 acceptance mapped: T1 (C1 exact, no knownFailures) + T2 (C2 floors) + T3 (mutation ≥ 80) . Decision trace (#399) = T5. ADR-0008's property tests + checksum = T4/T6. G6: T6 docs/ADR + epic close after S13.
- #614/#615 metadata-zone triage folded into T1 diagnosis.
- Bead 770 dispositions the S11 i18n deferral.
