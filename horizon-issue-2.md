## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2026-06-11

---

### 🏗️ Architecture Area
Testing Strategy / CI/CD Pipeline

### 🔍 Current State
The e2e testing configuration uses Playwright (configured in `playwright.config.ts`) and is currently designed to run against Chrome only (`extension-chromium` project). While there is an `extension-tests` and `build-check` step in `.github/workflows/ci.yml` that builds the extension for Firefox and Edge, there are no Playwright e2e tests executed in the CI pipeline that actually verify the built extension's behavior in Firefox or Edge.
The `ci.yml` workflow tests extension, worker, website, and oracle-backend, but the e2e integration testing of the built extension is limited by the lack of multi-browser testing, specifically Firefox which has a different extension API execution environment.

### 💡 Proposed Improvement
Expand the Playwright test configuration to include a Firefox project and configure the CI pipeline (`.github/workflows/ci.yml`) to run the Playwright tests against the Firefox build.
- Modify `playwright.config.ts` to add a Firefox project that loads the `firefox-mv2` or `firefox-mv3` build output from the `extension` workspace.
- Add an explicit `e2e-tests` job to `.github/workflows/ci.yml` that runs the Playwright test suite against both the Chrome and Firefox builds, creating a cross-browser verification step.
- Update `extension/package.json` with a dedicated test script to trigger the cross browser testing to ensure `playwright.config.ts` matches properly with the testing context.

### 🎯 Why This Matters
Chrome extensions and Firefox add-ons have subtle differences in their execution environments (e.g. background script behavior, manifest v3 support nuances, CORS handling). Building the extension for Firefox is not enough if we don't test it. A bug that only appears in Firefox will not be caught by our current CI pipeline and will ship to users.

### 📐 Acceptance Criteria
- [ ] `playwright.config.ts` has a project configured for Firefox testing.
- [ ] `.github/workflows/ci.yml` includes a job that executes the Playwright e2e tests against both Chrome and Firefox targets.
- [ ] The pipeline passes, verifying that cross-browser integration testing is working.

### 🔧 Technical Context
Files involved:
- `playwright.config.ts` (adding Firefox project)
- `.github/workflows/ci.yml` (adding the `e2e-tests` job)
- `extension/package.json` (adding a new script to run multi-browser e2e tests locally)

### 📊 Estimated Complexity
Small (1-2 days) — mostly involves configuring Playwright and the GitHub Actions workflow, assuming the extension currently works in Firefox without major issues.

### ⚠️ Risks and Considerations
Playwright's support for loading extensions in Firefox is documented but sometimes requires specific configuration (like `firefoxUserPrefs`). The CI run time will increase since e2e tests will run twice. Deployment ordering is simple for this change: this is a test and workflow configuration update that does not require sequential deployment across the backend/worker workspaces.

### 🔗 Related
playwright.config.ts
