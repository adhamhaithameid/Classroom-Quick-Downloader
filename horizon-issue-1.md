---
title: "Horizon: no shared type contract between extension, worker, and website — schema drift risk"
---

## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2026-06-18

---

### 🏗️ Architecture Area
Type Contract

### 🔍 Current State
Currently, type contracts for the system's analytics and data models are duplicated across multiple workspaces. For instance, the `OracleBatch` and various event payloads are defined independently in:
- `extension/entrypoints/utils/analytics/types.ts`
- `cloudflare-worker/src/types.ts`
- `oracle-backend/internal/model/counters.go` (backend equivalent)

This duplication creates a severe risk of schema drift. If a property is added or renamed in the extension's analytics payload, it must be manually updated in the Cloudflare Worker and the Oracle backend, otherwise the system will experience silent data loss or API failures at the boundaries.

### 💡 Proposed Improvement
Create a new mono-repo workspace package specifically for shared type contracts (e.g., `packages/shared-types`).
- Move all cross-boundary TypeScript definitions (like the analytics payload shapes and batch structures) into this shared package.
- Both the `extension`, `cloudflare-worker`, and `website` workspaces should import these shared types using pnpm's workspace protocol (`workspace:*`).
- Establish a single source of truth for the JSON schema/contract that the Oracle backend's Go structures (`internal/model/counters.go`) must align with, potentially using a shared JSON schema source that generates both TypeScript and Go structures.

### 🎯 Why This Matters
Type safety gaps at cross-boundary surfaces are the most common cause of silent system bugs in distributed applications. A shared type contract ensures that any change to the data schema will immediately fail the TypeScript compiler in all affected workspaces if not properly handled, turning runtime failures into build-time errors. It also improves developer velocity, as a developer working on a full-stack feature only needs to update the contract in one place.

### 📐 Acceptance Criteria
- [ ] A new `packages/shared-types` workspace is created with cross-boundary types.
- [ ] `extension`, `cloudflare-worker`, and `website` use `workspace:*` to depend on the shared package.
- [ ] Duplicated types in `extension/entrypoints/utils/analytics/types.ts` and `cloudflare-worker/src/types.ts` are removed and replaced with imports from the shared package.
- [ ] The CI/CD pipeline correctly builds the shared package before dependent workspaces.
- [ ] Documentation (`ARCHITECTURE.md`) is updated to describe the single source of truth for schemas.

### 🔧 Technical Context
- **Files to modify**:
  - `extension/entrypoints/utils/analytics/types.ts`
  - `cloudflare-worker/src/types.ts`
  - `pnpm-workspace.yaml` (to add the new workspace)
- **New files**:
  - `packages/shared-types/package.json`
  - `packages/shared-types/src/index.ts`

### 📊 Estimated Complexity
Medium (3–5 days). Extracting the types is straightforward, but ensuring the build process across the extension (WXT), worker (Wrangler), and website (SvelteKit) properly resolves the shared package requires careful `tsconfig.json` and build tool configuration.

### ⚠️ Risks and Considerations
- **Deployment Sequencing**: When the shared types change, the Oracle backend and Cloudflare Worker must be deployed before the extension or website to ensure they can parse the new payload format.
- **Go Alignment**: The TypeScript types still need manual alignment with the Go models (`oracle-backend/internal/model/counters.go`) unless code generation from JSON Schema is implemented.

### 🔗 Related
- `extension/entrypoints/utils/analytics/types.ts`
- `cloudflare-worker/src/types.ts`
- `oracle-backend/internal/model/counters.go`
