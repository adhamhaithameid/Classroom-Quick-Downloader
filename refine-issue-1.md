---
title: "Refine: 5 accumulated ESLint patches — consolidate or upstream fix"
---
## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-06-18

---

### 📦 Debt Category
Patched Dependencies

### 🔍 Current State
There are currently 5 versions of the same ESLint patch in the `patches/` directory (`eslint@10.0.0.patch`, `eslint@10.0.1.patch`, `eslint@10.0.2.patch`, `eslint@10.0.3.patch`, `eslint@10.2.0.patch`). All of them modify the same file (`lib/shared/ajv.js`) to support an older schema draft version format and fallback from `ajv` to `ajv-draft-04`.

### 💡 Proposed Paydown Strategy
- **First step:** Consolidate the 5 patches by deleting the 4 older, unused patches (since only one version of `eslint` will be active and properly resolved by the package manager). The current active patch appears to be for ESLint 10.2.0 based on `cloudflare-worker/package.json`.
- **Full paydown:** Ensure only the `eslint@10.2.0.patch` file remains.
- **Exit criterion:** The `patches/` directory contains exactly one patch for ESLint (the active version).

### 🎯 Why This Matters Now
Maintaining multiple versions of the same patch for older library versions adds unnecessary noise and confusion. Every time the package manager runs, it might evaluate or warn about patches for versions no longer in the dependency tree. If we upgrade ESLint again, developers might mistakenly copy or update the wrong patch file.

### 📐 Acceptance Criteria
- [ ] Exactly one `eslint@*.patch` file exists in the `patches/` directory.
- [ ] `pnpm install` runs successfully without warnings about missing or unused patches.
- [ ] Tests and linters pass in `cloudflare-worker`.

### 🔧 Technical Context
- Directory: `patches/`
- Command to execute: `rm patches/eslint@10.0.0.patch patches/eslint@10.0.1.patch patches/eslint@10.0.2.patch patches/eslint@10.0.3.patch`

### 📊 Estimated Complexity
Small (1-2 hours) — simple deletion and verification.

### ⚠️ Risks
Low risk. Deleting older patch versions for versions of `eslint` that are no longer installed will not affect the currently installed version `10.2.0`.

### 🔗 Related
None.
