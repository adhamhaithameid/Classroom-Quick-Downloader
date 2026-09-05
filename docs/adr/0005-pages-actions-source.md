# ADR-0005: GitHub Pages Source — Legacy Branch Mode → GitHub Actions Mode

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** Adham Haitham

## Context

Pages was configured in legacy "deploy from branch" mode pointing at `main` `/`,
which served a 404. Any workflow-based deploy (upload-pages-artifact /
deploy-pages) requires Pages to be in "GitHub Actions" build mode.

## Decision

Flip Pages to `build_type=workflow` via API. Deployments happen exclusively
through the `Build & Deploy Knowledge Graph` workflow (see ADR-0001/0003).

## Consequences

- The 404 is fixed by the first successful graph deploy.
- Deploys are atomic artifact uploads with an environment URL and deploy history.
- Legacy branch-source settings are gone; re-enabling them would be a manual
  revert if ever wanted.

## Alternatives Considered

- Fixing legacy mode by committing built artifacts to a branch: rejected —
  build artifacts in git bloat history and complicate the no-commit hygiene
  we're enforcing elsewhere.
