---
title: "Watch: oracle-backend-ci.yml and ci.yml lack job timeouts — hung test blocks runner for hours"
---

## 👁️ Watch — CI/CD Health
**Agent:** Watch | **Day:** Monday | **Date:** 2026-06-15
**Workflow:** `.github/workflows/oracle-backend-ci.yml`, `.github/workflows/ci.yml`

---

### 👁️ Finding
The `oracle-backend-ci.yml` and `ci.yml` workflows do not configure a `timeout-minutes` setting for any of their jobs. The GitHub Actions default job timeout is 360 minutes (6 hours).

### 🎯 Impact
If a Go test deadlocks, a database migration hangs, or a Playwright browser fails to start, the job will hang for up to 6 hours before timing out. This blocks other workflows from running, wastes runner minutes, and creates silent delays for PR feedback.

### 💡 Recommended Fix
Add `timeout-minutes` to each job in these workflows. Recommended values: 10 minutes for linting/typechecking, 15 minutes for unit tests, 20 minutes for integration tests, 30 minutes for e2e/smoke tests.

For example, in `.github/workflows/oracle-backend-ci.yml`:

```yaml
jobs:
  oracle-tests:
    name: Oracle Backend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

```yaml
  oracle-migrations:
    name: Oracle Migration Bootstrap
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

```yaml
  oracle-runtime-smoke:
    name: Oracle Runtime API Matrix
    runs-on: ubuntu-latest
    timeout-minutes: 30
```

```yaml
  oracle-security:
    name: Oracle Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

And in `.github/workflows/ci.yml`:

```yaml
jobs:
  extension-tests:
    name: Extension — Tests & Coverage
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

```yaml
  build-check:
    name: Monorepo Build Check
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

```yaml
  website-checks:
    name: Website Checks
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

```yaml
  cloudflare-worker-tests:
    name: Cloudflare Worker Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

```yaml
  cloudflare-smoke:
    name: Cloudflare Worker Smoke
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

```yaml
  gosec:
    name: Oracle Backend gosec
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

```yaml
  oracle-tests:
    name: Oracle Backend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

```yaml
  oracle-migration-smoke:
    name: Oracle Migration Smoke
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

```yaml
  playwright-e2e:
    name: Playwright E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
```

### 📐 Acceptance Criteria
- [ ] Add `timeout-minutes` to all jobs in `.github/workflows/oracle-backend-ci.yml`.
- [ ] Add `timeout-minutes` to all jobs in `.github/workflows/ci.yml`.
- [ ] Verify that workflow runs correctly after the change.
- [ ] Ensure no regressions: existing passing jobs still pass.

### 📋 Notes
This is a critical best practice to prevent runaway runner costs and delayed feedback.
