# Session log — Engine V4 S6: Activate the Bridge + Engine Mode UI (gate G2)

**Date:** 2026-09-13 · **Bead:** `Classroom-Quick-Downloader-1yf.6` · **Gh:** #676, #684
**Plan:** docs/superpowers/plans/2026-09-13-engine-v4-s6-bridge-engine-mode.md

## What shipped

### T1 — BridgePort implementations
- `tests/fakes/fake-bridge-port.ts` — in-memory loopback pair (page↔worker),
  correlation-pinned by requestId, idempotent off fns.
- `src/adapters/bridge/runtime-bridge.ts` — page + worker halves over one
  message pair (`CQD_BRIDGE_REQUEST` / `CQD_BRIDGE_RESPONSE`), same-extension
  sender guard, `return false` convention, throw-isolated handlers.
- 9 contract tests (`tests/bridge.test.ts`).

### T2 — Page relay
- `src/v2/orchestrator/bridge-relay.ts` — page bus `download:requested` →
  `bridge.send`; bridge responses → `download:settled` on the same bus.
  Wired in `v2_bootstrap.content.ts` (inert until a request publishes).
- 3 bus-level tests + bootstrap wiring; compile-verified.

### T3 — Worker service
- `entrypoints/background/bridge-download-service.ts` — bridge requests drive
  the EXISTING `handleDownloadRequest` state machine (bridge is a caller, not
  a second machine); terminal statuses settle the bridge exactly once per
  requestId via a new additive seam in `message-sender.ts`
  (`setDownloadStatusListener`, fires after the duplicate-success guard and
  before the tabId guard, so no-tab bridge downloads still settle).
- Status → `AcquireOutcome` mapping: success→saved, error+AUTH_ALL_FAILED→
  auth-exhausted, error/interrupted→failed, blocked_html→blocked; `trying` is
  progress and never settles. Synchronous refusals (started:false) settle as
  `blocked`.
- Wired in `background/index.ts` start() (always listening, inert without
  bridge traffic). 7 tests.

### T4 — Engine Mode UI (#684)
- Discovery: the popup had dead toggle handlers — the control was never
  rendered. Built `EngineModeRow` (segmented control, aria-pressed, disabled
  while loading), wired as a separate "Engine" settings section.
- **Recorded decision (per #684's open question):** a SEPARATE control, not
  folded into flag toggles — engine selection changes the whole page
  pipeline; flags tune one feature. Options: Legacy / New; API (v3) stays
  hidden until S13 OAuth. `handleEngineModeSelect` writes `cqdV2Mode` + sends
  the live `cqd-set-mode` message (no reload; rollback = one click).
- 5 component tests.

### T5 — Shadow parity threshold (decided + met)
- **Recorded decision:** the G2 parity instrument is the accuracy gate's C1
  exact-match on the labeled corpus (the same labeled truth the golden suites
  freeze for V1) — not the runtime ShadowComparator, which is DOM-coupled and
  non-deterministic; its `matchPercentage` stays an informational debug-panel
  signal for runtime drift, not a gate.
- Evidence: accuracy gate green (C1 exact-match outside knownFailures, C2
  floors), golden suites green.

### T6 — Fitness + verification
- The existing dependency-direction rule (`adapters/**` import only contracts
  + bus) already covers the new bridge adapter — 11/11 fitness green, no new
  rule needed (non-vacuous: adapters seed the live-surface check).
- Full suite: 134 files / 3,627 tests green; tsc clean; goldens green.

## G2 acceptance
- ✅ download topics flow through BridgePort (relay + worker service; decision
  topics flow through the bus roles from S5).
- ✅ Engine Mode toggle ships (popup → `cqdV2Mode` → live switch).
- ✅ Shadow parity meets the agreed threshold (C1 exact-match on corpus).
- ✅ Rollback is one setting (popup toggle; storage key `cqdV2Mode`).

## Known gaps / deferred
- `download:progress` push (worker→page) joins when the acquire engine
  publishes phases (S10+); the settled topic is today's whole contract.
- User-initiated cancel of a bridge download doesn't settle (page has no
  cancel UI for bridged downloads; the TTL sweep still bounds state).
- ShadowComparator remains interval-based by design (informational only).
