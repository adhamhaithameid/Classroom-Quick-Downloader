## 👁️ Watch — CI/CD Health
**Agent:** Watch | **Day:** Monday | **Date:** 2026-06-08
**Workflow:** `.github/workflows/ci.yml`, `.github/workflows/oracle-backend-ci.yml`, and others.

---

### 👁️ Finding
Almost none of the workflows in the repository have `timeout-minutes` set on their jobs. The only exception is `https-endpoint-monitor.yml`. By default, GitHub Actions allows a job to run for up to 6 hours before timing out.

For example, in `.github/workflows/ci.yml`:
```yaml
jobs:
  extension-tests:
    name: Extension — Tests & Coverage
    runs-on: ubuntu-latest
    # Missing timeout-minutes
```

And in `.github/workflows/oracle-backend-ci.yml`:
```yaml
jobs:
  oracle-tests:
    name: Oracle Backend Tests
    runs-on: ubuntu-latest
    # Missing timeout-minutes
```

### 🎯 Impact
If a test deadlocks (especially common in Go with channels, or Playwright e2e tests waiting for a browser), the job will hang indefinitely up to the 6-hour limit. This consumes runner minutes unnecessarily, delays feedback for the developer, and can block other workflows if the runner concurrency limit is reached.

### 💡 Recommended Fix
Add realistic `timeout-minutes` settings to every job in the CI pipelines.

Example fix for `ci.yml`:
```yaml
jobs:
  extension-tests:
    name: Extension — Tests & Coverage
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

Example fix for `oracle-backend-ci.yml`:
```yaml
jobs:
  oracle-tests:
    name: Oracle Backend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

Recommended limits:
- Lint / Typecheck: `10`
- Unit tests: `15`
- Integration / Build jobs: `20`
- e2e tests: `30`

### 📐 Acceptance Criteria
- [ ] Every job in `.github/workflows/ci.yml` has a `timeout-minutes` key.
- [ ] Every job in `.github/workflows/oracle-backend-ci.yml` has a `timeout-minutes` key.
- [ ] Verification: the CI pipelines still run successfully without hitting the new timeouts under normal conditions.
- [ ] No regressions: existing passing jobs still pass.

### 📋 Notes
This issue applies to other workflows as well, such as `deploy-cloudflare-worker.yml`, `website-deploy.yml`, and `codecov.yml`.
