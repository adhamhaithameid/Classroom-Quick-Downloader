## 2026-06-29 — Deployment Workflows Lack Job Timeouts
**Issue Filed:** Watch: Deployment workflows lack job timeouts — hung jobs block runners for hours
**Workflow Audited:** `.github/workflows/deploy-cloudflare-worker.yml`, `.github/workflows/oracle-dashboard-deploy.yml`, `.github/workflows/website-deploy.yml`, `.github/workflows/github-pages.yml`
**Finding:** These four deployment workflows are missing `timeout-minutes` on all their jobs (`preflight` and `deploy`), risking runners blocking for up to 6 hours if tasks hang.
**Learning:** While the primary CI testing workflows generally have timeouts configured, deployment workflows and simple summary jobs (`ci-passed` in `ci.yml`) were overlooked.
**Next Priority:** Check for path filters and trigger scopes in `ci.yml` and component-specific workflows to ensure they aren't running unnecessarily across all files.
