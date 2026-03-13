# Post-Merge Follow-Up Board (Not_Stable)

Last updated: 2026-03-11

## Purpose
This board defines the next implementation wave after merging `Not_Stable -> main` via PR #414.
It maps open issues to exact subsystems and files so execution is direct and trackable.

## Active Follow-Up Issues

- #415 Persist Oracle dashboard sessions (remove in-memory auth store)
- #416 Restore and verify automated Google Sheets export on Oracle v6
- #417 Enable and validate Oracle website traffic sync pipeline in production
- #418 Implement website Reviews section under Solution (Oracle-sourced)

Related already-open extension roadmap issues:
- #394 #395 #396 #397 #398 #399 #400 #401

## Execution Order

1. #415 Oracle persistent sessions (security + reliability baseline)
2. #416 Sheets export restoration (backup/archive integrity)
3. #417 Website sync activation (data-path correctness)
4. #418 Reviews section (user-facing feature)
5. Extension roadmap tranche (issues #394-#401)

## File-Level Work Map

### Issue #415 — Oracle persistent sessions

Core files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/session.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/db/postgres.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/docker-compose.yml`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/README.md`

Validation files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/session_persistence_test.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/oracle-dashboard-deploy.yml`

### Issue #416 — Google Sheets export restoration

Core files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/sheets_flush.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/sheets_flush_manual.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/static/oracle-dashboard.js`

Validation files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/sheets_flush_test.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DEPLOYMENT_RUNBOOK.md`

### Issue #417 — Website traffic sync activation

Core files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/website_traffic_sync.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/public_website_internal_batch.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/index.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/downloads_do.ts`

Validation files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/website_traffic_sync_test.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/tests/security.test.ts`

### Issue #418 — Website reviews section

Core files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/routes/overview/+page.svelte`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/types/public.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/api/publicSite.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/public_website.go`

Validation files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/routes/routes.render.test.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/api/publicSite.integration.test.ts`

## CI / Deployment Gates For This Follow-Up PR

Before merge to `Not_Stable`:
- `pnpm run scan:repo`
- `gh pr checks <PR_NUMBER>` all pass

Before promotion to `main`:
- Oracle health: `http://129.151.233.229:8080/health` and `https://129.151.233.229.nip.io/health`
- Worker health: `https://cqd-analytics.adhamhaithameid.workers.dev/health`
- Website route health: `https://classroom-quick-downloader-website.pages.dev/` and `/overview`

## Non-Goals In This Follow-Up PR

- No new extension runtime behavior changes unless tied directly to #394-#401.
- No branch spam / dummy commits.
- No credential material in repository files.
