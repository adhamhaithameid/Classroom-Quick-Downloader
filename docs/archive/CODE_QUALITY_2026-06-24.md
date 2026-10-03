# Code Quality & Optimization Findings — 2026-06-24

Full codebase scan: extension, oracle-backend, cloudflare-worker. Dead code, TODOs, optimizations.

---

## Changes Made This Session

| File | Change | Reason |
|------|--------|--------|
| `root/package.json` | Added `shell-quote: 1.8.4` to pnpm.overrides | CRITICAL CVE fix — newline escape bypass |
| `cloudflare-worker/src/types.ts` | Removed `ENABLE_SITE_QUEUE_PIPELINE` field | Dead env var — never read in runtime code |
| `cloudflare-worker/wrangler.toml` | Removed `ENABLE_SITE_QUEUE_PIPELINE = "false"` | Same — dead config entry, no runtime gating logic |
| `docs/DISTRIBUTION_CI_PLAN.md` | Fixed 6 errors: action versions, build commands, Edge output path, Firefox UUID, manifest path, scripts section | Wrong info from initial draft |
| `docs/archive/` | Archived 4 stale docs: plan2.md, refactor-plan.md, ORACLE_HUB_V4.md, extension-hardening-followup-board.md | Superseded by new Sprint/Oracle docs |

---

## Dead Code — Needs Manual Removal

These are confirmed dead but in runtime extension code — don't delete without reading the diff:

### Extension

| Location | Symbol | Status | Action |
|----------|--------|--------|--------|
| `src/v2/orchestrator/orchestrator.ts:454` | `getShadowReports()` | Zero references in entire codebase | Remove method + its return type annotation |
| `src/v2/compat/shadow-compare.ts:330` | `getLatestReport()` | Line 99 is JSDoc example only, not a real call | Remove method; update JSDoc example at line 99 |
| `src/engines/v3/engine-v3.ts` | v3 stub (`version: '4.2.1-stub'`) | Delegates everything to V2; Phase 8 not implemented | Keep as placeholder — needed for Phase 8 future work. Consider renaming to clarify stub status. |

**Note on V1 Engine:** V1 is still ACTIVE — engine-registry selects it based on mode. Do not remove it. Phase 9 migration to V2-only is a future milestone.

### Cloudflare Worker

| Location | Item | Status | Action |
|----------|------|--------|--------|
| `wrangler.toml:21` + `types.ts:423` | `ENABLE_SITE_QUEUE_PIPELINE` | ✅ Already removed this session | Done |

### Oracle Backend

| Location | Item | Status | Action |
|----------|------|--------|--------|
| `internal/handlers/store_batch.go:816` | `insertBatchIPs()` function | Privacy-disabled by design; call-site commented out. Only called from tests. | **DO NOT DELETE** — intentional privacy policy decision. Add a comment documenting why it's disabled. |

---

## Console Logging Audit

### Extension

All 60+ console calls are in `src/v2/` compat/orchestrator modules, prefixed `[CQD]`. No stray debug logs in production entrypoints or v1 engine. Status: **acceptable**.

Consider adding a build-time strip for `console.log` (not `console.error`/`console.warn`) in release builds via WXT/Vite config:

```ts
// wxt.config.ts or vite.config.ts
export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console'] : [],
  }
})
```

This would eliminate the `[CQD]` logs from shipped extension without removing them from source.

---

## TODOs Without Issues

| Location | TODO | Action |
|----------|------|--------|
| `extension/src/engines/v1/engine-v1.ts:136` | Phase 5: mutation handling migration | Tracked under V2 lifecycle consolidation — maps to issue #401 |
| `extension/src/engines/v3/engine-v3.ts:91` | Phase 8: Classroom API integration | Maps to issue #398 (1.6.0 API engine consent model) |
| `extension/src/engines/v3/engine-v3.ts:126` | Phase 8: API cross-reference | Same — #398 |
| Extension download handler | `pendingByUrl` race condition [HIGH] | ✅ Filed as issue #664 this session |

---

## System Optimizations

### High Value — Do Soon

**1. Oracle endpoint: IP → domain**
- Current: `ORACLE_ENDPOINT = "https://129.151.233.229.nip.io:8080"` in `cloudflare-worker/wrangler.toml`
- Problem: IP-based, fragile (IP change = outage), nip.io is a third-party dependency
- Fix: confirm `oracle.classroom-quick-downloader.com` resolves to Oracle VM, then update wrangler.toml
- Risk: LOW — just a config change + deploy

**2. CI oracle test deduplication**
- Current: oracle tests run in BOTH `ci.yml` and `oracle-backend-ci.yml` — double runner minutes on every PR
- Fix: remove oracle job from `ci.yml`, add PR trigger to `oracle-backend-ci.yml` path filter
- Impact: ~50% reduction in CI time for oracle-touching PRs

**3. Job timeouts in CI**
- Current: no `timeout-minutes` on any job in ci.yml or oracle-backend-ci.yml
- Fix: add `timeout-minutes: 20` per job (PRs #607/#639 do this — merge them)
- Impact: hung jobs can block runners for hours without limit

**4. Go modules in Dependabot**
- Current: `.github/dependabot.yml` has npm only — Go modules untracked
- Fix: add `package-ecosystem: gomod` entry for `oracle-backend/`
- Impact: pgx/v5 LOW vuln gets auto-PR, ongoing Go dep tracking

**5. Console log stripping in extension builds**
- As described above — WXT esbuild config to drop `console.log` in production builds
- Zero source code changes required

### Medium Value — Backlog

**6. CodeQL Go scan**
- Add Go to `codeql.yml` language matrix
- Currently only JS/TS scanned — oracle-backend entirely unscanned by CodeQL

**7. socket-security.yml oracle-backend audit**
- Add oracle-backend to the npm audit in `socket-security.yml` lines 34-35
- Currently skips oracle-backend npm deps

**8. GHSA-2g4f-4pwh-qvx6 audit ignore tracking**
- Hardcoded ignore in `socket-security.yml` with no tracking issue
- Create a GitHub issue documenting why it's ignored and when to revisit

**9. Website coverage in codecov.yml**
- Website and oracle Go are missing from coverage reporting
- Add Go coverage flags to `oracle-backend-ci.yml` → codecov upload
- Add website coverage to codecov.yml

**10. pnpm.overrides cleanup pass**
- Some overrides may be resolvable by bumping direct deps instead
- Run `pnpm why <package>` on each override to check if the root dep can just be updated
- Reduces override surface area over time

### Low Value — Icebox

**11. `.env.production` recovery documentation**
- `oracle-dashboard-deploy.yml` has a fragile multi-fallback search for .env.production
- Document the canonical location and recovery steps clearly in DEPLOYMENT_RUNBOOK.md

**12. Worker dashboard password complexity**
- No evidence of password strength validation for `DASHBOARD_PASSWORD`
- Add a CI check that validates secret complexity at deploy time (length > 20, not empty)

---

## Docs State After This Session

### New docs created
| Doc | Purpose |
|-----|---------|
| `docs/REPO_REPORT_2026-06-24.md` | Full audit report |
| `docs/PR_ISSUE_TRIAGE_2026-06-24.md` | Triage for all 65 PRs + issues |
| `docs/SPRINT_PLAN.md` | Rolling sprint system |
| `docs/DISTRIBUTION_CI_PLAN.md` | Hybrid distribution pipeline spec |
| `docs/ORACLE_EXPANSION_PLAN.md` | Oracle B+C expansion plan |
| `docs/CODE_QUALITY_2026-06-24.md` | This file |

### Archived (moved to docs/archive/)
| Doc | Reason |
|-----|--------|
| `plan2.md` | Extension hardening checklist — superseded by SPRINT_PLAN.md |
| `refactor-plan.md` | Old refactor roadmap — superseded |
| `ORACLE_HUB_V4.md` | v4.1 plan — superseded by ORACLE_EXPANSION_PLAN.md |
| `extension-hardening-followup-board.md` | Branch closed, work replanned in SPRINT_PLAN.md |

### Keep (confirmed still active)
| Doc | Why |
|-----|-----|
| `plan.md` | Reviews section spec, active (blocked on #415/#416) |
| `POST_MERGE_FOLLOWUP_BOARD.md` | Tracks live P0 issues #415-#418 |
| `DEPLOYMENT_RUNBOOK.md` | Primary deployment guide |
| `RUNBOOK_DEPLOYMENT.md` | Operator validation checklist (different scope) |
| `docs/security/gosec-triage.md` | Active triage record |

### GitHub Issue Filed
| Issue | Title |
|-------|-------|
| #664 | `bug: pendingByUrl race condition — untracked HIGH severity issue` |
