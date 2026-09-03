# Session Log — Engine V4 master plan + system design

Date: 2026-08-22 · Branch: `qa/e2e-hardening` · Mode: planning only, **no source code changed**

## What was asked

A multi-month plan to fix the engine end to end — detection, downloading,
formatting — to "100% accuracy", plus the system design, grounded in software
engineering best practice and SOLID.

## What was produced

| File | Type | Lines | Purpose |
|---|---|---|---|
| `docs/adr/0007-pure-core-ports-and-adapters.md` | ADR | 100 | Decision: pure core + ports/adapters, enforced by fitness functions |
| `docs/adr/0008-accuracy-definition-and-gates.md` | ADR | 114 | Decision: what "100% accurate" means operationally, and its three gates |
| `extension/docs/ENGINE_V4_SYSTEM_DESIGN.md` | Design | 428 | Target design: topology, layering, roles+bus, data model, three pipelines, failure model, SOLID mapping, target tree |
| `docs/ENGINE_V4_MASTER_PLAN.md` | Program plan | 306 | 8 workstreams, 7 gates, 12 sprints, defect backlog, risk register, rollout/rollback, scope-cut plan |
| `docs/superpowers/plans/2026-08-22-engine-v4-s1-accuracy-harness.md` | Sprint plan | 963 | Sprint 1, executable: 8 TDD tasks, full code, exact commands |

No file under `extension/src/` or `extension/entrypoints/` was touched.

## Commands run and results

All read-only. `find`, `grep`, `sed -n`, `wc -l`, `ls`, `cat` across
`extension/src/`, `extension/tests/`, `extension/entrypoints/`, `docs/`,
`.github/workflows/`; plus:

- `bd show cqd-685` → empty (the epic lives in **GitHub**, not beads; beads IDs
  are `Classroom-Quick-Downloader-<slug>`). Corrected course to `gh`.
- `bd ready` → 4 ready issues, none engine-related.
- `gh auth status` → logged in as `adhamhaithameid`, exit 0.
- `gh issue view 685` → full epic body retrieved; phases #673–#679, cross-cutting
  #680–#681, chores #682–#684, success-metric table.
- `gh issue list --state open` → 35 open issues; engine-relevant ones catalogued.

Two commands failed and were worked around, not hidden:
`grep -rn "authuser" ... --include=*.ts` and the `pendingByUrl` grep both died
with `zsh: no matches found: --include=*.ts` — zsh globbed the flag. The facts
were obtained from direct file reads instead. Every `bash` call also printed the
pre-existing `zoxide: detected a possible configuration issue` warning from the
user's shell profile; unrelated to this repo.

## Key findings that shaped the plan

1. **Phase 1 is further along than the epic suggests.** `src/contracts/detection.ts`,
   `src/detect/{keyword,structural,shared}/`, `src/decide/` and a real fitness
   function (`tests/contracts/import-boundary.test.ts`) already exist. The
   detect/decide seam shrank `flag-scoring.ts` from 1,013 lines to 95. The plan
   builds on that instead of proposing it again.
2. **The fixture corpus is real but small** — 9 sanitized fixtures with a sha256
   `manifest.json` and an integrity test. Only 1 is non-English. #396 is
   correctly marked "partially done".
3. **There is no structural signal for "edited"** in any fixture held today
   (recorded in `SPRINT_PLAN.md`). That is a confirmed constraint, logged as
   risk R1/R3 rather than planned around optimistically.
4. **Download and naming were never in the engine model.** The PRD's four roles
   stop at the content script. The design adds `AcquireEngine` (worker) and a
   pure `NamePolicy`, which is what lets #537/#541/#546/#547/#664 be planned as
   engineering rather than as one-off patches.
5. **#541's root cause confirmed by reading the code**:
   `entrypoints/content/file-meta.ts` `GARBAGE_LABELS` is a hardcoded English
   array matched with `endsWith` — a Hungarian type label cannot match, so it is
   appended to the filename instead of stripped.

## Technicalities to be able to explain

- **Why a pure core is a prerequisite for accuracy, not a style preference.**
  Accuracy is a measurement; measurement needs determinism; anything reading the
  DOM, `chrome.*`, the clock or the network at decision time is non-deterministic.
- **Two-tier harness.** Tier B (jsdom, HTML→observations) is truthful but slow;
  Tier A (pure, observations→decisions) is fast enough to evaluate a policy
  change over hundreds of cases. Tier B runs feed Tier A's inputs.
- **The ratchet.** `accuracy-budget.json` holds floors that may only rise and a
  `knownFailures` list that may only shrink; a knownFailure that starts passing
  *fails the build*, which is what stops the list from rotting.
- **Why "wrapped verbatim" is the rule for Sprint 5.** Reversibility. If the
  commit that moves code also rewrites it, the revert stops being safe and the
  gate model collapses.
- **Why 100% is split into three commitments.** 100% on the closed corpus and on
  the defect-to-fixture process are provable; 100% on the open web is not, and
  claiming it would be indefensible the first time Classroom redeploys.

## Blast radius

**This session:** zero runtime risk. Five new markdown files, no source, no
config, no CI change. Nothing to roll back except `git rm` on five docs.

**The plan it proposes:** the risky phases are S6 (bridge activation — first
phase users can see, gated behind the Engine Mode toggle) and S10 (V1 detector
deletion — the one irreversible step, gated on a full clean release at G3).
Everything before S6 is provably behavior-neutral by the G0 suites.

## Open items — owner decisions needed

Listed in `docs/ENGINE_V4_MASTER_PLAN.md` §13: pace, corpus capture sessions,
G2 parity threshold, whether Download-All/Student Work are in scope, and whether
V3/OAuth is committed or formally deferred.

## Suggested next commands (not run — conservative profile)

```bash
git status
```

```bash
git add docs/adr/0007-pure-core-ports-and-adapters.md docs/adr/0008-accuracy-definition-and-gates.md docs/ENGINE_V4_MASTER_PLAN.md docs/superpowers/plans/2026-08-22-engine-v4-s1-accuracy-harness.md docs/session-logs/2026-08-22-engine-v4-master-plan.md extension/docs/ENGINE_V4_SYSTEM_DESIGN.md
```
