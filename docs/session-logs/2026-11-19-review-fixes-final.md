# Final review fixes (branch feat/v3-base-engine)

All five findings verified in the code. Each was fixed test first. Finding 6
(watchdog does not notify settled listeners, bead v2qe) was not touched.

## 1. Orphaned apiInFlight entry (flag ON only)
- Verdict: real. The watchdog second stage deletes `pending` and never
  publishes download:settled, so handleFileSettled never removes the entry.
- Red: "expected [ { ...(3) } ] to have a length of 2 but got 1".
- Fix: before the API loop in startRun, drop every apiInFlight entry whose
  request is no longer in flight. `isRequestInFlight` already existed and was
  exported; download-controller is unchanged.
- Green: v2-download-all-controller.test.ts 31 of 31. A genuinely in-flight
  request is still skipped (separate test).
- Files: extension/src/v2/render/download-all-controller.ts,
  extension/tests/v2-download-all-controller.test.ts.

## 2. Silent caller got null during an interactive flow
- Verdict: real (token-source.ts getToken, inflightInteractive branch).
- Red: silent caller resolved null instead of the token ("expected 'at-1'
  received null"); the old test expected immediate null.
- Fix: new private waitCapped races the shared flow against a timer
  (deps.silentWaitMs, default the silent launch timeout, 10 s). Token if the
  interactive flow ends in time, else null. No second window is started.
- Green: tests for finish before the cap (token) and after the cap (null).
- Files: extension/src/engines/v3/api/token-source.ts,
  extension/tests/v3-token-source-hardening.test.ts (round-6 test rewritten).

## 3. lastClick retained an Event
- Verdict: real. Red: reset left a stale forged click, so a later direct run
  skipped the API file ("expected [] to include API_ONLY_...").
- Fix: `lastClick = null` in resetDownloadAllController.
- Green: new test. File: download-all-controller.ts and its test.

## 4. Throwing injected clock rejected getToken
- Verdict: real. Red: "promise rejected Error: clock-boom".
- Fix: private nowMs() wraps the clock; falls back to Date.now and logs one
  fixed line (no error text). Both clock reads in getToken and runFlow use it.
- Side effect: the old mutant-292 killer used a throwing clock to force a late
  rejection. That path is now closed by design, so the killer test now makes the
  private runFlow reject (spy). It still pins the cooldown stamp on rejection.
- Files: token-source.ts, v3-token-source-hardening.test.ts,
  v3-mutation-killers-5.test.ts.

## 5. Needless key work with no carried API files
- Verdict: real (both ingestPost and the inject-button correction).
- Red: "expected 2 to be +0" key computations.
- Fix: build `known` only when kept.length > 0; else post.files = rediscovered
  (identical output).
- Green: new tests/v2-engine-rediscover-keys.test.ts.
- Files: extension/src/engines/v2/engine-v2.ts and the new test.

## Verification
Targeted vitest: 21 files, 391 tests passed (touched tests, tests/architecture,
v3-mutation-killers-*, v3 api tests, v2 engine tests). `tsc --noEmit -p .` exit 0.

## Blast radius
Flag OFF: engine-v2 output is unchanged (same files array). Token-source
change affects only flag ON paths. A silent caller can now wait up to 10 s
during an interactive flow. A clock failure now falls back to system time.

## Rollback
Revert the commit. No data or schema change.
