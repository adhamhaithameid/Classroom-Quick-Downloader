# V2 Rendered-Flag Pipeline: Map and Injection Seam for the API Corroboration Floor

Read-only codebase research, 2026-09-21. All citations are `file:line` into this
repo. The goal: find the minimal seam where the additive-only API corroboration
floor (currently debug-only) can enter V2's RENDERED flag decisions without
rewriting V2's semantics.

---

## 1. The V2 rendered-flag pipeline, stage by stage

The pipeline is exactly as the V3 header describes it (`extension/src/engines/v3/engine-v3.ts:29-37`):
`ingestPost → detectFlags → scoreFlagsForPost`, private and decision-shaped.
Concretely, per post:

**Stage 0 — scan dispatch.** `EngineV2.handleMutations` resolves touched post
cards and either escalates to `fullScan` or runs `targetedScan`
(`extension/src/engines/v2/engine-v2.ts:287-314`). `fullScan` loops the post
elements and calls `ingestPost` per post (`engine-v2.ts:579-586`);
`targetedScan` calls the same `ingestPost` per touched post
(`engine-v2.ts:447-449`) — the two scan paths share the per-post pipeline
verbatim (`engine-v2.ts:680-688`).

**Stage 1 — ingest.** `EngineV2.ingestPost(postEl)` resolves the post id
(`data-stream-item-id` or a random fallback, `engine-v2.ts:690-692`),
gets/creates the `PostNode` in `postMap` (`engine-v2.ts:695-707`), extracts
files (`engine-v2.ts:714`), and calls `detectFlags`, storing the result on
`post.flags` (`engine-v2.ts:717`).

**Stage 2 — decide (where comment strength finalizes).**
`EngineV2.detectFlags(postEl, postId)` (`engine-v2.ts:872-911`) calls
`scoreFlagsForPost(postEl, postId, this.currentView)` (`engine-v2.ts:876-880`)
and stores the returned `FlagDecision` into `this.flagDecisions` and its trace
into `this.decisionTraces` (`engine-v2.ts:882-883`). This store is the single
source of truth for everything rendered later.

`scoreFlagsForPost` itself (`extension/src/v2/decision/flag-scoring.ts:50-90`)
is a two-line observe-then-decide pipeline:

- `keywordDetector.observe(post, ctx)` produces a `PostObservation`
  (`flag-scoring.ts:56`) — the Detect half.
- `decideFlags(observation)` produces the verdict (`flag-scoring.ts:57`) —
  the Decide half (`extension/src/decide/decide-flags.ts:16-60`).

The comment strength finalizes in `decideFlags`: thresholds live in
`extension/src/decide/thresholds.ts:12-18` (`comment_show: 40`,
`edited_show: 35`); the verdict branches are `decide-flags.ts:20-32`; the
comment count is promoted only alongside its verdict (`decide-flags.ts:48-49`).
`scoreFlagsForPost` then assembles the decision-shaped `FlagDecision`
(commentScore, editedScore, commentCount, finalVerdict, confidence, trace —
`flag-scoring.ts:79-89`; the type is `extension/src/engines/types.ts:199-209`).

One pre-existing floor already lives inside the Detect half: the D12
DOM-internal corroboration floor in `KeywordDetector.observe`
(`extension/src/detect/keyword/keyword-detector.ts:102-110`) — a positive
parsed count whose keyword score died sub-threshold is floored to
`comment_show` **only when the independent edited channel cleared its own
threshold**. It is pinned by `extension/tests/detect/keyword-detector.test.ts:132`
(floors) and `:148` (does not floor without edited corroboration).

**Stage 3 — plan.** `fullScan` rebuilds `placementDecisions`
(`engine-v2.ts:598`); this stage is unrelated to badges.

**Stage 4 — render (where the badge is produced).**
`fullScan` calls `renderDetectedFlags()` then `renderPlacedButtons()`
(`engine-v2.ts:605-606`). `renderDetectedFlags` (`engine-v2.ts:923-939`) gates
on mode — it renders only when `engineRegistry.getMode()` is `'v2'` or
`'v3'`, and is a no-op in `legacy`/`shadow` (`engine-v2.ts:930-934`) — then
iterates `this.flagDecisions` into the per-post body `renderFlagForPost`
(`engine-v2.ts:936-938`), which calls `renderFlagBadge(decision, postNode.element)`
(`engine-v2.ts:945-953`). The targeted path mirrors this exactly:
`renderAffectedPosts` re-applies the same mode gate and reads the same
`flagDecisions` map (`engine-v2.ts:496-503`).

The actual markup lives in `extension/src/v2/render/flag-renderer.ts`:
`renderFlagBadge` (`flag-renderer.ts:56-99`) is idempotent (same kind + count →
no-op, `flag-renderer.ts:83-85`), strips artifacts on a `'none'` verdict
(`flag-renderer.ts:64-66`), and builds the V1-contract pills
(`buildCommentBadge` `:143-171`, `buildEditedBadge` `:173-196`, the
`both` overlay + combined badge `:199-260`). A per-post `lastDecisions`
WeakMap (`flag-renderer.ts:43`) backs the live popup toggle
(`applyFlagToggle`, `flag-renderer.ts:120-131`, wired in
`extension/entrypoints/v2_bootstrap.content.ts:126-130`).

**Important consequence for the seam:** because the renderer is a pure
function of the stored `FlagDecision`, and both scan paths render from the same
`flagDecisions` map, a floor applied anywhere *before* `flagDecisions.set`
(i.e., inside `detectFlags`) flows to rendered badges on both paths with zero
render-side changes. Conversely, anything applied *after* the store must
itself re-render or it will be silently overwritten by the next scan.

## 2. The contracts vs. the decision-shaped internals

`extension/src/contracts/detection.ts` defines the public detection seam:

- `Detector` — `observe(post, ctx): PostObservation` plus optional `reset()`
  (`contracts/detection.ts:98-110`).
- `PostObservation` — semantic facts only; raw text confined to the optional
  `debug` LayerTrace field, which Decide must not read
  (`contracts/detection.ts:68-83`, rule stated at `:11-13`).
- `DetectorName` includes `'api'` explicitly for the assist
  (`contracts/detection.ts:18-24`).
- `PostDecision` is what Decide emits (`contracts/detection.ts:86-95`).

`ApiDetector` (`extension/src/strategies/detect/api-detector.ts`) is a
decorator over a base `Detector`. Its `observe` runs the base observation,
then applies **the additive-only floor** (`api-detector.ts:141-166`): when the
DOM channel already has a real numeral (`present`, `count > 0`) whose strength
died sub-threshold (`strength > 0 && < comment_show`) and the cached snapshot
is usable (token + freshness + same route, `api-detector.ts:169-179`), the
strength is floored to `comment_show` (`api-detector.ts:151-159`). It never
invents (strength 0 stays 0), never lowers, never changes counts, and keeps
the base detector's finding — the API only corroborates
(`api-detector.ts:26-44`). Every firing lands an `'api-corroboration'`-named
LayerTrace in `debug` (`api-detector.ts:181-207`).

**The mismatch:** V2's pipeline is decision-shaped (`FlagDecision` in,
`FlagDecision` stored), while the API assist is observation-shaped
(`PostObservation` out). V2's `detectFlags` never handles a `PostObservation`
— that type is consumed inside `scoreFlagsForPost` and discarded. That is why
EngineV3 currently cannot feed it in, and instead runs a parallel
`ApiDetector.observe` pass whose results land only on the debug surface:
`EngineV3.apiCorroboration: Map<string, PostObservation>`
(`engine-v3.ts:107`), filled by `runApiCorroborationPass` after each
fullScan-driven snapshot refresh on student-work views
(`engine-v3.ts:156-163`, `237-244`), and read by
`getApiCorroborationTrace(postId)` (`engine-v3.ts:195-199`). The documented
follow-up — floor rendered decisions, additive-only — is stated in
`docs/engine/api-assist-setup.md:117-126`.

Note the floor already exists end-to-end inside `ApiDetector.observe`; what is
missing is only that no rendered decision ever passes through an
`ApiDetector`. `scoreFlagsForPost` hard-imports the bare `keywordDetector`
singleton (`flag-scoring.ts:26`, used at `:56`), so the chain is
`keywordDetector` only, in every mode.

## 3. What pins the badge markup — the regression surface

A rendered-flag change must not regress these (all verified to assert on flags,
badges, or the decision store):

Unit (vitest, `extension/tests/`):

- `v2-flag-renderer-contract.test.ts` — z57 S4, the qa-03 markup contract:
  one `.cqd-comment-badge.cqd-flag` with count + comment tooltip (`:57`),
  one `.cqd-edited-badge.cqd-flag` (`:70`), `both` = ONE overlay + ONE
  combined badge, golden rule 5 (`:78`), none strips artifacts (`:91`), dark
  class (`:100`), RTL `data-cqd-dir` (`:112`), live toggle re-render
  (`:123`, `:135`), V1-badge safety (`:146`).
- `v2-flag-renderer.test.ts` — renderer behavior/idempotence.
- `v2-flag-scoring.test.ts` — `scoreFlagsForPost` verdicts and trace shape
  (`:191-278`), threshold exposure (`:280-291`). This is also the file the
  `flag-scoring.ts` header names as a caller whose surface must not change
  (`flag-scoring.ts:12-14`).
- `decide/decide-flags.test.ts` — verdict arithmetic.
- `detect/keyword-detector.test.ts` — D12 floor cases (`:132`, `:148`).
- `strategies/api-detector.test.ts` — the additive-only floor contract:
  floors a real sub-threshold finding (`:129`), never invents (`:157`),
  never lowers/fabricates (`:171`), route/stale fallbacks verbatim
  (`:183`, `:199`), Detector conformance (`:246`).
- `v3-engine-api-corroboration.test.ts` — the current debug-only surface:
  privacy (token only on student-work views, `:119`), trace exposure after
  fullScan (`:134`), silent fallback on denied token (`:158`), destroy clears
  the surface (`:182`).
- `v2-engines.test.ts` — engine-level flag pins: `getFlagDecisions`
  (`:88`, `:227`), stored-decision rendering (`:147`, `:268-308`).
- `v2-engine-targeted-mutations.test.ts` — S11: targeted scan shares the
  per-post pipeline, spied via `detectFlags` (`:114`, `:168`, `:211`, `:270`).
- `v4-mode-gate.test.ts`, `v4-orchestrator.test.ts` — mode gating of
  rendering; the orchestrator hands out `getFlagDecisions()` results by
  verbatim reference (`v4-orchestrator.test.ts:304`).
- `contracts/import-boundary.test.ts` — Detect→Decide→Render one-way imports;
  `v2/decision/flag-scoring.ts` must stay keyword-free
  (`import-boundary.test.ts:8-17`).
- `architecture/engine-layers.test.ts` — `strategies/**` may not import the
  legacy v1/v2 stacks (rule 4, `engine-layers.test.ts:17-23`), which is why
  `ApiDetector` takes the snapshot shape structurally
  (`api-detector.ts:47-55`).

E2E (playwright, `tests/e2e/qa/`):

- `qa-03-flags.spec.ts` — live badge assertions on `.cqd-comment-badge`
  (`:98`, `:146`, `:165`); harness selector map pins the same class
  (`harness.ts:49`).

## 4. Injection options

Shared constraint first: the API snapshot is async (token + fetch) while
`detectFlags` is synchronous, so **no option can floor the init-scan badges**.
The first render on a student-work view is necessarily unfloored; the floor
can only land after the first successful `refreshApiSnapshot()`
(`engine-v3.ts:201-228`). Every option therefore also needs a cheap
post-refresh re-detect/re-render trigger; they differ in where the floor
arithmetic lives and what V2 must expose.

### Option A — post-processing hook after `scoreFlagsForPost`, before render

**Where:** a new optional field on `EngineV2`, mirroring the existing
additive `onCorrectionSeen?` hook (`engine-v2.ts:157-161`), e.g.
`decorateFlagDecision?: (decision, postEl, postId) => FlagDecision`, invoked
inside `detectFlags` between the `scoreFlagsForPost` call
(`engine-v2.ts:876-880`) and `flagDecisions.set` (`engine-v2.ts:882`).
`EngineV3` installs it in its constructor (`engine-v3.ts:109-117`).

**State needed:** the per-post API corroboration result. Two sub-shapes:
either the hook re-observes via `this.apiDetector.observe(...)` and re-runs
`decideFlags` + reassembles the `FlagDecision` (duplicating the assembly at
`flag-scoring.ts:56-89` unless that half is exported), or the hook consults
`EngineV3.apiCorroboration` (`engine-v3.ts:107`) — but that map is filled
*after* the scan, so the hook is empty exactly when it matters, forcing the
write-back variant: V3 recomputes decisions post-refresh and calls a new V2
method that updates `flagDecisions`, refreshes `decisionTraces`, and calls
`renderFlagForPost` (`engine-v2.ts:945-960`).

**Rewrite cost:** moderate — one optional hook plus one write-back seam
method on V2, plus decision reassembly logic in V3 (or an exported helper
from `flag-scoring.ts`).

**Regression risk:** medium-low. `flagDecisions.set` timing and the
decision-shaped surface stay intact; the risk concentrates in the
reassembly step (trace/duration fields must match `flag-scoring.ts:69-89`
or `v2-flag-scoring.test.ts:239-264`-style trace pins and the
`v4-orchestrator.test.ts:304` verbatim-reference pin can notice drift), and
in keeping `lastRenderApplied`/RenderEngine bookkeeping coherent when the
write-back re-renders outside a scan cycle.

**Mode v2 without V3:** hook field stays undefined → `detectFlags` behaves
byte-identically. No global state involved.

### Option B — extend the detect chain: V2's detection accepts an optional corroborating Detector

**Where:** `scoreFlagsForPost` gains an optional trailing `detector?: Detector`
parameter (default `keywordDetector`, `flag-scoring.ts:26,56`); `detectFlags`
passes an `EngineV2` instance field (e.g. `flagCorroborator`, default
undefined, `engine-v2.ts:872-880`); `EngineV3` assigns its already-constructed
`apiDetector` (`engine-v3.ts:103-117`) into `this.v2` once, in its
constructor. Post-refresh, V3 triggers one re-detect (a plain
`this.v2.fullScan()` after the refresh chain in `engine-v3.ts:156-163` — the
budget controller already bounds it, `engine-v2.ts:562-563` — or a narrower
flags-only re-pass over `getTrackedPosts()`).

**State needed:** none beyond what exists. `ApiDetector` already caches
token+snapshot (`api-detector.ts:98-99,114-129`); before the first refresh it
falls back verbatim (`api-detector.ts:141-144`), so early scans are unchanged
by construction. The floor arithmetic itself is the already-tested code at
`api-detector.ts:149-166`, and the resulting `PostObservation` flows through
the *existing* `decideFlags` verdict logic — the floor raises strength to
exactly `comment_show` (`api-detector.ts:158`), which flips the verdict via
the normal branch at `decide-flags.ts:28-29` and promotes the count via
`decide-flags.ts:48-49`. No new decision code is written anywhere.

**Rewrite cost:** lowest. One optional parameter, one optional field, one
assignment in V3, one post-refresh rescan trigger. `ApiDetector.observe`
internally calls the base keyword detector once (`api-detector.ts:142`), so
there is no double scoring. The `'api-corroboration'` trace rides along in
`observation.debug` (`api-detector.ts:162-165`) and lands in the
`DecisionTrace.layers` via `flag-scoring.ts:73` — DevTools explanations get
strictly better for free. `runApiCorroborationPass`/`getApiCorroborationTrace`
(`engine-v3.ts:237-244`, `:195-199`) can stay as-is for the debug surface and
its pins (`v3-engine-api-corroboration.test.ts`), or later be folded into the
new path.

**Regression risk:** lowest. Rendered markup path untouched
(`flag-renderer-contract.test.ts` pins hold by construction — only the
*decision* feeding it can change, and only upward for real-numeral posts).
Import boundaries hold: `flag-scoring.ts` may import the `Detector` *type*
from `contracts/detection.ts` (types are not in the forbidden list,
`import-boundary.test.ts:15-27`; `decide-flags.ts:13` already imports that
module), and runtime detection still enters through the keyword layer.
The `v2-flag-scoring.test.ts` caller is unaffected by an optional trailing
parameter (the header's "neither of them can tell the difference" promise,
`flag-scoring.ts:12-14`, survives). Main behavioral note: the S11 targeted
path and fullScan share `detectFlags`, so both get the floor consistently
with no extra work (`engine-v2.ts:680-688`).

**Mode v2 without V3:** a standalone `EngineV2` (mode `'v2'` registers only
`engine-v2`, `engine-registry.ts:175-176`) never has the field set → default
`keywordDetector`, byte-identical today. Mode `'v3'` on an unconfigured
install falls back to a plain V2 in the shadow pair
(`engine-registry.ts:189-192`), so no floor there either.

### Option C — publish the floor through the runtime-bridge/window snapshot pattern

**Where:** a new window key alongside
`__CQD_SW_API_SNAPSHOT_V1` (`extension/src/engines/v3/api/runtime-bridge.ts:22`),
published by `EngineV3` after each corroboration pass; `flag-scoring.ts` (or
`detectFlags`) reads it via `readPublishedStudentWorkApiSnapshot`-style
accessor (`runtime-bridge.ts:80-91`; the existing consumer pattern is
`extension/src/student_work/resolver.ts:246`) and applies the D12-shaped floor
before `decideFlags`.

**State needed:** a new published shape (the existing
`PublishedStudentWorkApiSnapshot` is attachment-oriented,
`runtime-bridge.ts:14-20` — it carries no verdict/channel facts), plus the
per-post linkage (post id ↔ courseWork), which the current bridge does not
model at all.

**Rewrite cost:** moderate-high in practice — new publish shape, new read
path in the decide/detect half, staleness and post-id binding logic.

**Regression risk:** medium. The floor logic would be duplicated outside
`ApiDetector` (whose additive-only contract is pinned at
`api-detector.test.ts:129-182`), so it needs its own pin suite. It couples
the decide half to ambient global state, which is harder to test in jsdom and
weaker as a guarantee. Structural leak: a key left live within its 120s age
bound (publish, `runtime-bridge.ts:71-77`; delete on destroy,
`runtime-bridge.ts:43-46` and `engine-v3.ts:144`) would in principle be
consulted by a later plain-v2 session on the same tab — mode `'v2'` would
then behave differently depending on tab history. This can be mitigated
(mode-scoped keys) but the pattern is inherently side-channel.

**Mode v2 without V3:** safe only as long as the key is always cleaned up
(destroy does publish null, `engine-v3.ts:144`); a crashed v3 session leaves
a bounded-lived residue. Weakest of the three on this axis.

### Recommendation: Option B

Inject the detector chain (optional `Detector` parameter into
`scoreFlagsForPost`, optional `flagCorroborator` field on `EngineV2`, assigned
by `EngineV3`, plus a post-refresh rescan). Reasons:

1. **Zero new decision logic.** The floor is the already-implemented,
   already-pinned additive-only code in `ApiDetector.observe`
   (`api-detector.ts:149-166`; pins `api-detector.test.ts:129-182`). Options
   A and C both re-implement or re-route it.
2. **Smallest V2 diff.** One optional field + passing it through
   `detectFlags` (`engine-v2.ts:872-880`); nothing downstream — store, render
   paths, S11 parity, orchestrator reference semantics — changes at all.
3. **Correct seam placement.** The floor is a *detection* enrichment; the
   Detect→Decide contract was built exactly for detector composition
   (`contracts/detection.ts:97-110`, `DetectorName: 'api'` at `:24`). The
   observation-shaped input stops being a mismatch because it enters at the
   observe step of `scoreFlagsForPost` (`flag-scoring.ts:56`) rather than
   being forced into the decision shape.
4. **Cleanest mode isolation.** Undefined field in every mode that is not
   v3-configured; no globals.

The residual caveat to document: first-scan badges on a student-work view
render unfloored (inherent to the async snapshot, shared by all options); the
post-refresh rescan upgrades them. Additive-only means badges can appear
late, never wrong — consistent with the corpus rule quoted in the keyword
detector's D12 comment (`keyword-detector.ts:82-101`).

## 5. Open questions

- **Post-refresh trigger shape:** a full `v2.fullScan()` after refresh
  (simple, budget-bounded, re-renders everything) vs. a narrower
  flags-only re-pass over tracked posts. The full scan is the
  lowest-code option; a flags-only pass would need a new small V2 method and
  must remember to also drive `renderFlagForPost` (render is not automatic
  outside the scan seams, `engine-v2.ts:605`, `:464`).
- **Fate of `runApiCorroborationPass`** (`engine-v3.ts:237-244`): keep as the
  debug-trace surface (its tests pin it, `v3-engine-api-corroboration.test.ts:134-197`)
  or fold into the rescan now that `observe` runs inline. Keeping it costs
  one extra keyword observe per post per cycle.
- **Non-student-work views:** the floor is scoped to student-work views by
  the v3 refresh guard (`engine-v3.ts:201-207`, `:238`); confirm no rendered
  surface elsewhere should ever see it (today it cannot).
- **Confidence semantics:** flooring strength to exactly `comment_show`
  (40) yields `confidence: 'medium'` via `decide-flags.ts:35-40`. If the
  product wants floored badges visually distinguished, that is a
  `FlagDecision`/render change — out of scope for additive-only.
- **`ApiDetector.reset()` wiring:** in V3 destroy it is called
  (`engine-v3.ts:140`), and the shared `keywordDetector` reset stays in V2
  (`engine-v2.ts:232`); with the chain injected, verify no path resets the
  base but not the wrapper mid-session (today only destroy/view-change
  resets, so this is likely fine).
