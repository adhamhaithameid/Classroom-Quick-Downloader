# Agent tooling

Fast, bounded commands for agent sessions. See AGENTS.md for the standing
rules; this file is the usage reference.

## scripts/orient

One-call orientation: branch, last commit, dirty files, touched workspaces,
bd ready summary. Output stays within 15 lines.

```bash
scripts/orient
```

## scripts/check

Affected-only verification. Runs typecheck, lint (where defined), and the
related tests for one workspace, or for the workspaces touched by
uncommitted changes. Never runs the full monorepo suite.

```bash
scripts/check extension         # one workspace
scripts/check --changed         # derive from git status (default with no args)
```

Workspaces: `extension`, `website`, `cloudflare-worker`, `oracle-backend`,
`tools`. Changed test files run directly; changed sources run `vitest
related`; oracle-backend runs bounded `go vet` + `test:smoke`. Output: one
`ok <workspace>:<step>` line per step, or `FAIL` plus the first 30 error
lines. Exit 1 on the first failure.

## scripts/agent-env.sh

Quiet, deterministic tool output. Source it once per shell:

```sh
. scripts/agent-env.sh   # NO_COLOR=1 CI=1 PAGER=cat GIT_PAGER=cat TERM=dumb
```

## pnpm run audit:agents

Re-runs the agent token audit (tools/agent-audit/audit.mjs) and rewrites
`docs/agent-audit/01-baseline.md` + `baseline.json`. Run weekly during the
token-diet A/B window; see docs/agent-audit/golden-tasks.md for the protocol.
