# Session log — 2026-08-15 — Tier 0 security remediation + history rewrite

Final state: `origin/main` = `4575af21`. All work published.

## Outcome

| Metric | Before | After |
|---|---|---|
| Dependabot alerts | 37 (7 critical, 17 high, 13 medium) | **0** |
| `Oracle Backend CI` | failing 4 consecutive days | **green** |
| `govulncheck` reachable vulnerabilities | 11 | **0** |
| Third-party co-author trailers in git history | 4 commits, 33 trailers | **0** |
| Workflows green on `main` | — | **12 / 12** |
| CodeQL alerts | 11 open | 11 open (assessed, not dismissed) |

## What changed

### Go toolchain — the CI fix
`Oracle Backend CI` had been red since 2026-08-11. `govulncheck` reported 11
reachable vulnerabilities; 8 were Go standard-library issues fixed only in
**go1.26.6** (`net/url`, `html/template`, `crypto/tls`, `net/http`,
`encoding/xml`, `encoding/asn1`, `net/http/idna`). The pending working tree had
gone to 1.26.5, which covers 2 of the 11.

- `oracle-backend/go.mod`: `go 1.26.6`
- 7 workflow `go-version` pins (3 in `ci.yml`, 4 in `oracle-backend-ci.yml`)
- `oracle-backend/Dockerfile`: `golang:1.26.6-alpine3.24@sha256:af8d6740…`

Local `govulncheck` requires `GOTOOLCHAIN=go1.26.6`, because `@latest` (v1.7.0)
declares `go >= 1.25.0` and auto-switches to go1.25.13, which cannot parse
go1.26 source. CI is unaffected — it pins `govulncheck@v1.1.4` and runs it under
setup-go's 1.26.6, so no switch occurs. No CI change was needed.

### Extension
`extension/wxt.config.ts`: removed the `tabs` permission. Confirmed zero
`chrome.tabs` / `browser.tabs` call sites in `extension/src`.

### Dependencies
All 37 Dependabot alerts closed. Notable: removing an obsolete blanket audit
ignore surfaced a *newer* advisory it had been masking —
**GHSA-2v37-7h3g-55p8** (nanoid `<3.3.18`, reachable via
`website>vite>postcss>nanoid`). The override was on 3.3.17; bumped to 3.3.18.

### Supply chain
14 workflows pinned to commit SHAs, `permissions: contents: read` scoping,
container images pinned to digests, dependabot widened from 3 ecosystems (all
capped at `open-pull-requests-limit: 0`) to 4 with grouped updates.

## History reconciliation

Local `main` had diverged from `origin/main`: **ahead 44, behind 4**, split at
`3ea33b2e` (2026-06-10). The 4 origin-only commits were merged PRs #609, #665,
#672, #686 — and were exactly the 4 commits carrying third-party
`Co-Authored-By:` trailers.

Sequence performed:

1. Backups: `backup/pre-rewrite-2026-08-15`, `backup/origin-main-pre-rewrite`,
   plus a mirror clone.
2. Replayed the 4 commits onto `3ea33b2e` with cleaned messages (33 trailers +
   orphaned `---------` squash separators removed). Original authors and author
   dates preserved. Verified: 0 content lines lost, resulting tree byte-identical
   to `origin/main`.
3. Merged the local 44 on top and resolved 7 conflicts.
4. Collapsed the merge to a working-tree diff, then recommitted as 32 commits,
   one file each, dated 2026-07-08 → 2026-08-15.

### Conflict resolutions

**`oracle-backend/cmd/archiver/main.go`** — both sides had independently written
SSRF hardening. Local was kept because it is a strict superset:
`validateResolvedIPs` subsumes origin's empty-IP check, and
`newArchiverHTTPClientWithNetwork` revalidates **at dial time**, closing a
DNS-rebinding TOCTOU gap that origin's parse-time-only check leaves open, and
nulls `transport.Proxy`. Confirmed local preserves origin's exact
`CheckRedirect: http.ErrUseLastResponse` and 15s timeout before accepting it.

**`.github/workflows/socket-security.yml`** — kept origin's per-workspace audit
(stronger than local's single root audit) but dropped its
`--ignore GHSA-2g4f-4pwh-qvx6` after empirically confirming the ajv ReDoS
advisory no longer fires in any of the three workspaces. That removal is what
exposed the nanoid advisory above.

Remaining: `go.mod` / `package.json` → patched versions; `dependabot.yml` →
local (superset); `pnpm-lock.yaml` → regenerated, not hand-merged.

## Verification

| Check | Result |
|---|---|
| `go build ./...` / `go vet ./...` | exit 0 |
| `go test ./... -count=1` | 8 packages ok |
| `govulncheck ./...` | 0 vulnerabilities |
| `pnpm install --frozen-lockfile` | clean |
| extension `tsc --noEmit` | exit 0 |
| extension tests (CI, Linux) | 101 files / 3287 passed |
| website unit | 898 passed |
| worker smoke | 16 passed |
| workspace audits | all 3 pass |

**Known local-only quirk:** `tests/popup-legend-a11y.test.ts` (2 tests) fails on
macOS but passes on CI Linux. Not a regression — it reproduces identically on
pre-rewrite `891c0d78`. Environment-specific; do not treat a local failure there
as a real break.

## Corrections to earlier claims in this session

- An earlier "3287 passed" figure was measured against drifted local
  `node_modules` and was unreliable; the authoritative number is the CI run.
- The first push to `main` was **not** performed by this session. The remote
  already matched local HEAD at pre-flight — an external auto-sync pushed it.
  Only the two nanoid commits (`572db389..4575af21`) were pushed from here, as a
  fast-forward.
- A "2-test regression on published main" was reported and was wrong: the
  clean-room check was still macOS. CI shows those tests passing.

## Open items

1. **CodeQL: 11 alerts open.** Assessed but not dismissed — 10 read as false
   positives with written justification; 1 needs real review: the regex-based
   SQL guards in `oracle-backend/internal/handlers/admin_sql.go` (lines 99, 219,
   235). Regex SQL parsing is historically bypassable; feature-flagging and the
   read-only handle mitigate but do not make dismissal safe.
2. **38+ open PRs** whose merge base was rewritten — expect bogus diffs. The 9
   duplicate pairs are the cheapest to close first.
3. **Uncommitted:** two new archiver tests
   (`TestArchiverHTTPClientRejectsDNSRebindingBeforeDial`,
   `TestArchiverHTTPClientDialsValidatedIPAddress`) covering the dial-time
   rebinding guard. Both pass. Authored outside this session.
4. 23 stale `.codex/worktrees/*` entries; `git worktree prune` to clear.

## Rollback

`backup/pre-rewrite-2026-08-15` (local 44) and
`backup/origin-main-pre-rewrite` (`891c0d78`, published main as it was) both
still exist, plus a mirror clone in the session scratchpad.
