# ADR-0002: Beads (`bd`) as the Issue Tracker

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** Adham Haitham

## Context

Agent-driven development needs durable, dependency-aware task tracking that
survives sessions. Markdown TODO lists rot; GitHub Issues are remote-first and
awkward for local agent loops; TodoWrite-style lists die with the session.

## Decision

Use [Beads](https://github.com/gastownhall/beads) (`bd`) with its embedded Dolt
database in `.beads/`. Workflow: `bd ready` → `bd update <id> --claim` → work →
`bd close <id>`. Persistent project knowledge goes through `bd remember`, not
ad-hoc memory files. Cross-machine sync (when needed) via `bd dolt push/pull`
against `refs/dolt/data` on the git remote.

## Consequences

- Agents get `bd ready` — a dependency-aware queue they can't misread.
- `.beads/` is committed to git; issue IDs are hash-based so multi-agent merges
  don't collide.
- CI cannot yet write beads directly (dolt sync to the remote isn't configured);
  nightly CI failures file GitHub issues labeled `ci-failure` instead.

## Alternatives Considered

- GitHub Issues: fine for humans, poor fit for offline agent loops.
- Markdown TODO files: no dependencies, no state, rots immediately.
