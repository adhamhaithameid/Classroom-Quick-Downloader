# ADR-0004: Renovate for Version PRs; Dependabot Only for Security Alerts

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** Adham Haitham

## Context

Both Renovate (`renovate.json`) and Dependabot (`.github/dependabot.yml`) were
active simultaneously, double-filing dependency PRs across npm, Go modules,
Docker, and GitHub Actions.

## Decision

Keep **Renovate** as the single version-PR bot. Delete `.github/dependabot.yml`
(and its now-orphaned auto-merge workflow). Dependabot **security alerts and
security updates stay enabled** via repository settings (verified enabled).

## Consequences

- One dependency PR stream instead of two.
- Renovate automerges minor/patch/pin/digest updates once required checks pass;
  lockfile maintenance is automated.
- Required branch-protection checks gate those automerges — flaky CI days slow
  automerge (accepted).

## Alternatives Considered

- Keep Dependabot, drop Renovate: rejected — no automerge, no lockfile
  maintenance, weaker grouping config than what Renovate already had.
