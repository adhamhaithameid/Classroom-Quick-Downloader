---
title: "Refine: 5 accumulated ESLint patches — consolidate to current version"
---
## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-06-25

---

### 📦 Debt Category
Patched Dependencies

### 🔍 Current State
The `patches/` directory contains 5 different patch files for ESLint versions 10.0.x through 10.2.0 (`eslint@10.0.0.patch`, `eslint@10.0.1.patch`, `eslint@10.0.2.patch`, `eslint@10.0.3.patch`, `eslint@10.2.0.patch`). All of them apply the exact same fix to `lib/shared/ajv.js` for handling AJV imports and JSON schema refs. The `cloudflare-worker` workspace is currently using `eslint@^10.2.0`.

### 💡 Proposed Paydown Strategy
1. Delete the outdated patch files for versions that are no longer used (10.0.0, 10.0.1, 10.0.2, 10.0.3).
2. Keep only the patch file for the current version (`eslint@10.2.0.patch`).
3. Add a documentation comment in the remaining patch file or a `patches/README.md` explaining why this patch is necessary and tracking the upstream issue.
4. Check if ESLint 11 or a newer 10.x release has fixed this upstream, and if so, plan an upgrade to remove the patch entirely.

### 🎯 Why This Matters Now
Accumulated patches for old versions of dependencies create a silent maintenance burden. It pollutes the `patches/` directory, making it unclear which patches are active and which are just leftover garbage. It also increases the risk of `pnpm` getting confused or the patch being misapplied if dependency versions drift across workspaces.

### 📐 Acceptance Criteria
- [ ] 4 outdated ESLint patch files (`10.0.0` through `10.0.3`) are deleted from `patches/`.
- [ ] `eslint@10.2.0.patch` remains and is documented.
- [ ] CI criterion — all tests and linting pass after debt paydown (e.g., `pnpm run lint` in `cloudflare-worker`).

### 🔧 Technical Context
- Target files: `patches/eslint@10.0.0.patch`, `patches/eslint@10.0.1.patch`, `patches/eslint@10.0.2.patch`, `patches/eslint@10.0.3.patch`.
- Command to remove: `rm patches/eslint@10.0.0.patch patches/eslint@10.0.1.patch patches/eslint@10.0.2.patch patches/eslint@10.0.3.patch`.

### 📊 Estimated Complexity
Small (1 day) — simply cleaning up old files and adding context to the remaining one.

### ⚠️ Risks
Minimal. Removing patches for versions we don't have installed will not affect the build or linting.

### 🔗 Related
N/A
