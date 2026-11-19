# Session log 2026-11-19: Download All union label in a real browser

Worktree: /Users/adhamhaithameid/Desktop/code/CQD-wt-v3base (branch feat/v3-base-engine).
No commit, push, or bd write was made.

## Root cause (proven)

The student-work sidecar removes the marker `data-cqd-injected` from every element on each scan.

- `extension/entrypoints/student_work_sidecar.content.ts:33` lists `'data-cqd-injected'` in `FLAG_ARTIFACT_ATTRS`.
- `cleanupStudentWorkFlags()` (line 247) selects `[data-cqd-injected]` and removes every listed attribute. `scanStudentWorkLinks` calls it on every scan of a student-work route, except the by-status route.
- `syncDownloadAllCount` (`extension/src/v2/render/button-renderer.ts:410`) selected the button with `[data-cqd-injected][data-cqd-file-id="download-all:<id>"]`. After the sidecar scan it matched nothing, so it returned early. The label stayed at the DOM count.
- The label is rendered by the V2 controller (not V1): the button carries `data-cqd-group-count`, which only V2 writes. The earlier guess (V1 controller, or a union applied after the label) was wrong.

Evidence, real Chromium, flag-ON build (a scratch probe spec, deleted afterwards):

1. Button HTML after 8 s: `<button ... class="cqd-download-all-btn" data-cqd-file-id="download-all:sub-stu-77" aria-label="Download all 2 files" data-cqd-group-count="2">`. No `data-cqd-injected`.
2. Probe: set `data-cqd-injected` on the button, wait 2.5 s with no DOM mutation: `{"before":false,"justSet":true,"after2500ms":true}` (attribute stays; the scan is mutation-driven).
3. Same probe, but append a node to the post to trigger a scan: `{"before":false,"justSet":true,"after2500ms":false}`. The sidecar removed the attribute.

Why the phase 2 unit tests were green: they render the button and assert the label in jsdom without the sidecar, so the marker was never stripped.

## Fix (flag ON only)

- `button-renderer.ts`: `syncDownloadAllCount` gets an optional 6th parameter `matchWithoutInjectedMarker` (default `false`). When true, the button is found by `[data-cqd-file-id="download-all:<id>"]` alone. Default keeps the old selector byte for byte.
- `engine-v2.ts` (`cleanupAndWirePosts`): passes `apiFiles.length > 0`. With flag OFF there are no API-only files, so the argument is always `false` and nothing changes.
- The run needed no change: `download-all-controller.ts` selects by class (`.cqd-download-btn`, `.cqd-download-all-btn`), not by the marker, and already appends the API files.

## Red then green

Red (`pnpm exec vitest run tests/v2-button-renderer.test.ts tests/v3-engine-base-files.test.ts`, exit 1, log `scratchpad/dl-red.txt`):

```
FAIL ... syncDownloadAllCount > marker stripped + matchWithoutInjectedMarker: the label is rewritten from the file-id seam
AssertionError: expected '2' to be '3' // Object.is equality
FAIL ... EngineV3 phase 2 > (real browser) flag ON: the label still counts the union after the student-work sidecar stripped data-cqd-injected
AssertionError: expected '2' to be '3' // Object.is equality
Tests  2 failed | 52 passed (54)
```

The third new test (flag-OFF pin: stripped marker + default call leaves the button untouched) passed in the red run, as intended.

Green (same command, exit 0): `Test Files 2 passed (2)`, `Tests 54 passed (54)`.

The engine test releases the API response after the DOM render and after it strips the marker, which is the real-browser order.

## E2E

- `tests/e2e/qa/v3-base-flag-on.spec.ts`: `test.fail()` removed from (a2); the stale NEEDS-DECISION comments replaced with the root cause.
- Spec alone: exit 0, `4 passed (48.4s)`. (a2) passes for real: the label shows 3.
- Whole `pnpm -C extension test:qa`: exit 0, `23 passed (2.1m)`, `2 skipped` (qa-07 live canary, by design). 0 failed, 0 flaky. All 4 spec tests are ordinary passes.
- Logs: scratchpad `dl-e2e-spec.txt`, `dl-qa-full.txt`.

## Gates

- `scripts/check extension`: exit 0 (`ok extension:typecheck`, `ok extension:test`).
- `pnpm -C extension test:coverage:all`: exit 0. Both profiles: `Test Files 250 passed (250)`, `Tests 4847 passed (4847)`, Statements/Branches/Functions/Lines 100% (982/982, 765/765, 156/156, 889/889). No exclusions.

## Files changed

- extension/src/v2/render/button-renderer.ts
- extension/src/engines/v2/engine-v2.ts
- extension/tests/v2-button-renderer.test.ts (+2 tests)
- extension/tests/v3-engine-base-files.test.ts (+1 test)
- tests/e2e/qa/v3-base-flag-on.spec.ts ((a2) flipped)
- docs/session-logs/2026-11-19-download-all-real-browser.md

## Blast radius

- Flag OFF / default 'v2' / 'legacy': unchanged. The new argument is false when no API-only file exists, and API-only files exist only with flag ON. The sidecar and the shipped student-work buttons are untouched.
- Flag ON: with API-only files present, the Download All label (count, sub-text, aria-label, title) is now rewritten in the student-work view. Below the threshold the button is removed, as before.
- Side effect NOT fixed (outside scope, flag-independent): the sidecar strip also hides student-work buttons from `removeStaleButtons`, `removeAllV2Buttons`, `deep-validator` and `engine-v2.ts:1607`, which select by the marker. Proposed bead (text only): "Student-work sidecar strips data-cqd-injected from V2 buttons; marker-based cleanup and validation skip them on student-work routes". Fixing it changes default-mode behavior, so it needs an owner decision.

## Rollback

Owner-run: `git checkout -- extension/src/v2/render/button-renderer.ts extension/src/engines/v2/engine-v2.ts extension/tests/v2-button-renderer.test.ts extension/tests/v3-engine-base-files.test.ts`, and `rm -f` the report. Add tests/e2e/qa/v3-base-flag-on.spec.ts to the checkout list to restore `test.fail()` on (a2).
