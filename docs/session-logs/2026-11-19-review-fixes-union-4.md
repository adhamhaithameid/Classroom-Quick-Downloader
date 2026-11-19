# Review fixes union-4 (v3-base file reconciler)

Branch feat/v3-base-engine. Nothing committed. Fourth fresh-eyes review, four findings.

## 1. driveFileKeys trusted any google.com id query (RISK) - real, fixed
- Evidence: canonical-id.ts matched host `/(^|\.)google\.com$/` then called extractDriveFileId, which falls back to any `id|resourceId|fileId` query. toDownloadUrlFrom passes unknown Google URLs through, so `sites.google.com/view/x?id=N` gave key `drive-N`.
- Red: `expected [ 'drive-url-z', 'drive-N' ] to deeply equal [ 'drive-url-z' ]`; and `expected [] to have a length of 1 but got +0` (API file wrongly skipped).
- Fix: googleDriveIdFromUrl now accepts only drive.google.com (/file/d, /open?id, /uc?id), drive.usercontent.google.com (/download?id), docs.google.com (/<kind>/d/<id>), classroom.google.com (/drive id|resourceId|fileId). Generic fallback removed.
- Green: v3-file-reconciler 26/26. Each trusted shape and five untrusted Google URLs are pinned.
- Files: src/engines/canonical-id.ts, tests/v3-file-reconciler.test.ts, tests/v3-mutation-killers-4.test.ts (bare google.com and evil-host killers rewritten for exact hosts).

## 2. Details-page dedupe compared canonicalId only (RISK) - real, fixed
- Evidence: engine-v2.ts covered, uncoveredIds and keptApi filter used canonicalId. A DOM `open?id=X` anchor (url-...) plus API drive-X both survived.
- Red: `expected [ {...}, {...} ] to have a length of 1 but got 2`.
- Fix: covered and uncoveredKeys built from driveFileKeys; uncovered and keptApi filtered with `.some(k => set.has(k))`.
- Green: v3-engine-base-files 23/23; v2 engine suites 83/83 (flag-OFF unchanged: keys superset only adds matches for url-/dataid- anchors whose URL names a Drive id; see blast radius).
- Files: src/engines/v2/engine-v2.ts, tests/v3-engine-base-files.test.ts.

## 3. digits-only authUser (NIT) - decided
- Evidence: DOM getPageAuthUser (src/v2/decision/download-url.ts) returns the raw query value; appendAuth sets it via searchParams. Numeric and email values are safe. Only values with `..` or `%` trip validateDownloadUrl; that path is pre-existing and rare.
- Decision: do NOT touch the DOM path (non-numeric values, e.g. an account email, would change flag-OFF output). Align the API side instead: pass the raw value, retry without authuser if the validator rejects the URL.
- Red: expected `...&authuser=me%40example.com`, received URL without authuser.
- Green: new test plus rewritten killer (1x carried, a..b dropped).
- Files: src/engines/v3/file-reconciler.ts, tests/v3-file-reconciler.test.ts, tests/v3-mutation-killers-4.test.ts.

## 4. Name and extension fallback (NIT) - partly real
- Extension: DOM scans `name || href`. API now scans `title || downloadUrl` (snapshot has no mime). A non-empty extensionless title stays '' on both paths, so the reviewer claim holds only for an empty title.
- Red: `expected [ '', '' ] to deeply equal [ 'pdf', '' ]`. Green: reconciler 26/26.
- Name: kept 'Untitled'. DOM gives '' when a non-empty name sanitizes empty; changing the DOM would alter flag-OFF output, and union-3 #1 pins Untitled. No change.
- Files: src/engines/v3/file-reconciler.ts, tests/v3-file-reconciler.test.ts.

## Observation (not changed)
engine-v2 details block: `covered` includes the details post's own files, so on a re-scan the post's DOM files that were already tracked are excluded from `uncovered`, and `post.files = [...uncovered, ...keptApi]` drops them when other new anchors appear. Pre-existing, flag-OFF behavior. Needs a separate decision.

## Verification
Targeted green: v3-file-reconciler, v3-engine-base-files, v3-mutation-killers (1-4), tests/architecture/ (127 tests, 7 files), killers-2 18/18, v2 engine suites 83/83. `pnpm exec tsc --noEmit -p .` exit 0.

## Blast radius
- Finding 1 narrows keys: fewer API files wrongly skipped. Risk: a Drive URL shape outside the list no longer dedupes (API file then added; at worst one duplicate, never a missing file).
- Finding 2 widens dedupe only in the details view; flag OFF output differs only when a details page has a Drive file as both url- anchor and another tracked file with the same Drive id.
- Findings 3-4 touch the flag-ON API path only.
## Rollback
Revert the three source files and the touched test blocks; no data or config changes.
