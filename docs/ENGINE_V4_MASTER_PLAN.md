# Engine V4 — Master Plan (2026 H2 → 2027 H1)

Version 1.0 · 2026-08-22 · Owner: Adham · Status: proposed, awaiting owner sign-off

**What this is.** The program-level plan to take CQD's engine from two
uncoordinated detection stacks to one measurable, role-based engine where
detection, downloading and filename formatting are held to a written accuracy
standard.

**What this is not.** A step-by-step coding plan. Multi-month programs written
as step-by-step plans go stale in week three. The rule used here:

> **Plan the program at the level of gates and evidence. Plan the sprint at the
> level of TDD steps, and write that plan at the start of the sprint, against
> the code as it actually is.**

Sprint 1's executable plan is already written:
`docs/superpowers/plans/2026-08-22-engine-v4-s1-accuracy-harness.md`.

**Companion documents**
- Target design: `extension/docs/ENGINE_V4_SYSTEM_DESIGN.md`
- Locked architecture: `extension/docs/PRD_ENGINE_REFACTOR.md` (unchanged)
- Today's reality: `extension/docs/ENGINE_ARCHITECTURE.md`
- Decisions: `docs/adr/0007-pure-core-ports-and-adapters.md`,
  `docs/adr/0008-accuracy-definition-and-gates.md`
- Behavior contract: `docs/EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md`
- Epic: [#685](https://github.com/adhamhaithameid/Classroom-Quick-Downloader/issues/685)

---

## 1. The problem in one paragraph

The extension ships two full detection stacks at once. V1 detects **and**
renders; V2 detects, computes `FlagDecision[]` / `PlacementDecision[]` every
scan — and throws them away, because the `EngineEvent` bus declared in
`src/engines/types.ts:338–344` is emitted by nothing and consumed by nothing.
The cost is 8+ concurrent MutationObservers, 4 `setInterval` heartbeats,
detection logic duplicated 2–3×, and — the part that blocks everything else —
**no way to measure whether a change made detection better or worse.** The
download and filename paths were never part of the engine model at all: they
live in the background service worker as callback chains with four parallel
correlation maps, which is where #664's race and the #537/#547 "download never
works" reports come from.

---

## 2. Definition of done

The program is complete when all six statements are true and each is backed by a
CI job, not an opinion:

1. One MutationObserver, zero heartbeats, `handleMutations` p95 < 6 ms.
2. Zero role↔role imports; core has zero global references.
3. The accuracy corpus passes **exactly** (ADR-0008 C1), and the statistical
   floors (C2) are met on the sampled set.
4. Every download attempt reaches a terminal, reported state; no silent failures.
5. Filenames are byte-identical to expectation on every corpus case, in every
   shipped locale.
6. Chrome, Firefox and Edge each pass the automated smoke matrix.

**On "100% accuracy."** Read ADR-0008 before repeating the number to anyone.
100% is committed on the *closed set* (the corpus) and on the *process*
(every reported defect becomes a permanent regression case). On the open web it
is stated as floors — 99.5% coverage / 98% precision at gate G4, ratcheting up.
Claiming universal correctness for a DOM scraper against a product that deploys
without notice would be a claim we cannot defend, and the first counter-example
would destroy trust in every other number in this document.

---

## 3. Operating assumptions

| Assumption | Value | If wrong |
|---|---|---|
| Team size | 1 engineer (owner) + agent assistance | rescope, do not compress gates |
| Sprint unit | **10 engineering-days of engine work** | calendar length follows your pace |
| **Full-time pace — CHOSEN 2026-08-22** | 1 sprint ≈ 2 weeks → program ≈ **6 months** | — |
| Half-time pace | 1 sprint ≈ 4 weeks → program ≈ **12 months** | — |
| Evening pace (~1 d/wk) | ≈ 2 years | **cut scope** to the Accuracy Slice, §8 |
| Corpus labelling | needs live-Classroom human sessions | the hard schedule constraint, §9 R1 |
| No Safari | disabled in `package.json` today | unchanged by this plan |

Total estimated effort: **≈ 115 engineering-days** across 12 sprints.

---

## 4. Workstreams

Eight lanes. W0 blocks everything; W2/W3/W4 can run in parallel once W1 lands.

| ID | Workstream | Why it exists | Est. |
|---|---|---|---|
| **W0** | Safety net & measurement | You cannot improve accuracy you cannot measure. Corpus, harness, characterization tests, CI gates. | 17 d |
| **W1** | Architecture | Contracts, ports, bus, roles, strategies, bridge, V1 strip. Epic #673–#677, #682–#684. | 27 d |
| **W2** | Detection accuracy | Defects D1–D9, combine policy, structural-path decision. #613, #614. | 16 d |
| **W3** | Acquisition (downloading) | State machine, correlation ids, browser adapters. #537, #546, #547, #664. | 18 d |
| **W4** | Formatting (naming) | Pure name core + locale label registry. #541, feeds #611/#612. | 11 d |
| **W5** | Cross-browser & performance | Browser matrix, observer/heartbeat budget. #615, #616, #678. | 8 d |
| **W6** | API assist (V3) | Classroom API behind OAuth, optional. #679, #398. | 10 d |
| **W7** | Observability & governance | Decision trace #399, telemetry, docs, ADRs. #681. | 8 d |

---

## 5. Gates

A gate is a **verified state of the system**, not a date. No sprint starts on the
far side of an unmet gate.

| Gate | Name | Exit criteria (all must hold) |
|---|---|---|
| **G0** | Baseline frozen | Corpus ≥ 40 labelled cases incl. ≥ 6 locales; Tier A + Tier B harness green; V1 characterization suite passes and is pinned; `pnpm test:accuracy` wired into CI; current behavior recorded as the baseline numbers |
| **G1** | Seam live | `bus/event-bus.ts` + `contracts/ports.ts` shipped; adapters + fakes exist; architecture fitness suite green; **zero behavior change** proven by G0 suites |
| **G2** | Bridge active | Roles wrap existing code; `download:*` topics flow through `BridgePort`; Engine Mode toggle ships; shadow parity ≥ agreed threshold on corpus; rollback = one setting |
| **G3** | Single stack | V1 detector deleted, V1 render-only; duplicate detection passes per card = 1; observers = 1; heartbeats = 0 |
| **G4** | Accuracy gate | ADR-0008 C1 exact on corpus; C2 floors met; mutation score on `core/**` ≥ 80% |
| **G5** | Cross-browser | Chrome + Firefox + Edge smoke green in CI; `handleMutations` p95 < 6 ms measured |
| **G6** | Program complete | Docs/ADRs current; #685 checklist closed; V3 either shipped behind OAuth or explicitly deferred |

---

## 6. Sprint calendar

Each sprint = 10 engineering-days. Deliverable column is the *evidence*, not the
activity.

| # | Sprint | Lane | Key work | Evidence at close | Issues |
|---|---|---|---|---|---|
| **S1** | Accuracy harness | W0 | Corpus format, Tier A/B runner, metrics module, `accuracy-budget.json`, `pnpm test:accuracy`, CI job | Baseline numbers printed for today's engine | #673, #396 |
| **S2** | Baseline freeze | W0 | Capture+sanitize tool; corpus → 40 cases / 6 locales; V1 characterization suite; reconcile stale TEST docs | **G0** | #673, #396, #680 |
| **S3** | Contracts & bus | W1 | `contracts/ports.ts`, `bus/event-bus.ts`, adapters + fakes, `browserApi` shim, `scheduleIdle()`, architecture fitness suite | **G1**, zero behavior change | #674, #682, #683 |
| **S4** | Core extraction | W1+W2 | Move scoring/numerals/normalization into `core/`; kill the 3 duplicated pattern tables (D3); unify count ceilings (D4); fix D1, D2, D6, D7 | Corpus deltas per defect, each a new case | #614, #613 |
| **S5** | Roles behind the bus | W1 | Detect/Compute/Render/Harden wrap existing implementations verbatim; V1 still primary | Bus carries all page topics; behavior unchanged | #675 |
| **S6** | Bridge + Engine Mode | W1 | Activate the missing wire; Engine Mode UI (Legacy/New/API); fix D8 (`v2` renders nothing) and D9 (doc/code default drift); shadow parity run | **G2** | #676, #684 |
| **S7** | Naming core | W4 | `core/name/{derive,strip,sanitize,verify}`; locale `TypeLabelRegistry` generated from `_locales/`; property tests | #541 fixed with a Hungarian corpus case | #541, #611, #612 |
| **S8** | Acquisition core | W3 | `core/acquire/state-machine.ts`; one correlation id replaces the four pending maps; deadline → forced settle | #664 race closed by construction | #664 |
| **S9** | Acquisition adapters | W3 | Direct / Drive-auth / bypass-tab strategies; Chrome vs Firefox `BrowserPort` adapters; Download-All placement on `assignment_details` | #537, #546, #547 each with a repro test | #537, #546, #547 |
| **S10** | Strip V1 detector | W1 | Delete V1 detection; V1 → render-only strategy; observer-only scanning | **G3**: 1 observer, 0 heartbeats | #677, #616, #401 |
| **S11** | Cross-browser & perf | W5 | Browser smoke matrix in CI; selector audit; perf budget assertions | **G5** | #678, #615 |
| **S12** | Ratchet & closeout | W2+W7 | Raise C2 floors; mutation testing to ≥80%; decision trace; docs/ADR closeout | **G4**, **G6** | #399, #681, #685 |
| *S13+* | *API assist (optional)* | W6 | OAuth client id + `identity` permission; `ApiDetectStrategy`; consent + fallback model | V3 shipped or formally deferred | #679, #398 |

### Dependency graph

```
S1 ──► S2 ──► S3 ──► S5 ──► S6 ──────────────► S10 ──► S11 ──► S12
        │      │             │                   ▲
        │      └──► S4 ──────┘                   │
        │                                        │
        └──────────► S7 ────────────────────────┤   (naming is independent
        │                                        │    of the bus; can slot early)
        └──────────► S8 ──► S9 ──────────────────┘
```

S7, S8 and S9 depend on S3 (ports) but **not** on S5/S6. If a download bug
becomes urgent, pull S8/S9 forward — that is the payoff of the port split.

---

## 7. Defect backlog → sprint assignment

From the 2026-08-22 engine deep read. Every one gets a corpus case *before* its
fix, per ADR-0008 C3.

| ID | Defect | Sprint | Cost |
|---|---|---|---|
| D1 | Corrupted Armenian keywords (`'مېكdelays'`, `'խdelays'`) — Armenian detection dead | S4 | 0.5 d |
| D2 | `parseWordNumber` substring-matches `'un'` → false count 1 | S4 | 0.5 d |
| D3 | `ACTION_BUTTON_PATTERNS` duplicated ×3 | S4 | 1 d |
| D4 | Count ceilings inconsistent (`<1000` / `<10000` / `100000`) | S4 | 0.5 d |
| D5 | L0 blind trust on any `.huI6Cb` numeral | S4 | 1 d |
| D6 | Substring FPs (`'comment'` ⊂ "commentary"; generic `'من الصف'`) | S4 | 1 d |
| D7 | No Arabic tashkeel folding in normalization | S4 | 0.5 d |
| D8 | Pure `'v2'` mode renders nothing but the popup offers it | S6 | 0.5 d |
| D9 | Docs say default `'shadow'`, code says `'legacy'` | S6 | 0.25 d |
| D10 | English-only `GARBAGE_LABELS` corrupts filenames (#541) | S7 | 1 d |
| D11 | Four parallel pending maps → `pendingByUrl` race (#664) | S8 | 1 d |
| D12 | Comment verdict lost when DOM lacks golden/L0 selectors — count still reported, verdict silently `none` (found by S1 harness, bead `CQD-ass`) | S4 | 1 d |

---

## 8. Scope-cut plan (read this before committing)

If the pace turns out to be one day a week, the full program is a two-year
commitment and will not survive contact with reality. Pre-agree the cut now,
while it is a decision rather than an emergency.

**Accuracy Slice (≈ 44 engineering-days, 4–5 sprints)** — S1, S2, S4, S7, S9.
Delivers: measurement harness, frozen baseline, the nine detection defects, the
filename fix, and the download bug fixes. Leaves the two-stack architecture in
place.

Why this is the right cut: it fixes **every user-visible defect on the current
list** without the architectural migration. The architecture work (W1) buys
maintainability and performance — real value, but no user has ever filed a bug
about having 8 MutationObservers. Users file bugs about wrong filenames and
downloads that do not start.

Why the architecture work is still worth doing after: without ports and a pure
core, each subsequent accuracy fix costs more than the last, and cross-browser
support stays a manual audit. The slice buys time; it does not remove the debt.

---

## 9. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Trigger to act |
|---|---|---|---|---|---|
| **R1** | Corpus labelling stalls — needs live Classroom + sanitization, cannot be automated | High | Blocks G0, therefore everything | Timebox S2; ship G0 at 40 cases and grow later; build capture tooling first so each session is cheap | S2 ends with < 25 cases |
| **R2** | Google redeploys Classroom mid-program, invalidating fixtures | Medium | Corpus rot; false CI failures | `SelectorScorer` tiers already absorb class renames; corpus versioned by capture date; hash-id-rate alarm as the early warning | hash-id fallback rate rises above baseline |
| **R3** | No structural signal exists for "edited" in any fixture we hold | **Confirmed today** | Structural path cannot replace keyword path for edited | Keep `edited: 'unavailable'` honest reporting; decide with compare-mode data on real pages; do **not** guess | S6 parity run |
| **R4** | Big-bang temptation — rewriting instead of wrapping in S5 | Medium | Loses reversibility, breaks the gate model | S5's definition of done is "wrapped verbatim"; a rewrite in S5 fails review | any S5 diff that edits wrapped logic |
| **R5** | Accuracy gate becomes CI noise and gets disabled | Medium | Silent loss of the whole program's value | Floors in a versioned budget file; lowering one needs an ADR; exact-gate failures must be re-labelled in the same PR | any PR that touches `accuracy-budget.json` downward |
| **R6** | Solo-owner bus factor; six months of context in one head | High | Program stalls on any interruption | Every sprint closes with a session log in `docs/session-logs/`; every decision an ADR; plans in-repo | — |
| **R7** | V3/OAuth pulled forward for excitement value | Medium | Burns a sprint on a path that is dead without `identity` permission + client id | S13+ is explicitly after G6 | any V3 work before G4 |
| **R8** | Firefox download divergence widens (`onCreated` vs `onDeterminingFilename`) | Medium | Cross-browser regressions found late | Both paths get tests in S9, not S11 | S9 review |

---

## 10. Rollout and rollback

Every phase ships. Nothing sits on a long-lived branch.

```
 dev branch ──► accuracy gate ──► shadow (compute only, render off)
                                        │
                                        ▼  parity ≥ threshold on corpus
                                  Engine Mode = New  (opt-in, popup toggle)
                                        │
                                        ▼  field telemetry clean for 1 release
                                  Engine Mode = New  (default, Legacy still selectable)
                                        │
                                        ▼  one full release with no regressions
                                  Legacy path deleted (S10)
```

**Rollback paths, cheapest first**
1. Flip Engine Mode to Legacy in the popup — instant, per user, no release.
2. Flip the default in `mode-controller.ts` — one-line release.
3. Revert the phase's commits — every phase is independently revertible by
   construction (that is what "wrapped verbatim" in S5 buys).

**Blast radius per phase**
- S3 (bus/ports): worst case is a wiring bug in the composition root; nothing
  else changes behavior. Detected by G0 suites.
- S6 (bridge): first phase that can change what users see. Gated by shadow
  parity and shipped behind the toggle.
- S10 (V1 strip): the irreversible one. Only after a full release at G3 with
  clean telemetry.

---

## 11. Per-PR verification protocol

Non-negotiable for every PR in this program:

```bash
pnpm --dir extension test
```

```bash
pnpm --dir extension run compile
```

```bash
pnpm --dir extension run test:golden
```

```bash
pnpm --dir extension run test:accuracy
```

A PR may not merge if: the accuracy exact-gate fails, a fitness function fails,
or the golden behavior matrix (`docs/EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md`)
regresses. Behavior changes are legitimate — they just have to be *declared*, by
re-labelling the affected corpus cases in the same PR.

---

## 12. Tracking

- **Program/epic:** GitHub #685 stays the public spine; its checklist maps 1:1
  to gates G0–G6.
- **Day-to-day:** `bd`, filed 2026-08-22. Program epic
  `Classroom-Quick-Downloader-1yf`, label `engine-v4`. Sprints are `…-1yf.1`
  through `…-1yf.12` in the order of §6, wired with the dependency graph above.
  Defects D1–D11 hang off their owning sprint (`…-1yf.4.1`–`.4.7` for D1–D7,
  `…-1yf.6.1`/`.6.2` for D8/D9, `…-1yf.7.1` for D10, `…-1yf.8.1` for D11).
  Sprint 1's eight tasks are `…-1yf.1.1`–`.1.8`.
- **Decisions:** ADRs in `docs/adr/`. This plan is not the place for new
  decisions; if a sprint changes a decision, it writes an ADR.
- **Session close:** each sprint ends with `docs/session-logs/<date>-<slug>.md`.

---

## 13. Open questions for the owner

These change the plan and cannot be answered from the code:

1. ~~**Pace.**~~ **Answered 2026-08-22: full-time, ≈6 months, full 12-sprint
   program.** §8's scope cut is held in reserve, not pre-agreed — revisit it if
   two consecutive sprints overrun.
2. **Corpus sessions.** Can you commit to two live-Classroom capture sessions in
   S2 (≈ 4 hours each, multi-locale)? R1 is the only unmitigable schedule risk.
3. **Shadow parity threshold for G2.** 99%? 99.5%? Exact? Lower means faster
   promotion and more field risk.
4. **Scope of "downloading accuracy".** Does it include Download-All zip
   correctness and Student Work surfaces, or only single-file acquisition?
   Current estimate assumes single-file plus the existing Download-All button
   placement bug (#546).
5. **V3/OAuth.** Commit to S13+, or formally defer and close #679? It is dead
   code today (no `identity` permission, no client id) and carries a consent and
   privacy design cost (#398).
