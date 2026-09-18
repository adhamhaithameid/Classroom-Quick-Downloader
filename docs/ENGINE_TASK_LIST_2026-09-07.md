# Engine Task List — 2026-09-07

Consolidated, actionable task list for the extension engines and surrounding
program. **Status columns refreshed 2026-09-13** against the beads epic
(`Classroom-Quick-Downloader-1yf`): ALL SPRINTS CLOSED (G2–G5 met; G4
2026-09-18; S13 shipped behind OAuth 2026-09-18 — activation is the owner's
config step, docs/engine/api-assist-setup.md). Epic 1yf closed at G6. Sections C/F are historical snapshots. Produced from a full
scan of: the Engine V4 epic
(`Classroom-Quick-Downloader-1yf`), `docs/ENGINE_V4_MASTER_PLAN.md`,
`extension/docs/ENGINE_V4_SYSTEM_DESIGN.md`, `extension/docs/PRD_ENGINE_REFACTOR.md`,
ADR-0007/0008, the accuracy corpus state, and the current `extension/src` tree.

Supersedes nothing; it is an index over the existing plan plus the owner's
2026-09-07 request: **four separated engines — download, scan, display, API —
built for performance, with multiple download/data sources.**

---

## A. The four engines → where they live in Engine V4

| Engine (owner's term) | V4 home | Sprints | Beads | State |
|---|---|---|---|---|
| **Scan engine** (detection) | `roles/detect-engine.ts` + `roles/compute-engine.ts`, core in `core/detect` + `core/decide`; one MutationObserver, zero heartbeats | S4, S5, S10 | `1yf.4`, `1yf.5`, `1yf.10` | **S4 + S5 + S10 done** (roles on the bus; ONE MutationObserver via the DomPort multiplexer, zero heartbeats, mode-gated stacks, v2 default at interactive parity) |
| **Download engine** (acquisition) | `core/acquire/state-machine.ts` (pure reducer) + `roles/acquire-engine.ts` (worker) + `adapters/browser/*` strategies: direct, drive-auth (authuser 0–9), bypass-tab, later API+zip | S8, S9 | `1yf.8` (+`1yf.8.1` D11), `1yf.9` | **S8 + S9 done**: D11 authoritative registry shipped, #537/#547 fixed with the `background-bypass-flow.test.ts` BrowserPort-seam harness (2026-09-13); worker roles still to wrap (S5) |
| **Display engine** (render) | `roles/render-engine.ts` — the only DOM writer; button/flag renderers become strategies | S5, S6, S10 | `1yf.5`, `1yf.6` (D8, D9) | S5 roles done; S6 bridge live; S10: v2 default renders buttons/flags/Download-All at full parity (z57) |
| **API engine** (V3 assist) | `strategies/detect/api-detector.ts` behind `Detector` port + OAuth via `BrowserPort`; **promotion stays post-G4** per master plan R7 | S13+ | *none filed — file it* | Stub only (`src/engines/v3/`); no `identity` permission, no client id |

Shared foundation all four sit on: **S3 — `contracts/ports.ts`,
`contracts/topics.ts`, `bus/event-bus.ts`, adapters + fakes, architecture
fitness suite** (gate G1). Nothing above can start cleanly without it.

## B. Engine V4 sprint board (authoritative source: master plan §6)

| Sprint | Deliverable | Gate | Beads | Status |
|---|---|---|---|---|
| S1 accuracy harness | corpus + Tier A/B runner + CI gate | — | `1yf.1` | **Done** |
| S2 baseline freeze | 40 cases / 6 locales on disk; budget v2 ratcheted | G0 | `1yf.2` | **Done** |
| S3 contracts & bus | ports.ts, topics.ts, event-bus.ts, adapters + fakes, fitness suite; zero behavior change | G1 | `1yf.3` | **Done** (G1) |
| S4 core extraction + D1–D7, D12 | pure `core/detect`; one owned pattern table; defect fixes each with a corpus case | — | `1yf.4.*` | **Done** |
| S5 roles behind bus | Detect/Compute/Render/Harden wrap existing code **verbatim** | — | `1yf.5` | **Done** (2026-09-13, commits 29c1138d..70319ea5; session log) |
| S6 bridge + Engine Mode UI | activate bridge, Engine Mode UI, shadow parity | G2 | `1yf.6.*` | Open — **next takeable** (S5 done; D8/D9 already closed) |
| S7 naming core | `core/name/{derive,strip,sanitize,verify}`; locale TypeLabelRegistry; fixes D10 (#541) | — | `1yf.7` | **Done** (gh #541 verified closed 2026-09-13) |
| S8 acquisition core | pure state machine; one correlation id replaces 4 pending maps; deadline → forced settle | — | `1yf.8` | **Done** |
| S9 acquisition adapters | Direct/Drive-auth/BypassTab strategies; Chrome/Firefox BrowserPort adapters; #537/#546/#547 repro tests | — | `1yf.9` | **Done** (2026-09-13: authuser cycling fix + flow harness, commit af09ac05/fef5dfc0) |
| S10 strip V1 detector | 1 observer, 0 heartbeats; V1 render-only | G3 | `1yf.10` | **Done** (2026-09-17: DomPort multiplexer, heartbeats deleted, v2 default at interactive parity; V1 kept as rollback — see session log) |
| S11 cross-browser & perf | browser smoke matrix in CI; `handleMutations` p95 < 6 ms | G5 | `1yf.11` | **Done** (2026-09-17: p95 1.9ms asserted; Chrome+Edge CI legs; Firefox signed leg env-gated/owner-blocked; _locales + selector audit) |
| S12 ratchet & closeout | floors up, mutation ≥ 80%, decision trace, docs | G4, G6 | `1yf.12` | **Done** (2026-09-18: knownFailures [], floors 1.0, mutation 95.64%, trace viewer, checksums, ADR Accepted) |
| S13+ API assist | OAuth client id + `identity`; `ApiDetector` strategy; consent + fallback | — | `1yf.13` | **Done** (2026-09-18: strategy+consent+activation shipped, inert until owner OAuth config) |

## C. P0/P1 operations items (not engine code, but blocking trust)

1. **P0 — Rotate the Gemini API key exposed in chat** (`…-5w5`). Agent cannot
   rotate credentials; owner action, do first.
2. **P0 — Oracle public API unreachable, worker snapshot routes hang**
   (`…-4h1`). Investigate worker; likely unrelated to extension.
3. ~~**P0 — Commit working-tree drift** (`…-mml`)~~ — resolved: drift committed.
4. ~~**P1 — D12** (`…-ass`)~~ — resolved: closed with corpus evidence (S4).
5. ~~**P1 — Monitor alert endpoint failing** (`…-xer`)~~ — resolved: closed as
   duplicate of the Oracle incident (`…-4h1`), which stays owner-side.

## D. Website / store backlog (P2, independent of engines)

- SEO/AEO polish pass (`…-2ps`); AggregateRating schema from real store
  ratings (`…-6dq`).
- Navbar: hover megamenus (`…-7wp`, in progress); scroll-morph floating pill
  (`…-p2j`).
- Store distribution automation (`…-mj3`); Bing webmaster verification
  (`…-l8q`); INDEXNOW/GSC secret verification (`…-qwj`).

## E. Enhancement ideas surfaced by the owner's request (fold into sprints)

- **Multiple download sources** = S9's strategy list, explicitly: `direct`
  (`chrome.downloads`), `drive-auth` (authuser rotation), `bypass-tab`
  (interstitial click-through), plus later `api` (OAuth fetch) and
  `download-all` zip path. All must be pluggable strategies behind
  `BrowserPort` with a shared conformance suite — adding a source must not
  touch the state machine.
- **Multiple data sources for scanning** = `Detector` strategies:
  `keyword`, `structural`, and the S13 `api` detector. Combination policy is
  a data table in `core/decide/policy.ts` (S4).
- **Performance separation** = S3/S5/S10: one observer, zero heartbeats,
  idle scheduling (`scheduleIdle`), per-role fault isolation at the bus
  boundary, `handleMutations` p95 budget (G5).

## F. This session's execution scope (2026-09-07)

Goal: advance S3 (gate G1) and the S8 core, TDD, zero behavior change.
Worker/content wiring is untouched; existing suites must stay green.

**Pre-agreed TDD seams** (public interfaces under test):

1. `bus/event-bus.ts` — `createEventBus<TopicMap>()`: synchronous typed
   pub/sub; `subscribe` returns an unsubscribe fn; subscriber exceptions are
   isolated (one bad handler cannot stop the rest) and reported via optional
   `onError`.
2. `contracts/topics.ts` — `PageTopicMap`, `WorkerTopicMap` exactly as
   `ENGINE_V4_SYSTEM_DESIGN.md` §4.1 (+ acquire/naming payload types:
   `RequestId`, `FileRef`, `NameHint`, `AcquirePhase`, `AcquireOutcome`,
   `AcquireStrategyName`, `NameSource`).
3. `contracts/ports.ts` — `ClockPort`, `SchedulerPort`, `LogPort`,
   `NetworkPort`, `DomPort`, `BrowserPort`, `BridgePort` (ADR-0007). Fakes in
   `tests/fakes/` must satisfy every port; system adapters in `src/adapters/`.
4. `core/acquire/state-machine.ts` — `nextAcquireState(state, event) →
   { state, effects }`: REQUESTED → PLANNED → DIRECT | DRIVE_AUTH | BYPASS_TAB
   → SETTLED; BLOCKED on validation failure; authuser rotation as data
   (candidates 0–9); every terminal path settles with an explicit outcome;
   `timeout` event force-settles (design §7, §9).
5. `tests/architecture/*` — fitness: no globals in `core/**`; roles import
   only `bus` + `contracts`; no role↔role imports; no import cycles in new
   layers; file-size budget for the new architecture dirs.

**Verification protocol** (master plan §11): `pnpm --dir extension run
compile`, `test`, `test:accuracy`, `test:golden`.

**Not in this session** (deliberately): defect fixes D1–D12 (S4+ owns them,
each needs a corpus case first), worker rewiring, role wrapping, V1 strip,
any accuracy-budget edits.
