# Review fixes: API file union (v3-base)

Branch feat/v3-base-engine. No commits made. Flag OFF (engineBase 'v2') behavior is unchanged: apiFiles is always [] there.

## Finding 1 - API union lost on targeted re-scan (REAL)
- Verdict: real. `ingestPost` did `post.files = this.discoverFiles(postEl)` (wholesale replace). Engine-v3 re-added the files after each mutation, but `reconcileApiFiles` returns [] once the snapshot is over 120 s old, so after that the files vanished.
- Red: `(1 stale-retention)` -> `AssertionError: expected [ { …(6) }, { …(6) } ] to have a length of 3 but got 2`.
- Fix: engine-v2.ts `ingestPost` carries `splitApiFiles(post.files).apiFiles` over and drops any whose canonicalId the DOM also found. Staleness still gates only NEW adds (file-reconciler.ts header comment documents this).
- Green: 28/28 in v3-file-reconciler + v3-engine-base-files.

## Finding 2 - raw id vs drive-<id> (REAL)
- Verdict: real. Reconciler used `canonicalId: attachment.id`; DOM files use `drive-<id>` (engine-v2 extractFileNode, lines ~911/917). Download-all run dedupes on fileId, so both forms downloaded twice.
- Red: `expected 'FILE_1' to be 'drive-FILE_1'` (reconciler tests) and `expected 'drive-APIFILE…' to be 'APIFILE…'` after the fix when the pinned tests still used the raw id.
- Fix: new exported `toCanonicalDriveId` (idempotent) in file-reconciler.ts. API files get `drive-<id>`; the tracked set is normalized with the same function, so legacy raw ids still match.
- Tests: reconciler DOM-then-API and API-then-DOM; engine `(2 DOM-then-API)` and `(2 API-then-DOM)` (the latter also runs the inject-button correction).
- Pinned flag-ON tests (a), (a-mutation), (run), reconciler "maps..." and "returns only the NEW files" now assert the `drive-` form. These are flag-ON expectations, changed on purpose.
- Note: API-then-DOM was green before the fix only because engine-v3 re-reconciled after the wipe from finding 1. It becomes a real guard once retention exists.

## Finding 3 - details path drops API files (REAL)
- Verdict: real. `post.files = uncovered` dropped API-only files. The `covered` set compared raw API ids to DOM `drive-<id>`.
- Red: `(3 details)` -> `expected [ 'drive-DETAILSbbbb…' ] to include 'drive-APIONLY…'`.
- Fix: engine-v2.ts details block keeps the post's apiFiles (minus ids already in `uncovered`). Canonical ids from finding 2 make `covered` match.
- Green: same run, 28/28.
- Pre-existing, untouched: `covered` includes the details post's own earlier files, so a rescan keeps only newly uncovered DOM anchors. Not in scope.

## Finding 4 - snapshot to post tie (NEEDS-DECISION)
- Verdict: valid risk, not fixed. `ClassroomApiRouteContext` (api/types.ts) holds courseId, courseWorkId, authUser, studentSubmissionId, but no post/stream-item id. The snapshot cannot carry it without a type change in api/types.ts, discovery-service.ts and the cache key, which are outside my file scope.
- Kept: `posts.length !== 1` guard in engine-v3.ts, unchanged.
- Missing: a post id in the context, or a mapping from studentSubmissionId to a DOM post.
- Cheap partial option for the owner: in engine-v3, re-resolve the route at apply time and require `studentSubmissionId` equal to the snapshot's. It ties snapshot to route, not to post.

## Files changed (mine)
- extension/src/engines/v2/engine-v2.ts
- extension/src/engines/v3/file-reconciler.ts
- extension/tests/v3-file-reconciler.test.ts
- extension/tests/v3-engine-base-files.test.ts
(engine-v3.ts untouched.)

## Verification
`pnpm exec vitest run` on v3-file-reconciler, v3-engine-base-files, tests/architecture/, v2-download-all-controller, v3-engine-base, v2-engine-targeted-mutations: 7 files, 92 tests passed.

## Blast radius
- Flag ON only: file counts and Download All labels on student-work and details views; fileId of API files in the run changes to `drive-<id>` (the url is unchanged, so downloads are unaffected).
- Flag OFF: `splitApiFiles` returns no API files, so the new lines only re-assemble the same array. `ingestPost` result is identical.
- Risk: any consumer that read the raw API id from `canonicalId`. grep found none outside tests.

## Rollback
Revert the edits to engine-v2.ts (two blocks: ingestPost, details), file-reconciler.ts (canonical id), and the changed test expectations. No data or storage migration.
