## 2026-06-15 — Missing job timeouts
**Issue Filed:** Watch: oracle-backend-ci.yml and ci.yml lack job timeouts — hung test blocks runner for hours
**Workflow Audited:** `.github/workflows/oracle-backend-ci.yml`, `.github/workflows/ci.yml`
**Finding:** These workflows do not have a `timeout-minutes` setting on any job. A hung test or database migration could block the runner for up to 6 hours.
**Learning:** Workflows in this repository often lack `timeout-minutes`. Future audits should verify that all new jobs and workflows explicitly set a reasonable timeout.
**Next Priority:** Check other workflows (e.g., `codeql.yml`, `deploy-cloudflare-worker.yml`) for missing job timeouts and examine path filters to ensure CI doesn't run unnecessarily.
