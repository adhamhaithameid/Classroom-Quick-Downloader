# Final Plan: Complete Repository Health & Structure Overhaul

## Context

Classroom Quick Downloader is a 4-service pnpm monorepo with 3.2+ years of growth. Eight exploration agents scanned every file, config, test, and CI workflow. This plan covers **70+ issues** organized into 4 risk-graded tiers.

---

## TIER 1: Safe Restructure (Zero Downtime)

### Critical Discovery: GitHub Blob URLs Constrain MD Moves

**5 root MD files are referenced by GitHub raw/blob URLs in production runtime code.** Moving them breaks these URLs:

| File | Referenced By |
|------|--------------|
| `CHANGELOG.md` | `website/src/lib/api/publicSite.ts`, oracle static JS |
| `PRIVACY.md` | `website/src/lib/content/privacy.ts`, `website/src/lib/api/publicSite.ts`, tests |
| `user-friendly-changelog.md` | `cloudflare-worker/src/downloads_do.ts` (raw URL), `dashboard/main.ts` (blob URL), website routes |
| `SECURITY.md` | `.github/ISSUE_TEMPLATE/config.yml` (GitHub blob URL) |
| `README.md` | GitHub auto-renders root README |

**These 5 MUST stay at root.** Only 9 other MDs can safely move to `docs/`.

### Safe Moves

**1. Move 9 MDs to `docs/`:**
`ARCHITECTURE.md`, `ARCHITECTURE_RUNTIME_CONTRACT.md`, `DEVELOPMENT.md`, `TESTING.md`, `BOTS.md`, `SECURITY_DEV.md`, `plan.md`, `plan2.md`, `refactor-plan.md`

**`CONTRIBUTING.md` stays at root** (GitHub auto-displays root CONTRIBUTING.md when opening issues/PRs).

**2. Move `agents/` to `.github/agents/`**
**3. Rename `manual/changelog/` to `data/changelog/`**
**4. Rename `oracle-backend/dashboard-src/` to `oracle-backend/dashboard/`**
**5. Add `tools/package.json`** (minimal `{ "name": "@cqd/tools", "private": true }`)

### Reference Updates (after moves)

| File | From | To |
|------|------|-----|
| `README.md:152` | `DEVELOPMENT.md` | `docs/DEVELOPMENT.md` |
| `README.md:194` | `./ARCHITECTURE.md` | `./docs/ARCHITECTURE.md` |
| `README.md:199` | `./agents/jules/README.md` | `./.github/agents/jules/README.md` |
| `BOTS.md:22,26,74` | `agents/jules/` | `.github/agents/jules/` |
| `CONTRIBUTING.md:11` | `agents/jules/README.md` | `.github/agents/jules/README.md` |
| `tools/sync-manual-changelog.mjs:6` | `'manual/changelog'` | `'data/changelog'` |
| `oracle-backend/tsconfig.dashboard.json:13` | `dashboard-src/**/*` | `dashboard/**/*` |
| `tools/phase13_rollout.sh:107` | `ARCHITECTURE_RUNTIME_CONTRACT.md` | `docs/ARCHITECTURE_RUNTIME_CONTRACT.md` |
| `tools/run-extension-phase0-baseline.mjs` | `refactor-plan.md` | `docs/refactor-plan.md` |
| `extension/src/v2/debug/debug-panel.ts:21` | `plan2.md` | `docs/plan2.md` |
| `cloudflare-worker/src/index.ts:2727` | `manual/changelog` | `data/changelog` |
| `.github/agents/jules/prompts/stamp.md` | 11x `manual/changelog/` | `data/changelog/` |
| `docs/MANUAL_CHANGELOG_OPERATIONS.md` | 4x `manual/changelog/` | `data/changelog/` |
| `docs/ARCHITECTURE_EDGE_CACHE_ORACLE.md` | 6x `manual/changelog/` | `data/changelog/` |

---

## TIER 2: Config & Hygiene Fixes (Zero Downtime)

### Security-Critical

**6. Remove committed secrets from git tracking:**
- `oracle-backend/.env` contains plaintext `DASHBOARD_PASSWORD` and `SUPER_ADMIN_PASSWORD`. Already in `.gitignore` (line 6) but committed before the rule was added. Run `git rm --cached oracle-backend/.env`.
- `extension/.env` line 10: hardcoded production `VITE_WORKER_URL`. Run `git rm --cached extension/.env`. Already covered by the `.env` gitignore pattern.

**7. Create `oracle-backend/.env.example`:**
Document all 20+ env vars from `docker-compose.yml` with descriptions and `change-me` placeholders. Follow pattern of `cloudflare-worker/.dev.vars.example`.

### Documentation & Rot

**9. Fix absolute paths in runbook docs:**
`docs/DEPLOYMENT_RUNBOOK.md:16-18`, `docs/RUNBOOK_DEPLOYMENT.md:14-16`, `docs/RUNBOOK_INCIDENT_RESPONSE.md:10-12` — change `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/...` to relative paths.

**10. Fix outdated docs:**
- `DEVELOPMENT.md`: Go `v1.24+` → `v1.26+`, pnpm `v8+` → `v10.28+`
- `PRIVACY.md`: `your-email@example.com` → actual email, `AhmedHaitamSaid` → `adhamhaithameid`
- `cloudflare-worker/README.md` badge: `v1.0-stable` → `v3.0.0`
- `oracle-backend/README.md` badge: `Go-1.24` → `Go-1.26`
- `extension/README.md` structure diagram: `src/background/` → `entrypoints/background/`

**11. Stop tracking auto-generated files:**
6 files starting with "AUTO-GENERATED FILE" in `website/src/lib/content/` and `extension/entrypoints/utils/`. Add `*.manual.generated.json` and `*.manual.generated.ts` to `.gitignore`. Run `git rm --cached`.

**12. Clean stale `.gitignore` entries:**
Remove 10 entries for non-existent files/dirs (ownership-sensitive-rules.csv, oracle-backend/coverage*.out, ownership-map-*, etc.).

**13. Remove dead code:**
- `website/src/lib/types/public.ts:244-258` — 15 lines of commented-out newsletter types
- `oracle-backend/Dockerfile:9` — `# RUN apk add --no-cache gcc musl-dev`
- `oracle-backend/deploy.sh` — deprecated wrapper
- `extension/package.json` — `safari`, `safari:xcode`, `safari:local` all `process.exit(1)`

**14. Fix duplicate manual changelog content:**
`data/changelog/website-changelog.manual.md` and `extension-changelog.manual.md` have identical content (same v1.5.5/v1.5.4 entries). These should diverge or one reference the other.

### Config Fixes

**15. Create `oracle-backend/.dockerignore`:**
Exclude `node_modules/`, `.git/`, `tests/`, `*.db`, `data/`, `docs/`, `tools/`, `website/`, `extension/`, `cloudflare-worker/`, `dashboard/` (source, not built output).

**16. Remove `outDir: "dist"` from cloudflare-worker tsconfig:**
`cloudflare-worker/tsconfig.json` has `outDir: "dist"` but uses `tsc --noEmit`. Dead config.

**17. Remove website `overrides` field:**
`website/package.json` has `"overrides": { "cookie": "0.7.2" }` — npm feature pnpm ignores. Already in root `pnpm.overrides`. Dead config.

**18. Fix extension vitest broken alias:**
`extension/vitest.config.ts`: `'@': '/entrypoints/content'` is absolute filesystem path from `/`. Should be relative: `'@': path.resolve(__dirname, 'entrypoints/content')`.

**19. Remove `preinstall` duplication:**
`extension/package.json` and `oracle-backend/package.json` both have `"preinstall": "node ../tools/enforce-pnpm.cjs"` — redundant since root enforces pnpm.

**20. Add missing TypeScript config fields:**
- `cloudflare-worker/tsconfig.json`: add `forceConsistentCasingInFileNames`, `resolveJsonModule`
- `oracle-backend/tsconfig.dashboard.json`: add `esModuleInterop`, `forceConsistentCasingInFileNames`

**21. Fix CSP `NODE_ENV` dependency:**
`extension/wxt.config.ts:7-12` conditionally adds `localhost` to CSP based on `NODE_ENV !== 'production'`. If `NODE_ENV` is unset during production build, localhost origins leak. Use explicit production flag.

**22. Fix `wrangler.toml` cron overlap:**
Line 55: `crons = ["0 */3 * * *", "0 1-22/3 * * *"]` — two overlapping expressions. Consolidate or comment.

**23. Verify root Playwright deps:**
Root has `@playwright/test` and `playwright` as devDependencies. No script references them. Either add tests or remove deps.

---

## TIER 3: Code Quality Improvements (Separate PRs — Needs Testing)

### Monster File Decomposition

**24. Split `renderDashboard()` (6,527 lines):**
`cloudflare-worker/src/dashboard/main.ts` — the single largest function in the repo. Split into:
- `renderDashboardStyles()` (~1,700 lines of CSS)
- `renderDashboardHtml()` (~3,000 lines of HTML template)
- `renderDashboardScript()` (~650 lines of inline JS)
- Remove 319 lines of dead code (`renderNotificationSection`, `renderReleaseManagementSection`)
- Fix duplicated CSS: `.page`, `.hidden`, `header`, `.header-left`, `.title-block h1` defined twice

**Risk: LOW** (dashboard UI only).

**25. Fix `escapeHtml` duplication & inconsistency:**
Found in 4 files with a subtle bug: `release-notes.ts` uses `&#39;` while `dashboard/main.ts`, `dashboard/login.ts`, `dashboard/websiteConsole.ts` use `&#039;`. Both valid but inconsistent. Create single shared utility in `dashboard/utils.ts`.

**Risk: LOW.**

**26. Split `cloudflare-worker/src/index.ts` (2,799 lines):**
Extract into `src/middleware/` (auth, cors, logging) and `src/routes/` (ingest, public-api, dashboard, release-notes, health). Shrink `index.ts` to ~200-line router.

**Risk: HIGH** (live analytics pipeline at 300+ edge locations).

**27. Decompose `oracle-backend/cmd/app/main.go` (1,553 lines):**
Extract: route registration → `routes.go` (~155 lines), archiver code → `internal/archiver/` (528 lines), scheduler configs → `internal/config/` (~130 lines), `HealthDBHandler` → `internal/handlers/health.go`.

**Risk: MEDIUM** (live API).

**28. Fix false-confidence XSS test:**
`extension/tests/xss-prevention.test.ts` tests a locally redefined `escapeHtml` function, NOT the production implementation. Import from production module.

### Consolidation

**29. Merge duplicated worker utilities:**
- `isLocalEnvironment()` ≈ `isLoopbackHostname()` → merge into `oracle-endpoint.ts`
- 4 copies of `escapeHtml` → use shared utility (see #25)
- Cookie header builders share repeated logic → extract `buildCookieHeader()`

**30. Split long functions:**
- `handleRoot()` (209 lines) → `handleLoginGet()` + `handleLoginPost()`
- `handleWebsiteConsoleAdminEndpoint()` (245 lines) → per-path handlers
- `handleOraclePublicWebsiteProxy()` (171 lines) → extract duplicate fallback logic
- `main()` in main.go (342 lines) → extract blocks

**31. Name all magic numbers:**
`ORACLE_PROXY_TIMEOUT_MS` (8000), `DEFAULT_RATE_LIMIT_BLOCK_SECONDS` (900), `LIVE_INDICATOR_REFRESH_MS` (5000), `PIPELINE_HEALTH_REFRESH_MS` (60000), `INITIAL_CLEANUP_DELAY_MS` (60000), `BYPASS_TAB_REMOVAL_DELAY_MS` (5000), CORS max-age (`"86400"`), D1 default maxRows (200), login attempts default (4).

**32. Fix TypeScript `any` in extension:**
- `message-handler.ts:39`: `(message: any, _sender: any, sendResponse: any)` → proper types
- `download-handler.ts:28`: `respondOnce?: (payload: any) => void` → generic
- `message-handler.ts:89`: `(button.dataset as any).cqdAllDone` → properly typed

**33. Fix silently swallowed errors:**
Multiple `catch {}` blocks in extension background/content scripts. Add error type differentiation for tab removal errors (ignore "tab closed", log others).

**34. Fix cloudflare-worker `console.warn` bypasses:**
Three direct `console.warn()` calls in `index.ts` (lines 1125, 1128, 2041) bypass the `logEvent()` structured logging pattern. Route through `logEvent`.

### Test Suite Fixes

**35. Fix overlapped test execution:**
Root `test:strict` runs tests 2-3x due to `test:system` being subset of `test:strict`, and `test:massive` adding another full run. Consolidate to single parameterized script.

**36. Fix website test script duplication:**
`test:stress` and `test:fuzz` both run `websiteEvents.fuzz.test.ts`. 18 test scripts with hardcoded file paths are fragile to renames.

**37. Rename misleading `test:dashboard:unit`:**
`oracle-backend/package.json` — only runs typecheck, not unit tests.

**38. Add website coverage config:**
Website vitest has no coverage thresholds or reporters. Add realistic thresholds.

**39. Separate website vitest config:**
Move from`vite.config.ts` to standalone `vitest.config.ts` (consistent with extension and worker).

**40. Consolidate identical vitest coverage profiles:**
`extension/vitest.config.ts`: `criticalCoverageInclude` and `runtimeCoverageInclude` are identical arrays. Make `exclude` the sole differentiator.

**41. Add missing ESLint to extension:**
Only package without linting. Use same config pattern as cloudflare-worker.

### CI Improvements

**42. Extract composite action for CI setup:**
7 jobs duplicate the same 4-step block (checkout + pnpm + node + install). Create `.github/actions/setup/action.yml`.

**43. Add build artifact uploads:**
`build-check` job builds extension for chrome/firefox/edge but discards output. Upload as CI artifacts.

**44. Fix CI fragile test guards:**
Optional test steps with `if [ -f path/test.ts ]` silently skip if files missing. Fail loudly instead.

**45. Fix release-drafter typo:**
`.github/release-drafter.yml:14`: `'chow'` → `'chore'`.

**46. Disable or remove Dependabot:**
`.github/dependabot.yml` has `open-pull-requests-limit: 0` (disabled). If using Renovate, remove Dependabot config.

**47. Fix Renovate deprecated config:**
`renovate.json`: `"config:base"` → `"config:recommended"`.

**48. Add deploy/release workflows:**
Only CI workflow exists. No automated deploy, release, or scheduled tasks.

**49. Fix husky stale shim:**
`.husky/_/husky.sh` is a deprecation leftover from husky v9 migration. Remove and simplify hooks.

**50. Add pre-commit hook:**
Run lint + typecheck before commits.

**51. Fix `ci-passed` gate fragility:**
New jobs added without updating both `needs:` and shell script pass silently. Use `if: failure()` pattern instead.

**52. Add monorepo scope enforcement to commitlint:**
No `scope-enum` rules. Valid scopes (extension, website, oracle-backend, cloudflare-worker, ci, docs) should be enforced.

---

## TIER 4: Future Architecture (Long-Term)

**53. Extract Durable Object (3,500+ lines):** Split schema migration (~770 lines) into `migrations.ts`. Extract admin handlers, ingest logic, validation.

**54. Create shared types package:** `ChangelogEntry`/`ChangelogConfig` types independently defined in worker and extension — already drifted.

**55. Standardize test organization:** Website co-locates, extension/worker use separate `tests/`. Pick one.

**56. Add Makefile:** 42 package.json scripts + 10+ shell scripts. `make help`, `make dev`, `make test`, `make deploy`.

**57. Fix naming inconsistencies:** `downloads_do.ts` (snake_case) → kebab-case. `websiteConsole.ts` (camelCase) → kebab-case. `scan_optimization.test.ts`, `auth_timing.test.ts` (snake_case) → kebab-case.

**58. Version management strategy:** 5+ different versions with no sync. Document or unify.

**59. Add API documentation:** 70+ REST endpoints. No OpenAPI/Swagger spec.

**60. Standardize env boolean parsing:** Worker's `envFlagEnabled` (only `"true"`) vs website's `envBool` (`"1"`, `"true"`, `"yes"`, `"on"`) — could cause bugs.

**61. Fix inline JS type safety:** ~650 lines of inline JS in `renderDashboard()` with zero type safety.

**62. Fix duplicated schema constants:** `WEBSITE_EVENTS_SCHEMA_VERSION` defined in both `index.ts` and `downloads_do.ts`.

**63. Add scheduled DB maintenance workflow:** Archiver cron, backup runs, retention cleanup — currently managed manually.

**64. Fix Go version in CI:** `1.26.4` is referenced in CI and `go.mod`. Verify against official Go release schedule (1.26 doesn't exist as stable yet).

**65-70+. Additional minor items** (logged in previous plan iterations but lower priority).

---

## Execution Order (Tier 1 + Tier 2)

### Batch 1: Independent renames
```
1. Create tools/package.json
2. git mv oracle-backend/dashboard-src/ oracle-backend/dashboard/
3. Update oracle-backend/tsconfig.dashboard.json:13
4. git mv manual/changelog/ data/changelog/ + rmdir manual/
5. Update tools/sync-manual-changelog.mjs:6
6. Update docs/MANUAL_CHANGELOG_OPERATIONS.md (4 occurrences)
7. Update docs/ARCHITECTURE_EDGE_CACHE_ORACLE.md (6 occurrences)
8. Update cloudflare-worker/src/index.ts:2727
```
**Verify:** `pnpm run sync:manual-changelog && cd oracle-backend && pnpm run typecheck:dashboard`

### Batch 2: Agents move
```
9.  git mv agents/ .github/agents/
10. Update README.md:199, CONTRIBUTING.md:11, docs/BOTS.md (3x)
11. Update .github/agents/jules/prompts/stamp.md (11x data/changelog refs)
```
**Verify:** `grep -rn "agents/" --include="*.md" . | grep -v ".github/agents"`

### Batch 3: Root MD moves
```
12. git mv 9 MDs to docs/
13. Update README.md:152,194
14. Update tools/phase13_rollout.sh:107
15. Update tools/run-extension-phase0-baseline.mjs
16. Update extension/src/v2/debug/debug-panel.ts:21
```
**Verify:** `bash tools/phase13_rollout.sh`

### Batch 4: Hygiene fixes
```
17. git rm --cached oracle-backend/.env extension/.env
18. Create oracle-backend/.env.example
20. Create oracle-backend/.dockerignore
21. Fix absolute paths in runbook docs
22. Fix outdated doc versions/badges/emails
23. Stop tracking auto-generated files + gitignore
24. Clean stale gitignore entries
25. Remove dead code (newsletter types, Dockerfile comment, deploy.sh, safari scripts)
26. Fix duplicate changelog content
27. Remove outDir: "dist", website overrides, preinstall duplication
28. Fix extension vitest alias
29. Add missing TS config fields
30. Fix CSP NODE_ENV dependency
31. Verify/fix wrangler cron, Playwright deps
```
**Verify:** `pnpm install && pnpm run build:ext && pnpm run build:website && full test suite`

---

## Verification Checklist

### After Tier 1+2:
- [ ] `pnpm install` succeeds
- [ ] `pnpm run build:ext` — valid builds (Chrome, Firefox, Edge)
- [ ] `pnpm run build:website` — valid static site
- [ ] `cd extension && pnpm test` — all passing
- [ ] `cd cloudflare-worker && pnpm test` — all passing
- [ ] `cd website && pnpm test` — all passing
- [ ] `cd oracle-backend && go build ./cmd/app` — compiles
- [ ] `cd oracle-backend && go test ./...` — all passing
- [ ] `node tools/sync-manual-changelog.mjs` — runs
- [ ] `node tools/generate-full-changelog.mjs` — writes to `docs/CHANGELOG.md`
- [ ] No broken links in README.md or docs/
- [ ] `.gitignore` correctly excludes `*.manual.generated.*`
- [ ] `.dockerignore` exists and excludes correctly
- [ ] `oracle-backend/.env.example` exists
- [ ] `git ls-files oracle-backend/.env` returns empty
- [ ] `git ls-files extension/.env` returns empty
- [ ] `grep -rn "manual/changelog\|dashboard-src" --include="*.{ts,js,mjs,json,md,sh}" . | grep -v node_modules | grep -v .git` returns empty
