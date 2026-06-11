
## 2026-06-11 — Type Contract Drift & Cross-Browser e2e Testing CI Gaps
**Issues Filed:** Horizon: no shared type contract between worker and backend — drift risk, Horizon: e2e tests only cover Chrome — no Firefox e2e in CI pipeline
**Rationale:** The payload schema disagreement between the TypeScript worker and the Go backend causes silent data drop risks. A shared schema will enforce consistency and act as a cross-boundary typed contract. Additionally, the CI pipeline lacks Playwright test integration for Firefox, missing a critical cross-browser verification.
**Areas for Next Run:** Consider evaluating the release-drafter coverage to ensure it effectively drafts changelogs spanning the Oracle backend, extension, and website, as currently it is only a single release-drafter.yml file. Evaluate whether all dependabot/renovate bots properly sync shared dependencies like typescript across all workspaces.
