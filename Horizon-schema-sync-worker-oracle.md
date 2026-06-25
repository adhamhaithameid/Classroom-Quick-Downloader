---
title: "Horizon: schema sync risk between Cloudflare Worker and Oracle Backend"
---

## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2026-06-25

---

### 🏗️ Architecture Area
Type Contract / Mono-repo Tooling

### 🔍 Current State
Currently, the `cloudflare-worker` (written in TypeScript) and the `oracle-backend` (written in Go) share a data contract, specifically the `OracleBatch` payload sent by the Durable Object to the backend. The TypeScript type definition resides in `cloudflare-worker/src/types.ts` (`export interface OracleBatch`), and the Go struct definition resides in `oracle-backend/internal/model/counters.go` (`type OracleBatch struct`).
These definitions must be kept in sync manually. Any change in the worker (e.g., adding a new field, changing a type) must be manually replicated in the Go struct, and vice-versa. This manual synchronization creates a high risk of schema drift. If one side is updated without the other, it can cause silent ingestion failures, missing data, or runtime panics in the backend. There is no automated cross-workspace check to ensure they remain compatible.

### 💡 Proposed Improvement
We should implement an automated schema synchronization or contract testing mechanism between the Cloudflare Worker and the Oracle Backend.
- **Single Source of Truth:** Define the cross-boundary contracts (like `OracleBatch`, `BatchSummary`, `TimeBucket`) in a language-agnostic format (e.g., JSON Schema, Protocol Buffers, or a central OpenAPI/TypeSpec definition) located in a shared root directory (e.g., `shared/contracts/`).
- **Code Generation:** Use this single source of truth to automatically generate both the TypeScript interfaces for the `cloudflare-worker` and the Go structs for the `oracle-backend` during the build step.
- **Developer Workflow:** Developers would modify the schema file in the `shared/contracts/` directory instead of manually editing `types.ts` or `counters.go`. The build process (`pnpm build` or a dedicated `pnpm sync:contracts` script) would then regenerate the code for both workspaces.
- **Deployment Workflow:** Deployments remain unchanged, but CI would enforce that the generated files are up-to-date with the schema, failing the build if a developer modifies the generated files directly or forgets to run the generation step.

### 🎯 Why This Matters
This eliminates the risk of silent data loss or API failures caused by human error during manual schema synchronization. The boundary between the Worker and the Oracle backend is a critical ingestion path. A single-workspace fix cannot address this because the contract inherently spans two disparate languages and deployment targets. Automating this ensures type safety across the network boundary, improving reliability and reducing developer cognitive load when modifying analytics payloads.

### 📐 Acceptance Criteria
- [ ] A central schema definition exists (e.g., `shared/contracts/oracle_batch.json`).
- [ ] A build script generates `cloudflare-worker/src/generated/contracts.ts` from the schema.
- [ ] A build script generates `oracle-backend/internal/model/generated_contracts.go` from the schema.
- [ ] The `OracleBatch` type in `cloudflare-worker/src/types.ts` is replaced or extends the generated type.
- [ ] The `OracleBatch` struct in `oracle-backend/internal/model/counters.go` is replaced by the generated struct.
- [ ] CI pipeline fails if the generated files do not match the schema (ensuring generation is run).
- [ ] `DEVELOPMENT.md` is updated to document the new contract modification workflow.

### 🔧 Technical Context
- **Files Modified:** `cloudflare-worker/src/types.ts`, `oracle-backend/internal/model/counters.go`, `package.json` (for new workspace scripts).
- **New Files:** `shared/contracts/oracle_batch.json` (or similar), generation scripts in `tools/`.
- **CI/CD Changes:** Add a step in `.github/workflows/ci.yml` and `.github/workflows/oracle-backend-ci.yml` to verify schema generation (`pnpm sync:contracts && git diff --exit-code`).

### 📊 Estimated Complexity
Medium (3–5 days). Requires setting up a code generation tool (e.g., `quicktype` or similar) that supports both TypeScript and Go, creating the initial schema from the existing definitions, integrating the generation step into the build process of both workspaces, and updating the existing code to use the generated types.

### ⚠️ Risks and Considerations
- **Generation Tool Dependency:** Introduces a new tooling dependency to the repo. We must choose a tool that reliably produces idiomatic TS and Go.
- **Deployment Sequencing:** If a breaking schema change is made, the `oracle-backend` must be deployed and ready to accept the new schema *before* the `cloudflare-worker` is deployed, as the Worker sends data to Oracle.
- **Custom Logic in Structs:** If the current Go structs have custom JSON unmarshalling logic or methods attached, these will need to be preserved (e.g., by embedding the generated struct or using aliases).

### 🔗 Related
- `ARCHITECTURE_RUNTIME_CONTRACT.md`
- Current schema definitions in `cloudflare-worker/src/types.ts` and `oracle-backend/internal/model/counters.go`