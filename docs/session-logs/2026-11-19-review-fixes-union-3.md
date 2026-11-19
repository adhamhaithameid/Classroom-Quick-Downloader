# Review fixes: union round 3 (2026-11-19)

Branch feat/v3-base-engine. Nothing committed. Flag OFF paths unchanged: the changed
code runs only through the API union (reconcileApiFiles, applyExternalFiles, and the
kept-API-file filters, which hold no API files when the flag is OFF).

## 1. Empty sanitized title - FIXED
- Verdict: real. file-reconciler.ts had `name: sanitizeFileName(attachment.title)`; the DOM
  path (engine-v2 extractFileNode) uses `... : 'Untitled'`.
- Red: `expected [ '', '' ] to deeply equal [ 'Untitled', 'Untitled' ]`
- Fix: `sanitizeFileName(title) || 'Untitled'`.
- Green: v3-file-reconciler 21/21.
- Files: src/engines/v3/file-reconciler.ts, tests/v3-file-reconciler.test.ts.

## 2. Dedupe misses url-/dataid- DOM canonicals - FIXED
- Verdict: real. Dedupe compared only `drive-<id>`; DOM `open?id=` anchors canonicalize as
  `url-...`, so the same Drive file was added twice.
- Red: `expected [ { ...(6) } ] to deeply equal []`
- Fix (flag-OFF-safe: canonicalId of DOM files is NOT changed): new `driveFileKeys(file)` in
  src/engines/canonical-id.ts returns the normalized canonical plus `drive-<id>` read from a
  Google-host download URL (core extractDriveFileId). Used in the reconciler `tracked` set,
  engine-v2 applyExternalFiles, and the two rescan keep-filters. A non-Google URL with
  `id=` does not match (tested).
- Green: v3-file-reconciler, plus engine test "(2 open?id=)" in v3-engine-base-files
  (3 files, count 3, not 4).
- Files: canonical-id.ts, file-reconciler.ts, engine-v2.ts, two test files.

## 3. Native Docs/Sheets/Slides URL - FIXED (parity), LIVE BEHAVIOR UNVERIFIED
- Finding: the DOM path converts every Drive/docs URL (including docs.google.com/document/d/)
  to the single byte-serving endpoint via toDownloadUrlFrom; there is no per-type export.
  The API path kept `drive.google.com/uc?export=download`. The API has no mimeType here.
- Red: `expected 'https://drive.google.com/uc?export=do…' to be 'https://drive.usercontent.google.com/…'`
- Fix: reconciler now runs `toDownloadUrlFrom(url, authUser)` (same pure rule as the DOM
  path) and validates the converted URL. Existing expectations for the API URL updated.
- Not verified live: whether the byte-serving endpoint downloads a native Google file
  correctly. Parity with the DOM path is the only claim.
- Green: v3-file-reconciler, v3-engine-base-files.

## 4. Group bail gives no feedback - NEEDS-DECISION (left, bead d2li)
- Bail kept. No cheap consistent channel: the only feedback is updateRunUI (cqd-all-*
  classes, text, reset timer), driven by a GroupRun with files. The bail runs before any
  run exists; reusing it needs new no-run state code, and the hotkey scan calls the same
  function for groups the user did not click (it would flash feedback on them).
- Files changed: none.

## 5. authuser trips the validator - FIXED in reconciler
- Verdict: real. authuser comes from route-context.ts resolveAuthUser (any query value,
  not digits-only), appended by student_work/url-classifier buildDriveDownloadUrl. A value
  with `..` or `%25` made validateDownloadUrl reject and silently drop the file.
- Fix: the reconciler rebuilds the URL itself and passes authUser only if `^\d+$`
  (else null). Test: authuser '../x%25' keeps the file with no authuser.
- Left alone (not my files): route-context.ts and the client keep the unconstrained value
  for other consumers (course inventory URLs). Suggest digits-only at the source.

## Verification
- Targeted: v3-file-reconciler, v3-engine-base-files, v2-download-all-controller,
  v3-mutation-killers(-2,-3), v3-engine-base, v2-engine-targeted-mutations, tests/architecture:
  10 files, 164 tests pass.
- tsc --noEmit: 3 errors, all in tests/v3-webauthflow-token-source.test.ts (the other
  agent's in-flight work, `launchTimeoutMs`/`fetchTimeoutMs` not in DepsOverrides). None in my files.

## Blast radius / rollback
- Affects only flag-ON API-union files: their download URL form, name fallback, and dedupe
  keys. A non-Google DOM URL never suppresses an API file. Risk: a DOM file whose URL names a
  different Drive id is unaffected. Rollback: revert the 3 src files and 2 test files.
