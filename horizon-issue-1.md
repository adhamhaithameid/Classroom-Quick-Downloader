## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2026-06-11

---

### 🏗️ Architecture Area
Type Contract

### 🔍 Current State
There is a drift risk between the `cloudflare-worker` and the `oracle-backend` regarding the API payload structure. The `cloudflare-worker` sends an `OracleBatch` payload to the backend, which includes a `DOStateBatch` state.
The worker defines this in `cloudflare-worker/src/types.ts` as `export interface OracleBatch` and `export interface DOStateBatch`.
The backend expects this exact structure and defines it in `oracle-backend/internal/model/counters.go` as `type OracleBatch struct` and `type DOState struct`.
These are manually synced. If a developer adds a field to the payload in the worker but forgets to add it to the Go struct, the Go JSON decoder will silently drop the new field, or worse, if a required field changes its name, the Go backend will fail to parse the payload and reject it.

### 💡 Proposed Improvement
Introduce a shared type contract or schema definition (e.g. JSON Schema, Protocol Buffers, or a shared OpenAPI spec) that acts as the single source of truth for the `OracleBatch` and related structures.
- For TypeScript, types can be generated from this schema.
- For Go, structs can be generated from this schema.
This shared schema could reside in a new `shared/schema` workspace package.

### 🎯 Why This Matters
This prevents silent data drops and deployment-breaking payload rejections. The `cloudflare-worker` and `oracle-backend` communicate constantly. A single-workspace fix (just updating the worker or just updating the backend) is insufficient because the bug lies in the *disagreement* between the two components. A typed boundary is a contract, and right now, the contract is implicit and enforced only by developer memory.

### 📐 Acceptance Criteria
- [ ] A shared schema definition is created for the `OracleBatch` payload.
- [ ] `cloudflare-worker/src/types.ts` generates its `OracleBatch` type from the shared schema.
- [ ] `oracle-backend/internal/model/counters.go` generates its `OracleBatch` struct from the shared schema.
- [ ] CI pipeline validates that both generated files match the schema to prevent drift.

### 🔧 Technical Context
Files involved:
- `cloudflare-worker/src/types.ts`
- `oracle-backend/internal/model/counters.go`
- A new shared package, e.g. `shared/schema/`
- CI/CD workflow updates in `.github/workflows/ci.yml` to include schema validation.

### 📊 Estimated Complexity
Medium (3–5 days) — requires setting up a code generation step in both TypeScript and Go workflows, and adjusting the existing structs to match the generated code without breaking the database mapping.

### ⚠️ Risks and Considerations
Deployment ordering is critical. If the schema changes in a non-backwards-compatible way, the `oracle-backend` must be deployed and ready to accept the new schema *before* the `cloudflare-worker` starts sending it. The schema generator should ideally enforce backwards compatibility.

### 🔗 Related
ARCHITECTURE.md (Runtime Contracts)
