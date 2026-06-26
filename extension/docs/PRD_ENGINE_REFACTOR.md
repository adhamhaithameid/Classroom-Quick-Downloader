# PRD — Engine Refactor: Role-Based Modules + EventBus

> **Author:** Adham · **Date:** 2026-06-26 · **Status:** Draft for approval
> **Companion:** [ENGINE_ARCHITECTURE.md](./ENGINE_ARCHITECTURE.md) (what-does-what)
> **Tracking issues:** #396 (freeze fixtures), #401 (consolidate runtime), #615
> (cross-browser selectors), #616 (observer-only detection)

---

## 1. Problem

The extension ships **two full detection stacks running at once** (`shadow` mode
default): legacy V1 (detect + render) and V2 (detect + compute, render off). They
**never communicate** — V2's decisions drive nothing. Cost:

- **Performance:** 8+ MutationObservers + 4 setInterval heartbeats per Classroom
  page; every post card scanned by 3 independent scanners on every mutation.
- **Detection:** comment/edited/anchor logic duplicated 2–3×, can disagree.
- **Activity:** the smarter engine (V2) is inert — it computes and throws the
  result away.
- **Comms:** no contract between layers; coordination via scattered `data-cqd-*`
  DOM attributes.
- **Availability:** `chrome.*` used without a `browser` polyfill; no cross-browser
  tests; V1 has **zero** dedicated tests.
- **Scalability:** adding a capability means touching tangled monoliths.

## 2. Goal

One **role-based, fault-tolerant, event-driven** architecture: four modules
(**Detect / Compute / Render / Harden**) connected by a typed **EventBus**, with
versions (V1/V2/V3) demoted to swappable **strategies**. Same behavior on
Chrome / Firefox / Edge across Windows / macOS / Linux. Instant rollback via a
settings toggle.

Targets the six named outcomes: **detection, performance, activity, comms,
availability, scalability.**

## 3. Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Structure | **Role modules**: Detect / Compute / Render / Harden | versions become strategies; clean long-term shape |
| 2 | Seam | **Typed pub/sub EventBus**, synchronous | zero module↔module coupling, testable, swap-friendly |
| 3 | V1 detector | **Dual-run → strip** after parity proven | safe; instant rollback during transition |
| 4 | V3 / API | **Interface now, OAuth later**; DOM stays live | ships architecture without blocking on Google review |
| 5 | Harden | **Peer module** on the bus | matches the 4-role model; centralizes repair+budget |
| 6 | Renderer keeper | **LegacyRenderStrategy** (wrap V1 render fns) | proven output; V2 render code kept as alt strategy |

## 4. Target design

### 4.1 Modules

- **DetectEngine** — owns the single MutationObserver + RouteWatcher. Strategies:
  `DomDetectStrategy` (from `v2/model/dom-scanner` + `selectors/`), `ApiDetectStrategy`
  (from `engines/v3/api/`, OAuth-gated). Publishes `route:changed`, `post:scanned`,
  `file:discovered`.
- **ComputeEngine** — pure computation from `v2/decision/*`. Subscribes
  `post:scanned`; publishes `decision:flags`, `decision:placement`. No DOM writes.
- **RenderEngine** — the only DOM writer. Strategies: `LegacyRenderStrategy`
  (wraps V1 fns), `V2RenderStrategy` (from `v2/render/*`). Subscribes
  `decision:*` + `correction:needed`; publishes `render:applied`.
- **HardenEngine** — from `v2/repair/*` + `v2/telemetry/*`. Subscribes to all
  events; idle-validates DOM vs decisions; publishes `correction:needed` and
  `budget:throttle`.

### 4.2 EventBus contract

```ts
type TopicMap = {
  'route:changed':      { view: ViewKind; url: string };
  'post:scanned':       { posts: PostNode[] };
  'file:discovered':    { postId: string; files: FileNode[] };
  'decision:flags':     { decisions: FlagDecision[] };
  'decision:placement': { decisions: PlacementDecision[] };
  'render:applied':     { postId: string; kind: 'button'|'flag'|'all' };
  'correction:needed':  { item: CorrectionItem };
  'budget:throttle':    { level: ThrottleLevel };
};
interface EventBus {
  publish<T extends keyof TopicMap>(topic: T, payload: TopicMap[T]): void;
  subscribe<T extends keyof TopicMap>(topic: T, fn: (p: TopicMap[T]) => void): () => void;
}
```

Synchronous dispatch (no serialization, no latency). Subscriptions return an
unsubscribe fn; Orchestrator clears all on navigation via AbortController.

### 4.3 Orchestrator

Keeps its job (`v2/orchestrator/orchestrator.ts`): route watch → abort previous
page → init modules for the ViewKind → wire bus → teardown on nav. One
`AbortController` per page. The single MutationObserver moves **into DetectEngine**.

### 4.4 Settings toggle

Popup **Engine Mode** → `chrome.storage.local.cqdV2Mode`: `Legacy` / `New` /
`API` (API hidden until OAuth lands). Live switch already supported by
`mode-controller` + `engine-registry` mode-change callback.

## 5. Cross-browser / cross-OS hardening (requirements)

| Risk | Today | Requirement |
|---|---|---|
| API namespace | `chrome.*` inconsistent, no polyfill | adopt one `browserApi` shim (or `webextension-polyfill`); all modules import it |
| `requestIdleCallback` | has setTimeout fallback in `correction-queue` | extract one `scheduleIdle()` util; use everywhere |
| `WeakRef` (ES2021) | used in `model/entities` | OK (FF 109+ already required); document min versions |
| `IntersectionObserver rootMargin:'100%'` | `viewport-observer` | verify on Edge; pixel fallback if needed |
| `history` monkey-patch | `route-classifier` | keep; add `Navigation API` path where available |
| Download divergence | Chrome `onDeterminingFilename` vs FF `onCreated` | keep both; **add tests for both paths** |
| Icon API | `action` vs `browserAction` | already handled in `icon-manager`; keep |
| Filenames / OS | `conflictAction:'uniquify'` | OS-agnostic; no change |
| No cross-browser tests | jsdom only | add browser-matrix smoke plan (Phase 5) |

## 6. Migration plan (phased, each phase shippable + reversible)

### Phase 0 — Safety net  *(blocks everything)*
- Freeze golden fixtures + regression matrix (**#396**).
- Add **V1 characterization tests** (V1 has zero today) — lock current render output.
- Reconcile stale `TEST.md` (claims 134 vs 3233 tests).
- **Gate:** golden baseline green and frozen.

### Phase 1 — Contracts + Bus  *(no behavior change)*
- Create `src/contracts/` (Detector/Computer/Renderer/Hardener + `TopicMap`).
- Create `src/bus/event-bus.ts` + unit tests.
- Add `browserApi` shim + `scheduleIdle()` util.
- **Gate:** bus + shim unit-tested, build green on all 3 targets.

### Phase 2 — Wrap existing code into roles  *(behind the bus, V1 still primary)*
- DetectEngine wraps `dom-scanner` + RouteWatcher + the one observer.
- ComputeEngine wraps `decision/*`.
- RenderEngine = `LegacyRenderStrategy` wrapping V1 render fns.
- HardenEngine wraps `repair/*` + `telemetry/*`.
- Wire through bus in `shadow`; V1 detector still dual-runs.
- **Gate:** ShadowComparator match ≥ 99.5% coverage / 98% precision
  (existing `readiness-gate` thresholds) on golden fixtures.

### Phase 3 — Activate the bridge  *(the missing wire)*
- In `v2` mode, ComputeEngine decisions → bus → RenderEngine(Legacy) actually
  render. This is the connection that does not exist today.
- Ship the settings toggle (Legacy / New).
- **Gate:** New mode passes full golden + manual smoke; rollback verified.

### Phase 4 — Strip V1 detector  *(V1 → render-only)*
- Delete `smart-detector*` duplication; legacy scripts keep only render fns.
- Remove redundant V1 observers/heartbeats (target: 1 observer, 0 heartbeats).
- **Gate:** golden green; observer/heartbeat count verified down.

### Phase 5 — Cross-browser hardening
- Browser-matrix smoke tests (Playwright per target or scripted manual matrix).
- Verify download both-paths, idle fallback, IntersectionObserver on Edge.
- **Gate:** green Chrome/Firefox/Edge builds + smoke.

### Phase 6 — OptCompute (V3)  *(separate, OAuth-gated)*
- Google Cloud OAuth client + consent screen + `classroom.courses.readonly`.
- Add `identity` permission + `oauth2` block to `wxt.config.ts`.
- `ApiDetectStrategy` goes live behind the `API` toggle.
- **Gate:** Google verification passed; DOM fallback still default.

## 7. Success metrics

| Metric | Baseline | Target |
|---|---|---|
| Concurrent observers (Classroom page) | 8+ | 1 |
| setInterval heartbeats | 4 | 0 |
| `handleMutations` p95 | unmeasured cross-stack | < 6 ms |
| Detection match vs golden | n/a (no frozen baseline) | ≥ 99.5% coverage / 98% precision |
| Duplicate detection passes per card | 3 | 1 |
| Module↔module imports | many | 0 (bus only) |
| Browsers with passing smoke | 0 automated | Chrome + Firefox + Edge |
| V1 dedicated tests | 0 | characterization suite |

## 8. Risks

| Risk | Mitigation |
|---|---|
| ComputeEngine misses a V1-handled case | dual-run + shadow gate before strip (Phase 2–3) |
| Bus dispatch becomes a perf bottleneck | synchronous + topic-scoped; budget throttle via Harden |
| Stripping V1 breaks a niche view | golden fixtures cover 8 ViewKinds; toggle = instant rollback |
| Google OAuth review delay | V3 is isolated Phase 6; DOM path unaffected |
| Refactor churn vs 36 weekly Jules PRs | land phases as small PRs; freeze fixtures first |

## 9. Out of scope

- Background download engine internals (stable; only add cross-browser tests).
- Analytics pipeline, Oracle backend, Svelte site.
- New user-facing features (this is structural).

---

## 10. Test Strategy

> Companion to [PRD_ENGINE_REFACTOR.md](./PRD_ENGINE_REFACTOR.md) and
> [ENGINE_ARCHITECTURE.md](./ENGINE_ARCHITECTURE.md). Defines how the existing
> 100-file suite is preserved and where new coverage lands, phase by phase.

### 0. Baseline reality (reconcile the stale TEST.md)

`TEST.md` is **stale and self-contradictory**: its header claims "100 files /
3233 tests" while its overview table claims a "Total of 134" across only
`core.test.ts` (60), `dom.test.ts` (45), `ui.test.ts` (29). Neither reflects the
tree. **Ground truth today: 100 `*.test.ts` files under `extension/tests/`**
(plus `fixtures.ts`, `setup.ts`, `fixtures/`, `cloudflare-workers-globals.d.ts`).
Phase 0 reconciles `TEST.md` to point at the golden suite and the role-module
layout below; the per-file fate table in this PRD is the authoritative map.

Config facts the strategy relies on:
- `vitest.config.ts`: jsdom env, `include: tests/**/*.test.ts`, alias `@ -> entrypoints/content`, `setup.ts` preloaded.
- Three coverage profiles: **default** (content/**), **critical** and **runtime** (analytics + background, 100% lines/branches/funcs/statements). These gates are out-of-scope code and **must keep passing untouched**.
- Golden scripts already exist: `test:golden = regression + fuzz + stress + visual`, plus `test:fixtures:manifest`. These become the Phase 0 freeze.

### 1. Approach to existing tests (fate model)

Every existing file is assigned one fate:

- **keep** — unaffected (analytics, background download engine, student-work
  subsystem, cross-cutting utils, security/fuzz suites). ~55 files. These stay
  byte-for-byte and remain green every phase.
- **adapt** — same target module, edits only when code moves behind the bus /
  contracts / a strategy wrapper, or when a mode default/label changes (e.g.
  `core.test.ts`, `content-button-factory.test.ts`, `v2-mode-controller.test.ts`,
  `v2-engine-registry.test.ts`, `engine-combiner.test.ts`, the
  `classroom-*-regression` golden gates).
- **migrate** — move to the new role-module test location with the code:
  `v2/decision/*` -> `tests/compute/*`, `v2/model|selectors|context/*` ->
  `tests/detect/*`, `v2/render/*` -> `tests/render/v2-render-strategy`,
  `v2/repair|telemetry/*` -> `tests/harden/*`, `engines/v3/api/*` ->
  `tests/detect/api-detect-strategy`.
- **split** — one file spans multiple roles; carve detection vs render:
  `content-flags`, `content-both-badge`, `ui.test.ts`, `content-observers`,
  `content-post-card-utils`, `content-url-utils`, `scan_optimization`,
  `flag-detection-comprehensive`, `v2-engines`, `v3-engine-student-work-scope`.
- **delete** — tests V1 detection logic removed at strip: `dom.test.ts` (after
  its language cases are migrated into ComputeEngine flag-scoring). The V1
  *render* fns are NOT deleted — they survive as `LegacyRenderStrategy`.

Migration tooling tests (`v2-launch-controller`, `v2-readiness-gate`,
`v2-shadow-diff-report`) are **keep through the transition**, then retire only
when V1 dual-run ends (Phase 4) and shadow comparison is no longer wired.

### 2. New tests per feature

| Feature | New test file(s) | Phase |
|---|---|---|
| Golden-fixture freeze (#396) | `tests/golden/classroom-golden-freeze.test.ts` (+ existing `classroom-fixture-manifest.test.ts` as the hash lock) | 0 |
| V1 characterization (zero today) | `tests/v1-characterization/legacy-render-characterization.test.ts`, `legacy-detect-characterization.test.ts` | 0 |
| EventBus | `tests/bus/event-bus.test.ts` | 1 |
| Contracts (Detector/Computer/Renderer/Hardener + TopicMap) | `tests/contracts/contracts.test.ts` | 1 |
| browserApi shim + scheduleIdle | `tests/platform/browser-api-shim.test.ts`, `tests/platform/schedule-idle.test.ts` | 1 |
| DetectEngine + Dom/Api strategies | `tests/detect/detect-engine.test.ts`, `dom-detect-strategy.test.ts`, `api-detect-strategy.test.ts` | 2 |
| ComputeEngine | `tests/compute/compute-engine.test.ts` | 2 |
| RenderEngine + Legacy/V2 strategies | `tests/render/render-engine.test.ts`, `legacy-render-strategy.test.ts`, `v2-render-strategy.test.ts` | 2 |
| HardenEngine | `tests/harden/harden-engine.test.ts` | 2 |
| Bus activation bridge | `tests/orchestrator/bus-wiring.test.ts` | 3 |
| Settings toggle (Engine Mode) | `tests/settings/engine-mode-toggle.test.ts` | 3 |
| Parity gate | `tests/parity/engine-parity-gate.test.ts` | 3 |
| Observer/heartbeat budget | `tests/perf/observer-heartbeat-budget.test.ts` | 4 |
| Cross-browser matrix | `tests/cross-browser/browser-matrix.smoke.test.ts`, `download-paths.test.ts` | 5 |
| V3 OAuth live | `tests/detect/api-detect-strategy.live.test.ts` | 6 |

### 3. Coverage gates per phase

| Phase | Gate (must be green to ship) |
|---|---|
| **0** | Golden manifest hashes match + golden-freeze snapshots immutable; V1 render+detect characterization captured; `test:golden` green; existing critical/runtime 100% profiles untouched. |
| **1** | EventBus + contracts + browserApi shim + scheduleIdle unit-tested; `tsc --noEmit` clean; `build:all` (chrome/firefox/edge) green. No behavior change — full existing suite still passes unmodified. |
| **2** | Role modules wrapped, wired in shadow, V1 still primary. **Parity gate >= 99.5% coverage / 98% precision** vs golden via readiness-gate + shadow-diff-report. Migrated tests pass in their new locations; characterization suites still green. |
| **3** | Bus-wiring renders in New mode; `engine-parity-gate` green for BOTH Legacy and New over full golden; settings toggle persists + live-switches + rollback verified. |
| **4** | V1 detector deleted; `dom.test.ts` removed (cases migrated); `observer-heartbeat-budget` proves observers->1, heartbeats->0, 1 pass/card, p95 < 6ms; golden still green via Legacy render path. |
| **5** | `browser-matrix.smoke` + `download-paths` green on Chrome/Firefox/Edge; idle fallback, IntersectionObserver-on-Edge, both download paths verified. |
| **6** | API toggle live behind OAuth; `api-detect-strategy.live` green; DOM path remains default and still passes all detection gates. |

Each phase keeps the full prior suite green (no red between phases); migrations
move tests with their code in the same PR so coverage never dips.

### 4. Cross-browser test plan (Phase 5)

Today: **jsdom only, zero automated cross-browser coverage** (PRD risk row).
Plan addresses each PRD section-5 risk with an explicit check:

| Risk | Test |
|---|---|
| `chrome.*` vs `browser.*`, `action` vs `browserAction` | `browser-api-shim.test.ts` (Phase 1) resolves the right namespace; smoke matrix confirms on each target. |
| Download filename divergence | `download-paths.test.ts` — Chrome/Edge `onDeterminingFilename` + authuser rotation vs Firefox `onCreated` (no rename, always bypass tab, no 403 retry). Extends `background-download-handler`/`background-index`. |
| `requestIdleCallback` absence | `schedule-idle.test.ts` fallback path; matrix confirms on each engine. |
| `WeakRef` (ES2021) | documented min versions (FF 109+); covered by migrated `v2-element-lifecycle`/`v2-entities` running on each target. |
| `IntersectionObserver rootMargin:'100%'` on Edge | matrix case + pixel-fallback assertion (from migrated `v2-viewport-observer`). |
| `history` monkey-patch / Navigation API | migrated `route-classifier` cases run per target. |

**Mechanism (open question 2):** default to a **scripted manual checklist**
driven by `wxt build -b {chrome,firefox,edge}` + the existing
`utils-firefox-debug` helper for the first matrix; upgrade to **Playwright
per-target** (`--project=extension-chromium` already used for student-work e2e)
if the manual matrix proves flaky. The smoke suite loads the built extension on
each target, opens a golden Classroom fixture page, and asserts buttons/badges
render and a download both-path completes.

---

## 11. Documentation Strategy

This section defines what happens to every CQD doc during the engine refactor: what is the source of truth, what is stale, what new docs the seam needs, and when each lands. It is reconciled against the actual repo state on 2026-06-26 (`src/bus` and `src/contracts` do **not** exist yet — Phase 0/1 are genuinely pending; the extension has ~100 test files / ~1316 `it()` cases, not the 134 or 3233 figures floating in the docs).

### Guiding principles

1. **One source of truth per topic.** `docs/TESTING.md` owns testing; `extension/TEST.md` shrinks to extension-specific specifics + a pointer. `docs/ARCHITECTURE.md` owns the *analytics backend*; `extension/docs/ENGINE_ARCHITECTURE.md` owns the *detection engine*. No doc should restate another's authority.
2. **Never hardcode a test count.** Every stale number ("134", "3233", "43", "47", "101") came from copy-pasting a point-in-time scan. Counts must be derived by command at write time and stated once.
3. **The seam gets a contract doc.** The EventBus TopicMap is currently duplicated inline in two docs. The moment `src/bus/event-bus.ts` lands it gets one canonical `EVENTBUS_CONTRACT.md` that both other docs link to.
4. **Dated snapshots are history, not truth.** `AUDIT_REPORT`, `MAJOR_SCAN_*`, `CODE_QUALITY_*`, `TODO_LIST_2026-03-13`, `POST_MERGE_FOLLOWUP_BOARD`, `extension-core-strategy` are point-in-time. They get a "superseded by" header or move to `docs/archive/`; they are never cited as the live state.
5. **Phase numbers are namespaced.** "Phase 12/13" belongs to the *old* analytics `refactor-plan.md`; "Phase 0–6" belongs to this engine PRD. Docs that use either must say which.

### Immediate fixes (Phase 0 — blocks the refactor)

| Doc | Problem | Fix |
|---|---|---|
| `extension/TEST.md` | Self-contradictory (134 vs 3233 tests); frames the suite as a 3-file "Universal V4" system; omits the golden suites. | Delete the 134/3-file table and "Universal V4" framing; reduce to extension-specific content (Student Work verification block, golden/`test:golden` scripts) + a pointer to canonical `docs/TESTING.md`. Derive any count by command. |
| `docs/TESTING.md` | Inconsistent counts (43 / 47 / 101); still labels `core/dom/ui.test.ts` as the detection system. | Make it the single testing source of truth; state the count once (script-derived); reframe the 3 legacy files as a slice; add the golden-suite scripts. |
| `docs/ARCHITECTURE.md` | Name implies engine docs; ~95% is the analytics backend. | Add a top banner pointing engine readers to `ENGINE_ARCHITECTURE.md` + `PRD_ENGINE_REFACTOR.md`. Rename to `ANALYTICS_ARCHITECTURE.md` is a stretch goal behind the banner. |
| `extension/README.md`, `docs/DEVELOPMENT.md` | No mention of the engines; Node version differs from `.nvmrc`. | Add a "Detection Engine" subsection linking the two new engine docs; reconcile Node version to `.nvmrc`. |
| Stale `Update (2026-02-28)` banners across README/TEST/ARCHITECTURE/BOTS/DEVELOPMENT/SECURITY_DEV | Point at an **archived** `MAJOR_SCAN_2026-02-28.md`. | Drop or update those banner lines while editing each file. |
| `docs/README.md` | **Does not exist** — 40+ docs with no index; the new engine docs are undiscoverable. | Create a domain-grouped docs index (Engine / Backend / Testing / Distribution / SEO-Website / Planning / Archive). |
| `docs/SPRINT_PLAN.md` | Lists #396/#401/#615/#616 without tying them to the PRD. | Annotate each with the PRD phase it maps to so the board and PRD stay reconciled. |
| `docs/PHASE12_TEST_MATRIX.md` | Phase-number collision with the engine PRD. | Add a header: "Phase 12 = analytics `refactor-plan.md`, not engine PRD phases 0–6." |

### Keepers that just need linking

`ENGINE_ARCHITECTURE.md` and `PRD_ENGINE_REFACTOR.md` (both new this session, accurate) are correct as written — they only need to be **linked** from README, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, and the new docs index, and to reference `EVENTBUS_CONTRACT.md` once it exists. `EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md` is the parity oracle the ShadowComparator gate must satisfy — link it from the PRD. `CLASSROOM_FIXTURE_CAPTURE_GUIDE.md` is the #396 freeze procedure — link it from PRD Phase 0. `EXTENSION_TESTING_RUNBOOK.md` is the manual companion for Phase 0 (V1 characterization) and Phase 5 (cross-browser). `student-work-*` docs are accurate and gain only a forward-link to PRD Phase 6.

### New docs the refactor requires

| New doc | When | Why |
|---|---|---|
| `extension/docs/EVENTBUS_CONTRACT.md` | Phase 1 (with `src/bus/`) | Canonical TopicMap + publisher→subscriber matrix + dispatch/teardown semantics + the "bus-only imports" rule. Replaces the inline duplication. |
| `extension/docs/CROSS_BROWSER_MATRIX.md` | Phase 1 stub → Phase 5 complete | Living version of PRD §5: shim/idle/observer/download-path coverage per Chrome/Firefox/Edge × OS. Gates Phase 5 smoke. |
| `extension/docs/MIGRATION_RUNBOOK.md` | Phase 2 draft → Phase 3–4 use | The "is it safe to strip V1?" operator doc: reading ShadowComparator, readiness-gate thresholds, the Engine Mode toggle, instant rollback, per-phase gate checklist. |
| `extension/docs/ENGINE_DEBUG_GUIDE.md` | Phase 3 (only if the in-line quick-ref proves too thin) | Deep troubleshooting: decision traces, shadow diffing, `budget:throttle`, tracing a missing button through Detect→Compute→Render. |

### Cleanup / archive (not engine-gated, batchable)

Move to `docs/archive/`: `TODO_LIST_2026-03-13.md` (superseded by SPRINT_PLAN), `extension-core-strategy-2026-03-08.md` (folded into PRD). Reduce `RUNBOOK_DEPLOYMENT.md` to a redirect to the canonical `DEPLOYMENT_RUNBOOK.md` (the SPRINT-flagged duplicate). Add "superseded by" headers to dated snapshots (`AUDIT_REPORT`, `MAJOR_SCAN_2026-03-17`, `CODE_QUALITY_2026-06-24`). `plan.md` (Website Reviews) stays live until Reviews ships, then archives. Disambiguate `ARCHITECTURE_RUNTIME_CONTRACT.md` (website telemetry contract) from the engine `contracts/` seam with a one-line scope note.

### Doc gates per phase (mirrors the PRD migration gates)

- **Phase 0 gate** also requires: `TEST.md` + `TESTING.md` reconciled, `ARCHITECTURE.md` cross-link banner added, `docs/README.md` index created, engine docs linked from README. Documentation is part of the safety net, not an afterthought.
- **Phase 1 gate** also requires: `EVENTBUS_CONTRACT.md` published, `CROSS_BROWSER_MATRIX.md` stubbed.
- **Phase 3 gate** also requires: `MIGRATION_RUNBOOK.md` usable (toggle + rollback documented and verified).
- **Phase 5 gate** also requires: `CROSS_BROWSER_MATRIX.md` fully filled per target.

---

## 12. Open questions for next session

1. `browserApi` shim hand-rolled vs `webextension-polyfill` dependency?
2. Browser-matrix tests: Playwright (heavier, real) vs scripted manual checklist?
3. Settings UI: separate Engine Mode control, or fold into existing flag toggles?
4. Keep `V2RenderStrategy` long-term, or delete once Legacy is confirmed keeper?
