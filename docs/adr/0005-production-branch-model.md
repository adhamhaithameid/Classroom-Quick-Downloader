# ADR 0005: Production Branch Model for the Release Train

Date: 2026-10-28 · Status: accepted · Deciders: owner (plan review 2026-10-28) · Epic: beads `9bmc`

## Context

Before 2026-10-28 the repo had a single branch (`main`) that both developed
and deployed: worker and website deployed on every push, and the extension
stores published by dispatch from any ref. A 2026-10-28 audit found ungated
publish paths (the legacy tag workflow auto-published AMO), missing-secrets
silent skips, no version monotonicity checks, no approval environments, and a
manual-QA suite that never ran in CI. Single-maintainer context: PR reviews
cannot gate anything (self-approval is impossible), but the owner is present
at release time.

## Decision

1. Introduce a long-lived `production` branch that receives only promote-PRs
   from `main`. All production-facing effects — worker deploy, website deploy,
   store publication — run from `production` through `production.yml`.
2. Gate the train on a `production` GitHub **environment** with a required
   reviewer and no branch policy. The approval is the human gate everywhere,
   including emergency dispatches (a branch policy would bind administrators
   and deadlock tag-ref emergencies).
3. `main` keeps the development lane: fast CI, scoped pre-push gate,
   Renovate, no deploys.
4. Store publication is exclusive to the pipeline; the legacy tag workflow
   becomes draft-release-only. Dispatch paths exist for emergencies but carry
   the same environment approval and explicit exception inputs.
5. Version monotonicity is enforced by preflight verdicts, not by store error
   handling: a promote whose versions equal live skips publication by design.

## Consequences

- Pushing to `main` no longer deploys anything — a deliberate, announced
  behavior change (see docs/RELEASE_PIPELINE.md).
- The owner's per-release cost drops to: glancing at stage 1, running the
  HITL checklist, clicking Approve once.
- Rehearsals (`dry_run=true`) exercise the entire train, including the
  approval UX, with zero user-facing effects.
- Stage 2 runs deploy/publish under non-cancelling concurrency; a rehearsal
  can queue but never kill a live deploy.
- Accepted latencies: hotfixes ride the full e2e stage; full Stryker runs
  once per release SHA (promote-PR), nightly covers main.

## References

- Spec: docs/superpowers/specs/2026-10-28--production-pipeline-design.md
- Gate ledger and runbook: docs/RELEASE_PIPELINE.md
- Supersedes: the tag-choreography sketch in workflows/release-ritual.md and
  the DISTRIBUTION_CI_PLAN.md publish path (already marked superseded).
