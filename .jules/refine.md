## 2026-06-11 — Tech Debt Suggestions
**Issues Filed:**
- Refine: 5 accumulated ESLint patches — consolidate or upstream fix
- Refine: 12 skipped tests across extension test suite — audit and re-enable or delete
**Rationale:**
The ESLint patches represent an accumulating maintenance burden over multiple version upgrades, which reduces developer confidence in upgrading dependencies. The skipped tests represent broken promises and untested behavior in critical modules like analytics and entrypoints, risking silent regressions. Both of these are specific and bounded paydown opportunities.
**Areas for Next Run:**
- 44 'any' types, primarily in the extension workspace.
- Inconsistent 'strict' settings in tsconfig.json across workspaces.
- 3 TODO/FIXME comments without associated GitHub Issue numbers.
