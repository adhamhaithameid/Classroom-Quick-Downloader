# Beads follow-ups, 2026-11-20

Branch `feat/beads-followups` (worktree `CQD-wt-beads-r2`). No git write. No `bd` write.
Setup note: the worktree had no `node_modules`. I ran `pnpm install --frozen-lockfile --offline --ignore-scripts` and `wxt prepare` (both untracked output).

Verification: `scripts/check extension` exit 0 after each of items 1 to 5 (typecheck ok, tests ok). Final `pnpm -C extension test:coverage:all` exit 0 (260 files, 5094 tests passed).

## 1. v2qe (watchdog never settles the group run)

- Files: `extension/src/v2/render/download-controller.ts`, test in `extension/tests/v2-download-all-controller.test.ts`.
- Change: the fan-out loop moved into `notifySettled()`. The stage 2 watchdog now calls it with status `timeout` and the watchdog message, after `pending.delete`.
- Test: `v2qe: a request the watchdog drops still settles its group run`. Fake timers, no reply, run settles to `cqd-all-error`. Red first (busy class stayed), then green.
- Blast radius: any code using `onSettled` now also sees timeouts. Only the group controller uses it. Rollback: revert the one `notifySettled` call.

## 2. co2e (sidecar strips data-cqd-injected from V2 buttons)

- Files: `extension/entrypoints/student_work_sidecar.content.ts`, test in `extension/tests/classroom-entrypoint-domport.test.ts`.
- Change: `cleanupStudentWorkFlags()` skips the `data-cqd-injected` attribute on `.cqd-download-btn` and `.cqd-download-all-btn`. Other flag attributes and other elements are unchanged.
- Test: `co2e: a scan keeps data-cqd-injected on V2 buttons ...`. Red first, then green.
- FLAG-OFF BEHAVIOR CHANGES: on student-work routes, V2 buttons now keep the marker. Stale-button cleanup, `removeAllV2Buttons`, the deep validator and `engine-v2` (~line 1607) now see these buttons. Before, they skipped them. `syncDownloadAllCount` still works (its 6th parameter from the earlier fix stays; the marker is now present too).
- Not changed: `student_work_by_status.content.ts` has the same strip. It was out of the item scope. Owner may want the same fix there.
- Blast radius: student-work routes only. Rollback: revert the `ownsMarker` lines.

## 3. d2li (bail feedback and id forms)

- Files: `extension/src/v2/render/download-all-controller.ts`, test in `extension/tests/v2-download-all-controller.test.ts`.
- (a) The collapsed-post bail now shows `Expand post` / `to download all` on the group button (`cqd-all-error`) and resets after `GROUP_FEEDBACK_MS`. It still returns false and starts no run. Test: `d2li: the collapsed-post bail shows a visible status ...`.
- (b) `file-reconciler.ts` already dedupes DOM `dataid-`/`url-` files against API `drive-<id>` through `driveFileKeys` (union-3 #2, test at `v3-file-reconciler.test.ts` line 353). No change there. The real gap was in `startRun`: it compared raw ids only. It now also collects the Drive keys of DOM buttons (from their URL) and skips an API file that matches. Test: `d2li: an API file whose Drive id a dataid-/url- DOM button already carries ...`. Red first, then green.
- Blast radius: group runs only. API files exist only with the flag ON, so flag-OFF runs are unchanged. Rollback: revert the two edits.

## 4. 9v3g (snapshot not tied to a post), cheap partial

- Files: `extension/src/engines/v3/engine-v3.ts`, test in `extension/tests/v3-engine-base-files.test.ts` (the harness now also returns the route mock).
- Change: `applyApiFileReconciliation()` re-resolves the route. It returns without applying when the route is null or its `studentSubmissionId` differs from the snapshot's.
- Test: `9v3g: a snapshot for another submission is rejected at apply time`. Red (3 files), then green (2 files).
- Limit: this ties the snapshot to the route, not to a post. A post inside the same submission is still decided by the single-post gate.
- Blast radius: flag ON only. Rollback: remove the route check.

## 5. 82gr (persist engineBase)

- Files: `extension/src/engines/engine-base.ts`, `extension/src/v2/orchestrator/mode-controller.ts` (`readMode` awaits the loader), `extension/entrypoints/content/mode-gate.ts` (`onEngineModeChange` reads both keys in one `get` and applies the flag before the suppression check), `extension/entrypoints/background/index.ts` (`void loadEngineBase()` at start), `extension/entrypoints/popup/main.tsx` and `extension/entrypoints/options/main.tsx` (render after load). New test `extension/tests/engine-base-persist.test.ts` (6 tests).
- API: `ENGINE_BASE_STORAGE_KEY = 'cqdEngineBase'`, `loadEngineBase()` (never rejects), `setEngineBasePersisted(base)` (writes storage, then memory; rejects and keeps memory when the write fails), `applyStoredEngineBase(value)`.
- Rules: default `v2` (OFF). Stored `v3` turns it ON. A read failure or a present invalid value gives `v2`. An absent key keeps the current value (fresh context = `v2`; this keeps the `setEngineBase` test seam working, 3 existing mode-gate tests needed it).
- Limit: running contexts do not follow a live flip. They pick it up on their next load. No user-visible setting was added.
- Blast radius: one extra `storage.local.get` at startup in each context. Nothing writes the key, so the flag stays OFF. Rollback: revert the six wiring edits; `engine-base.ts` additions are inert alone.

## 6. tj0l (gate the five ungated UI creators): NEEDS-DECISION (no code changed)

The five creators (the `UNGATED_ALLOWLIST` in `extension/tests/architecture/ui-single-source.test.ts`):

1. `entrypoints/student_work_sidecar.content.ts` (row buttons on student-work routes)
2. `entrypoints/student_work_by_status.content.ts` (by-status rows plus the V1 group button)
3. `src/student_work/button.ts` (the V1 student-work button, used by 1 and 2)
4. `src/download-all/button-controller.ts` (the V1 group button; V2 imports only `findHeaderContainer` from it)
5. `src/student_work/resolver.ts` (hidden resolver iframe, not visible UI)

What gating with `gateV1Stack` would silence in default mode (`v2`): entrypoints 1 and 2 both carry a z57 comment that they must run in every mode. The mode gate silenced them in v2 once, and that was called a bug. Gating would stop the student-work row buttons and the by-status group button in the default mode. Items 3 to 5 would go with them. V2 does place single buttons for DOM files on a student-work page (phase 2 tests), but no one verified full parity in a real browser.

Options:
- A. Gate 1 and 2 only when `engineBase='v3'` AND mode `v3` (flag ON). Default mode is unchanged. Needs a real-browser check that V2 draws the same row buttons on submission routes.
- B. Move `findHeaderContainer` to a creator-free module, then retire the V1 group button once by-status uses V2. Larger, safer long term.
- C. Gate in default mode too. Not recommended: it reverses z57 and silences the feature.

Recommendation: A now (the 82gr persisted flag makes it safe to read in every context), B later. Do not do C. Keep the allowlist as is until a creator is removed (the scan does not shrink when code is gated).

## Technicalities to explain

- Why the watchdog needs `notifySettled`: the group machine waits for a settled event per file. A dropped request never emits one.
- Why the marker matters: V2 code finds its buttons by `[data-cqd-injected]`. The V1 sidecar removed it on every scan.
- Why the engine flag loads before gates: the registry, the mode gate and `isApiConfigured()` must agree in every context.
