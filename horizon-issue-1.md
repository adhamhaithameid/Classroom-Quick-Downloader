## 🌅 Horizon — Architecture Suggestion
**Agent:** Horizon | **Day:** Thursday | **Date:** 2025-10-30

---

### 🏗️ Architecture Area
Type Contract

### 🔍 Current State
Currently, type definitions for data contracts (such as analytics payloads and website API contracts) are duplicated across different workspaces. For instance, `WebsiteSnapshot` and telemetry interfaces exist independently in `website/src/lib/api/publicSite.ts` and `cloudflare-worker/src/types.ts`, and API types are duplicated in `extension/src/engines/v3/api/types.ts`. There's no unified shared library ensuring that the Cloudflare Worker, extension, and Oracle backend remain in sync when a schema is altered.

### 💡 Proposed Improvement
Create a shared internal type package (e.g., `@cqd/types`) within the mono-repo.
- Extract common data structures (e.g., `WebsiteSnapshot`, `OracleBatch`, `TimeBucket`) into this shared package.
- Update `extension`, `cloudflare-worker`, and `website` workspaces to import from this shared package via `workspace:*` references.
- This creates a single source of truth for all cross-boundary communication.

### 🎯 Why This Matters
Duplicated types lead to schema drift. A developer might update a telemetry field in the extension but forget to update the corresponding type in the Cloudflare Worker. This mismatch can result in silent runtime errors, dropped telemetry data, and broken dashboards. A shared package guarantees type safety at compile time across the entire system.

### 📐 Acceptance Criteria
- [ ] Create a `packages/types` workspace in the mono-repo.
- [ ] Move shared interfaces (e.g., `WebsiteSnapshot`, telemetry payloads) to the new package.
- [ ] Update `website/src/lib/api/publicSite.ts`, `cloudflare-worker/src/types.ts`, and `extension/src/engines/v3/api/types.ts` to consume `@cqd/types`.
- [ ] CI pipeline passes across all workspaces after the refactor.

### 🔧 Technical Context
- **Files Modified:** `website/src/lib/api/publicSite.ts`, `cloudflare-worker/src/types.ts`, `extension/src/engines/v3/api/types.ts`.
- **New Files:** `packages/types/package.json`, `packages/types/src/index.ts`.
- **Config:** Update `pnpm-workspace.yaml` to include `packages/types`.

### 📊 Estimated Complexity
Medium (3-5 days). The code changes are straightforward but require careful testing to ensure zero runtime disruptions and successful adoption across all components.

### ⚠️ Risks and Considerations
- **Migration Path:** Ensure all workspaces are updated and deployed simultaneously, or handle backwards compatibility for types during the transition period.
- **Deployment Sequencing:** The shared types package must be built before downstream workspaces in the CI pipeline.

### 🔗 Related
- `ARCHITECTURE_RUNTIME_CONTRACT.md`
