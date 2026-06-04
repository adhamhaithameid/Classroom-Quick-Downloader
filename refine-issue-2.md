# Refine: plan.md and refactor-plan.md are stale — convert actionable items to Issues or close

## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-03-12

---

### 📦 Debt Category
Stale Plans

### 🔍 Current State
There are 3 stale or semi-stale plan files sitting in the repository root:
- `plan.md` (last updated 2026-03-08, regarding Website Reviews Section)
- `plan2.md` (last updated 2026-03-11, Extension Plan 2 — Practical To-Do Checklist)
- `refactor-plan.md` (last updated 2026-03-11, CQD Refactor Plan — Current Practical Roadmap)

These files represent intentions that were either completed, superseded, or are partially done. Keeping them in the repository root clutters navigation and creates confusion about what the active plans actually are.

### 💡 Proposed Paydown Strategy
- **Step 1:** Audit the contents of `plan.md`, `plan2.md`, and `refactor-plan.md` against the current state of the codebase.
- **Step 2:** For any actionable items still remaining in these plans, extract them into formal, tracked GitHub Issues.
- **Step 3:** For any completed or outdated items, discard them.
- **Step 4:** Once all actionable items are converted to Issues, archive these 3 files by either moving them to a `docs/archive/` folder or deleting them entirely.

### 🎯 Why This Matters Now
Plans sitting in the root of the repository rot quickly. They lose context and fail to represent the actual state of the project. A new contributor (or AI agent) reading these files might attempt to implement outdated architectural patterns or duplicate work. Moving these plans to actionable GitHub Issues keeps the project organized and the root directory clean.

### 📐 Acceptance Criteria
- [ ] All actionable work from the 3 plan files is converted to tracked GitHub Issues.
- [ ] `plan.md` is removed from the root directory (archived or deleted).
- [ ] `plan2.md` is removed from the root directory (archived or deleted).
- [ ] `refactor-plan.md` is removed from the root directory (archived or deleted).

### 🔧 Technical Context
- Target files: `plan.md`, `plan2.md`, `refactor-plan.md` in the repo root.
- Read through them to identify if the described work (e.g., website reviews, extension baseline protection) is done or still pending.

### 📊 Estimated Complexity
Small (1–2 days) — mostly involves reading documentation, verifying code state, writing up a few GitHub issues, and deleting the files.

### ⚠️ Risks
Low risk. The main risk is losing important historical context or architectural decisions, which is mitigated by moving them to a `docs/archive/` folder instead of outright deletion if they contain valuable context.

### 🔗 Related
None yet.
