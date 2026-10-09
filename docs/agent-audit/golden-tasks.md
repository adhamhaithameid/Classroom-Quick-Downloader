# Agent golden tasks (token-diet Phase 4.1)

Five representative task briefs, derived from this repo's real recent work
(beads i338.* and commits on master, Sept-Oct 2026). Each is executed in a
FRESH ZCode session (no handoff context) to measure agent efficiency before
and after the token-diet fixes.

## A/B protocol (per task)

1. **A (pre-fix)**: `git worktree add ../CQD-gt-a 960c577e` (last pre-fix
   commit; token-diet fixes start at dc31788e). Open a fresh session there.
2. **B (post-fix)**: fresh session at `chore/token-diet` HEAD.
3. Paste the brief verbatim. Let the agent work to "done" with no hints.
4. Measure per run (from `turn_usage`/`tool_usage` in the ZCode SQLite, or
   `pnpm run audit:agents` after the week window):
   tool calls before first edit, total tool calls, calls per accepted edit,
   fresh (uncached) input tokens, total tokens.
5. Compare against the Phase-1 baseline comparators: median **23** calls
   before first edit; **3.8** calls per accepted edit; 681 full-suite test
   invocations per 30 sessions. Pass = B improves calls-before-first-edit
   and total tokens without breaking the task's pass criteria.
6. Label every number MEASURED (from logs) or ESTIMATED (bytes/4 proxy or
   projection). Never mix labels in one comparison.

## Task 1 — UI change (real source: i338.29)

Brief: "In `extension/` options page, apply the approved Stillwater
token/cards styling to the settings cards (see docs/design Stillwater
references). Keep behavior identical; only classes/tokens/markup change."
Pass criteria: `pnpm -C extension run typecheck` exits 0; options UI renders
cards with Stillwater tokens (manual spot check or existing visual test);
no behavior test regresses (`scripts/check extension` green).

## Task 2 — Bug fix (real source: i338.3 / i338.2)

Brief: "Bug: classroom-level download does not work in the New engine —
clicking Download Classroom downloads nothing. Diagnose and fix test-first."
Pass criteria: a new failing test that reproduces the bug is added and now
passes; `scripts/check extension` green; fix touches engine code paths only.

## Task 3 — Refactor (real source: 51614211)

Brief: "Consolidate the duplicated S2 download-timeout settle logic and the
leading-dot trim into one helper; callers keep identical behavior."
Pass criteria: existing extension vitest suite green via
`scripts/check extension`; no behavior change (no new tests required);
duplication removed (one definition).

## Task 4 — Test addition (real source: 4ed40c77)

Brief: "Add a regression test: on the free model, extension startup must not
fetch remote config. Red first if the bug exists on the branch under test."
Pass criteria: new test fails on a branch with the bug and passes on HEAD;
`scripts/check extension` green; test runs in under 10s.

## Task 5 — Docs update (real source: style of 084d97c6)

Brief: "Document the agent scripts (`scripts/orient`,
`scripts/check <workspace|--changed>`, `scripts/agent-env.sh`,
`pnpm run audit:agents`) in `docs/agent-tooling.md`: purpose, usage,
one example each. Keep it under 30 lines. (Adapted 2026-10-09: the
original target CONTRIBUTING.md is a public no-PR policy doc; internal
dev workflow belongs in docs/, next to AGENTS.md's one-line pointers.)"
Pass criteria: doc contains all four commands with accurate usage;
`scripts/check --changed` reports no affected workspaces; doc matches
the scripts' actual flags.

## Status

- Task 5 executed once on 2026-10-09 (MEASURED, see 02-results.md).
- Tasks 1-4 not yet run; schedule one per week alongside
  `pnpm run audit:agents`.
