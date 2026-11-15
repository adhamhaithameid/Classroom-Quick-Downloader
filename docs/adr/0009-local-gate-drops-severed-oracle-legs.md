# ADR-0009: The local gate chains drop the severed oracle-backend legs

- **Status:** accepted
- **Date:** 2026-11-15
- **Deciders:** Adham (owner, by plan approval), agent-proposed
- **Bead:** Classroom-Quick-Downloader-ic4n

## Context

oracle-backend was severed from the live data path in 2026-09. Its suites
still gated every local full-gate push through the root chains
(`test:smoke`, `test:functional`, `test:integration:all`, `test:regression`,
`test:load`, `test:stress`, `test:security:all`, `test:ui`, `test:fuzz:all`,
`test:reliability`, and one explicit `test:strict` segment).

On 2026-11-14 a docs-only push (PR #880) stalled 19+ minutes inside
`pnpm -C oracle-backend run test:smoke`: 0% CPU, no child processes, no
output, unrecoverable except by killing the push. The mechanism was never
captured. The same leg passed standalone in about 2 seconds the next day
(`go test ... ok`, exit 0, go1.26.1 from `~/.local/bin`), so the stall is
intermittent and unreproduced. A first hypothesis ("no Go toolchain on this
machine") was wrong: `go` lives at `~/.local/bin/go`, which the gate's PATH
self-heal already covers. The stale Intel path `/usr/local/opt/go/bin` in
the hook and `AGENTS.md` was dead weight either way.

CI already owns oracle coverage where it matters: `production.yml` runs
`pnpm -C oracle-backend run test:strict` on the release lane, and
`nightly-tests.yml` provisions Go from `oracle-backend/go.mod`.

## Decision

The root gate chains no longer run oracle-backend legs. The workspace keeps
its own scripts (`pnpm -C oracle-backend run test:strict`, `test:oracle`,
`validate:oracle`, `scripts/check oracle-backend`) for any machine with Go,
and CI coverage is unchanged. `.husky/pre-push` and the `AGENTS.md` PATH
note drop the dead `/usr/local/opt/go/bin` segment.

## Consequences

- Local full gates complete end-to-end again; the intermittent,
  un-diagnosable stall cannot block a push.
- Oracle regressions surface through CI (nightly + production lane), not
  through local pushes. An engineer who wants the oracle suites locally must
  run the workspace scripts deliberately.
- `scripts/check oracle-backend` still exists and still requires Go; it
  fails clearly on machines without one.

## Alternatives Considered

- **Install/repair Go and keep the legs.** Go already works; the stall had
  no children and no output, so a toolchain fix has no target. Rejected.
- **Keep the legs behind a timeout.** `go test -timeout` cannot fire when
  no test binary is running, and a pnpm-level watchdog adds a kill path that
  masks the real question. Rejected.
- **Delete oracle-backend.** The repo deliberately keeps the severed backend
  restorable (`ORACLE_RECOVERY_RUNBOOK.md`). Deleting it is a separate,
  larger decision. Rejected here.
