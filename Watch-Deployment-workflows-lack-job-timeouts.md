---
title: "Watch: Deployment workflows lack job timeouts — hung jobs block runners for hours"
---

## 👁️ Watch — CI/CD Health
**Agent:** Watch | **Day:** Monday | **Date:** 2026-06-29
**Workflow:** `.github/workflows/deploy-cloudflare-worker.yml`, `.github/workflows/oracle-dashboard-deploy.yml`, `.github/workflows/website-deploy.yml`, `.github/workflows/github-pages.yml`

---

### 👁️ Finding
The repository's CI testing workflows (like `ci.yml` and `oracle-backend-ci.yml`) correctly utilize `timeout-minutes` to cap job runtime. However, the production deployment workflows omit this safety net entirely.

Specifically, the `jobs:` configurations in the following workflows lack any `timeout-minutes` setting:
- `.github/workflows/deploy-cloudflare-worker.yml` (both `preflight` and `deploy` jobs)
- `.github/workflows/oracle-dashboard-deploy.yml` (both `preflight` and `deploy` jobs)
- `.github/workflows/website-deploy.yml` (both `preflight` and `deploy` jobs)
- `.github/workflows/github-pages.yml` (`deploy` job)

### 🎯 Impact
Without `timeout-minutes`, a hung step (e.g. `npx wrangler deploy` hanging indefinitely due to an API timeout, or `pnpm install` hanging on a bad registry connection) will block a GitHub Actions runner for up to 6 hours (the default maximum). This wastes CI minutes and prevents subsequent queued workflows from executing.

### 💡 Recommended Fix
Add `timeout-minutes: 20` to all `deploy` jobs and `timeout-minutes: 10` to all `preflight` jobs across the deployment workflows.

Example correction for `.github/workflows/deploy-cloudflare-worker.yml`:

```yaml
jobs:
  preflight:
    name: Pre-deploy Guardrails
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # ... existing steps ...

  deploy:
    name: Deploy Worker to Cloudflare
    runs-on: ubuntu-latest
    needs: preflight
    timeout-minutes: 20

    # ... existing steps ...
```

### 📐 Acceptance Criteria
- [ ] Added `timeout-minutes: 10` to all `preflight` jobs in deployment workflows.
- [ ] Added `timeout-minutes: 20` to all `deploy` jobs in deployment workflows.
- [ ] Added `timeout-minutes: 10` to the `deploy` job in `github-pages.yml`.
- [ ] Verification: Deployments complete successfully within the allocated timeframes.
- [ ] No regressions: Existing passing deployment steps still succeed.

### 📋 Notes
The `ci.yml` workflow also has a `ci-passed` summary gate job that is missing a timeout, which should ideally also have `timeout-minutes: 10` added.
