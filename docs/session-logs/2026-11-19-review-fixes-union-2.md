# Review fixes union-2 (2026-11-19, branch feat/v3-base-engine)

Method: test first (red quoted), fix, green. Targeted runs only.
Final: 7 files, 129 tests passed (reconciler, engine-base-files, download-all-controller,
button-renderer, engine-base, tests/architecture). `tsc --noEmit` shows no errors in touched files.

| # | Verdict | Red | Fix | Files |
|---|---|---|---|---|
| 1 | REAL | `expected true to be false` (collapsed post, API file + label 3, no DOM buttons: run started) | startRun bails (returns false) when API files exist, zero DOM buttons, and label count minus API count > 0. API-only post (details shape) still runs (pinned). | download-all-controller.ts, v2-download-all-controller.test.ts |
| 2 | REAL (defensive: real DOM forms are `drive-<id>`, `dataid-..`, `url-..`; only a non-prefixed emit would collide) | `expected 1 to be +0`; `expected [ 'RAWDOMID…', …(1) ] to deeply equal [ 'RAWDOMID…' ]` x2 | Compare `toCanonicalDriveId(canonicalId)` in applyExternalFiles, ingestPost, inject-button correction. Helper moved to new `src/engines/canonical-id.ts` (v2 must not import v3); reconciler re-exports it. | engine-v2.ts, canonical-id.ts, file-reconciler.ts, v3-engine-base-files.test.ts |
| 3 | REAL | `expected '3' to be '2'` (marker stripped, API file gone, label stayed 3) | Per-post `postsWithApiFiles` set: marker-free selector for any post that ever carried API files. Cleared on post removal and on engine reset. Flag OFF: set stays empty, selector unchanged. | engine-v2.ts |
| 4 | REAL | `expected [ Array(5) ] to deeply equal [ 'drive-GOOD_1' ]` | `validateDownloadUrl` gate; failing rows dropped. URL value is not rewritten. | file-reconciler.ts |
| 5 | REAL | `expected '../../etc/passwd.pdf' to be 'etcpasswd.pdf'` | `sanitizeFileName(attachment.title)` (src/core/name/sanitize). | file-reconciler.ts |
| 6 | REAL | `expected [] to deeply equal [ 'drive-drive-X1234567890' ]` | API side always `drive-${id}`; DOM-side tracked ids keep idempotent helper. | file-reconciler.ts |
| 7 | REAL | `expected "vi.fn()" to be called with arguments: [ 'post-1', [] ]` | New private `dropApiFiles(postId)` at the 3 postMap.delete sites (targeted cleanup, details empty-post drop, fullScan cleanup). | engine-v2.ts |
| 8 | NOT REAL as written | none | In current code the three cheap gates (flag, view, snapshot) already run before `getTrackedPosts()`. Only a tiny array allocation remains after them. No change. | engine-v3.ts (unchanged) |
| 9 | NEEDS-DECISION | none | engine-v3.ts snapshot is not tied to a post id; the single-post gate is the only guard. Cheapest option inside my files: also require `snapshot.context.studentSubmissionId` to match a post-level id, but the post has no such id in V2 (needs the DOM scanner or a post-to-student map). Not implemented. | none |

## Not done / notes
- engine-v2.ts details-view `covered`/`uncoveredIds` compare still uses raw canonicalId (same class as #2, outside the three listed sites, no red test written). Offer: switch to `toCanonicalDriveId`.
- Finding 1 bail leaves the click as a no-op for that post; label count still includes API files (unchanged by design).

## Blast radius
- Flag OFF (engineBase v2): apiFiles empty, set empty, `apiFilesByPost` empty, so controller guard, selector and dedupe keys are unchanged. Dedupe now uses prefix-normalized keys; DOM ids are already `drive-` prefixed so keys are identical.
- Flag ON: invalid-host API URLs no longer reach download:requested; API names are sanitized (names may differ from raw titles); a collapsed post with API files has no group run until expanded.
- New file canonical-id.ts is pure, no imports.

## Rollback
Revert the listed files (`git checkout -- <file>`, delete canonical-id.ts). No schema, storage or manifest change.
