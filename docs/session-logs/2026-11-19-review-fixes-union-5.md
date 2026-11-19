# Session log 2026-11-19: review fixes union 5

Branch feat/v3-base-engine. Five findings from the fifth fresh-eyes review. All five were real.

## 1. Details-page dedupe not gated by the flag (engine-v2.ts)
- Verdict: real. The base branch compared `f.canonicalId`; the new code used `driveFileKeys` for every flag value, and counted posts that step 3 deletes.
- Red: "flag OFF: a body anchor sharing only a Drive id with a post is still synthesized" failed with `expected false to be true`. "flag ON: a stale post removed from the page does not hide its body button" failed with `expected undefined to deeply equal [ 'drive-twinYYYYPad20Chars000000' ]`.
- Fix: `keysOf` is `[f.canonicalId]` unless `getEngineBase() === 'v3'`. Under 'v3', posts that are not seen this scan or are disconnected (the step 3 delete rule) are excluded from `covered`. The `details:` post is always counted, as before.
- Other three dedupe sites (ingestPost, inject-button correction, applyExternalFiles): re-discovery sites keep API-only files; with flag OFF that list is empty, so the output equals the base. applyExternalFiles is new and only the v3 engine calls it.
- Green: all 4 new tests plus the 35 existing tests in the two engine files pass.
- Files: extension/src/engines/v2/engine-v2.ts, extension/tests/v2-engine-targeted-mutations.test.ts.

## 2. Authuser retry unreachable (file-reconciler.ts)
- Verdict: real. buildDriveDownloadUrl embeds the raw authuser, and the first gate rejected `..` or `%25` before the retry ran.
- Red: "an API URL that embeds a malformed authuser is kept" failed with `expected [] to have a length of 1`.
- Fix: `withoutAuthUser` strips the param; the first gate, conversion and retry use the stripped URL.
- Green: new test and a valid-authuser-once test pass (29 of 29 at that point).
- Files: extension/src/engines/v3/file-reconciler.ts, extension/tests/v3-file-reconciler.test.ts.

## 3. Extension read from the authuser query
- Verdict: real. Red: `expected 'com' to be ''`.
- Fix: the fallback scans the stripped URL. The earlier union-4 case (`name=a.PDF` in the query) still passes.
- Files: same as finding 2.

## 4. auth_warmup missing from canonical-id (canonical-id.ts)
- Verdict: real. Red: "auth_warmup continue naming a Drive file yields its key" failed (1 failed, 32 passed).
- Fix: on drive.google.com, `/auth_warmup` follows `continue` one level (depth below 1), else reads `id`. A non-Drive continue, a chain deeper than one, and a non-Drive host yield no key.
- Green: 33 of 33 in the reconciler file.
- Files: extension/src/engines/canonical-id.ts, extension/tests/v3-file-reconciler.test.ts.

## 5. Download-all API map survived init (engine-v2.ts)
- Verdict: real. Red: `expected "resetDownloadAllController" to be called at least once`.
- Fix: init calls `resetDownloadAllController()` next to `postsWithApiFiles.clear()`.
- Green: test "init without destroy clears the download-all API file map" passes.

## Verification
Targeted run of 13 files (reconciler, engine-base-files, download-all-controller, engine-registry, targeted-mutations, engines, mutation-killers 1 to 5, tests/architecture): 13 files, 274 tests, all pass. `pnpm exec tsc --noEmit -p .` exit 0.

## Blast radius
Flag OFF: details dedupe is the base compare again; init now also resets download-all runs (destroy already did). Flag ON: stale posts no longer hide body buttons; API URLs with odd authuser values are kept; two more URL shape keys. Mutation-killers blocks were not edited.

## Rollback
Revert the three source files and two test files listed above; no data or config change.
