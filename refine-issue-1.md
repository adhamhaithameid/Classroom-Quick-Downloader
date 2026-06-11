## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-06-11

---

### 📦 Debt Category
Patched Dependencies

### 🔍 Current State
The `patches/` directory currently contains 5 patches for `eslint`:
- `eslint@10.0.0.patch`
- `eslint@10.0.1.patch`
- `eslint@10.0.2.patch`
- `eslint@10.0.3.patch`
- `eslint@10.2.0.patch`

This indicates that an ESLint patch is being maintained across multiple upgrades.

### 💡 Proposed Paydown Strategy
Consolidate the patches. We should only need the patch for the version currently used (or none if the issue has been fixed upstream).
- First step: Remove all older versions of the patch (`10.0.0` through `10.0.3`) as only the patch for the installed version is needed.
- Full paydown: Review the `10.2.0` patch to determine what it works around. File an upstream issue with `eslint` if applicable, and document the rationale for the patch within the `.patch` file itself if we must keep it.
- Done looks like: Only one documented patch file remaining in the `patches/` directory.

### 🎯 Why This Matters Now
Maintaining patches across multiple version upgrades is a significant maintenance burden. If the patches accumulate silently, developers might be afraid to upgrade the package or fail to recognize when the upstream package has already fixed the bug, leading to unnecessary technical debt.

### 📐 Acceptance Criteria
- [ ] 0 unused ESLint patch versions remaining in `patches/`.
- [ ] The current patch (`eslint@10.2.0.patch`) has a documented reason for its existence (or is deleted if upstream fixed the issue).
- [ ] All tests pass after the old patches are removed.

### 🔧 Technical Context
Remove `patches/eslint@10.0.0.patch`, `patches/eslint@10.0.1.patch`, `patches/eslint@10.0.2.patch`, and `patches/eslint@10.0.3.patch`. Review `patches/eslint@10.2.0.patch` and `cloudflare-worker/package.json` where `eslint` is a dependency.

### 📊 Estimated Complexity
Small (1-2 days) - Mostly cleanup and review.

### ⚠️ Risks
Low. Removing older, unused patch files shouldn't break the build. Modifying or removing the current patch may break linting or the build if the underlying issue still exists.

### 🔗 Related
None.
