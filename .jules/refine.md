
## 2026-03-12 — High-Priority Tech Debt Suggested
**Issues Filed:**
- Refine: 5 accumulated ESLint patches — consolidate or upstream fix
- Refine: plan.md and refactor-plan.md are stale — convert actionable items to Issues or close
**Rationale:** The accumulated ESLint patches signal dependency maintenance drift, making upgrades harder and obscuring actual required fixes. The stale plan files clutter the root directory and distract contributors with out-of-date or completed tasks that should be formal GitHub issues instead.
**Areas for Next Run:**
- `any` types (55) in extension boundary logic.
- A significant number of TODOs (100 in extension tests alone) with no associated issue.
- Disabled Svelte pages (`overview2`, `samples`).
