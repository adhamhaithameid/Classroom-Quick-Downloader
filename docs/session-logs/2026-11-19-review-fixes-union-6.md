# Review fixes union 6 (v3 base engine)

Scope: findings 1 to 6 of the sixth fresh-eyes review. No git writes made.

## Findings

| # | Verdict | Red (before fix) | Fix | Green |
|---|---------|------------------|-----|-------|
| 1 | Real | `expected "resetDownloadAllController" to not be called at all, but actually been called 1 times` | `engine-v2.ts` init: `if (getEngineBase() === 'v3') resetDownloadAllController();` | v2-engine-targeted-mutations 18 passed (init test now flag ON, new flag OFF test) |
| 2 | Real | rescan with an api-snapshot twin: `expected undefined to be true` (details post never created, DOM anchor lost) | `engine-v2.ts` covered loop: skip `idSource === 'api-snapshot'` when the v3 keys path is on | same file, 18 passed; removing the fix turns it red again (checked) |
| 3 | Real | `expected [...] to have a length of 3 but got 4` (API file requested again after reset) | `download-all-controller.ts`: module Map `apiInFlight` (requestId to fileId), set on API file start, deleted in `handleFileSettled`, skipped in `startRun` | 28 passed |
| 4 | Real | `expected [ Array(3) ] to not include 'API_ONLY_0000000000009'` (untrusted `.click()` downloaded the API file) | Capture-phase document click listener records the last click. `startRun` ignores API files when that click is untrusted and inside the group button | 28 passed |
| 5 | Real | `expected [ 'drive-url-z' ] to deeply equal [ 'drive-url-z', 'drive-DEEP' ]` | `download-url.ts` exports `MAX_AUTH_WARMUP_DEPTH = 3` (converter uses it, same value as before). `canonical-id.ts` uses it | v3-file-reconciler 34 passed |
| 6 | NEEDS-DECISION | not changed | see below | n/a |

### Deviations from the brief (decide if you disagree)
- #3: `resetDownloadAllController` does NOT clear `apiInFlight`. Clearing it there would defeat the fix, since the reset is exactly the moment the run is dropped while requests still run. `uninstallDownloadAllController` clears it (the settled listener is gone then). Settle removes each entry. The download controller watchdog settles stuck requests, so no permanent leak.
- #4: the delegated click handler (`button-renderer.ts` / `download-controller.ts`, not my files) does not pass the event. I used a capture listener in my file instead of editing those two. `decoratedButtons` cannot be the check: it is filled by the first run start, so a first genuine click would fail. The `isTrusted` check is the real control. Untrusted click: only DOM files run (API files skipped). Direct calls with no click (hotkey path, tests) are allowed, because the hotkey is a runtime message from the background.
- Existing test `(run) flag ON: the run downloads DOM files AND the API-only file` used `groupBtn.click()` (untrusted in jsdom). It now calls `handleDownloadAllClickV2` directly. Reason: the old call is exactly the forged-click shape the fix blocks.
- #5 existing test "nested auth_warmup chains stop after one level" asserted the old bug. Replaced by a 2-level chain test and a shared-cap test.

### NEEDS-DECISION: finding 6 (inherited, flag OFF too)
`engine-v2.ts` details synthesis: the details post's own files count in `covered`, so on a rescan the body anchors it already owns are dropped from `uncovered`. Fixing it changes flag OFF output, so no code change was made. Decision needed: fix in the base branch too, or accept.

## Files changed by this work
- extension/src/engines/v2/engine-v2.ts
- extension/src/engines/canonical-id.ts
- extension/src/core/acquire/download-url.ts (one constant exported, behavior same)
- extension/src/v2/render/download-all-controller.ts
- extension/tests/v2-engine-targeted-mutations.test.ts
- extension/tests/v2-download-all-controller.test.ts
- extension/tests/v3-file-reconciler.test.ts
- extension/tests/v3-engine-base-files.test.ts

## Verification
Targeted run: 13 test files, 233 tests passed (the four test files above, v3-mutation-killers 1 to 5, v2-download-all-renderer, v3-engine-base, tests/architecture/). `pnpm exec tsc --noEmit -p .` exit 0. Full gate and browser E2E: coordinator.

## Blast radius
- Flag OFF: init no longer resets (matches base). The other changes only act on API-only files, which exist only with the flag ON. The `MAX_AUTH_WARMUP_DEPTH` constant keeps value 3, so the converter is unchanged. The capture click listener is installed on all modes that install the controller, but it only stores a reference and has no effect without API files.
- Flag ON: a twin API file no longer hides its DOM anchor; chained warmup URLs now yield dedupe keys; scripts cannot trigger API downloads; a re-click during flight does not duplicate requests.
- Risk: a lost settle event would keep an API file blocked until uninstall (the watchdog normally settles it).

## Rollback
Revert the four source files and four test files listed above. `git checkout -- <file>` per file restores the previous state.
