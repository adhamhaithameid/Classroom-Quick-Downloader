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

## 10. Open questions for next session

1. `browserApi` shim hand-rolled vs `webextension-polyfill` dependency?
2. Browser-matrix tests: Playwright (heavier, real) vs scripted manual checklist?
3. Settings UI: separate Engine Mode control, or fold into existing flag toggles?
4. Keep `V2RenderStrategy` long-term, or delete once Legacy is confirmed keeper?
