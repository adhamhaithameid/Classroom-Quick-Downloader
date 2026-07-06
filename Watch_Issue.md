---
title: "Watch: deploy workflows have no job timeouts — hung steps block runners for hours"
---
## 👁️ Watch — CI/CD Health
**Agent:** Watch | **Day:** Monday | **Date:** 2025-03-01
**Workflow:** deploy-cloudflare-worker.yml, website-deploy.yml, oracle-dashboard-deploy.yml, github-pages.yml

---

### 👁️ Finding
Several deployment workflows (`deploy-cloudflare-worker.yml`, `website-deploy.yml`, `oracle-dashboard-deploy.yml`, and `github-pages.yml`) lack `timeout-minutes` settings on their jobs (`preflight` and `deploy`).

### 🎯 Impact
Without `timeout-minutes`, a hung test, build, or deploy step can block a GitHub Actions runner for up to 6 hours (the default maximum). This blocks the deployment pipelines, prevents other CI jobs from running in constrained environments, and can tie up concurrency groups unnecessarily.

### 💡 Recommended Fix
Add `timeout-minutes` to each job in the affected deployment workflows.

For `deploy-cloudflare-worker.yml`, `website-deploy.yml`, and `oracle-dashboard-deploy.yml`:
```yaml
jobs:
  preflight:
    name: Pre-deploy Guardrails
    runs-on: ubuntu-latest
    timeout-minutes: 10
```
```yaml
  deploy:
    name: Deploy Worker to Cloudflare
    runs-on: ubuntu-latest
    needs: preflight
    timeout-minutes: 20
```

For `github-pages.yml` (and other single-job workflows like `release-drafter.yml`):
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

### 📐 Acceptance Criteria
- [ ] Added `timeout-minutes: 10` to `preflight` jobs in deployment workflows.
- [ ] Added `timeout-minutes: 20` to `deploy` jobs in deployment workflows.
- [ ] Added `timeout-minutes: 15` to single jobs in `github-pages.yml` and `release-drafter.yml`.
- [ ] Verification: workflows still run and pass successfully.
- [ ] No regressions: existing passing jobs still pass.

### 📋 Notes
A quick check with `grep -c "timeout-minutes"` shows that while `ci.yml` and `oracle-backend-ci.yml` correctly use timeouts on most jobs, none of the deploy workflows (`deploy-cloudflare-worker.yml`, `oracle-dashboard-deploy.yml`, `website-deploy.yml`) have any timeouts defined.
