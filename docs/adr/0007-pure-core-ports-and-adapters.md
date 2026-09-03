# ADR-0007: Pure core, ports and adapters, enforced by fitness functions

- **Status:** proposed
- **Date:** 2026-08-22
- **Deciders:** Adham (owner)
- **Extends:** `extension/docs/PRD_ENGINE_REFACTOR.md` §3 (role modules + EventBus — already locked), ADR-0002

## Context

The role+bus decision (Detect / Compute / Render / Harden joined by a typed
EventBus) fixes *coupling between roles*. It does not fix *what each role is
allowed to touch*. Today:

- Decision code reaches into the DOM (`v2/decision/exclusion-engine.ts` reads
  page text), so decisions cannot be unit-tested without jsdom.
- `chrome.*` is called directly from many modules, so nothing is testable
  without a stub and nothing is portable to Firefox/Safari without edits.
- Filename derivation (`entrypoints/content/file-meta.ts`) is pure logic living
  inside a DOM module, and its `GARBAGE_LABELS` table is English-only — the
  root cause of issue #541 (`example.zipTömörítettArchívum`).
- Time is read via `Date.now()` and scheduling via `setInterval` /
  `requestIdleCallback` scattered across modules, so no test can control the
  clock and no accuracy run is deterministic.

Accuracy is the driving requirement of the 2026 H2 engine program. Accuracy can
only be *measured* on code that is deterministic: same input → same output. Any
module that reads the DOM, the clock, the network, or `chrome.*` at decision
time is not deterministic and therefore not measurable.

## Decision

We split every engine role into a **pure core** and an **impure shell**, and we
enforce the split with automated architecture tests ("fitness functions") that
run in CI on every PR.

1. **Core is pure.** `extension/src/core/**` may import only other `core/**`
   modules and `contracts/**` types. It may not reference `document`, `window`,
   `chrome`, `browser`, `fetch`, `Date.now`, `Math.random`, or any timer.
   Input is plain data; output is plain data.

2. **Shell talks to the world through ports.** Every external capability is a
   narrow interface declared in `contracts/ports.ts`: `DomPort`, `BrowserPort`
   (storage / downloads / tabs / runtime), `ClockPort`, `SchedulerPort`,
   `NetworkPort`, `LogPort`. Concrete adapters live in `extension/src/adapters/**`
   and are the only files allowed to touch the real globals.

3. **Roles depend on ports, never on adapters.** Construction happens once, in
   the composition root (`orchestrator.ts` for the content script,
   `background/index.ts` for the service worker). Nothing else calls `new` on an
   adapter.

4. **Fitness functions gate the rule.** `extension/tests/architecture/` grows
   from the one existing boundary test (`tests/contracts/import-boundary.test.ts`)
   into a suite that fails the build on: a forbidden global inside `core/**`, a
   `core → adapters` import, a role → role import that is not via the bus, a
   cyclic import, and a file over the agreed size budget.

## Consequences

**Easier**
- Detection, decision, naming and planning become testable as pure functions —
  no jsdom, milliseconds per case — which is what makes a corpus-scale accuracy
  gate (ADR-0008) affordable at all.
- Cross-browser support becomes "write one more adapter" instead of an audit of
  every `chrome.` call site (#615, #678).
- Determinism: injecting `ClockPort` and `SchedulerPort` removes the 4 heartbeat
  intervals from test runs and makes flaky timing tests impossible by construction.

**Harder**
- One more indirection. Reading `DomPort.queryAll(...)` is less direct than
  `document.querySelectorAll(...)`, and new contributors will resist it.
- The composition root becomes a real object that must be maintained; wiring
  bugs move there instead of being spread out.
- Migration cost is real: ~9,400 lines of `entrypoints/content/**` and ~1,300
  lines of `entrypoints/background/**` currently violate the rule. This is paid
  down phase by phase, not in one pass.

**New obligations**
- Every new port needs a fake in `extension/tests/fakes/` on the day it lands.
- Every port interface needs a shared conformance test run against *all* its
  implementations, so strategies stay Liskov-substitutable.

## Alternatives Considered

**Keep roles impure, test with jsdom only.** Rejected: jsdom setup dominates
runtime, so a several-hundred-case accuracy corpus becomes minutes per run and
gets skipped in CI. It also leaves the `chrome.*` portability problem unsolved.

**Adopt `webextension-polyfill` and call it done.** Rejected as insufficient,
not wrong — it solves the namespace half of the problem (and we still adopt it
*inside* `BrowserPort`, see #682) but does nothing for DOM, clock, or scheduler
determinism.

**Full dependency-injection container.** Rejected as over-engineering for a
codebase with one composition root per process. Constructor injection by hand is
enough, and YAGNI applies.

**Do nothing; rely on review discipline.** Rejected — the codebase already
proves discipline does not hold: the same `ACTION_BUTTON_PATTERNS` table is
duplicated in three modules and has already drifted.
