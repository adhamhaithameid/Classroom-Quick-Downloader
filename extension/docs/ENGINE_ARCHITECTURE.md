# Engine Architecture — What Does What

> **Purpose:** the map you open at 2am when something breaks. Explains the
> current engine reality (V1/V2/V3), every observer/heartbeat that runs, where
> data flows, and the target role-based model we are migrating to.
>
> **Status:** current state = shipped. Target state = planned (see
> [PRD_ENGINE_REFACTOR.md](./PRD_ENGINE_REFACTOR.md)).
> **Last verified:** 2026-06-26 against `src/engines/`, `src/v2/`, `entrypoints/`.

---

## TL;DR

| | Today (V1/V2/V3) | Target (roles) |
|---|---|---|
| **Mental model** | 3 versioned engines, each a partial monolith | 4 role modules + a bus |
| **V1** | legacy **detect + render** monolith | becomes `LegacyRenderStrategy` inside RenderEngine |
| **V2** | **detect + compute + render(off) + repair** | splits into DetectEngine + ComputeEngine + HardenEngine |
| **V3** | V2 + Classroom API (dead — no OAuth) | `ApiDetectStrategy` inside DetectEngine (OAuth-gated) |
| **Comms** | none — V1 & V2 run in parallel, never talk | typed pub/sub `EventBus` |
| **Observers** | 8+ concurrent (see below) | 1 (DetectEngine) |
| **Heartbeats** | 4 setInterval timers | 0 (event-driven) |

---

## Part 1 — Current reality

### 1.1 The three engines

All three implement the same `CQDEngine` interface (`src/engines/types.ts`):
`init() / destroy() / handleMutations() / fullScan() / getTrackedPosts() /
getPlacementDecisions() / getFlagDecisions() / getDecisionTrace()`.

| Engine | File | Mode(s) active | Role today | Renders? |
|---|---|---|---|---|
| **V1** | `src/engines/v1/engine-v1.ts` | `legacy`, `shadow` | thin wrapper over the **legacy content scripts** which do their own detect **and** render | **Yes** (via legacy scripts) |
| **V2** | `src/engines/v2/engine-v2.ts` | `shadow`, `v2` | unified **detect + compute + repair**; render code exists but is **commented out** | **No** (detection-only) |
| **V3** | `src/engines/v3/engine-v3.ts` | `v3` | extends V2 + Classroom **API** discovery | No (delegates to V2) |

**Mode → engine mapping** (`src/engines/engine-registry.ts`):

```
legacy → [V1]            business as usual
shadow → [V1, V2]        V1 renders, V2 runs silently for comparison  ← DEFAULT shipped
v2     → [V2]            V2 would render (render code is OFF, so nothing shows)
v3     → [V3]            V2 + API
```

> ⚠️ **Default shipped mode is `shadow`** (`src/v2/orchestrator/mode-controller.ts`
> `DEFAULT_MODE = 'shadow'`). So in production **both V1 and V2 run at once.**

### 1.2 The critical gap: V1 and V2 never talk

- V2 computes `FlagDecision[]` and `PlacementDecision[]` every scan.
- V1 renders buttons/badges **independently**, ignoring V2 entirely.
- The only link is `ShadowComparator` (`src/v2/compat/shadow-compare.ts`) which
  **diffs** them on a 10s timer and logs mismatches. It is a measuring tape,
  **not** a wire. V2's decisions drive nothing.

This is why "make V2 take action" is not a small change — there is no bridge to
extend. The bridge must be built (the EventBus seam).

### 1.3 Detection is duplicated 2–3×

The same work runs in multiple places simultaneously in `shadow` mode:

| Concern | V1 location | V2 location |
|---|---|---|
| Comment detection | `entrypoints/content/smart-detector-comments.ts` | `src/v2/decision/flag-scoring.ts` (`scoreComments`) |
| Edited detection | `entrypoints/content/smart-detector.ts` | `src/v2/decision/flag-scoring.ts` (`scoreEdited`) |
| File/anchor finding | `entrypoints/content/observers.ts` + `url-utils.ts` | `src/v2/model/dom-scanner.ts` + `selectors/` |
| Post-card finding | `entrypoints/content/post-card-utils.ts` | `src/v2/model/dom-scanner.ts` |
| Route/tab classify | `entrypoints/content/tab-detector.ts` | `src/v2/context/route-classifier.ts` |

### 1.4 Everything that ticks (the performance cost)

Steady-state on **one** Classroom page, all features on, `shadow` mode:

**MutationObservers**
| Observer | File | Watches |
|---|---|---|
| comment `domObserver` | `comment_frame.content.ts` | body, childList+subtree+attr `style` |
| comment `urlObserver` | `comment_frame.content.ts` | document (SPA nav) |
| edited `domObserver` | `edited_frame.content.ts` | body, attr `aria-label,title,style` |
| edited `urlObserver` | `edited_frame.content.ts` | document (SPA nav) |
| download-button observer | `entrypoints/content/observers.ts` | body, attr `class,style,data-cqd-processed` |
| download-all `globalObserver` | `download_all.content.ts` | body, attr `class,aria-expanded` |
| download-all `syncObserver` ×N | `download_all.content.ts` | **one per Download-All button** |
| download-all visibility ×N | `download_all.content.ts` | **one per button** (accordion) |
| V2 orchestrator observer | `src/v2/orchestrator/orchestrator.ts` | body, filtered attrs (feeds V2) |
| V2 `waitForContentReady` | `src/engines/v2/engine-v2.ts` | body (transient, until first post) |

→ **~5 page-wide + 2×N per-button + 1 V2 = 8+ observers.** Each post card is
scanned by 3 independent scanners on every mutation.

**setInterval heartbeats**
| Interval | File | Period |
|---|---|---|
| comment heartbeat | `comment_frame.content.ts` | 2500 ms |
| edited heartbeat | `edited_frame.content.ts` | 2500 ms |
| download-button rescan | `entrypoints/content/observers.ts` (`RESCAN_INTERVAL_MS`) | 2000 ms |
| download-all refresh | `download_all.content.ts` | 4000 ms |

(Drive-page-only: `drive_bypass` 300 ms tick, `drive_bypass_register` 1000 ms —
these run on `drive.google.com` tabs, not Classroom.)

### 1.5 Data flow today

```
                    ┌─────────────── LEGACY (V1) ───────────────┐
  Classroom DOM ──► comment_frame  ─► detect ─► render badge     │ ─► user sees
                ──► edited_frame   ─► detect ─► render badge     │    V1 output
                ──► observers.ts   ─► detect ─► render button    │
                ──► download_all   ─► group  ─► render "all" btn │
                    └────────────────────────────────────────────┘
                    ┌─────────────── V2 (shadow) ────────────────┐
                ──► orchestrator ─► dom-scanner ─► flag-scoring   │ ─► decisions
                                   ─► file-placement ─► repair    │    (rendered:
                                   (render OFF)                   │     nothing)
                    └────────────────────────────────────────────┘
                              │
                    ShadowComparator (10s) ─► diff V1 DOM vs V2 model ─► console
```

### 1.6 V2 internals (the reusable parts)

`src/v2/` is already well-factored — these become the role modules:

| Folder | Does | Becomes |
|---|---|---|
| `model/dom-scanner.ts`, `selectors/` | find posts/files (pure read) | **DetectEngine** |
| `context/route-classifier.ts` | URL → ViewKind, SPA watch | **DetectEngine** |
| `decision/flag-scoring.ts`, `file-placement.ts`, `exclusion-engine.ts`, `placement-recipes.ts`, `keyword-loader.ts` | scoring + placement (pure compute) | **ComputeEngine** |
| `render/*` | button/flag injection (DOM writers, currently dormant) | **RenderEngine** (alt strategy) |
| `repair/deep-validator.ts`, `correction-queue.ts` | idle self-heal | **HardenEngine** |
| `telemetry/performance-monitor.ts`, `budget-controller.ts` | metrics + throttle | **HardenEngine** |
| `compat/shadow-compare.ts`, `readiness-gate.ts`, `launch-controller.ts` | migration safety | stays as migration tooling |
| `orchestrator/orchestrator.ts`, `mode-controller.ts` | lifecycle + mode | **Orchestrator** (keeps role) |

### 1.7 V3 / Classroom API — why it's dead

The API layer (`src/engines/v3/api/`) is **fully coded**:
`token-provider.ts → classroom-api-client.ts → discovery-service.ts → cache.ts`,
published to the page via `runtime-bridge.ts` and consumed by
`src/student_work/resolver.ts`.

But `wxt.config.ts` has **no `oauth2` block, no `identity` permission, no
`classroom.*` scope**. So `ChromeIdentityTokenProvider.getAccessToken()` returns
null → API returns `[]` → it silently degrades to the DOM/iframe path. V3 is
architecturally complete but **non-functional** until OAuth is set up.

### 1.8 Background (download engine) — cross-browser split

`entrypoints/background/` is separate from the detection engines and stays as-is.
Key divergence to remember:

| | Chrome / Edge (MV3) | Firefox (MV2) |
|---|---|---|
| Filename intercept | `downloads.onDeterminingFilename` | `downloads.onCreated` (no rename) |
| Drive download | native first, bypass tab on HTML/403 | **always** bypass tab |
| 403 handling | rotate authuser 0–9 | error + cleanup (no retry) |
| Icon API | `chrome.action` | `chrome.browserAction` |
| file:// cleanup | n/a | auto-close tab |

Pending-download state: `pendingByRequestId / pendingByDownloadId / pendingByUrl
/ pendingByBypassTabId` in `background/state.ts`; swept every 5 min by
`cleanupOrphanedPendingDownloads` (TTL 10 min).

---

## Part 2 — Target model (roles + bus)

### 2.1 Four roles, one bus

```
                          ┌──────────────── EventBus ────────────────┐
                          │  typed pub/sub, synchronous dispatch       │
                          └────────────────────────────────────────────┘
   route:changed ▲  post:scanned ▲   decision:* ▲   render:applied ▲  correction:needed ▲
                 │               │              │                 │                      │
   ┌─────────────┴───┐  ┌────────┴────────┐  ┌──┴──────────┐  ┌───┴──────────┐
   │  DetectEngine   │  │  ComputeEngine  │  │ RenderEngine │  │ HardenEngine │
   │  (the eyes)     │  │  (the brain)    │  │ (the hands)  │  │ (the immune  │
   │                 │  │                 │  │              │  │  system)     │
   │ strategies:     │  │ flag-scoring    │  │ strategies:  │  │ validate     │
   │  • Dom          │  │ file-placement  │  │  • Legacy(V1)│  │ repair       │
   │  • Api (v3)     │  │ exclusion       │  │  • V2        │  │ budget+perf  │
   └─────────────────┘  └─────────────────┘  └──────────────┘  └──────────────┘
        publishes            publishes            subscribes        subscribes
     post:scanned        decision:flags        decision:*          ALL
     file:discovered     decision:placement    correction:needed   publishes
     route:changed                             → writes DOM        correction:needed
```

**Rule:** modules import only `bus` + shared `contracts/types`. **Zero
module↔module imports.** Swapping a strategy (new detector source, new renderer)
touches nothing else.

### 2.2 Role contracts (the seam)

```ts
// contracts/types.ts — the shared vocabulary (no logic)
interface Detector  { init(view, signal): Promise<void>; scan(): void; destroy(): void; }
interface Computer  { decide(posts: PostNode[]): { flags: FlagDecision[]; placements: PlacementDecision[] }; }
interface Renderer  { apply(d: RenderInstruction): void; remove(id: string): void; clear(): void; }
interface Hardener  { observe(ev: BusEvent): void; /* idle validate + repair + govern */ }

// bus/event-bus.ts — the wire
type Topic =
  | 'route:changed'      // DetectEngine → all
  | 'post:scanned'       // DetectEngine → Compute, Harden
  | 'file:discovered'    // DetectEngine → Compute, Harden
  | 'decision:flags'     // ComputeEngine → Render, Harden
  | 'decision:placement' // ComputeEngine → Render, Harden
  | 'render:applied'     // RenderEngine → Harden
  | 'correction:needed'  // HardenEngine → Render
  | 'budget:throttle';   // HardenEngine → Detect (slow down)
```

### 2.3 Settings toggle (what the user flips)

Popup setting **Engine Mode**, persisted to `chrome.storage.local.cqdV2Mode`
(existing key — `mode-controller.ts`):

| UI label | Mode | Wiring |
|---|---|---|
| **Legacy** | `legacy` | V1 monolith only. Guaranteed-good rollback. |
| **New** (default after validation) | `v2` | Detect(Dom) → Compute → Render(**Legacy strategy**) → Harden, all on bus. V1 detector stripped. |
| **API** (experimental, hidden until OAuth) | `v3` | same, Detect adds `Api` strategy. |

The keeper renderer is **LegacyRenderStrategy** — it wraps V1's proven DOM
injection functions (`injectButtonIntoAttachment`, `createCommentBadge`,
`createEditedBadge`, `upgradeCombinedBadge`, `ensureDownloadAllButton`). V2's
dormant render code becomes an alternate `V2RenderStrategy` (kept, not deleted).

### 2.4 Why this hits the six goals

| Goal | How |
|---|---|
| **Detection** | one brain (ComputeEngine), no duplicate/racing scanners; exclusion engine cuts false positives |
| **Performance** | 8+ observers → 1; 4 heartbeats → 0 (event-driven); idle budget enforced by HardenEngine; `handleMutations` p95 < 6 ms |
| **Activity** | the bus is the bridge that finally makes computed decisions *act* (render) |
| **Comms** | typed events, documented topic contract, zero hidden coupling |
| **Availability** | `browserApi` shim + idle fallback → same behavior Chrome/Firefox/Edge × Win/Mac/Linux; toggle = instant rollback |
| **Scalability** | add a strategy behind a contract without touching peers |

---

## Part 3 — Quick reference

### "Where do I look when…"

| Symptom | File(s) |
|---|---|
| Button missing on a file | Detect: `model/dom-scanner.ts`, `selectors/` → Compute: `decision/file-placement.ts` → Render: `entrypoints/content/button-factory.ts` |
| Wrong/missing comment badge | `decision/flag-scoring.ts` (`scoreComments`) + `decision/exclusion-engine.ts` |
| Wrong "edited" badge | `decision/flag-scoring.ts` (`scoreEdited`) |
| Download fails / Drive 403 | `background/download-handler.ts`, `entrypoints/drive_bypass.content.ts` |
| Firefox-only download issue | `background/index.ts` (`onCreated` path), `download-handler.ts` (`IS_FIREFOX`) |
| Mode won't switch | `src/v2/orchestrator/mode-controller.ts`, `engine-registry.ts` |
| Student-work file won't resolve | `src/student_work/resolver.ts`, `engines/v3/api/` |
| Perf regression | `telemetry/budget-controller.ts`, `performance-monitor.ts` |

### Debug panel

`Ctrl+Shift+D` toggles the in-page panel (`src/v2/debug/debug-panel.ts`) — shows
active engine, mode, flag decisions, shadow report, perf summary.

### Glossary

- **ViewKind** — one of 8 Classroom page types (`src/engines/types.ts`). Each has
  different DOM, so detection/placement vary by ViewKind.
- **Decision** — a `FlagDecision` or `PlacementDecision`: pure data describing
  *what* to render, separate from the act of rendering.
- **DecisionTrace** — full audit trail of why a decision was made (for debugging).
- **Shadow mode** — V1 renders, V2 computes silently, comparator diffs them.
- **Strategy** — a swappable implementation behind a role contract (e.g. Dom vs
  Api detector, Legacy vs V2 renderer).

---

## Detection seam (2026-08-18)

Detection is split into three layers with strictly one-directional flow:

    Detect  ->  Decide  ->  Render

**Detect** (`src/detect/`) answers "what is physically on this page?" and emits
a `PostObservation` of semantic facts — "has a comment indicator, count 3", not
"this element contains the string 'تعليقات'". `KeywordDetector` is the only
detector today; it owns page-language detection, the keyword preload, the
`pageLang + en + ar` union, and the text-based exclusion pass. Raw matched text
never leaves it except in the optional debug field.

**Decide** (`src/decide/`) turns a `PostObservation` into a `PostDecision`
using score thresholds alone. It takes no language argument and can see no page
text, so it cannot have a language bug. `decideFlags()` never branches on which
detector produced the observation.

**Render** consumes a `PostDecision` plus a `Theme`. It never re-inspects the
page to decide anything. Not yet wired — Render still reads `FlagDecision`.

Contracts live in `src/contracts/`. `Detector` also carries an optional
`reset()` lifecycle hook so orchestration can free per-page state without
knowing what is being freed — `EngineV2.destroy()` uses it instead of reaching
for the keyword cache directly.

### The one-way rule

`tests/contracts/import-boundary.test.ts` fails the build if a file outside the
keyword layer imports a keyword or language module. The keyword layer is
`src/detect/keyword/` plus the two legacy modules it wraps
(`v2/decision/keyword-loader.ts`, `v2/decision/exclusion-engine.ts`), which are
keyword-layer code that has not physically moved yet.

### What is deliberately unchanged

`entrypoints/content/smart-detector.ts` and `smart-detector-comments.ts` are the
V1 production path. They keep their own keyword unions and are untouched; those
unions become dead code when the V2 path is promoted (PRD Phase 4), not before.

`src/v2/decision/flag-scoring.ts` still exports `scoreFlagsForPost`,
`scoreComments`, `scoreEdited` and `getThresholds` with unchanged signatures. It
is now a ~95-line adapter over Detect -> Decide; its callers cannot tell the
difference. Behaviour is locked by
`tests/characterization/flag-scoring-baseline.json`.

### Compare-mode themes

`src/contracts/theme.ts` holds two palettes, `KEYWORD_THEME` and
`STRUCTURAL_THEME`, for the planned dual-render compare mode. The structural
secondary is **nile green** (`#1a7f5a`), not nile blue — blue would collide with
the structural tertiary and make disagreement unreadable at 50% opacity.
`tests/contracts/theme.test.ts` enforces that no two roles share a colour.
Nothing consumes these yet.

Design: `docs/superpowers/specs/2026-08-16-detection-engine-seam-design.md`
Plan: `docs/superpowers/plans/2026-08-18-detection-engine-seam.md`
