## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2025-10-30

---

### 🏗️ Architecture Area
Testing Strategy / CI/CD Pipeline

### 🔍 Current State
CI pipelines for `website`, `cloudflare-worker`, and `oracle-backend` run their own tests independently (e.g., `.github/workflows/website-deploy.yml`, `.github/workflows/oracle-backend-ci.yml`, `.github/workflows/deploy-cloudflare-worker.yml`). While `pnpm run test:strict` invokes smoke and integration tests across components, there is no comprehensive end-to-end integration test in CI that spins up the extension, worker, and oracle backend together to verify that a full workflow works correctly across all boundaries.

### 💡 Proposed Improvement
Introduce a cross-workspace integration test suite using Playwright.
- Create a dedicated CI workflow (e.g., `.github/workflows/e2e-integration.yml`) that starts the full stack: `oracle-backend` (with test DB), `cloudflare-worker` (using Wrangler local), and the `extension` (loaded in a headless browser).
- Write E2E tests verifying critical paths, such as the end-to-end analytics ingestion pipeline and cross-boundary API interactions.

### 🎯 Why This Matters
Independent unit and integration tests only verify that components fulfill their isolated contracts. They don't catch integration bugs caused by environment misconfigurations, proxy issues, or subtle timing and schema mismatches between running services. A full E2E test suite prevents releasing breaking changes that span multiple components.

### 📐 Acceptance Criteria
- [ ] Create a `tests/e2e` workspace or directory for cross-boundary tests.
- [ ] Implement at least one cross-system Playwright test (e.g., Extension -> Worker -> Oracle).
- [ ] Add `.github/workflows/e2e-integration.yml` to trigger on PRs affecting multiple workspaces.
- [ ] Update `DEVELOPMENT.md` to document how to run the E2E suite locally.

### 🔧 Technical Context
- **Files Modified:** `.github/workflows/`, `DEVELOPMENT.md`.
- **New Files:** `.github/workflows/e2e-integration.yml`, `tests/e2e/playwright.config.ts`, `tests/e2e/analytics.spec.ts`.

### 📊 Estimated Complexity
Large (1-2 weeks). Requires orchestrating local services in a GitHub Actions environment and writing resilient, flake-free E2E tests.

### ⚠️ Risks and Considerations
- **CI Time:** Running the full stack can increase CI time. Consider running this only on PRs affecting multiple workspaces or on `main` branch merges.
- **Flakiness:** E2E tests are prone to flakiness due to network and timing issues; ensure proper waiting and retries are implemented.
- **Deployment Sequencing:** The deployment order for multi-component feature rollouts should not be impacted directly by these tests, but the test pipeline must complete before any single component triggers a production release to prevent version mismatches. If breaking cross-boundary changes are merged, downstream systems (like Oracle backend) must be deployed before the systems that depend on them (like the Cloudflare Worker).

### 🔗 Related
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
