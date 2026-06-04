# Refine: 5 accumulated ESLint patches — consolidate or upstream fix

## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-03-12

---

### 📦 Debt Category
Patched Dependencies

### 🔍 Current State
There are 5 accumulated patch files for `eslint` in the `patches/` directory:
- `eslint@10.0.0.patch`
- `eslint@10.0.1.patch`
- `eslint@10.0.2.patch`
- `eslint@10.0.3.patch`
- `eslint@10.2.0.patch`

This is a significant tech debt signal because maintaining multiple patch versions for the same dependency imposes a maintenance burden on every upgrade and clutters the patch list.

### 💡 Proposed Paydown Strategy
- **Step 1:** Audit the current `eslint` version in use across the repository (e.g., `cloudflare-worker` uses `^10.2.0`). Check if the upstream `eslint` has fixed the issue requiring the patch.
- **Step 2:** If the upstream fix exists, upgrade `eslint` and delete all 5 patch files.
- **Step 3:** If the patch is still needed for the current version (`eslint@10.2.0`), delete the 4 older, unused patch files (`10.0.0` through `10.0.3`).
- **Step 4:** Document the remaining patch (if any) with a comment explaining why it exists and link it to an upstream issue tracking the fix.

### 🎯 Why This Matters Now
Maintaining multiple patches for the same dependency slows down development velocity when upgrading packages. If patches conflict or the underlying bug is already fixed, it creates unnecessary friction and risk of regressions. Removing stale patches ensures the `patches/` directory only contains active, necessary workarounds.

### 📐 Acceptance Criteria
- [ ] 0 unused ESLint patch files in `patches/`.
- [ ] If a patch is still required, only the most recent version (e.g., `eslint@10.2.0.patch`) remains.
- [ ] Remaining patch (if any) is documented with rationale and an upstream issue link.
- [ ] CI tests pass after the cleanup.

### 🔧 Technical Context
- Target directory: `patches/`
- Command to check patches: `ls patches/eslint*.patch`
- Verify eslint version in `cloudflare-worker/package.json` and others.

### 📊 Estimated Complexity
Small (1–2 days) — mostly involves verifying if the patch is still needed, deleting old files, and ensuring tests pass.

### ⚠️ Risks
Low risk. The primary risk is accidentally removing a patch still needed by the current version, but running the tests after removal will quickly highlight any regressions.

### 🔗 Related
None yet.
