# Session log — v3-base (Chrome-first) 2026-11-18 (chat 5)

Worktree: /Users/adhamhaithameid/Desktop/code/CQD-wt-v3base (branch
feat/v3-base-engine, BASE 9167c190). Uncommitted by contract — the owner commits.
Design doc: docs/audit/2026-11-18-v3-base-design.md (119 lines).
SDD ledger: .superpowers/sdd/chat5-v3-base-chrome/progress.md (rulings, minors).

## Result

V3 is wired as the Chrome base engine behind `engineBase` (default 'v2' = OFF;
zero shipped behavior change). Flag ON (mode 'v3', Chrome, configured): the API
reconciles submission attachments into the tracked post's file set (additive
union, deduped by Drive id, persisted across mutation re-scans), the registry
falls back to V2 DOM only (no V1), and the V1 stacks stay inert in v3 mode. All
UI stays in v2/render; a new architecture guard pins "no second UI".

## Files changed (all in-lane unless noted)

- NEW extension/src/engines/engine-base.ts — the flag: getEngineBase /
  setEngineBase, default 'v2'. Flipping the shipped default is a later owner PR.
- extension/src/engines/engine-registry.ts — case 'v3' flag-gated: flag OFF
  byte-identical (['engine-v3'] or ['engine-v1','engine-v2']); flag ON fallback
  ['engine-v2'] (pure V2 DOM).
- extension/entrypoints/content/mode-gate.ts — suppressesV1(): also suppresses
  the V1 stacks in mode 'v3' when flag ON. Fixes the found double-UI defect
  (V1 stacks used to run beside the V2 render layer in v3 mode).
- NEW extension/src/engines/v3/file-reconciler.ts — pure reconcileApiFiles():
  snapshot null / stale (120s) / no studentSubmissionId / submission missing /
  zero driveFile / already-present (raw or drive-<id> form) → [] (DOM verbatim);
  otherwise synthetic FileNodes (idSource 'api-snapshot', element = post
  element).
- extension/src/engines/v3/engine-v3.ts — applyApiFileReconciliation(): flag
  gated; student-work views only; exactly-one-tracked-post mapping; wired at end
  of init(), in the fullScan() refresh chain, AND after handleMutations (final
  review fix: mutation-driven re-ingests no longer wipe the union).
- extension/src/engines/v2/engine-v2.ts — ONE new method applyExternalFiles():
  additive idempotent merge + targeted re-render (mirrors renderAffectedPosts);
  synthetic files filtered from placement (no floating single button; they join
  the download-all count via buildPostFilesMap).
- extension/src/engines/types.ts — FileNode.idSource gains 'api-snapshot'.
- extension/src/v2/model/entities.ts — OUT-OF-LANE TOUCH (disclosed): type-only
  widening of FileModel['idSource'] (ScannedFile projects it via toScannedFile);
  no runtime change; mechanical consequence of the types.ts widening.
- NEW tests (35): extension/tests/v3-engine-base.test.ts (5),
  v4-mode-gate-engine-base.test.ts (7), v3-file-reconciler.test.ts (11),
  v3-engine-base-files.test.ts (7 incl. the mutation-persistence test),
  architecture/ui-single-source.test.ts (6).
- NEW docs/audit/2026-11-18-v3-base-design.md.

## TDD evidence (exact quotes in task reports, .superpowers/sdd/…/task-N-report.md)

- Registry flag ON red: `AssertionError: expected [ 'engine-v1', 'engine-v2' ]
  to deeply equal [ 'engine-v2' ]`.
- Mode-gate flag ON red: `AssertionError: expected false to be true`.
- Reconciler red: import-resolution failure, then
  `expected [ { …(6) }, { …(6) } ] to have a length of 3 but got 2`;
  floating-button red: `expected <button …> to be null`.
- Mutation-persistence red (final-review fix): union wiped to DOM-only, same
  length-3-vs-2 shape; green after the one-line re-apply.
- Guard: widened red run listed all 16 creator files → allowlist with reasons →
  green; non-vacuity probe red on engine-base.ts, reverted byte-identical.

## Verification (controller-run, fresh)

- Baseline + after every task: `scripts/check extension` →
  `ok extension:typecheck`, `ok extension:test`, EXIT=0.
- Independent re-runs: 12/12 (Task 1), 29/29 (Task 2 suites), 6/6 + 35/35
  (guard + post-restore), 24/24 (post-fix), 11/11 (second post-restore).
- Reviews: three task reviews (Spec ✅ Approved each), one final whole-branch
  review (APPROVED WITH FOLLOW-UPS), one scoped re-review (Clean). Reviewers
  re-ran suites themselves (full unit suite grew 241→244 files, 4701→4724 tests,
  all green).
- Coverage gate (step 5): `pnpm -C extension test:coverage:all` — critical AND
  runtime profiles: `Test Files  244 passed (244)`, `Tests  4724 passed
  (4724)` each, all-file coverage 100/100/100/100, `COVERAGE_EXIT=0`.
- Browser E2E (step 6): `pnpm -C extension test:qa` (qa-chromium, real Chromium
  with the built extension): first run 18 passed / 2 skipped / 1 failed —
  qa-01 hit `page.waitForSelector: Timeout 20000ms exceeded` while the machine
  was still winding down the coverage profiles; the spec alone passes in 1.7s;
  full idle re-run: `19 passed (1.5m)`, `2 skipped`, `E2E_EXIT=0`. Load flake,
  not a regression.
- Design doc line budget: 119 (< 120, re-checked after every edit).

## Step 4 perf (controller-run BASE-swap; six sources swapped to 9167c190 and
back, restores verified by diff-stat + test suites; scratch bench deleted)

- first-scan (details-aria-cards-2026-10.html, 1.4MB, happy-dom, 5 runs):
  BEFORE runs=[971.0, 877.3, 753.4, 753.4, 760.9] ms (min 753.4, median 760.9)
  AFTER  runs=[927.5, 851.0, 856.8, 727.5, 763.3] ms (min 727.5, median 851.0)
  Ranges overlap ([753-971] vs [727-927]); no regression resolvable above run
  noise. Mechanism: flag OFF adds only getEngineBase() calls (registry, mode
  gate) and a first-line short-circuit in engine-v3 paths.
- content-script bundle (per-file js/css delta, BASE vs working tree):
  v2_bootstrap.js 394104 → 395913 B (+1809 B, +0.46%); edited_frame and
  comment_frame +275 B each; download_all and content +274 B each;
  student_work_sidecar and student_work_by_status +222 B each — ~3.5 KB total
  content surface (mode-gate→registry→engine-base helpers inline per chunk).
  A du-total delta of +84 KB between single builds was sourcemap/metadata
  noise; the per-file table is authoritative.
- API calls per page view: pinned by the (a-cache) test — exactly 1 discovery
  call across init + two fullScan calls (cache-first; shared rate budget).

## What could break

- Flag ON only: API-only files raise the download-all count where a group
  button already exists but cannot join a run (the run enumerates DOM buttons);
  posts below MIN_FILES_FOR_DOWNLOAD_ALL in the DOM show no button even when
  the union clears the threshold; the correction-queue 'inject-button' path can
  still wipe the union. All three are ONE planned follow-up bead (fixing the
  threshold alone would make the label overstate the runnable set).
- Out-of-lane entities.ts widening is type-only but touches src/v2/model.
- The guard allowlist carries 5 UNGATED creators (student-work sidecar/by-status
  entrypoints + src/student_work/button.ts + src/download-all/button-controller.ts
  + the resolver iframe). They render in EVERY mode today — pre-existing, out of
  this chat's lane (NEEDS-OWNER), same follow-up family.
- engine-layers.test.ts carries the same comment-string stripper flaw the new
  guard fixed (latent false-negative); out of lane.
- The flag is module-scoped: when the flip PR wires it at runtime, EVERY
  entrypoint context must set it before gates read it (each bundle has its own
  instance), or the registry and V1 gates disagree and the double-UI defect
  returns. Recorded in the design doc Rollout checklist.

## Rollback

Shipped behavior is already rollback-safe (flag default 'v2' = OFF). Full
revert (owner-run; never run by the agent):
`git checkout -- extension/src extension/entrypoints && rm -f
extension/src/engines/engine-base.ts extension/src/engines/v3/file-reconciler.ts
extension/tests/v3-engine-base.test.ts extension/tests/v3-engine-base-files.test.ts
extension/tests/v3-file-reconciler.test.ts
extension/tests/v4-mode-gate-engine-base.test.ts
extension/tests/architecture/ui-single-source.test.ts
docs/audit/2026-11-18-v3-base-design.md`

## Proposed beads (text only — no bd writes)

1. phase-2 download integration: union-count group decision + button-less
   GroupRun files + correction-queue wipe (+ lastRenderApplied cycle reset,
   reconciler header count claim).
2. UNGATED student-work/download-all creators: gate them (gateV1Stack or v2
   migration) — NEEDS-OWNER (entrypoints outside content/**).
3. engineBase user-visible setting (settings store + popup).
4. ADR 0010: non-Chromium base engine.
5. engine-layers.test.ts stripper flaw (port the ui-single-source state machine).

## Rulings (full list also in the SDD ledger)

1. Flag OFF preserves every shipped behavior bit-for-bit; all new behavior sits
   behind engineBase='v3' (consent #398 preserved; DEFAULT_MODE untouched).
2. Reconciliation is additive union — safe-by-construction "source of truth".
3. Guard test (c) is a guard: red = scan without the legacy allowlist
   (documents the parallel UI), green = allowlist with reasons.
4. Step 3 scope: V3 creates no UI (verified); legacy-only V1 UI move deferred.
5. Phase-2 download integration (threshold + run) defers as ONE bead — fixing
   the threshold alone would make the label overstate the runnable set.
6. Out-of-lane entities.ts type-only widening accepted and disclosed.
7. Task 3 fix round widened the scan to all src/** + entrypoints/**; UNGATED
   creators stay allowlisted (out of lane) with a must-only-shrink contract.
8. Final-review Important (mutation-path union wipe) fixed in-chat (one-line
   re-apply + test); correction-queue wipe stays phase-2.

## Open items

= Proposed beads 1-5 above; plus the flip-PR checklist in the design doc
(per-context flag wiring, mode-gate.ts:101 else-branch + stale gateV1Stack doc,
flag-OFF mutation path is code-guarded only).
