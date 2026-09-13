# Session Log — Engine V4 S5: Wrap Roles Behind the Bus (1yf.5)

Date: 2026-09-13 · Sprint: S5 of epic `1yf` (gh #685) · Executed via subagent-driven development (fresh implementer + independent review per task)

## What shipped

The page EventBus went live carrying the page topics, with the four page roles
wrapping the existing engine implementations VERBATIM (strangler-fig steps 2–3,
`ENGINE_V4_SYSTEM_DESIGN.md` §13). Seven commits, each independently revertible:

| Commit | Content |
|---|---|
| `29c1138d` | Orchestrator page bus (`createEventBus<PageTopicMap>()`), `getBus()`, `route:changed` publish |
| `3cc5aa80` | `roles/detect-engine.ts` — publishes `post:scanned` + `file:discovered` (FileNode→FileRef mapping inside the role) |
| `85c263bb` | `roles/compute-engine.ts` — publishes `decision:flags` + `decision:placement` verbatim |
| `8464761a` | `roles/render-engine.ts` + additive `EngineV2.getLastRenderApplied()` (+36/−0) — publishes `render:applied` per applied item |
| `46f77ce3` | `roles/harden-engine.ts` — `budget:throttle` (edge-triggered) + `correction:needed` (callback route: additive `onCorrectionSeen?` hook in `handleCorrection`) |
| `f9a435e9` | Orchestrator wiring: roles built in `start()`, `publishCycleTopics()` after each mutation cycle, order render→detect→compute→harden, V1-safe `typeof` guards |
| `70319ea5` | Fitness: role↔role import ban (canary-anchored scanner) + roles ≥4 modules non-vacuous guard |

## Bus topics now carried (S5 scope)

`route:changed`, `post:scanned`, `file:discovered`, `decision:flags`,
`decision:placement`, `render:applied`, `correction:needed`, `budget:throttle`.
`download:requested/progress/settled` are the worker-half topics and are carried
by the S6 bridge (bead `1yf.6`) — recorded here as the 1yf.5 acceptance reading.

## Evidence (2026-09-13, at close)

- `tsc --noEmit`: exit 0.
- Full unit suite: **130 files / 3,601 tests, all green**.
- Golden: regression 5, fuzz 71, stress 8, visual 20 — all green.
- Accuracy gate: 4 files / 20 tests green (C1 exact + C2 floors unchanged).
- Zero behavior change proven: no existing test edited (Task 6's 4-line
  `vi.mock` path repair in `tests/v4-orchestrator.test.ts` fixed dead mocks in
  a file created this sprint; test bodies byte-identical).
- Fitness suite: 11 rules green, including the two new ones.

## Design rulings (this sprint)

1. **Wrap shape:** roles wrap the EXISTING engine getters
   (`getTrackedPosts/getFlagDecisions/getPlacementDecisions`) and publish their
   outputs; no detection/compute/render logic lives in roles. Additive
   engine-v2 changes: `lastRenderApplied` record + getter, and the optional
   `onCorrectionSeen?` hook (both +0 deletions, R4-clean).
2. **Correction route:** QueueStats has no monotonic queued-count
   (`pending` shrinks, `historySize` caps), so `correction:needed` uses the
   callback route; retries re-publish per retry — consumers dedup by
   `CorrectionItem.id` (deep-validator's declared dedup contract).
   *Amended, final-review fix wave:* the callback route is now actually
   wired in production — `Orchestrator.publishCycleTopics()` assigns
   `primary.onCorrectionSeen` per cycle (idempotent, `in`-guarded so
   EngineV1 is skipped), pointing it at `HardenEngine.reportCorrection()`,
   which publishes the item verbatim as `correction:needed`. At sprint
   close the hook had zero production callers; pinned by two new tests in
   `tests/v4-orchestrator.test.ts`.
3. **Render cycle boundary:** only `renderDetectedFlags` resets
   `lastRenderApplied`; the sole caller pair (`fullScan`: flags→buttons) makes
   a buttons-side reset self-defeating. Purpose-preserving deviation, reviewed.
4. **Cycle publish order** render→detect→compute→harden pinned by test.
5. **1yf.5 acceptance reading:** "bus carries all page topics" = the eight
   topics above live in S5; the three `download:*` worker topics arrive with
   the S6 bridge activation.

## Deferred minors (parked for final review / later sprints)

- Button render record can over-claim on re-scan (`renderBatch` idempotent
  null-returns still recorded) — fix when the additivity rule lifts (S10).
- Source-throw inside DetectEngine is silent (no error topic yet) — Harden
  error-topic candidate.
- ~~Redundant `S5CapableEngine` casts in orchestrator.ts (cosmetic).~~
  Resolved in the final-review fix wave: replaced with typed declarations.
- Fitness scanner: raw-text scanning false-positives on comment text;
  dynamic `import()` evasion (consistent with the suite's existing threat model).

## Environment notes

- A parallel session landed 7 commits interleaved with this sprint's
  (`76249414`, `5df8c8d6`, `31f0cbe4`, `2f6fe196`, `2e73a296`, `29923e4c`,
  `570040ec`), including a major background download-flow restructure
  (zero-tab drive flow, bypass-tab mechanism deletion). All review packages
  were scoped to exclude them. **S6 note: re-pin the background
  `handleDownloadRequest` seams from fresh reads — that area moved.**
- Mid-sprint the parallel session's in-flight work briefly caused 2→7→14
  working-tree test failures; the task gate was "failure set identical with
  and without this task's diff". At sprint close the full suite is green.

## Sprint status

Bead `1yf.5` → closed with this log. Next takeable: S6 (bridge + Engine Mode
UI, gate G2) — user-approved parameters: 100% exact corpus parity threshold.
