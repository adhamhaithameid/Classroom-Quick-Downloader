# Engine V4 S10 — Strip the V1 Detector (Gate G3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the default (v2-mode) Classroom page: exactly ONE MutationObserver, ZERO setInterval heartbeats, one detection pass per card. V1's self-starting scripts become mode-aware (inert in v2, full behavior in legacy — the one-click rollback survives). Redundant V1 heartbeats are deleted outright (their observers+scroll coverage already make them redundant in legacy too).

**Architecture:** `src/adapters/dom/mutation-observer-dom-port.ts` becomes the page's single real MutationObserver with N multiplexed callback subscriptions (each subscription carries its own init; the multiplexer observes the union). All Classroom-page observers subscribe through DomPort. Mode gating: V1 entrypoints read `cqdV2Mode` at startup + `storage.onChanged` and skip/start their scan stacks. Default mode flips to `'v2'` (G2 parity evidence = C1 exact per the recorded epic ruling).

**Tech Stack:** TypeScript, Vitest (jsdom + fake timers), Playwright qa-chromium probe.

**Spec:** `extension/docs/ENGINE_V4_SYSTEM_DESIGN.md` §4 (DetectEngine owns the only observer), `docs/ENGINE_V4_MASTER_PLAN.md` §6 S10 row + §5 G3 row; bead `Classroom-Quick-Downloader-1yf.10`; compression ruling (2026-09-13): Engine Mode toggle is the rollback, no release pause.

## Global Constraints

- Fitness suite green throughout; new rules added TDD-first.
- C1 accuracy gate + goldens + full unit suite green before close (behavior changes are declared: the mode-gating of V1 scripts in v2 mode is a DECLARED behavior change covered by new tests; legacy-mode behavior unchanged).
- Never touch: website/*, cloudflare-worker/*, wxt.config homepage_url, root package.json verify:contract. The parallel session may interleave commits — pathspec-limited commits only, ≤100-char headers, Write/Edit tools, no pushes.
- Out of scope (documented rulings): drive.google.com intervals (different surface), resolver-bridge 250ms bounded one-shot poll (self-terminating, allFrames), background worker cleanup interval (not a page), debug-panel refresh timer (debug-only UI), ShadowComparator interval (mode-gated informational per S6 ruling).

## File Structure

- Modify: `extension/src/adapters/dom/mutation-observer-dom-port.ts` (multiplexer)
- Modify: `extension/src/v2/orchestrator/orchestrator.ts`, `extension/src/v2/context/route-classifier.ts`, `extension/src/engines/v2/engine-v2.ts` (DomPort migration; engine-v2 transient observer only)
- Modify: `extension/entrypoints/content/observers.ts`, `comment_frame.content.ts`, `edited_frame.content.ts`, `download_all.content.ts`, `student_work_by_status.content.ts`, `student_work_sidecar.content.ts` (DomPort migration + heartbeat deletion + mode gate)
- Modify: `extension/src/v2/orchestrator/mode-controller.ts` (DEFAULT_MODE flip)
- Modify: `extension/src/v2/context/route-classifier.ts` (title observer via DomPort)
- Delete: `extension/src/download-all/index.ts`, `extension/src/v2/model` dead export `watchThemeChanges` (in `entrypoints/content/theme.ts` — dead factory), `extension/entrypoints/content/translations/detection-keywords.ts` (stale duplicate, zero importers)
- Tests: extend `extension/tests/contracts/ports-conformance.test.ts`; new `extension/tests/v4-single-observer.test.ts`; adjust pinned heartbeat tests (declared); new qa probe check in `tests/e2e/qa/qa-01-buttons.spec.ts` or a new `qa-08-single-observer.spec.ts`.

---

### Task 1: DomPort multiplexer — one real observer, N subscriptions

**Files:** Modify `extension/src/adapters/dom/mutation-observer-dom-port.ts`; Test `extension/tests/contracts/ports-conformance.test.ts` (extend) + new `extension/tests/v4-single-observer.test.ts`

**Interfaces:** Keep the existing `DomPort` contract (`observe(options, callback): Unsubscribe`). Implementation change: ONE real `MutationObserver` per DomPort instance, created lazily on first `observe()`; each call registers `{options, callback}`; on any mutation batch the multiplexer invokes each callback whose registered options match the batch (per-subscription filtering: childList vs attributes + attributeFilter intersection — a subscription with `attributes: true, attributeFilter: ['class']` receives only batches containing class-attribute records; a childList subscription receives childList records). `disconnect()` semantics: the port is per-page-lifetime (orchestrator owns it) — provide `dispose()` for the owner; individual unsubscribes never disconnect the shared observer while subscriptions remain.

- [ ] **Step 1 (RED):** v4-single-observer.test.ts: (a) two subscriptions with different inits → exactly ONE `new MutationObserver` (spy on global); (b) attribute-filtered subscription does not receive childList-only batches and vice versa; (c) unsubscribe removes only that callback; (d) last unsubscribe leaves observer disconnected; re-observe revives it.
- [ ] **Step 2: RED run** (`cd extension && npx vitest run tests/v4-single-observer.test.ts tests/contracts/ports-conformance.test.ts`) — conformance tests must keep passing (they pin the DomPort contract).
- [ ] **Step 3 (GREEN):** implement the multiplexer.
- [ ] **Step 4: GREEN + fitness green.**
- [ ] **Step 5: Commit:** `feat(engine): dom port multiplexes subscriptions over one observer (S10)`

### Task 2: v2 stack onto DomPort — orchestrator, RouteWatcher, engine-v2 transient

**Files:** Modify `orchestrator.ts` (setupDomObserver → subscribe via a DomPort instance the orchestrator owns), `route-classifier.ts` (title observer → DomPort subscribe, same options), `engine-v2.ts` (waitForContentReady transient observer → DomPort subscribe with auto-unsubscribe on ready/timeout), Test `tests/v4-single-observer.test.ts` (append) + keep `tests/v2-engines.test.ts` green (declared edits ONLY if a test asserts observer construction directly — record each).

**Interfaces:** Orchestrator constructs `new MutationObserverDomPort()` per page (in `handleViewChange`), passes it to engines that need transient observation (engine-v2 via init or a setter — choose the smallest additive seam; if wiring engine-v2 is too invasive, alternative: engine-v2 keeps its transient observer but the qa probe counts observers AFTER page settle when it's gone — RULE AGAINST: the gate says exactly 1; wire it).

- [ ] RED: orchestrator test — driving handleViewChange creates exactly one real MutationObserver for domObserver+title+content-ready combined (global spy); GREEN: migrate. Behavioral parity: same callback payloads, same filter unions.
- [ ] Full v2 test files green (`v2-engines`, `v4-orchestrator`, `v4-single-observer`, fitness).
- [ ] Commit: `feat(engine): v2 stack observes through the shared dom port (S10)`

### Task 3: V1 entrypoints — DomPort migration + heartbeat deletion + bounded settle scans

**Files:** Modify `observers.ts` (button observer → DomPort; DELETE the 2000ms rescan interval at :258), `comment_frame.content.ts` (domObserver+urlObserver → DomPort; DELETE 2500ms heartbeat :167; keep/add one bounded `setTimeout(scan, 1500)` post-start settle scan), `edited_frame.content.ts` (same pattern :138/:161/:155), `download_all.content.ts` (globalObserver → DomPort; DELETE 4000ms interval :161; the per-button syncObserver :821 and per-post accordion :967 → attribute-matched subscriptions on the shared port via event-delegation predicates), `student_work_by_status.content.ts` (:682 observer → DomPort; DELETE 2000ms :709), `student_work_sidecar.content.ts` (:399 → DomPort; DELETE 2000ms :426).

**Interfaces:** Each entrypoint constructs (or receives) the page DomPort. Since entrypoints are separate content-script worlds in the SAME page, "one observer per page" requires a shared instance: export a module-level `getPageDomPort()` singleton from the adapter (content scripts in the same JS world share module registry per WXT bundling — verify: all these scripts are separate entries; if separate module registries, the singleton must live on `window.__cqdDomPort`). Pin the chosen mechanism in a test.

- [ ] RED per file: fake-timer test proving scans fire on mutations and NOT on timer advance alone (heartbeat deleted). Existing tests pinning heartbeats: EDIT ONLY the interval-related assertions, list every edit in the report (declared behavior change).
- [ ] Per-button/per-post observer replacement: one shared-port subscription whose callback filters mutations to `class`/`aria-expanded` attribute changes on button/post elements, dispatching to the same handlers (behavior parity: existing download-all tests green).
- [ ] Full suite green. Commit: `feat(engine): v1 entrypoints observe via dom port, heartbeats deleted (S10)`

### Task 4: Mode gate + default flip

**Files:** Modify `mode-controller.ts` (`DEFAULT_MODE = 'v2'`), V1 entrypoints (startup mode gate: read `cqdV2Mode`; if `'v2'` → skip starting the scan stack, subscribe to storage changes to hot start/stop), Tests: `tests/v2-mode-controller.test.ts` (default flips — DECLARED edit), new gate tests.

**Interfaces:** `subscribeToGlobalState` gains a mode predicate (small additive helper in `entrypoints/content/state.ts` or a new `entrypoints/content/mode-gate.ts`): `onEngineModeChange(cb: (mode) => void)` reading storage + `storage.onChanged`. V1 scripts start only when mode !== 'v2'. Legacy behavior unchanged when mode is legacy/shadow.

- [ ] RED: default mode test expects 'v2'; gate test: v2 → V1 observers/heartbeats absent; legacy → present; live flip v2→legacy starts V1 stack.
- [ ] Declared: accuracy corpus unaffected (detection is V2 in v2 mode); run `test:accuracy` to prove C1 green.
- [ ] Commit: `feat(engine): default engine mode v2, v1 scripts mode-gated (S10)`

### Task 5: Dead code + fitness bans + runtime probe

**Files:** Delete `extension/src/download-all/index.ts`, `extension/entrypoints/content/theme.ts` `watchThemeChanges` (function only — file keeps `isPageDark` if used), `extension/entrypoints/content/translations/detection-keywords.ts`; Modify `engine-layers.test.ts` (ban `new MutationObserver` outside the DomPort adapter in src/** + entrypoints/**, with the adapter as the sole allowlist; ban classroom-heartbeat `setInterval` in the six entrypoints); New `tests/e2e/qa/qa-08-single-observer.spec.ts`: on the simulator page in default mode, inject a counter (`const orig = MutationObserver; window.__moCount = 0; ... class CountingMO extends orig { constructor(...a){ super(...a); window.__moCount++; } }` via addInitScript BEFORE the extension loads? — extension runs in isolated world; instead assert via the page's performance: count via `MutationObserver` subclass in the MAIN world won't see the extension's isolated-world observers. ALTERNATIVE honest probe: the extension exposes `window.__CQD_DEBUG_OBSERVER_COUNT` (additive debug export from the DomPort singleton) asserted by the qa check in v2 mode == 1 after settle.)

- [ ] Fitness RED→GREEN; dead-code deletions compile + suite green (grep proves zero importers first).
- [ ] qa-08 probe green on qa-chromium; full qa suite green.
- [ ] Commit: `feat(engine): s10 dead code, fitness bans, single-observer probe`

### Task 6: Closeout

- [ ] Full verification: compile, full unit suite, goldens, accuracy, qa-chromium (zero HARNESS skips).
- [ ] Docs: ENGINE_TASK_LIST S10 row Done; runbook note (qa-08 + default mode); ADR-0008/plan note that G3 met via DomPort multiplexer + mode gate; session log `docs/session-logs/2026-09-14-engine-v4-s10-strip-v1-detector.md`.
- [ ] `bd close 1yf.10` with evidence; gh #685 comment when epic closes.

## Self-Review

- G3 acceptance mapped: T1+T2+T3 = 1 observer; T3 = 0 heartbeats; T4 + engine-v2 single-pass = 1 detection pass per card (v2 mode already scans once per mutation cycle — assert in qa-08 that `data-cqd-processed` dedup leaves one pass; the design's "1 detection pass" is pinned by existing dedup tests + the probe).
- Rollback: legacy mode intact (T4 gate preserves it); default flip is one constant.
- Declared behavior changes listed per task; no silent test edits.
