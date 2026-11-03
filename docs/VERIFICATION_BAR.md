# The verification bar — what blocks a merge, what advises, what stays manual

Draft for bead `sqa9.5` (owner sign-off pending). Written 2026-10-27 from the
gates as they actually exist today, after the mega-E2E gate shipped.

## Tier 1 — BLOCKING (a change cannot land without these)

| Gate | Scope | Notes |
| --- | --- | --- |
| Pre-push scoped gate | Only the workspaces the push touches; full gate for main pushes | Typecheck + lint + unit per workspace |
| CI required checks (ruleset) | `Extension — Tests & Coverage`, `Website — Check, Tests, Build`, `Cloudflare Worker — Tests & Lint`, `Go — Oracle Backend Tests`, `Extension — Real Browser E2E`, `CI ✅` | Enforced by the Main Branch Protection ruleset (incl. admin merge path) |
| CodeQL + Dependabot | New high/critical findings | Fixed in code, or dismissed with a written reason tied to a tracked bead |
| Mega-E2E gate (store dispatches) | build → unit → golden → chromium E2E → drift probes | Blocks all three publish jobs; local full matrix adds Edge, signed Firefox, popup QA, live Classroom |
| Coverage profile | `test:coverage:all` critical + runtime thresholds | Bare `vitest --coverage` is not the gate |

## Tier 2 — ADVISORY (runs, reports, does not block)

| Gate | Scope | Follow-up rule |
| --- | --- | --- |
| Nightly full matrix | Long-tail suites, Firefox profiles | Red → bead within 24h; green closes it |
| Mutation testing (`test:mutation`) | Survivor quality | Reviewed per epic, not per PR |
| Socket / GitGuardian / Codecov | Supply chain + coverage trend | Findings → beads; secrets → immediate rotation |
| Live Classroom suites | Real-site teacher/student flows | Required before store dispatch (`--require-live`), advisory on regular merges |

## Tier 3 — MANUAL (human judgment, not automatable)

| Check | When |
| --- | --- |
| HITL live-Classroom pass | Before any store publish of a detection-affecting change |
| Design/UX sign-off | Before integrating any prototype (owner approves the prototype first) |
| Survey-issue triage | Verify the reporter is a human (form link / diagnostics / email) before responding |
| Release notes + changelog accuracy | Owner eyeballs before dispatch |
| Firefox QA leg interpretation | While `w5r6` is open: a red Firefox leg is a known issue, not a dispatch blocker — but it must be explained in the release notes |

## The one-line contract

A merge needs green Tier 1. A store dispatch additionally needs the mega
gate's local full matrix plus a HITL pass. Everything else advises, files
beads, and waits for humans.
