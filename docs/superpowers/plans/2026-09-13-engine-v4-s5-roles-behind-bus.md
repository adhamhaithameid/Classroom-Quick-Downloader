# Engine V4 S5 — Wrap Roles Behind the Bus — Implementation Plan

> **STATUS (2026-09-13): COMPLETE.** All seven tasks executed and reviewed via
> subagent-driven development; commits 29c1138d → 70319ea5; full verification
> green (3601 unit tests, golden suites, accuracy gate, tsc). Evidence and
> rulings: docs/session-logs/2026-09-13-engine-v4-s5-roles-behind-bus.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The four page roles (Detect/Compute/Render/Harden) wrap the existing engine implementations VERBATIM and the page EventBus carries every `PageTopicMap` topic — with zero behavior change (G0 suites prove it).

**Architecture:** Strangler-fig step 2–3 (ENGINE_V4_SYSTEM_DESIGN §13). The orchestrator owns a `createEventBus<PageTopicMap>()` instance. Four new role modules in `extension/src/roles/` delegate to the EXISTING engine state (getters that already exist) and publish bus topics after each scan cycle. Roles never implement detection/compute/render logic of their own; a rewrite here fails review (master plan R4). One additive change is allowed: a render-applied getter on EngineV2 (additive state, no logic edits).

**Tech Stack:** TypeScript, Vitest (jsdom), WXT. Verification: `pnpm -C extension test`, `run compile`, `run test:golden`, `run test:accuracy`.

**Spec:** `extension/docs/ENGINE_V4_SYSTEM_DESIGN.md` §4 (roles + topic map), §13 (coexistence); `docs/ENGINE_V4_MASTER_PLAN.md` §6 S5 row, §10 (blast radius); bead `Classroom-Quick-Downloader-1yf.5`.

## Global Constraints

- Fitness suite `extension/tests/architecture/engine-layers.test.ts` must stay green: `roles/**` import ONLY relative-`./`, `/bus/`, `/contracts/`, `engines/types` — never `/v1/` `/v2/` `/v3/` or the registry; no role↔role imports (this plan adds that explicit test).
- ZERO behavior change: the full extension suite (3,573+ tests), golden suites, and accuracy gate pass unchanged. No existing test may need editing.
- Every commit independently revertible; commitlint header ≤ 100 chars; pathspec-limited `git commit` only (never `git commit -a` / bare `git commit` — a parallel session stages unrelated files).
- Never touch: `website/*`, staged launch docs, `extension/wxt.config.ts`, root `package.json`, `cloudflare-worker/*`.
- pnpm needs `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`.
- Mimosa hook blocks Bash writes to source files — use Write/Edit tools.

## File Structure

- Modify: `extension/src/v2/orchestrator/orchestrator.ts` — bus creation, route:changed publish, role wiring, cycle hook (additive only; no logic rewrites)
- Modify: `extension/src/engines/v2/engine-v2.ts` — ONE additive render-applied record + getter (Task 4 only)
- Create: `extension/src/roles/detect-engine.ts`, `compute-engine.ts`, `render-engine.ts`, `harden-engine.ts`
- Create: `extension/tests/v4-orchestrator.test.ts`, `extension/tests/v4-roles.test.ts`
- Modify: `extension/tests/architecture/engine-layers.test.ts` — role↔role import ban + roles-nonempty assertions
- Modify: `extension/src/contracts/topics.ts` — only if a payload type gap is found (none expected)

---

### Task 1: Page bus in the orchestrator + `route:changed`

**Files:**
- Modify: `extension/src/v2/orchestrator/orchestrator.ts`
- Test: `extension/tests/v4-orchestrator.test.ts` (new — first orchestrator test)

**Interfaces:**
- Consumes: `createEventBus`, `EventBus`, `PageTopicMap` from `../../bus/event-bus` and `../../contracts/topics`; `ViewKind` from `../../engines/types`.
- Produces: `Orchestrator` gains `getBus(): EventBus<PageTopicMap>`; publishes `'route:changed': { view: ViewKind; url: string }` exactly once per accepted view change (not for rejected UNKNOWN/non-Classroom views).

- [ ] **Step 1: RED — failing test**

```ts
// extension/tests/v4-orchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Isolate the orchestrator singleton per test (established repo idiom).
vi.mock('../../src/engines/engine-registry', () => ({
  engineRegistry: {
    getActiveEngines: vi.fn(() => []),
    getEngine: vi.fn(() => null),
    getMode: vi.fn(() => 'legacy'),
    setModeChangeCallback: vi.fn(),
    getSummary: vi.fn(() => ''),
  },
}));
vi.mock('../../src/v2/context/route-classifier', () => ({
  RouteWatcher: class { start() {} stop() {} },
  isClassroomUrl: vi.fn((url: string) => url.includes('classroom.google.com')),
}));
vi.mock('../../src/v2/compat/shadow-compare', () => ({ ShadowComparator: class {} }));

import { Orchestrator } from '../src/v2/orchestrator/orchestrator';
import { ViewKind } from '../src/engines/types';

describe('Orchestrator page bus (S5)', () => {
  it('exposes a page bus and publishes route:changed for an accepted view', async () => {
    const o = new Orchestrator();
    o.start();
    const bus = o.getBus();
    const seen: Array<{ view: ViewKind; url: string }> = [];
    bus.subscribe('route:changed', (p) => seen.push(p));
    // Reach into the private lifecycle through the mode-change callback the
    // registry captured — the same path production navigation uses.
    // (Alternative: call (o as any).handleViewChange(...) — allowed, test-only.)
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/a/not-in-any-class');
    expect(seen).toEqual([{ view: ViewKind.STREAM, url: 'https://classroom.google.com/u/0/a/not-in-any-class' }]);
  });

  it('does NOT publish route:changed for rejected views', async () => {
    const o = new Orchestrator();
    o.start();
    const seen: unknown[] = [];
    o.getBus().subscribe('route:changed', (p) => seen.push(p));
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.UNKNOWN, null, 'https://example.com');
    expect(seen).toEqual([]);
  });
});
```

NOTE: with zero active engines the current `handleViewChange` returns early AFTER `abortCurrentPage()` — the publish must sit after the Classroom/UNKNOWN guard and BEFORE the engines-empty early return, so it fires in both tests' paths. Pick `ViewKind.STREAM` + a URL `isClassroomUrl` accepts. If ViewKind enum values differ from the mock's expectations, adjust the test to the real enum — never the production code.

- [ ] **Step 2: Run RED** — `pnpm -C extension vitest run tests/v4-orchestrator.test.ts` → FAILS: `getBus is not a function`.
- [ ] **Step 3: GREEN — minimal implementation**

```ts
// orchestrator.ts (additive)
import { createEventBus, type EventBus } from '../../bus/event-bus';
import type { PageTopicMap } from '../../contracts/topics';

export class Orchestrator {
  // ...existing fields...
  /** The page-scoped event bus (S5). Roles subscribe/publish here only. */
  private pageBus: EventBus<PageTopicMap> = createEventBus<PageTopicMap>();

  /** The page bus. Roles and debug tooling get it here — never a global. */
  getBus(): EventBus<PageTopicMap> {
    return this.pageBus;
  }
  // in handleViewChange(), immediately after the guard block (line ~206):
  //   this.pageBus.publish('route:changed', { view: newView, url });
}
```

- [ ] **Step 4: Run GREEN** — same command passes; run full suite `pnpm -C extension test` → all green.
- [ ] **Step 5: Commit**
```bash
git add extension/src/v2/orchestrator/orchestrator.ts extension/tests/v4-orchestrator.test.ts
git commit -m "feat(engine): S5 orchestrator page bus + route:changed topic" -- extension/src/v2/orchestrator/orchestrator.ts extension/tests/v4-orchestrator.test.ts
```

---

### Task 2: DetectEngine role — `post:scanned` + `file:discovered`

**Files:**
- Create: `extension/src/roles/detect-engine.ts`
- Test: `extension/tests/v4-roles.test.ts` (new)

**Interfaces:**
- Consumes: `EventBus<PageTopicMap>`, `PostNode`, `FileNode` (all via `engines/types` + `contracts/topics` re-exports; if `PostNode`/`FileNode` live only in `engines/types`, import from there — allowed by the fitness rule).
- Produces:
```ts
export interface DetectSource { getTrackedPosts(): PostNode[] }
export class DetectEngine {
  constructor(bus: EventBus<PageTopicMap>, source: DetectSource)
  /** Call once after a scan cycle settles. Reads the source VERBATIM. */
  onScanComplete(): void
}
```
Publishes `'post:scanned'` `{ posts }` once per call; publishes one `'file:discovered'` `{ postId, files }` per post that has `files.length > 0` (`files` = the post's existing `FileNode[]` mapped to the topic's payload type; if the topic expects `FileRef[]`, map `{ fileId, url, ext?, name? }` from `FileNode` fields — check `contracts/topics.ts` and `engines/types.ts` FileNode shape first and write the mapping in the role, not the caller).

- [ ] **Step 1: RED** — tests: (a) publishes post:scanned with the source's tracked posts verbatim; (b) publishes file:discovered per post with files; (c) posts without files produce no file:discovered; (d) a source that throws does not break the bus (error surfaces via bus onError — the bus already isolates subscribers; assert publish still happened for post:scanned before the throw path, or that onError fired — pin ONE contract: role reads source inside try/catch and rethrows nothing).
- [ ] **Step 2: RED run** — `pnpm -C extension vitest run tests/v4-roles.test.ts` → fails on missing module.
- [ ] **Step 3: GREEN** — implement `DetectEngine` exactly as the interface above; no DOM, no globals (fitness rule).
- [ ] **Step 4: GREEN run** — role tests + `pnpm -C extension test`.
- [ ] **Step 5: Commit** (pathspec: the two new files).

---

### Task 3: ComputeEngine role — `decision:flags` + `decision:placement`

**Files:**
- Create: `extension/src/roles/compute-engine.ts`
- Test: `extension/tests/v4-roles.test.ts` (append)

**Interfaces:**
- Produces:
```ts
export interface ComputeSource {
  getFlagDecisions(): FlagDecision[]
  getPlacementDecisions(): PlacementDecision[]
}
export class ComputeEngine {
  constructor(bus: EventBus<PageTopicMap>, source: ComputeSource)
  onDecisionsComputed(): void
}
```
Publishes `decision:flags` and `decision:placement` with the source arrays VERBATIM (same array references; role must not clone/filter).

- [ ] **Step 1: RED** — tests: publishes both topics with the exact arrays; empty arrays still publish (topic carried); source throw isolated same contract as Task 2.
- [ ] **Step 2: RED run → Step 3: GREEN → Step 4: full suite green.**
- [ ] **Step 5: Commit** (pathspec-limited).

---

### Task 4: RenderEngine role + additive EngineV2 render-applied getter

**Files:**
- Modify: `extension/src/engines/v2/engine-v2.ts` (ADDITIVE ONLY: record + getter)
- Create: `extension/src/roles/render-engine.ts`
- Test: `extension/tests/v4-roles.test.ts` (append); `extension/tests/v2-engines.test.ts` MUST NOT be edited

**Interfaces:**
- EngineV2 addition (the only production diff outside orchestrator/roles in this sprint):
```ts
/** S5 additive: what the last render cycle applied, for the RenderEngine role. */
private lastRenderApplied: Array<{ postId: string; kind: 'button' | 'flag' | 'all' }> = [];
getLastRenderApplied(): Array<{ postId: string; kind: 'button' | 'flag' | 'all' }> {
  return this.lastRenderApplied;
}
```
`renderDetectedFlags()` and `renderPlacedButtons()` each START by resetting `lastRenderApplied = []` and push `{ postId, kind }` as they apply flags/buttons — push statements only; zero changes to conditions, loops, or DOM calls.
- Role:
```ts
export interface RenderSource { getLastRenderApplied(): Array<{ postId: string; kind: 'button' | 'flag' | 'all' }> }
export class RenderEngine {
  constructor(bus: EventBus<PageTopicMap>, source: RenderSource)
  onRenderApplied(): void   // publishes one 'render:applied' per applied item
}
```

- [ ] **Step 1: RED** — role tests: publishes one topic per applied item with exact payload; empty list publishes nothing. Engine test (in v4-roles.test.ts, not v2-engines.test.ts): after driving EngineV2's public scan pipeline (reuse the setup pattern from `tests/v2-engines.test.ts` "render strategy writes badge DOM in v2 mode (D8)" test), `getLastRenderApplied()` is non-empty and matches what rendered.
- [ ] **Step 2: RED run → Step 3: GREEN (additive engine diff + role) → Step 4: full suite green — especially `tests/v2-engines.test.ts` untouched-and-passing.**
- [ ] **Step 5: Commit** (pathspec: engine-v2.ts, render-engine.ts, v4-roles.test.ts).

---

### Task 5: HardenEngine role — `correction:needed` + `budget:throttle`

**Files:**
- Create: `extension/src/roles/harden-engine.ts`
- Test: `extension/tests/v4-roles.test.ts` (append)

**Interfaces:**
- Produces:
```ts
export interface HardenSource {
  getBudgetSnapshot(): { throttleLevel?: unknown } & Record<string, unknown>  // engine-v2.getBudgetSnapshot()
  getCorrectionStats(): { totalProcessed?: number; [k: string]: unknown }     // engine-v2.getCorrectionStats() → QueueStats
}
export class HardenEngine {
  constructor(bus: EventBus<PageTopicMap>, source: HardenSource)
  /** Call after each cycle; emits on DELTA since the previous call. */
  onCycleChecks(): void
}
```
Delta semantics (keep it minimal and test-pinned): if `getBudgetSnapshot().throttleLevel` differs from the previous call's value → publish `'budget:throttle' { level }` (level = the snapshot's throttleLevel cast to `ThrottleLevel`; first call establishes the baseline and publishes nothing). Correction events: the correction QUEUE path is internal to EngineV2's `handleCorrection` — for S5 publish `correction:needed` via the QueueStats delta only if QueueStats exposes a count that grows when corrections are queued; READ `src/v2/repair/correction-queue.ts` QueueStats fields first. If no monotonic count exists, implement `correction:needed` as: HardenEngine exposes `reportCorrection(item: CorrectionItem)` that publishes verbatim, and EngineV2's `handleCorrection` gains ONE additive publish-hook call (same additive pattern as Task 4: `this.onCorrectionSeen?.(item)` — optional callback, default undefined). Pin whichever route the QueueStats reading dictates in the test FIRST.

- [ ] **Step 1: RED** — tests: throttle publish on level change, silence when stable, baseline call silent; correction publish path per the pinned contract.
- [ ] **Step 2: RED run → Step 3: GREEN → Step 4: full suite green.**
- [ ] **Step 5: Commit** (pathspec-limited).

---

### Task 6: Wire roles into the orchestrator cycle

**Files:**
- Modify: `extension/src/v2/orchestrator/orchestrator.ts`
- Test: `extension/tests/v4-orchestrator.test.ts` (append)

**Interfaces:**
- Orchestrator gains: `private roles: { detect: DetectEngine; compute: ComputeEngine; render: RenderEngine; harden: HardenEngine } | null = null;` constructed in `start()` (after bus exists) with the primary engine as source — source resolved lazily per cycle via `engineRegistry.getPrimaryEngine()`, so mode changes are honored without rebuilding roles.
- Cycle hook: extract the mutation-callback body's per-cycle tail into `private publishCycleTopics(): void` — called (a) after the `for` loop over `engine.handleMutations(mutations)` in the observer callback, (b) at the end of any fullScan trigger path the observer uses. It reads the PRIMARY engine only:
```ts
private publishCycleTopics(): void {
  const primary = engineRegistry.getPrimaryEngine();
  if (!primary || !this.currentView) return;
  if (typeof primary.getLastRenderApplied === 'function') {
    this.roles?.render.onRenderApplied();
  }
  this.roles?.detect.onScanComplete();
  this.roles?.compute.onDecisionsComputed();
  this.roles?.harden.onCycleChecks();
}
```
Guard with `typeof` checks so EngineV1 (which lacks `getLastRenderApplied`) never breaks legacy mode — V1's getters (`getTrackedPosts` live DOM query, empty decision arrays) publish real-but-empty decision topics, which is correct verbatim behavior.
- Order inside the hook is pinned by test: render → detect → compute → harden.

- [ ] **Step 1: RED** — integration test: register a stub engine (fulfilling the `CQDEngine` shape with `getTrackedPosts` returning one post with a file, `getFlagDecisions`/`getPlacementDecisions` returning one decision each, `getLastRenderApplied` returning one item, `getBudgetSnapshot`/`getCorrectionStats` stable) via the mocked `engineRegistry.getActiveEngines`/`getPrimaryEngine`; drive a mutation through the observer callback (capture the callback passed to `new MutationObserver` in the test via jsdom and invoke it); assert all four topics published in order with exact payloads.
- [ ] **Step 2: RED run → Step 3: GREEN → Step 4: full suite + `run compile`.**
- [ ] **Step 5: Commit.**

---

### Task 7: Fitness tightening + sprint closeout

**Files:**
- Modify: `extension/tests/architecture/engine-layers.test.ts`
- Modify: `docs/superpowers/plans/2026-09-13-engine-v4-s5-roles-behind-bus.md` (checkboxes)
- Create: `docs/session-logs/2026-09-13-engine-v4-s5-roles-behind-bus.md`

- [ ] **Step 1: RED** — fitness tests: (a) a fixture snippet with role→role import is flagged (add `roles↔roles` to the scanner rule: within `roles/**`, relative imports MAY only import the role's own file — implement as: each role file must not import another file under `roles/`); (b) `roles/**` contains ≥ 4 modules (non-vacuous).
- [ ] **Step 2: RED run → Step 3: GREEN → Step 4: FULL VERIFICATION** — `pnpm -C extension run compile && pnpm -C extension test && pnpm -C extension run test:golden && pnpm -C extension run test:accuracy` all green.
- [ ] **Step 5: Commit tests; then closeout:** write the session log (what wrapped, seams, evidence numbers), update the plan checkboxes, `bd comment` + `bd close` on `1yf.5`, update `docs/ENGINE_TASK_LIST_2026-09-07.md` Section B S5 row to Done.

## Self-Review Notes

- Spec coverage: bus carries all page topics (T1/T2/T3/T4/T5 publish 9 of 11 PageTopicMap topics; `download:*` are S6 bridge scope — bead 1yf.5 acceptance says "bus carries all page topics": rule that `download:requested/progress/settled` are carried by the WORKER half in S6, documented in the session log; `post:scanned`/`file:discovered`/`decision:*`/`render:applied`/`correction:needed`/`budget:throttle`/`route:changed` all live in S5).
- Placeholders: none — every step has concrete code or a pinned contract.
- Type consistency: role constructor shapes are used identically in Task 6 wiring.
