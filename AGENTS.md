# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
```

Note: `bd dolt push` (tracker sync) belongs to the Team-maintainer profile
below — do not run it under the default Conservative profile.

## Bead Me Up (mandatory bead-change report)

The owner must see every tracker change in chat. After ANY `bd` mutation —
create, close, reopen, claim, status change, defer, delete — print this block
before doing any other work in that turn:

```text
BEAD ME UP
<id> <short title> — <old state> → <new state>
```

One line per affected bead. A failed mutation prints the exact error instead.
No `bd` state change may pass silently.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Repository Map

Monorepo (pnpm workspaces): `extension/` (WXT browser extension, TS) ·
`website/` (SvelteKit marketing site) · `cloudflare-worker/` (Workers API +
Durable Objects) · `oracle-backend/` (Go; severed from the live data path
2026-09) · `tools/` (root scripts + node --test suites) · `docs/` (start at
[docs/INDEX.md](docs/INDEX.md)).

Extension facts that cost agents hours when re-derived:

- Runtime surfaces live in `extension/entrypoints/` (background, popup,
  options, content scripts, diagnostics); `extension/src/` is pure logic
  only (adapters, bus, contracts, detect).
- There is no `manifest.json` — it is generated from `extension/wxt.config.ts`.
- `extension/tsconfig.json` extends the generated `.wxt/tsconfig.json`, whose
  include spans the whole repo: if `tsc --noEmit` fails on
  `cloudflare-worker` types (`D1Database`), that is this include, not your
  diff. `tests/integration-extension-cloudflare.test.ts` is already excluded.
- CI's coverage gate is `pnpm -C extension test:coverage:all` (critical +
  runtime profiles via `COVERAGE_PROFILE`, thresholds in vitest config) —
  bare `vitest --coverage` reports different numbers than CI.

Workflow facts:

- PRs are merged via admin merge (a ruleset requires extra approval for
  unattributed changes) — a green but BLOCKED merge state is normal.
- Run `bd` from the repo root of the primary checkout; the Dolt DB
  (`.beads/dolt/`) does not exist in worktrees.
- Parallel sessions share this checkout: do significant work in a dedicated
  worktree (e.g. `git worktree add ../CQD-wt-<topic> -b <branch> origin/main`),
  and never assume `git status` describes only your changes.
- Worktree notifications are mandatory: announce in chat BEFORE creating any
  worktree (path, branch, purpose), and report the created path AFTER. Never
  create a worktree silently.
- Verify doc claims against code before relying on them — dated reports and
  Oracle-era docs describe a world that has changed.

## Agent Shell Rules

- The shell cwd resets between Bash calls. Embed `cd` inside every command
  that depends on location, and `pwd`-check before any write that resolves
  relative paths — GitHub contents-API commits read CWD-relative local
  files (a wrong-cwd API commit once wrote a workspace file to the repo
  root and emptied the lockfile on a remote branch).
- Long-running or background commands: redirect output to a file and poll
  the file. Never pipe through `tail` — it buffers until EOF (a 12-minute
  idle wait once) and its exit code masks the real one.
- Pre-push gate PATH — the hook self-heals this into its own environment, but
  for manual gate runs export:
  `export PATH="/opt/homebrew/opt/openssl/bin:$HOME/.local/bin:/usr/local/opt/go/bin:$PATH"`
  The gate is scoped: it runs only the workspaces your push touches
  (`tools/pre-push-scope.mjs`); full gate for main pushes or `CQD_FULL_GATE=1`.
- Commits are commitlint-checked (conventional): subject lowercase after
  the type, body lines ≤ 100 chars.
- Escalating retries on a blocked action (Mimosa hook, commitlint) are a
  signal to change approach, not to retry the same call.
- NEVER run `git clean -fdX` or `git clean -X` here — its `-e` excludes did
  NOT protect `.beads/`, `.env`, or `extension/.output/signed.xpi` (2026-10-24
  incident; `bd bootstrap` restored the tracker, but `.env` values and design
  prototypes were lost with no backup). Remove generated files only with
  `scripts/safe-clean` (dry-run by default). Protected paths:
  `.beads/`, `*.env`, `.dev.vars`, `signed.xpi`, `tools/commit-planner/data.*`
  (regenerate via `scan.mjs`), `website/prototype-*.html`. See GLOSSARY.md.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

## Agent efficiency

- Start every session with `scripts/orient` (branch, dirty files, bd ready, last commit). Do not re-derive repo facts with exploration loops.
- Verify with `scripts/check <workspace|--changed>` (affected typecheck, lint, tests only). Do not run the full monorepo suite for one change.
- Cache hygiene: never edit files already loaded in context (AGENTS.md, docs, package.json) mid-session; batch such edits at session start. Prefer static reading (`rg`, ranged `Read`) over more calls.
- Keep bash output bounded: pipe through `| head -30`, prefix with `rtk` where it helps (`rtk gain`), and source `scripts/agent-env.sh` for quiet, no-color output.
- Final reports: at most 6 lines. State result, evidence, next step. No task restatement, no step-by-step narration.
- Delegate broad searches to the built-in Explore subagent and reviews to the built-in code-reviewer; do not hand-roll custom equivalents.

## Output style: ASD-STE100

Write all prose in ASD-STE100 Simplified Technical English: sentences of 25 words or fewer, active voice, one meaning per word, no idioms, no contractions.

Full rules: docs/ASD_STE100_RULES.md

Scope: chat replies, commit messages, docs. Scope excludes code identifiers and product UI copy.
