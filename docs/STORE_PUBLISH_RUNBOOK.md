# Three-Store Publish Runbook

> 2026-10-28: publishing is now exclusive to the production pipeline
> (production.yml -> extension-stores.yml) behind the production-environment
> approval. This document stays the reference for store mechanics and error
> classes. Lane model: docs/RELEASE_PIPELINE.md.

Current-state runbook for publishing the extension to Chrome Web Store,
Firefox Add-ons (AMO), and Microsoft Partner Center. The 2026-10-03 sessions
retro found store-publish friction in 29 of 44 interactive sessions (67 tool
hits), dominated by one error class: **AMO "Version X already exists"**.

> Historical background: `docs/DISTRIBUTION_CI_PLAN.md` (2026-06-24) describes
> the older hybrid pipeline. The one-command automated workflow below
> supersedes it for Chrome/Edge/Firefox.

## The automated path (use this)

GitHub Actions workflow: **"Extension Stores — Automated Publish (all three)"**
(`.github/workflows/extension-stores.yml`), triggered manually
(`workflow_dispatch`) with a ref (tag or branch, e.g. `v1.8.7`).

It builds all three artifacts and publishes each store leg; a leg skips itself
(with a loud notice) when its secrets are absent.

Required repo secrets (one-time owner setup, then never again):

| Store | Secrets |
|-------|---------|
| Firefox/AMO | `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` (already exist) |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_CLIENT_SECRET` |
| Chrome | `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` |

## The AMO version rule (the recurring failure)

AMO version strings are **immutable and globally unique per addon**. Re-running
a publish (or retrying after a partial failure) with the same
`extension/package.json` version fails with:

```
Version 1.8.0 already exists
already exists on AMO — bump extension/package.json version or delete the AMO version.
```

Session logs show this error looped many times across releases. The fix order:

1. Bump the version in `extension/package.json` (a patch bump is fine —
   `1.8.0` → `1.8.1`).
2. Propagate it: `pnpm run sync:versions` then `pnpm run check:versions`.
3. Tag the release and dispatch `extension-stores.yml` with the new tag.

Do **not** delete the AMO version unless you specifically want to replace an
unlisted/draft upload — bumping is almost always the right move.

## Pre-flight checklist

- [ ] Version bumped in `extension/package.json` and synced
      (`pnpm run check:versions` green — CI has a version-manifest drift gate).
- [ ] Changelog updated (`pnpm run sync:manual-changelog`).
- [ ] Tag pushed, matching the ref you dispatch the workflow with.
- [ ] Secrets present (missing-secret legs skip with a notice — check the run
      summary rather than assuming all three published).

## Manual fallbacks

- Per-store manual steps and store-policy context: `docs/DISTRIBUTION_CI_PLAN.md`.
- Safari: `docs/SAFARI_DISTRIBUTION_RUNBOOK.md`.
- Store verification (listing, screenshots): the store audit sessions used
  `docs/E2E_BROWSER_MATRIX.md` as the test matrix.
