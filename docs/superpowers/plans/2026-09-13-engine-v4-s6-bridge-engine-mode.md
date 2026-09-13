# Engine V4 S6 — Activate the Bridge + Engine Mode UI — Implementation Plan

**Goal (G2, bead `1yf.6`):** download and decision topics flow through
`BridgePort`; the Engine Mode toggle ships (rollback = one setting); shadow
parity meets the agreed threshold.

**STATUS (2026-09-13): COMPLETE.** All tasks executed TDD-first; evidence and
decisions: docs/session-logs/2026-09-13-engine-v4-s6-bridge-engine-mode.md
(3,627 unit tests, fitness 11/11, accuracy gate + goldens green). Original
carrier text below. Spec: `ENGINE_V4_SYSTEM_DESIGN.md` §7
(bridge), §13 (coexistence); gh #676, #684; S5 log rules `download:*` topics as
S6's worker half.

**Already in place (verified, not re-built):** page bus + four roles (S5);
engine-registry mode machinery (`legacy | shadow | v2 | v3`), mode-controller
(`cqdV2Mode` storage key, live switching, cross-tab sync); popup Legacy↔New
toggle writing `cqdV2Mode`; ShadowComparator; D8/D9 closed.

## Tasks

### T1 — BridgePort implementations (fake + runtime)
- Create `extension/src/adapters/bridge/in-memory-bridge.ts` (test double,
  synchronous loopback) and `extension/src/adapters/bridge/runtime-bridge.ts`
  (page side + worker side over `chrome.runtime` message
  `CQD_BRIDGE_REQUEST`/`CQD_BRIDGE_RESPONSE`, correlation by requestId).
- RED: fake loopback delivers send→onRequest→respond→onResponse with the exact
  correlation id; runtime adapters tested with a mocked `chrome.runtime`.
- Constraint: adapters import `contracts/ports` types only (fitness).

### T2 — Page wiring: bus → bridge
- Content side: subscribe the orchestrator page bus `download:requested` →
  `bridge.send({ requestId, payload })`; bridge responses → publish
  `download:settled` on the page bus.
- RED: bus-level test with the in-memory bridge; bootstrap-level wiring test.

### T3 — Worker wiring: bridge → download state machine
- Background: `onRequest` → reuse the existing `CQD_DOWNLOAD` handler path
  (zero behavior change for legacy users); correlate requestId ↔ pending; on
  terminal (success/error/cancel) → `bridge.respond(requestId, outcome)`.
- RED: worker tests driving requests through the existing state machine mocks.

### T4 — Engine Mode UI (#684)
- Verify the existing popup toggle has UI + persistence tests; add what's
  missing (Legacy/New; API stays hidden until S13 OAuth). Record the UI
  placement decision (separate control) in the issue.

### T5 — Shadow parity threshold
- Decide + record the agreed threshold (zero decision mismatches on the
  accuracy corpus); run the comparator against corpus fixtures as a test if the
  comparator exposes a pure seam; otherwise document the run + numbers.

### T6 — Fitness + closeout
- Architecture fitness: adapters/bridge import rules. Session log, plan
  checkboxes, `bd close 1yf.6` + gh #676/#684, task-list S6 row.

## Constraints
- Zero behavior change for `legacy` mode (default): all G2 wiring is behind
  the mode toggle. Every commit pathspec-limited; Mimosa hook: use Write/Edit
  for source files; pnpm needs the nvm PATH export.
