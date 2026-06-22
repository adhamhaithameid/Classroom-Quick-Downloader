---
title: "Watch: no workflow runs Playwright e2e tests on PRs — regressions ship undetected"
---

## 👁️ Watch — CI/CD Health
**Agent:** Watch | **Day:** Monday | **Date:** 2024-05-20
**Workflow:** `.github/workflows/ci.yml`

---

### 👁️ Finding
The repository has a comprehensive Playwright setup in `playwright.config.ts` designed to test the extension inside a real Chromium browser, including an E2E test suite in `tests/e2e/`. However, reading through `.github/workflows/ci.yml` and all other workflow files, there is no job that actually executes these Playwright tests (e.g. `npx playwright test` or equivalent) on PRs or `main`.

### 🎯 Impact
E2E regressions in the extension can silently ship to production. The unit/integration tests might pass, but actual browser interactions (like injecting UI into Classroom, or popup interactions) remain completely untested in the CI pipeline. This creates a false sense of security and leaves the highest value user flows unprotected by automation.

### 💡 Recommended Fix
Add an E2E testing job to `.github/workflows/ci.yml` that builds the extension and then runs Playwright tests. This job requires a real display server to run headful Chromium for extensions, so we must use `xvfb-run` on Ubuntu.

Add this job to `.github/workflows/ci.yml` (e.g., after the `extension-tests` job):

```yaml
  extension-e2e-tests:
    name: Extension — Playwright E2E Tests
    runs-on: ubuntu-latest
    needs: build-check # Wait for builds or run alongside unit tests

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.28.2

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Build Extension (Required for Playwright)
        run: pnpm -C extension exec wxt build -b chrome

      - name: Run Playwright E2E Tests (Headful)
        run: xvfb-run npx playwright test
```

### 📐 Acceptance Criteria
- [ ] Added the `extension-e2e-tests` job to `.github/workflows/ci.yml` using `xvfb-run npx playwright test`.
- [ ] Verification: The new CI job runs and correctly executes the `tests/e2e/` suite on a pull request.
- [ ] No regressions: The E2E tests successfully load the extension and pass reliably.

### 📋 Notes
Extension UI testing in Playwright mandates a headful launch (`headless: false` in `playwright.config.ts`), which is why the `xvfb-run` command is essential in the Ubuntu runner.
