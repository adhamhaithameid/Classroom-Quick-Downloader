# Agent token audit — Phase 2-4 results (2026-10-09)

Baseline: docs/agent-audit/01-baseline.md (2.31B tok / 30 sessions / 21.8d;
top sinks d ~879k, e ~870k, f ~639k, a ~237k, h ~160k est tok/wk).
token-diet.md was missing; no post-fix sessions exist, so all savings are ESTIMATED unless MEASURED.

Commits (one fix = one commit = one bead, all closed):
dc31788e FIX 1 scripts/orient + scripts/check (i338.31); 8ff00a9c FIX 2
.ignore + agent-env.sh + core.pager (i338.32); 1a9cc78a FIX 3 AGENTS.md
efficiency rules (i338.33); 99d40bcd FIX 4 typecheck aliases, CI pins
verified, gitleaks bead (i338.34); 187b303e FIX 5 pnpm run audit:agents
(i338.36).
Open follow-up: i338.35 gitleaks pre-commit stage (binary absent, not installed).
Closed with Phase 4: i338.38 golden tasks + docs-task A/B sample + this report.

Savings per fix:
- FIX 1 (pool f+a+g+c ~1.03M/wk): ESTIMATED 30-50% = ~0.3-0.5M/wk.
  MEASURED: orient 10 lines; node --test 3/3; check tools `ok`.
- FIX 2: MEASURED rg --files 0 noise; saving <3% of weekly fresh input,
  flagged low-ROI, kept for near-zero cost. ESTIMATED <20k/wk.
- FIX 3 (pool d+e ~1.75M/wk): behavioral, unproven; ESTIMATED 0-30%;
  costs ~330B fixed tax (MEASURED). Needs the re-measure.
- FIX 4: ~0 direct; CI SHA-pins verified, 3 workflows (MEASURED). FIX 5: enables next week's MEASURED numbers.

Golden task (docs update, Task 5): MEASURED (n=1, authoring session,
hand-counted): 5 tool calls, 3 before first edit, vs baseline median 23
pre-edit and 3.8 calls/edit; check --changed -> ok. Brief adapted to
docs/agent-tooling.md (CONTRIBUTING.md is a public no-PR doc).

Skipped: 2A rtk hook (no verified hook surface; pointer in FIX 3);
2D generated REPO_MAP (duplicates hand map; gate bead i338.37); 2G skills/
MCP prune (owner setup, unmeasurable); 2H custom subagents (harness ships
equivalents; rule in FIX 3); 2J caveman (conflicts with ASD-STE100,
~1-1.5k/turn input tax, A/B gate would fail it).

Risks: FIX 3 compliance unproven without fresh sessions; no rtk hook; scripts/check can miss
cross-workspace contract deps; .ignore hides tracked lockfiles from rg by design.

Re-measure next week: pnpm run audit:agents; golden Tasks 1-4 fresh A/B
(protocol in golden-tasks.md); watch pre-edit calls (23), calls/edit (3.8), test invocations (681), collapsed turns (11); worktree 960c577e vs HEAD.
