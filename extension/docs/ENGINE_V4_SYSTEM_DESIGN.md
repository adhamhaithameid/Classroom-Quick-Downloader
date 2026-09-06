# Engine V4 — System Design

Version 1.0 · 2026-08-22 · Owner: Adham

**Relationship to existing docs.** This document does not replace
`PRD_ENGINE_REFACTOR.md` (the role+bus decision is locked and unchanged here) or
`ENGINE_ARCHITECTURE.md` (which describes today's reality). It is the *target
design*: it takes the locked four-role model and specifies the parts the PRD
left open — the layering inside a role, the download/acquisition path, the
naming path, the failure model, and the machinery that makes accuracy
measurable. Decisions introduced here are recorded in ADR-0007 and ADR-0008.

---

## 1. Design goals

| # | Goal | How it is checked |
|---|---|---|
| G1 | Detection is *measurable*, not just "looks right" | Accuracy corpus + CI gate (ADR-0008) |
| G2 | One reason to change per module | Architecture fitness tests; file size budget |
| G3 | Adding a language / view / browser edits no core code | New table or new adapter only; OCP test |
| G4 | Any strategy can be swapped without touching callers | Shared conformance suite per port |
| G5 | One MutationObserver, zero heartbeats | Runtime assertion test + perf budget |
| G6 | Every failure is either repaired or reported, never silent | Harden role + settled-event contract |
| G7 | Instant rollback | Engine Mode toggle, per-phase kill switch |

**Non-goals.** Rewriting the popup/options UI. Replacing WXT. Server-side
processing of student data. Supporting Classroom features CQD does not ship
today (grading, rubrics). Safari (disabled at `package.json` level today).

---

## 2. Process topology

CQD runs in three isolated JS contexts. The bus is *per-context*; contexts talk
over a single typed bridge, never ad-hoc `sendMessage` calls.

```
┌────────────────────── CONTENT SCRIPT (classroom.google.com) ───────────────────┐
│  Composition root: orchestrator.ts                                             │
│                                                                                │
│   DomAdapter ─┐                       ┌─ RenderEngine ──► DOM writes           │
│   ClockAdapter├─► [ PAGE BUS ] ◄──────┤─ DetectEngine ──► 1 MutationObserver   │
│   SchedAdapter┘        ▲              ├─ ComputeEngine (pure calls into core)  │
│                        │              └─ HardenEngine ──► repair + budget      │
│                        │                                                       │
│                   BridgePort  ◄── typed request/response, correlation ids ──┐  │
└────────────────────────┼────────────────────────────────────────────────────┼──┘
                         │                                                    │
┌────────────────────────▼─────── SERVICE WORKER (background) ────────────────┼──┐
│  Composition root: background/index.ts                                      │  │
│                                                                             │  │
│   BrowserAdapter ─► [ WORKER BUS ] ◄── AcquireEngine ──► chrome.downloads    │  │
│                            ▲                    │                           │  │
│                            │                    └──► BypassTabSupervisor ───┼──┘
│                     NamePolicy (core, pure)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                                     │
┌────────────────────────────────────────────────────▼──────────────────────────┐
│  BYPASS TAB (drive.google.com virus-scan interstitial)                         │
│  drive_bypass.content.ts — single job: report interstitial state, click through │
└────────────────────────────────────────────────────────────────────────────────┘
```

Why the bridge is a port and not raw messaging: today the download path uses
four separate correlation maps (`pendingByRequestId`, `pendingByDownloadId`,
`pendingByUrl`, `pendingByBypassTabId`) in `background/state.ts`, and the
`pendingByUrl` race (#664) came from exactly that. One correlation id, owned by
`BridgePort`, replaces all four as lookup *indexes* over one authoritative map.

---

## 3. Layering inside every role

```
        ┌─────────────────────────────────────────────┐
  IN    │  ADAPTER      real document / chrome.* /     │   impure, thin,
  ───►  │               fetch / Date / timers          │   no branching logic
        ├─────────────────────────────────────────────┤
        │  ROLE         subscribes to bus topics,      │   impure orchestration,
        │               calls core, publishes results  │   no rules of its own
        ├─────────────────────────────────────────────┤
  OUT   │  CORE         pure functions: score, decide, │   deterministic,
  ◄───  │               plan, name, validate           │   100% unit-testable
        └─────────────────────────────────────────────┘
```

Rule (ADR-0007): `src/core/**` may not name `document`, `window`, `chrome`,
`browser`, `fetch`, `Date.now`, `Math.random`, or any timer. Enforced by
`tests/architecture/no-globals-in-core.test.ts`.

This is the single most important structural change, because it is what turns
"is detection accurate?" from a question about a running browser into a question
about a pure function and a table of inputs.

---

## 4. Roles and the bus

Four roles stay as locked in the PRD. Two are added for the paths the PRD left
outside the model — acquisition (downloading) and naming (formatting):

| Role | Context | Owns | Never does |
|---|---|---|---|
| **DetectEngine** | page | the *only* MutationObserver, RouteWatcher, DOM reads | write DOM, decide anything |
| **ComputeEngine** | page | calls `core/decide`, `core/plan` | touch DOM at all |
| **RenderEngine** | page | the *only* DOM writer | read decisions from DOM |
| **HardenEngine** | page | drift repair, perf budget, throttle | make product decisions |
| **AcquireEngine** | worker | download attempts, auth rotation, bypass tabs | derive filenames |
| **NamePolicy** | core | filename derivation + sanitation (pure) | perform I/O |

### 4.1 Topic map (extends PRD §4.2 — additions marked `+`)

```ts
type PageTopicMap = {
  'route:changed':      { view: ViewKind; url: string };
  'post:scanned':       { posts: PostNode[] };
  'file:discovered':    { postId: string; files: FileNode[] };
  'decision:flags':     { decisions: FlagDecision[] };
  'decision:placement': { decisions: PlacementDecision[] };
  'render:applied':     { postId: string; kind: 'button' | 'flag' | 'all' };
  'correction:needed':  { item: CorrectionItem };
  'budget:throttle':    { level: ThrottleLevel };
+ 'download:requested': { requestId: RequestId; file: FileRef; nameHint: NameHint };
+ 'download:progress':  { requestId: RequestId; phase: AcquirePhase };
+ 'download:settled':   { requestId: RequestId; outcome: AcquireOutcome };
};

+ type WorkerTopicMap = {
+   'acquire:requested': { requestId: RequestId; file: FileRef; nameHint: NameHint };
+   'acquire:attempt':   { requestId: RequestId; strategy: AcquireStrategyName; authUser?: number };
+   'acquire:settled':   { requestId: RequestId; outcome: AcquireOutcome };
+   'name:resolved':     { requestId: RequestId; filename: string; source: NameSource };
+ };
```

Dispatch stays **synchronous** in-context (PRD §4.2). The bridge between the two
buses is the only asynchronous hop, and it is explicit:

```
page:  publish('download:requested') ──► BridgePort.request(requestId, …)
worker:                                  publish('acquire:requested')
worker: publish('acquire:settled')  ──► BridgePort.respond(requestId, …)
page:                                    publish('download:settled')
```

### 4.2 Invariant

Modules import **only** `bus` and `contracts/**`. Zero role↔role imports. Adding
`AcquireEngine` does not change one line of `RenderEngine`. This is the property
that makes the whole plan incremental instead of a big-bang rewrite.

---

## 5. Canonical data model

Identity is the foundation of accuracy — you cannot measure "did we flag the
right post?" without a stable id for the post.

```
ClassroomPage
 └── PostNode        id: postId  (data-stream-item-id, else content hash)
      ├── meta       viewKind, lang, hasDateRow
      ├── files[]    FileNode
      └── signals    CommentSignal | EditedSignal   (observed, not decided)

FileNode
  id: fileId         resolution chain, first hit wins:
                       1. data-drive-id
                       2. Drive URL /d/{id}/
                       3. data-id + item-id pair
                       4. sha1(normalizedUrl)            ← last resort only
  url, container, nameSources: RawNameSources
```

Two rules that come out of this model:

1. **A hash id is a *fallback*, never a default.** If a file resolves by hash,
   Harden records it; a rising hash-id rate is an early warning that Classroom
   changed its markup, days before users report anything.
2. **Observations carry no page text** outside `debug` — already enforced by
   `contracts/detection.ts` and `tests/contracts/import-boundary.test.ts`. Keep it.

---

## 6. Detection pipeline

```
 DOM ──DomAdapter──► PostNode[] ──► Detector[] ──► PostObservation[] ──► Decide ──► PostDecision[]
                                     ▲                                      ▲
                       keyword | structural | api                  pure, language-free
```

**Strategies (LSP):** `KeywordDetector`, `StructuralDetector` and the future
`ApiDetector` all satisfy `Detector` (`contracts/detection.ts`). Every one of
them is run against the same conformance suite, so "swap the strategy" is a
config change, not a code change.

**Combination policy is data, not code.** Which detector wins, and how their
strengths merge, lives in `core/decide/policy.ts` as a table:

```ts
// Example shape — the real table lands in Sprint 4.
type CombinePolicy = {
  order: DetectorName[];            // consult order
  shortCircuit: { detector: DetectorName; source: string; }[]; // e.g. keyword/dom-truth
  weights: Record<DetectorName, number>;
};
```

This is Open/Closed in practice: promoting the structural path (the open
question in SPRINT_PLAN.md) becomes editing one table plus re-running the
accuracy gate, not rewriting the engine.

**Known accuracy defects this pipeline must fix** (found in the 2026-08-22 deep
read; each becomes a corpus case before its fix):

| # | Defect | Site |
|---|---|---|
| D1 | Corrupted Armenian keywords (`'مېكdelays'`, `'խdelays'`) — Armenian detection is dead | `entrypoints/content/detection-keywords.ts:431,524` |
| D2 | `parseWordNumber` substring-matches `'un'` → any "un…" text parses as count 1 | numerals path |
| D3 | `ACTION_BUTTON_PATTERNS` duplicated in 3 modules → guaranteed drift | exclusion-engine / keyword-scoring / smart-detector-comments |
| D4 | Count ceilings inconsistent: `<1000` vs `<10000` vs `MAX_PLAUSIBLE_COUNT=100000` | scoring modules |
| D5 | L0 blind trust: any numeral inside `.huI6Cb` wins unconditionally | comment layer 0 |
| D6 | Substring FPs: `'comment'` ⊂ "commentary"; generic Arabic `'من الصف'` | keyword matching |
| D7 | No Arabic tashkeel folding in normalization | `detect/shared` normalization |
| D8 | Pure `'v2'` mode renders nothing, yet the popup offers it | `engine-registry.ts:164` |
| D9 | Docs claim default mode `'shadow'`; code says `'legacy'` | `mode-controller.ts:58,72` |

D3 and D4 are Single-Responsibility failures with a visible cost — the fix is
one owned table in `core/`, not three copies.

---

## 7. Acquisition pipeline (downloading)

Today's logic is correct in spirit but expressed as nested callbacks with
implicit state. The target expresses it as an explicit state machine in core,
driven by an impure runner.

```
        ┌──────────┐  validate (security gate)  ┌──────────┐
        │ REQUESTED├───────────────────────────►│ PLANNED  │
        └──────────┘        fail ──► BLOCKED    └────┬─────┘
                                                     │ next strategy
                     ┌───────────────────────────────┼───────────────────┐
                     ▼                               ▼                   ▼
              ┌────────────┐               ┌──────────────┐      ┌──────────────┐
              │  DIRECT    │               │ DRIVE_AUTH   │      │  BYPASS_TAB  │
              │ downloads. │               │ authuser 0..9│      │ interstitial │
              │ download() │               │  rotation    │      │  click-thru  │
              └─────┬──────┘               └──────┬───────┘      └──────┬───────┘
                    │  html-interstitial seen ────┘                     │
                    │  403 confirmed ─────────────────────────────────► │
                    ▼                                                   ▼
              ┌──────────────────────────── SETTLED ────────────────────────────┐
              │ outcome: 'saved' | 'blocked' | 'auth-exhausted' | 'browser-fail' │
              └─────────────────────────────────────────────────────────────────┘
```

`core/acquire/state-machine.ts` is a pure reducer:

```ts
export function nextAcquireState(
  state: AcquireState,
  event: AcquireEvent,
): { state: AcquireState; effects: AcquireEffect[] };
```

`AcquireEngine` performs `effects` through `BrowserPort` and feeds results back
as `event`s. Consequences that matter for the current bug list:

- The 10-attempt authuser rotation becomes a table-driven, unit-testable
  sequence instead of recursion through `startNextDriveAttempt`, so "#537
  downloads never work" turns into a reproducible transition trace.
- Firefox-family divergence (`IS_FIREFOX` branches, `onCreated` vs
  `onDeterminingFilename`) moves into two `BrowserPort` adapters. The state
  machine has no idea which browser it is on — which is the point.
- Every terminal state publishes `acquire:settled`. There is no path that ends
  in silence, which is goal G6.

---

## 8. Naming pipeline (formatting)

This path is currently 109 lines in `entrypoints/content/file-meta.ts` with an
English-only strip list — the direct cause of issue #541.

```
RawNameSources { tooltip? aria? title? textLines[] urlPath? mimeHint? driveMeta? }
        │
        ▼  core/name/derive.ts        pick highest-confidence source
CandidateName { stem, ext, source, confidence }
        │
        ▼  core/name/strip.ts         remove localized type labels
        │                             ← TypeLabelRegistry keyed by locale,
        │                               generated from _locales/ (#611, #612)
        ▼  core/name/sanitize.ts      NFC normalize, strip bidi controls,
        │                             replace OS-illegal chars, clamp length
        ▼  core/name/verify.ts        extension ⟷ mimeHint agreement check
FinalName
```

Three rules that fix the known class of bugs:

1. **Stripping is locale-driven, never a hardcoded English array.** "Compressed
   archive" and "Tömörített archívum" are the same fact in two locales; both come
   from the same generated registry.
2. **Stripping is anchored and evidence-backed.** A trailing label is removed
   only when it matches a *known type label for the resolved locale* **and** the
   remaining stem still carries a plausible extension or the `mimeHint` agrees.
   This protects a genuine file called `Design Document` from being mutilated —
   a false positive the current `endsWith` loop would happily commit.
3. **Sanitation is the same function in both processes.** The content script uses
   it for the button label and the worker uses it for
   `onDeterminingFilename`; being pure core, there is exactly one implementation
   and one test suite. Today those two paths can disagree.

---

## 9. Failure model

| Failure | Detected by | Response |
|---|---|---|
| Selector stopped matching | `SelectorScorer` reliability decrement | fall to next priority tier; emit `correction:needed`; raise hash-id-rate alarm |
| Button rendered then removed by Classroom | Harden deep-validate (orphan check) | re-render once; 3 strikes → stop, report |
| Duplicate button/flag on one card | Harden duplicate check | remove extras, keep first |
| Decision made, render never applied | missing `render:applied` within N frames | re-publish decision once |
| Download stuck (no terminal state) | `ClockPort` deadline in AcquireEngine | force `settled: 'timeout'`, surface to user |
| Engine throws during scan | role-level try/catch at bus boundary | isolate the role, keep others alive, `budget:throttle` |
| Instability (repair loop) | 3-strike breaker (exists in deep-validator) | disable repair for the page, log |

Principle: **a role may fail without taking the page down.** The bus boundary is
the fault boundary; every subscriber invocation is wrapped, so one bad detector
cannot stop rendering.

---

## 10. Accuracy instrumentation

Two tiers, because the expensive tier cannot be the only one (ADR-0008).

```
 TIER B (jsdom, slower, small N)          TIER A (pure, fast, large N)
 corpus/<case>/page.html                  corpus/<case>/observations.json
        │                                        │
        ▼ DomAdapter + Detector                  │
   PostObservation[]  ───── recorded ───────────►│
        │                                        ▼
        ▼                                    Decide (pure)
   compare vs expected.json                  compare vs expected.json
        │                                        │
        └────────────► metrics: coverage, precision, recall, exact-count ◄──┘
                                    │
                                    ▼
                       accuracy-budget.json  → CI gate
```

Tier A exists so decision-policy changes can be evaluated over hundreds of cases
in milliseconds. Tier B exists so DOM-level regressions are still caught. Tier B
runs record Tier A inputs, so the fast corpus grows for free.

---

## 11. SOLID mapping — concretely, in this codebase

| Principle | Violation today | Target |
|---|---|---|
| **S**RP | `flag-scoring.ts` was 1,013 lines mixing keyword tables, scoring, thresholds, DOM reads (already cut to 95 by the detect/decide seam — proof the split works) | one reason to change per module; file budget enforced by test |
| **S**RP | `file-meta.ts` mixes DOM extraction + label stripping + extension parsing | split into `adapters/dom/name-sources.ts` + `core/name/{derive,strip,sanitize,verify}.ts` |
| **O**CP | adding a language edits `detection-keywords.ts` *and* three pattern copies | add a locale table; core untouched. Adding a ViewKind adds a placement recipe |
| **L**SP | `Engine` implementations differ in whether they render (`v2` renders nothing — D8) — callers must know which one they hold | every strategy passes one shared conformance suite; a non-rendering render strategy is a test failure, not a surprise |
| **I**SP | `Engine` is a god interface (init/destroy/handleMutations/getDecisionTrace/…) | split into `Lifecycle`, `MutationSink`, `Traceable`; roles implement only what they use |
| **D**IP | `chrome.*` and `document` called from ~everywhere | roles depend on `BrowserPort` / `DomPort` / `ClockPort`; adapters are leaves |

Beyond SOLID, the two practices this design leans on hardest:

- **Determinism as a design constraint** — accuracy is unmeasurable without it.
- **Fitness functions** — architecture that is not enforced by a test decays.
  We already have one (`import-boundary.test.ts`); this design makes it a suite.

---

## 12. Target directory layout

```
extension/src/
  contracts/          types + port interfaces only. no logic, no imports out.
    detection.ts      (exists)
    ports.ts          + DomPort BrowserPort ClockPort SchedulerPort BridgePort
    topics.ts         + PageTopicMap, WorkerTopicMap
  bus/
    event-bus.ts      + typed sync pub/sub, per-context instance
  core/               PURE. no globals. the accuracy surface.
    detect/           scoring math, numerals, normalization
    decide/           thresholds, combine policy            (decide/ exists)
    plan/             placement recipes per ViewKind
    name/             derive / strip / sanitize / verify
    acquire/          download state machine
  adapters/           IMPURE leaves. one per port per platform.
    dom/  browser/  clock/  scheduler/  bridge/
  roles/
    detect-engine.ts  compute-engine.ts  render-engine.ts
    harden-engine.ts  acquire-engine.ts
  strategies/
    detect/  render/  acquire/
  orchestrator/       composition root (page)               (exists)
```

`src/v1`, `src/v2`, `src/v3` do not appear. Versions are **strategies**, not
layers — that is the locked decision from the PRD, made physical.

---

## 13. Coexistence during migration

Nothing above lands in one commit. The migration order (see
`docs/ENGINE_V4_MASTER_PLAN.md`) is deliberately "strangler-fig":

1. New code is added beside old code and is dead until wired.
2. The bus goes live carrying events nobody consumes (no behavior change).
3. Roles wrap existing implementations verbatim — the wrapped code is not
   rewritten in the same commit that moves it.
4. The bridge is activated behind the Engine Mode toggle, so rollback is a
   setting, not a release.
5. Old paths are deleted only after the accuracy gate proves parity.

The rule for every phase: **shippable and reversible on its own.**
