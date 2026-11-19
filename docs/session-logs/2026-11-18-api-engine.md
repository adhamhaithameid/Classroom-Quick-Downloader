# api-engine chat (chat 4 of 4) — 2026-11-18

Scope: v3 API engine — token relay, `isApiConfigured` gate, OAuth scopes,
HTTP 401 surfacing, list pagination, cross-browser ADR draft.
Worktree: `../CQD-wt-api`, branch `fix/api-engine-token-relay`, cut from
`origin/main` @ `460e60cb`. No commits, no pushes, no `bd` writes (per brief).

## Premise check (brief vs code)

The brief expected three failing tests to exist only as uncommitted files in
the main checkout. Reality, verified against code:

- The main checkout (`fix/qa-sweep-website`) predates `origin/main` and is
  clean. All three test files were ALREADY COMMITTED on `origin/main` and
  present in the new worktree. Nothing needed copying.
- Findings 1 (token relay), 2 (`isApiConfigured` content-script gate), and
  3 (fine-grained scopes) were ALREADY IMPLEMENTED on `origin/main`:
  - `extension/src/engines/v3/api/token-provider.ts` — `relayTokenRequest`
    when `chrome.identity` is absent.
  - `extension/entrypoints/background/api-token.ts` — `handleApiTokenRequest`
    with the classroom.google.com sender check (strict hostname + https).
  - `extension/src/engines/v3/api/config.ts` — identity permission +
    `oauth2.client_id` + `isGoogleChromeBrand()` gate.
  - `extension/wxt.config.ts:60-64` — exactly the three readonly scopes the
    guard test demands.
- Baseline run of the three "known failing" files in the worktree:
  26/26 PASS. The failures the brief predicted were fixed by the merged
  csaa.7 work before my branch point. Bead csaa.7's "code part done" claim
  is TRUE against code (the brief said: do not trust the bead — verified
  anyway).

## Real work done

### Finding 5 — 401 became an empty course; 3-page list cap (fixed, TDD)

Verified defects in `extension/src/engines/v3/api/classroom-api-client.ts`:
`!response.ok` returned the partial/empty list on ANY status, so a dead
token (HTTP 401) rendered as "No downloadable files found" — and
`CourseInventoryService` cached that empty inventory for the 5-minute TTL.
`MAX_LIST_PAGES = 3` cut courseWork/courseWorkMaterials mid-pagination.

New tests: `extension/tests/v3-api-client-errors.test.ts` (7 tests).

RED run (exact output):
```
 ❯ tests/v3-api-client-errors.test.ts (7 tests | 6 failed) 12ms
 FAIL ... throws ClassroomApiAuthError when courseWork.list answers 401
 AssertionError: promise resolved "[]" instead of rejecting
 FAIL ... later page 401 → AssertionError: promise resolved "[ { id: 'FILE_1', …(3) } ]" instead of rejecting
 FAIL ... studentSubmissions 401 → AssertionError: promise resolved "[]" instead of rejecting
 PASS ... keeps R7 silent degradation for non-401 errors (intentional pin)
 FAIL ... getInventory on 401 → AssertionError: expected { fetchedAt: … } to be null
 FAIL ... discover() on 401 → AssertionError: promise resolved "{ fetchedAt: … }" instead of rejecting
 FAIL ... pagination → AssertionError: expected 3 to be 5
 Test Files  1 failed (1)  Tests  6 failed | 1 passed (7)
```

GREEN fix (same file):
- New exported `ClassroomApiAuthError` (status 401). Both list methods throw
  it on HTTP 401 only; every other non-OK status keeps the R7
  silent-degradation partial (pinned by an existing test and a new one).
- `MAX_LIST_PAGES` 3 → 20 (safety cap only; the loop normally ends when the
  API stops sending `nextPageToken`; the csaa.5 budget gate still runs
  before every HTTP call).

Consumer behavior on 401, both verified in tests:
- `CourseInventoryService.getInventory` resolves null and does NOT cache —
  the second click retries instead of serving a cached empty course; the
  controller then renders "Couldn't list files" (failure), not "No
  downloadable files found" (lie).
- `ClassroomApiDiscoveryService.discover` rejects without caching; retry
  hits the network again. `EngineV3.refreshApiSnapshot` already catches
  (`engine-v3.ts:247`) and warns — no unhandled rejection anywhere.

One typecheck round-trip: the first `scripts/check extension` failed with
TS2345 (my test used a partial `ClassroomApiRouteContext`). Fixed the test
to the full shape (`viewKind: ViewKind.STUDENT_WORK_TEACHER`, …). Test-only
change; no production code touched for it.

### Finding 4 — cross-browser OAuth (DOC ONLY)

New draft `docs/adr/0010-cross-browser-oauth-web-auth-flow.md`, status
"proposed (DRAFT)". Covers: Firefox has no `getAuthToken`; Edge/Brave/Opera
ship the surface but it never answers; the design is Authorization Code +
PKCE over `identity.launchWebAuthFlow`, needing an owner-provided OAuth
WEB APPLICATION client (owner prerequisite), redirect-URI allowlist,
refresh-token lifecycle in `storage.local`, provider selection per browser,
and an `isApiConfigured` branch. NOT implemented, per brief.

## Files changed (worktree, uncommitted)

| File | Why |
|---|---|
| `extension/src/engines/v3/api/classroom-api-client.ts` | 401 → `ClassroomApiAuthError`; `MAX_LIST_PAGES` 3 → 20; doc comments |
| `extension/tests/v3-api-client-errors.test.ts` | NEW — 7 regression pins (RED→GREEN quoted above) |
| `docs/adr/0010-cross-browser-oauth-web-auth-flow.md` | NEW — DOC ONLY draft |
| `docs/session-logs/2026-11-18-api-engine.md` | NEW — this report |

Lane check: no background file was touched (the relay handler already
existed; the "one registration line" the brief allowed was never needed).
No files outside my lane were edited.

## Commands and exit status

| Command | Exit | Result |
|---|---|---|
| `git worktree add ../CQD-wt-api -b fix/api-engine-token-relay origin/main` | 0 | worktree @ `460e60cb` |
| `pnpm install --frozen-lockfile` (worktree root) | 0 | deps installed |
| `vitest run` 3 brief test files (baseline) | 0 | 26/26 pass (findings 1–3 pre-merged) |
| `vitest run tests/v3-api-client-errors.test.ts` (RED) | 1 | 6 failed / 1 passed |
| same (GREEN) | 0 | 7/7 pass |
| `vitest run` 8 v3 + guard files | 0 | 53/53 pass |
| `./scripts/check extension` (1st) | 1 | `FAIL extension:typecheck` TS2345 ×4 (test file) |
| `./scripts/check extension` (2nd) | 0 | `ok extension:typecheck` + `ok extension:test` |

Full `scripts/check extension` output (final, quoted):
```
ok extension:typecheck
ok extension:test
CHECK_EXIT=0
```

## What could break

- The pagination raise (3 → 20 pages) lets very large courses issue more
  API calls per click. Bound: 20 pages × 100 items per list × 2 lists, and
  the shared csaa.5 rate-limiter budget gates every call, so a worst case
  consumes budget rather than bursting.
- The 401 throw changes behavior for callers that previously saw `[]`.
  Audited callers: `CourseInventoryService` (catch → null, uncached),
  `discovery-service` (propagates; engine-v3 catches), tests. No other
  callers exist (grep verified).
- A Classroom API outage that answers 401 (rare; 401 means auth, 5xx means
  outage) would now surface as "Couldn't list files" instead of a silent
  empty state. That is the intended contract.

## Rollback

All changes are uncommitted in `../CQD-wt-api`:
```
git -C /Users/adhamhaithameid/Desktop/code/CQD-wt-api checkout -- extension/src/engines/v3/api/classroom-api-client.ts
rm -f /Users/adhamhaithameid/Desktop/code/CQD-wt-api/extension/tests/v3-api-client-errors.test.ts \
      /Users/adhamhaithameid/Desktop/code/CQD-wt-api/docs/adr/0010-cross-browser-oauth-web-auth-flow.md \
      /Users/adhamhaithameid/Desktop/code/CQD-wt-api/docs/session-logs/2026-11-18-api-engine.md
```
(or discard the whole worktree: `git worktree remove ../CQD-wt-api --force`)

## Open items (proposed beads — NOT filed, bd writes forbidden)

1. [api-engine] Owner decision needed on ADR-0010: mint the OAuth web
   application client (second client, same Cloud project) or decline and
   keep Chrome-only API assist. Blocks any `launchWebAuthFlow` build.
2. [api-engine] `fetchStudentSubmissions` keeps its own `pageGuard < 10`
   cap with `pageSize` 200 — generous already; consider aligning it with
   the 20-page safety-cap language for consistency (cosmetic).
3. [docs] docs/INDEX.md needs no per-file ADR entry today (it links the
   directory), but ADR-0010 should move proposed → accepted/rejected once
   the owner decides.
4. [qa] The 401 → "Couldn't list files" path is unit-pinned but not
   browser-verified end to end; fold into the next HITL live-Classroom
   session (needs a real expired-token scenario).
