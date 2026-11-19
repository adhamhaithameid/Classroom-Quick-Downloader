# v3-base design — API engine as the Chrome base engine (2026-11-18)

Chat: v3-base-chrome. Worktree: CQD-wt-v3base, branch feat/v3-base-engine. Chrome only; other browsers wait for ADR 0010 (later chat).

## Current state (verified file:line)

- Registry (engines/engine-registry.ts, getActiveEngines 166-199): mode 'v3' +
  isApiConfigured() → ['engine-v3'] (179-183); without config → the
  ['engine-v1','engine-v2'] shadow pair (189-192).
- Chrome gate (engines/v3/api/config.ts): isApiConfigured() (72-98); the content
  path ends with isGoogleChromeBrand() (97) — Edge/Brave/Opera read unconfigured.
- V3 is assist-only (engines/v3/engine-v3.ts): wraps EngineV2 (94, 114), delegates
  all DOM work (170-206); ApiDetector composition root (117-124), additive-only
  flag corroboration (strategies/detect/api-detector.ts:141-166); snapshot refresh
  on student-work views only (224-251); correlateWithApi is a commented stub
  (302-307).
- API truth data exists: ClassroomApiSnapshot.submissions[].attachments
  (api/types.ts:11-29); discovery cache, one fetch per course:courseWork:submission
  key (discovery-service.ts:40-54), shared rate budget (rate-limiter.ts);
  course-wide fetchCourseDriveFiles (api/types.ts:48-52) drawn by
  v2/render/classroom-download-controller.ts.
- V2 render owns all sanctioned UI (buttons, badges, download-all, styles).
- Second UI exists — V1 legacy stacks, mode-gated: content/button-factory.ts,
  content/flags.ts, content/both-badge.ts, comment_frame.content.ts,
  edited_frame.content.ts, download_all.content.ts, content/styles.ts.
- Defect found: isV1Suppressed() is exactly mode === 'v2' (mode-gate.ts:50-56).
  In mode 'v3' with the API configured, V3 renders via the V2 render layer AND
  the six V1 stacks still run — double UI in v3 mode today.

## Target design (flag OFF ships zero change)

Flag: engineBase, 'v2' | 'v3'. Default 'v2' (OFF), code-level
(extension/src/engines/engine-base.ts, getter + test setter). Chrome-only via
isApiConfigured() — no new brand check.

Ruled decision — union, not replace: the API can ADD files to a post's list; it never removes DOM files, so a false-empty or mapping miss cannot hide a file.

Flag ON semantics:
1. engine-v3 becomes the base engine in mode 'v3'. New module
   engines/v3/file-reconciler.ts merges the snapshot's submission attachments
   into the tracked post's FileNode list, deduped by Drive id. API-only files
   become synthetic FileNodes (new idSource 'api-snapshot') that join the post's
   file set; V2 render draws every button and count — no new UI code. Mapping
   rule: per submission; with studentSubmissionId in the route context that
   submission maps to the one tracked post. List views have no post-to-student
   mapping yet, so DOM stays the source there (phase 2).
2. Registry 'v3' fallback: ['engine-v2'] (pure V2 DOM), not the V1+V2 shadow pair.
3. mode-gate suppresses the V1 stacks in mode 'v3' (fallback is V2-only, and V3
   renders through V2). Fixes the double-UI defect.
4. Modes 'legacy' and 'shadow' stay byte-identical (rollback paths).
5. DEFAULT_MODE stays 'v2'. Popup Engine Mode UI untouched. Consent (#398) stays:
   API fetches run only after the user picks 'API (beta)'.

## Fallback matrix (flag ON, mode 'v3')

| Case | File list | Error shown |
|---|---|---|
| API ok, single submission | union(API, DOM) via V2 render | none |
| API ok, list view | DOM verbatim (no mapping yet) | none |
| 401 (ClassroomApiAuthError) | DOM verbatim | none (silent) |
| 403 / offline / quota / fetch reject | DOM verbatim | none |
| empty snapshot (0 rows) | DOM verbatim (union with empty) | none |

Every case lands on a V2 DOM scan with no user-visible error. V1 never renders.

## Risks

- Reconciliation mutates V2 tracked posts — additive idempotent merge (dedupe by
  canonicalId, cleared on destroy); synthetic FileNodes have no DOM anchor (post
  file set only, no per-file button); staleness 120s (api-detector.ts:93); rate
  budget unchanged (cache-first discovery adds no calls).

## Test plan (TDD, red first)

1. tests/v3-engine-base.test.ts — flag default 'v2'; registry flag OFF pins today's
   mapping, flag ON pins ['engine-v2'] fallback; (a) union merge through the V2
   render count path + exactly 1 discovery call per TTL; (b) matrix rows land on
   DOM verbatim, no throw.
2. tests/v4-mode-gate-engine-base.test.ts — flag ON + mode 'v3' suppresses V1;
   flag OFF unchanged.
3. tests/architecture/ui-single-source.test.ts — (c) static scan: outside
   v2/render + a documented allowlist, nothing creates buttons or HTML.

## Perf plan (step 4)

- content-script bundle: wxt build output size, before (BASE) vs after.
- first-scan: timed V2 fullScan on the largest fixture
  (details-aria-cards-2026-10.html, 1.4MB). API calls per view: 1 per
  course:courseWork per TTL (test pinned).

## Rollout

- Flip = change the engine-base.ts default to 'v3' in a later PR (owner call),
  then flip DEFAULT_MODE after shadow data. This chat ships the code path OFF.
  Rollback: default back to 'v2' (one line) or storage cqdV2Mode='v2'.
  Flip-PR checklist: per-context flag wiring (each entrypoint bundle has its
  own module instance — gates read it independently); fix mode-gate.ts:101 +
  the stale gateV1Stack doc; flag-OFF mutation path is code-guarded only.

## Open items (report only, no bd writes)

- Phase-2 download integration (ONE follow-up bead, flag-ON only): the group
  button plans from DOM-anchored files, so a post below
  MIN_FILES_FOR_DOWNLOAD_ALL in the DOM never shows the button even when the
  union clears the threshold; and the group run enumerates DOM buttons only, so
  API-only files raise the label but cannot join a run. Fix both together
  (union-count decision + button-less GroupRun files; related minors:
  lastRenderApplied cycle reset, reconciler header count claim). Mutation-path
  union persistence is FIXED (handleMutations re-apply, tested); correction-queue
  'inject-button' can still wipe it — same bead.
- Move legacy-only V1 UI onto V2 render — touches rollback modes; defer with the
  shallow-module audit. Guard probe found UNGATED creators the inventory missed:
  student_work_sidecar/by-status entrypoints + src/student_work/button.ts render
  in EVERY mode; src/download-all/button-controller.ts builds the V1 download-all
  button (v2/render imports only findHeaderContainer). NEEDS-OWNER: entrypoints
  outside content/**.
- Post-to-student mapping on submissions list views (phase 2).
- engineBase as a user-visible setting (settings store + popup — out of lane);
  Firefox/Edge base-engine decision (ADR 0010, later chat).
