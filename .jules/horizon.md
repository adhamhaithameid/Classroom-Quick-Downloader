## 2026-06-18 — Type Contracts & Dependency Management
**Issues Filed:**
- Horizon: no shared type contract between extension, worker, and website — schema drift risk
- Horizon: Dependabot and Renovate conflict with partial workspace coverage — dependency management gap
**Rationale:**
- **Type Contracts:** The `OracleBatch` and related analytics payloads are duplicated across `extension/entrypoints/utils/analytics/types.ts` and `cloudflare-worker/src/types.ts`. This poses a significant schema drift risk where changes in one workspace could silently break cross-boundary communication. Creating a `packages/shared-types` workspace ensures the TypeScript compiler catches these mismatches.
- **Dependency Management:** The repository currently runs both Dependabot and Renovate. Dependabot is misconfigured using `npm` instead of `pnpm`, completely omits the `website` workspace, and updates workspaces independently. Standardizing on Renovate and utilizing its monorepo grouping capabilities resolves these conflicts and ensures coordinated updates.
**Areas for Next Run:**
- E2E tests in `playwright.config.ts` currently only cover Chromium. Firefox should be added to the CI pipeline to catch cross-browser extension regressions.
- Look into creating a full-stack local development script to simplify running the extension, worker, website, and backend simultaneously.
