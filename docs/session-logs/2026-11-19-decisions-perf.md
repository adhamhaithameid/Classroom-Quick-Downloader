# Decisions and performance: v3-base (engineBase flag), 2026-11-19

Worktree: CQD-wt-v3base, branch feat/v3-base-engine, HEAD cfc8341b, BASE 9167c190.
No git write, no bd write, no repo source or test edit. Flag `engineBase` stays OFF by default.

## 1. Performance, BASE 9167c190 vs HEAD (flag OFF, shipped default)

Method: `git archive` of each commit into a scratch dir, node_modules symlinked from the worktree,
`wxt build` (chrome-mv3) in each. Logs: scratchpad `build-base.log`, `build-head.log`.
Both builds exit 0.

### 1a. Bundle size (bytes, chrome-mv3)

| File | BASE | HEAD | Delta |
|---|---|---|---|
| content-scripts/v2_bootstrap.js | 394104 | 398177 | +4073 (+1.03%) |
| content-scripts/comment_frame.js | 255388 | 255728 | +340 |
| content-scripts/edited_frame.js | 251253 | 251593 | +340 |
| content-scripts/content.js | 221174 | 221513 | +339 |
| content-scripts/download_all.js | 221197 | 221536 | +339 |
| content-scripts/student_work_by_status.js | 229322 | 229609 | +287 |
| content-scripts/student_work_sidecar.js | 213033 | 213320 | +287 |
| background.js | 209214 | 209214 | 0 (byte-identical) |
| chunks/config-*.js | 484 | 551 | +67 |
| popup, options, celebration, resolver bridge, all CSS | same | same | 0 |

- Total js+css: 2434536 to 2440608 = +6072 B (+0.25%). Content scripts alone: +6005 B.
- v2_bootstrap gzip: 125728 to 126891 = +1163 B.
- Chunk hash renames (popup, options, config) are content-hash noise; sizes equal. The raw
  directory total (+44 KB) is copied `.ts` source files under `.output/`, not shipped JS.
- Growth since the earlier measurement: v2_bootstrap was +1809 B at step 4 of
  2026-11-18-v3-base-chrome.md. It is +4073 B now (phase 2, review fixes, download-all seam).

### 1b. First-scan time (happy-dom, details-aria-cards-2026-10.html, 1.4 MB)

Bench: scratchpad `bench-first-scan.test.ts` (not in repo). `EngineV2.init` with an aborted
signal (state setup only) then a timed `fullScan()`. Fresh vitest process per run, 9 runs each,
alternating BASE/HEAD. Real timers (tests/setup.ts fakes them by default). Raw: `bench.out`.

| Metric (ms) | BASE min / median / max | HEAD min / median / max |
|---|---|---|
| scan1 (init + first fullScan, cold) | 1221.4 / 1330.2 / 2201.5 | 1313.4 / 1336.0 / 1427.4 |
| scan2 (second fullScan, warm) | 80.2 / 84.1 / 113.5 | 80.6 / 84.5 / 101.0 |

- Median delta: scan1 +5.8 ms (+0.4%), scan2 +0.4 ms (+0.5%). Ranges overlap fully.
- Verdict: no resolvable regression. The BASE max (2201 ms) is one load outlier, not signal.
- The earlier note (BASE 760.9 vs HEAD 851.0 median) is not reproduced here. The old absolute
  numbers are not comparable: they came from a different harness. Compare only within one table.
- Caveat: the machine was shared (a reviewer ran in parallel). Only same-run pairs are valid.

### 1c. Classroom API calls per page view (flag ON)

`cd extension && pnpm exec vitest run tests/v3-engine-base-files.test.ts`: `Tests 16 passed (16)`.
The pin `(a-cache)` still holds: exactly ONE discovery fetch across init + two fullScans
(cache-first; snapshot age bound 120 s, MAX_RECONCILE_SNAPSHOT_AGE_MS). Flag OFF: zero calls.

## 2. Open items

Priority: P0 blocks flipping the default; P1 needed before wide canary; P2 hygiene.
Size: S under 1 day, M 1 to 3 days, L more. Owner: you (owner), product, code lane.

| # | Item | Source | Pri | Size | Risk | Recommended next action | Owner |
|---|---|---|---|---|---|---|---|
| 1 | NEEDS-DECISION: snapshot not tied to a post (no post id in `ClassroomApiRouteContext`); `posts.length !== 1` guard only | review-fixes-union F4 | P0 | M | API file lands on the wrong post if a view has 1 DOM post but a different submission | Add post id or submission-to-post map in api/types.ts, discovery-service.ts, cache key. Cheap partial: re-resolve route at apply time, require equal `studentSubmissionId` | code lane (decision: product) |
| 2 | engineBase has no runtime setter; per-context module state; must persist in chrome.storage and be read by background, content, popup, options | adr-0010 checklist #9; v3-base-chrome; e2e-flag-on | P0 | M | Registry and V1 gates disagree: double UI defect returns | Bead 3: persisted setting + per-context init before any gate reads it | code lane |
| 3 | NEEDS-OWNER: add `oauth2.web_client_id` to manifest | adr-browsers #1; ADR 0010 | P0 (non-Chrome) | S | None for Chrome path | Mint the Web client, then add the key | you |
| 4 | NEEDS-OWNER: mint web client, register Chrome/Edge/Firefox redirect URIs (incl. QA companion), confirm scope status, publish privacy policy | adr-browsers #2; ADR 0010 step 1 | P0 (non-Chrome) | M | Google verification delay; store review | Start verification now: lead time is not under our control | you |
| 5 | Wire `WebAuthFlowTokenSource` into engine-v3 and background relay; flip `NON_CHROME_TOKEN_SOURCE_WIRED` and its pin test | adr-browsers #3; review-fixes-auth open items | P0 (non-Chrome) | L | Token flow has no caller today; untested end to end on real Google | Rollout step 2 PR after items 3 and 4 | code lane |
| 6 | NEEDS-OWNER: UNGATED creators (student_work sidecar/by-status, src/student_work/button.ts, src/download-all/button-controller.ts, resolver iframe) render in every mode | phase2 item 2; v3-base-chrome bead 2 | P1 | M | Gating in default mode reverses z57 and silences student-work downloads | Decide option 1 (gate only when flag ON and mode v3) or option 2 (move `findHeaderContainer`, retire V1 group button) | product + you |
| 7 | Sidecar strips `data-cqd-injected` from V2 buttons; marker-based cleanup, deep-validator, engine-v2.ts:1607 skip them on student-work routes | download-all-real-browser (proposed bead) | P1 | M | Touches default mode; real defect independent of the flag | File bead. Fix only with a flag-OFF characterization test first | code lane |
| 8 | Flip-PR checklist: mode-gate.ts:101 else-branch, stale `gateV1Stack` doc | design doc Rollout; v3-base-chrome | P1 | S | Wrong gate on one branch at flip time | Include in the flip PR, with test | code lane |
| 9 | Flag-OFF mutation path is code-guarded only (no test) | design doc Rollout | P2 | S | Silent flag-OFF drift | One characterization test | code lane |
| 10 | Firefox/Edge canary with flag ON, real login HITL pass, AMO/Edge/Opera store submissions | adr-browsers bead 2; ADR step 3-4 | P1 | L | Review rejection; consent UX | After items 3 to 5. QA companion installs first | you |
| 11 | ADR 0010 acceptance (Status: proposed). Option 4 (DOM-only) stays the answer if no second client | ADR 0010 | P1 | S | Work on item 5 may be wasted if declined | Accept or decline before item 5 starts | you |
| 12 | storage.session token mirror (SW restart drops token, user repeats consent) | adr-browsers bead 3 | P2 | S | Consent prompt frequency | Decide inside item 5 review | code lane |
| 13 | Student-work list views: no post-to-student mapping (`studentSubmissionId` null) | design doc open items; flag test (b-list) | P2 | M | Feature gap, not a regression (files stay DOM-only) | Defer behind item 1 | code lane |
| 14 | Minors: `lastRenderApplied` cycle reset; reconciler header count claim | phase2 open items | P2 | S | Doc and cosmetic | Bundle with item 1 | code lane |
| 15 | Phase-2 behaviors: API file with a rejected Drive URL shows only as "N ok, M failed" in group result; DOM-only scan briefly drops the API entry until EngineV3 re-applies | phase2 blast radius | P2 | S | UX only, flag ON | Accept; recheck in canary | product |
| 16 | Edge exposing `getAuthToken` as a function: token fails silently to null, DOM verbatim | adr-browsers "what could break" | P2 | S | Silent degrade, no error | Covered by Google-brand rule (review fix #1); recheck on real Edge | code lane |
| 17 | UNVERIFIED: classroom scopes sensitive vs restricted (consent-screen indicator) | adr-browsers U4; ADR 0010 | P1 | S | Verification path and timeline | Read the console indicator | you |
| 18 | UNVERIFIED: Firefox literal redirect pattern, Brave and Opera identity behavior, Android no-extension line, Safari API list | adr-browsers U1-U3, U5, U6 | P2 | S | Wrong registration or support claim | Verify on real browsers during item 10 | you |
| 19 | E2E gaps: Edge and Firefox qa not run; popup/options screenshot walk not done; no byte-identical check vs 9167c190; flake in (c) once, diff not captured; qa-07 live canary skipped | e2e-flag-on remaining gaps | P1 | M | Cross-browser claims unproven | Run qa-edge/qa-firefox; re-run (c) with profile attach under idle load | code lane |
| 20 | Mutation: equivalent mutants left (documented); `classroom-api-client.ts` never mutated; token-source raw score 96.32% (adjusted 100%) | mutation, mutation-2 | P2 | S | None known; no BUG found | Mutate classroom-api-client.ts in the flip round | code lane |
| 21 | Nothing is committed. Untracked e2e spec and several tests await the coordinator | all logs | P0 | S | Loss of work | Coordinator commits | you |

DONE, not open: stripper flaw in engine-layers.test.ts (phase2 item 3); union lost on re-scan,
raw id vs `drive-<id>`, details path drops API files (review-fixes-union F1-F3); nine auth findings
(review-fixes-auth); Download All union label in a real browser (download-all-real-browser).

## 3. Flag-on-by-default readiness

Thresholds below are proposed by this report, not agreed. Owner sets the final numbers.
Measure each on the flip candidate against BASE or flag OFF, same machine, alternating runs.

| Gate | Measure | Threshold to pass | Current |
|---|---|---|---|
| Bundle growth | per-file js+css delta, content scripts and background | total js+css under +1% vs BASE; v2_bootstrap under +2%; background 0 | +0.25% total; v2_bootstrap +1.03%; background 0 |
| First-scan time | median of 9+ alternating runs, scan1 and scan2 | flag ON within +5% of flag OFF; ranges overlap or delta under run noise | OFF vs BASE +0.4% / +0.5% (ON not yet measured) |
| API calls per view | discovery fetches per course:courseWork per TTL | exactly 1 (pin `(a-cache)` green); 0 when flag OFF; shared rate budget not exceeded | 1 (16 of 16 tests pass) |
| Fallback error rate | share of views ending in auth/API failure fallback; uncaught errors | 0 uncaught errors and 0 error UI on 401 (silent DOM fallback). A fallback-rate number needs telemetry that does not exist in the logs read: add a counter first | not measurable today |
| Unit and coverage | `scripts/check extension`; `test:coverage:all` both profiles | 0 failed; 100/100/100/100 both profiles | 250 files, 4847 tests, 100% |
| E2E | `pnpm -C extension test:qa` twice in a row, idle machine | 0 failed, 0 flaky; skipped limited to qa-07 | 23 passed, 2 skipped, 0 failed (2 runs) |
| Mutation | Stryker on engine-base, reconciler, token-source, capability, config | adjusted 100%, no BUG | adjusted 100% on all 5 |
| Cross-browser | qa-edge, qa-firefox, HITL login on Firefox and Edge | all pass | not run |

### Go / no-go checklist

- [ ] Item 1 decided and fixed (snapshot tied to post or route).
- [ ] Item 2 done: `engineBase` persisted and read in every JS context before gates run.
- [ ] Item 8 done: mode-gate.ts:101 else-branch and stale doc.
- [ ] Item 6 decided (UNGATED creators); flag-ON E2E shows one UI per file, no double UI.
- [ ] All eight gate rows above pass on the flip candidate, numbers saved in a session log.
- [ ] Chrome only first. Non-Chrome stays off until items 3, 4, 5, 10, 11 are done.
- [ ] Rollback proven: default back to `'v2'` (one line) or storage `cqdV2Mode='v2'`.
- [ ] Owner commits and merges (admin merge, BLOCKED-but-green is normal).
- NO-GO if any box is empty. The default flip is a separate owner PR; `DEFAULT_MODE` flips later, after shadow data.

## 4. Production readiness (honest)

### Proven (evidence)

- Flag OFF keeps shipped behavior: background.js byte-identical; content-script growth +6 KB;
  scan time unchanged within noise (section 1); E2E (c) compares API-ok and API-401 runs of one
  flag-OFF build (2026-11-19-e2e-flag-on.md). This is NOT a proof of byte-equality with BASE: that check was dropped.
- Flag ON, Chromium for Testing, stubbed API: union file count, label and run, 401 silent fallback,
  no error UI (tests/e2e/qa/v3-base-flag-on.spec.ts, `23 passed, 2 skipped`, twice;
  2026-11-19-download-all-real-browser.md).
- Unit and coverage: 250 files, 4847 tests, 100% on both profiles; mutation adjusted 100% on 5 files
  (2026-11-19-mutation-2.md). Cost: no independent reviewer pass for the ADR chat
  (subagent budget note in 2026-11-18-adr-browsers.md).
- One discovery call per view, cache-first (`tests/v3-engine-base-files.test.ts`, re-run here).
- Auth hardening: nine fixes with red then green quotes (2026-11-19-review-fixes-auth.md).

### NOT proven (do not claim)

- Real Google OAuth: every E2E stubs the token source and the Classroom API. No real consent,
  no real token, no real quota or rate-limit behavior.
- Real Classroom data: fixtures and stubs only. The qa-07 live canary is skipped by design
  (`QA_LIVE_CLASSROOM` unset). Post-to-student mapping is unresolved (items 1, 13).
- Firefox, Edge, Opera, Brave, Safari: no run on any. The non-Chrome token source has no caller
  and `NON_CHROME_TOKEN_SOURCE_WIRED = false`. Support facts rest on MDN and are partly UNVERIFIED
  (items 17, 18). Safari has no `identity` API per MDN BCD.
- The flag as a user feature: no runtime setter, no popup setting. E2E uses a test-only build
  that edits a COPY of the source (module state).
- Flag-ON performance: section 1 numbers are flag OFF. The ON cost (scan plus reconcile plus API) is not measured.
- Field error rate: no telemetry for fallback rate. The student-work marker defect (item 7)
  affects default mode and is independent of the flag.
- Scope verification status with Google (item 17) and store review outcomes.
- Bench caveats: happy-dom, one fixture, shared machine, cold process per run. Not browser timing.
