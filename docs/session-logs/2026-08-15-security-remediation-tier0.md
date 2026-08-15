# Session log — 2026-08-15 — Tier 0 security remediation

## What changed

30 commits on `main`, one file per commit, not yet pushed.

### Go toolchain (fixes red CI)
- `oracle-backend/go.mod`: `go 1.26.5` → `1.26.6`
- `.github/workflows/ci.yml`: 3 `go-version` pins → `1.26.6`
- `.github/workflows/oracle-backend-ci.yml`: 4 `go-version` pins → `1.26.6`
- `oracle-backend/Dockerfile`: builder image → `golang:1.26.6-alpine3.24@sha256:af8d6740070b8906d12eae1c3e3ea0957fb63f492051ea05e354c38ef9fe88df`

### Extension
- `extension/wxt.config.ts`: removed unused `tabs` permission

### Already-staged audit work (committed, not authored this session)
Workflow SHA pinning across 14 workflows, `permissions: contents: read` scoping,
archiver SSRF hardening, SVG denylist → allowlist, dependency bumps across all
5 package manifests + lockfile, obsolete eslint patch removal.

## Why

`Oracle Backend CI` had failed 3 consecutive days. Root cause: `govulncheck`
reported 11 reachable vulnerabilities; 8 of them are Go standard library issues
whose fix is `go1.26.6` (`net/url`, `html/template`, `crypto/tls`, `net/http`,
`encoding/xml`, `encoding/asn1`, `net/http/idna`). The pending working tree only
went to `1.26.5`, which covers 2 of the 11.

The `tabs` permission was requested in the manifest but `chrome.tabs` /
`browser.tabs` has zero call sites in `extension/src` — it widened the install
prompt and attack surface for nothing.

## Verification performed

| Check | Result |
|---|---|
| `go build ./...` | exit 0 |
| `go test ./...` | all 8 packages `ok` |
| `govulncheck ./...` | **0 vulnerabilities** (was 11) |
| `pnpm install --frozen-lockfile` | clean — lockfile consistent with manifests |
| `pnpm -C extension run compile` | exit 0 (tsc --noEmit) |
| `pnpm -C extension run test` | 101 files, 3245 tests passed |
| `pnpm -C website run test:unit` | 11 files, 898 tests passed |
| `vitest run placements.test.ts` | 13 tests passed |
| `pnpm -C cloudflare-worker run test:smoke` | 2 files, 16 tests passed |

Local `govulncheck` needed `GOTOOLCHAIN=go1.26.6` because `@latest` (v1.7.0)
declares `go >= 1.25.0` and auto-switched to `go1.25.13`, which cannot parse
go1.26 source. CI is unaffected: it pins `govulncheck@v1.1.4` and runs it under
setup-go's `1.26.6`, so no toolchain switch occurs. No CI change was needed.

## Impact / risk

**Blast radius:** every workspace. The dependency set includes major bumps
(`vite@8.2.1`, `typescript@6.0.3`, `svelte@5.56.8`, `eslint@10.8.1`). All test
suites pass locally, but the heavy matrix (`test:strict`) was not run.

**Rollback:** `git reset --hard b2205829` returns to pre-session state
(that commit is the last one authored before today).

**Not verified:** `test:strict`, `scan:security`, production deploy paths.

## Deliberately NOT committed

- `LICENSE` — modified in the working tree from a custom license to
  **PolyForm Strict 1.0.0**. This is a licensing decision, not security work,
  and the 2026-08-08 audit report explicitly records it as pre-existing and
  intentionally untouched. Left uncommitted pending an explicit decision.

## Open items

1. Push 44 commits (30 from today + 14 authored 2026-06-10, still unpushed).
2. Decide on the `LICENSE` change.
3. CodeQL: 11 open alerts, 10 assessed as false positives (see below), 1 needs real review.
4. Close Dependabot PRs #723, #724 — both superseded.
5. Close 9 duplicate draft PRs.

## CodeQL assessment (code read, not yet dismissed)

| Alert | Verdict |
|---|---|
| `go/request-forgery` public_website.go:1764 | FP — `isAllowedUserChangelogHost` is a strict 2-host switch, redirects re-validated per hop |
| `go/path-injection` main.go:997 | FP — `filepath.Rel` containment check precedes `os.Stat` |
| `go/cookie-secure-not-set` auth.go ×4 | FP — `cookieSecurityPolicy` sets Secure under TLS or trusted `X-Forwarded-Proto`; default mode `auto`; covered by tests in main_test.go |
| `go/uncontrolled-allocation-size` admin_sql.go:115 | FP — `limit` hard-capped at 2000 above the allocation |
| `go/sql-injection` admin_backup.go:102 | Accept — SQLite `VACUUM INTO` cannot bind params; filename regex + canonical path + quote escaping |
| `go/sql-injection` admin_sql.go:99,219,235 | **Needs real review** — guards are regex-based (forbidden-term, comment-strip, table allowlist). Regex SQL parsing is historically bypassable. Feature-flagged + read-only handle mitigate, but this is not a safe dismissal |
