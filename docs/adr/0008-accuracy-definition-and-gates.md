# ADR-0008: What "100% accurate" means, and the gates that enforce it

- **Status:** proposed
- **Date:** 2026-08-22
- **Deciders:** Adham (owner)
- **Related:** ADR-0007, epic #685, issues #396, #673, #399

## Context

The stated goal of the engine program is that detection, downloading and
filename formatting are "100% accurate". As written, that goal cannot be
accepted or rejected, because:

- Google Classroom is a closed, continuously-deployed product. Its DOM changes
  without notice, in ~120 language variants, across 8 view kinds. No test suite
  can enumerate the space, so no suite can prove universal correctness.
- The epic itself already sets a different, measurable bar: **≥99.5% coverage /
  98% precision** against golden fixtures (#685 success metrics).
- We hold 9 sanitized fixtures. Two of them are non-English. There is currently
  **no structural (language-free) signal for "edited"** in any fixture we hold
  (SPRINT_PLAN.md, Detection Engine Seam, Plan B key limit), so today we cannot
  even measure edited-detection outside the keyword path.

Shipping against an unfalsifiable goal is how a refactor runs for six months and
lands unable to prove it helped. We need a definition that is demanding, honest,
and machine-checkable.

## Decision

"100% accurate" is defined operationally as **three commitments**, each with an
automated gate. We do not claim universal correctness anywhere in docs, UI, or
release notes.

### C1 — Zero defects on the frozen corpus (hard gate, 100%)

A versioned corpus lives at `extension/tests/accuracy/corpus/`. Each case is a
sanitized HTML page plus a hand-labelled `expected.json`. The gate is exact:

> Every case in the corpus must match its label exactly. One mismatch fails CI.

This is a true 100% target because the corpus is a closed set we control.

### C2 — Statistical floors on the wider sample (soft gate, budgeted)

For the sampled/replayed set that is too large to label by hand, per-signal
floors, checked in CI and ratcheted upward only:

| Signal | Metric | Floor at G4 | Aspiration |
|---|---|---|---|
| Attachment discovery | recall | 99.5% | 100% |
| Attachment discovery | precision | 99.5% | 100% |
| Comment flag | precision | 98% | 99.5% |
| Comment flag | recall | 99.5% | 99.9% |
| Comment count | exact match | 99% | 99.9% |
| Edited flag | precision | 97% | 99% |
| Filename fidelity | exact match | 99.5% | 100% |
| Download start success | success rate | 99% | 99.9% |

Floors are stored in `extension/tests/accuracy/accuracy-budget.json` and may
only move up. A PR that lowers a floor is a policy change and needs its own ADR.

### C3 — Every escape becomes a permanent fixture (process gate, 100%)

Any accuracy defect observed in the field — a GitHub bug report, a telemetry
signal, a user video — must, before its fix merges, be added to the corpus as a
failing case. **100% of reported defects become regression cases.** This is the
part of "100%" we can honestly promise: the same bug never ships twice.

### Supporting mechanisms

- **Mutation testing** on `src/core/**` (Stryker). A test suite that survives
  mutants is not binding the behavior it claims to. Target ≥80% mutation score
  on core by G4.
- **Property-based tests** (fast-check) for the parsers where the input space is
  adversarial: filename cleaning, URL normalization, numeral parsing.
- **Decision traces** (#399) shipped in the debug build so a field report can be
  converted into a labelled corpus case without guessing.

## Consequences

**Easier**
- The claim becomes defensible to anyone who asks "how do you know?" — the
  answer is a number, a budget file, and a CI job.
- Accuracy regressions are caught in the PR that causes them rather than in a
  store review.

**Harder**
- Labelling is manual, slow, and the bottleneck of the whole program. Corpus
  growth needs dedicated human sessions on a live Classroom account, and
  captures must be sanitized before commit (real student data cannot land in
  git — this is exactly why #396 is only partially done).
- C1's exactness will cause "annoying" CI failures on intentional behavior
  changes. The remedy is re-labelling the affected cases in the same PR, which
  is the desired friction: behavior changes become visible.

**New obligations**
- A capture/sanitize tool must exist and be maintained
  (`docs/CLASSROOM_FIXTURE_CAPTURE_GUIDE.md` extends into a script).
- Corpus integrity is checksummed like the existing fixture manifest, so a
  silently edited label is a build failure.

## Alternatives Considered

**Claim 100% and rely on manual QA.** Rejected — unfalsifiable, and the current
bug list (#537, #541, #546, #547) is evidence manual QA already missed cases.

**Adopt only the epic's 99.5/98 numbers.** Rejected as too weak on the closed
set: for cases we have already labelled, anything less than exact is a known bug
we chose to ship.

**Live end-to-end tests against real Classroom in CI.** Rejected: needs real
credentials and real student data in CI, is rate-limited, non-deterministic, and
a privacy hazard. Live checks stay a manual, human-run activity (compare mode,
`extension/docs/COMPARE_MODE_RUNBOOK.md`).
