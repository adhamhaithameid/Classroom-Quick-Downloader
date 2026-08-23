# Workflow: Release Ritual (SKETCH — not yet grilled to depth)

> Status: **draft sketch** — do not implement until promoted after
> repo-triage-burst ships.
> Loop: cutting a CQD release, currently ~30 min of manual choreography.

## Current flow (observed)

1. Dispatch `version-bump.yml` (component + level) → PR opens (bump + resync).
2. Human merges PR.
3. Human pushes tag `v<version>` ← the deliberate human gate (ADR: manual gate kept).
4. `extension-distribution.yml` fires on the tag: builds 3 browsers,
   auto-publishes Firefox to AMO, creates draft GitHub release with artifacts.
5. **Manual**: upload Chrome zip → Chrome Web Store dashboard.
6. **Manual**: upload Edge zip → Edge Partner Center.
7. **Manual**: publish the GitHub draft release.
8. Manual changelog sanity-check (`*.manual.*` files vs generated copies).

## Automation candidates (to grill when promoted)

- Steps 1–4 are already automated; workflow wraps them into one command:
  `release <component> <level>` → dispatch → watch → prompt for tag approval
  (the one checkpoint) → push tag → monitor distribution run → brief on AMO result.
- Steps 5–6 have no usable APIs for Edge; Chrome Web Store API exists but needs
  an OAuth refresh token — bead `mj3` tracks this decision.
- Step 7 executable on user confirmation inside the same checkpoint.
- Step 8 verifiable via existing `sync:versions --check` + generated-copy diff.

## Open questions blocking promotion

- Chrome Web Store API token: worth minting, or keep manual?
- Should tag-push be part of this workflow's executor, or stay a human git action?
- Post-release verification set (which endpoints/smokes constitute "shipped OK"?)
