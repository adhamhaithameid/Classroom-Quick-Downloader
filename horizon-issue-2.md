---
title: "Horizon: Dependabot and Renovate conflict with partial workspace coverage — dependency management gap"
---

## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2026-06-18

---

### 🏗️ Architecture Area
Dependency Management

### 🔍 Current State
The repository currently uses both Dependabot (`.github/dependabot.yml`) and Renovate (`renovate.json`) concurrently, creating conflicting dependency management strategies.
Furthermore, the Dependabot configuration has several significant issues:
1. It is configured to use the `npm` package ecosystem for individual directories (`/extension`, `/cloudflare-worker`, `/oracle-backend`), completely ignoring the fact that this is a `pnpm` workspace with a root-level `pnpm-lock.yaml`.
2. The `website` workspace is completely omitted from the Dependabot configuration.
3. This setup leads to uncoordinated major dependency updates across workspaces (e.g., updating TypeScript in the worker but not the extension).

### 💡 Proposed Improvement
Standardize the entire mono-repo's dependency management on a single tool—specifically, Renovate.
- Remove the `.github/dependabot.yml` configuration entirely.
- Update `renovate.json` to properly understand the pnpm workspace structure and coordinate dependency updates globally across all workspaces.
- Configure Renovate to group major version updates for shared dependencies (like `typescript` or `vite`) so that the `extension`, `cloudflare-worker`, and `website` upgrade in lockstep.

### 🎯 Why This Matters
Conflicting dependency managers lead to noisy PRs, lockfile conflicts, and potential CI failures when one tool overwrites the changes of another. Using `npm` Dependabot rules in a `pnpm` workspace breaks the workspace links and leads to incorrect `package.json` updates that bypass the root `pnpm-lock.yaml`. Additionally, omitting the `website` workspace leaves it vulnerable to outdated dependencies. Coordinated updates ensure that all workspaces build against the same core toolchain versions, reducing "works on my machine" bugs.

### 📐 Acceptance Criteria
- [ ] `.github/dependabot.yml` is deleted.
- [ ] `renovate.json` is configured to recognize the pnpm workspace and the `website` directory.
- [ ] Shared dependencies (e.g., TypeScript) are configured to group updates into a single PR spanning all workspaces.
- [ ] CI pipeline continues to pass with the updated Renovate PRs.

### 🔧 Technical Context
- **Files to modify**:
  - `renovate.json` (enhance configuration for grouping and pnpm)
- **Files to delete**:
  - `.github/dependabot.yml`

### 📊 Estimated Complexity
Small (1–2 days). Removing Dependabot is trivial. Updating Renovate configuration requires consulting the Renovate docs for monorepo and grouping settings, but is generally straightforward.

### ⚠️ Risks and Considerations
- Deleting Dependabot means relying entirely on Renovate for security alerts; ensure GitHub's native Dependabot alerts are still enabled at the repository settings level even if the auto-update PR action is removed.

### 🔗 Related
- `.github/dependabot.yml`
- `renovate.json`
- `pnpm-workspace.yaml`
