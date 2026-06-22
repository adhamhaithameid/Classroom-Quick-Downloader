## 2024-05-20 — Missing E2E tests in CI pipeline
**Issue Filed:** Watch: no workflow runs Playwright e2e tests on PRs — regressions ship undetected
**Workflow Audited:** .github/workflows/ci.yml
**Finding:** The Playwright setup (`playwright.config.ts`) has tests but no GitHub Actions workflows actually run them (`playwright test`).
**Learning:** Even though testing infrastructure is in place (Playwright), the pipeline must actually trigger the tests. E2E extension tests require a headful environment `xvfb-run`.
**Next Priority:** Check for other components that might lack CI coverage, such as verifying all cron jobs run smoothly and verifying all missing timeouts across other secondary workflows.
