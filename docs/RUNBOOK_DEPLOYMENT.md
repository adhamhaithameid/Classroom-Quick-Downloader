# RUNBOOK_DEPLOYMENT

Last updated: 2026-03-01
Owner: CQD platform maintainers

This runbook is the operator playbook for deploying and validating:

- Cloudflare Worker + Durable Object (`cloudflare-worker`)
- Oracle backend + dashboard (`oracle-backend`)
- Website (`website`)

Use this with:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DEPLOYMENT_RUNBOOK.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`

## 1. Pre-Deploy Guardrails

Run from repo root:

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
bash tools/check_schema_compat.sh
pnpm -C cloudflare-worker test:smoke
pnpm -C website test:smoke
cd oracle-backend && go test ./... && cd ..
```

Expected output:

- `Schema compatibility check passed (version=1)`
- Worker smoke: `Test Files ... passed`
- Website smoke: `Test Files ... passed`
- Go tests: `ok oracle-backend/...`

If any check fails, do not deploy.

## 2. Required Environment and Secrets

## 2.1 GitHub Actions secrets

Required:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ORACLE_HOST`
- `ORACLE_SSH_KEY`

## 2.2 GitHub Actions variables

Required:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `PUBLIC_WORKER_BASE_URL`
- `PUBLIC_ORACLE_API_BASE_URL`
- `PUBLIC_SITE_URL`

## 2.3 Oracle runtime env

Required keys in `oracle-backend/.env.production`:

- `APP_ENV`
- `ADDR`
- `DB_PATH`
- `STATIC_DIR`
- `DO_SHARED_SECRET`
- `DASHBOARD_PASSWORD`
- `SUPER_ADMIN_PASSWORD`
- `DANGER_PASSWORD`
- `ARCHIVER_SHARED_SECRET`
- `ORACLE_AUDIT_CHECKPOINT_SECRET`
- `PUBLIC_WEBSITE_ALLOWED_ORIGINS`

## 3. Automatic Deploys on Main

Workflows:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/deploy-cloudflare-worker.yml`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/oracle-dashboard-deploy.yml`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/website-deploy.yml`

Each workflow enforces:

- preflight secrets/vars checks
- schema compatibility check
- deploy step
- post-deploy smoke checks (`health`, `auth gate`, `ingest`, `snapshot`)

## 4. Manual Deploy Commands

## 4.1 Cloudflare Worker

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm -C cloudflare-worker test
pnpm -C cloudflare-worker run validate
pnpm -C cloudflare-worker run deploy
```

Expected output:

- tests pass
- validate pass
- wrangler deploy completes with deployed version id

## 4.2 Oracle backend/dashboard

```bash
ORACLE_HOST="<oracle-host>"
ssh -i ~/.ssh/oracle_key "ubuntu@${ORACLE_HOST}" <<'SSH'
set -euo pipefail
cd ~/Classroom-Quick-Downloader
# optional branch override:
# TARGET_REF=origin/Not_Stable bash oracle-backend/scripts/deploy_main_inplace.sh
bash oracle-backend/scripts/deploy_main_inplace.sh
curl -fsS http://127.0.0.1:8080/health
SSH
```

Expected output:

- `Deployment complete`
- `Health check passed`
- `/health` returns JSON with `ok=true`

## 4.3 Website (Cloudflare Pages)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
PUBLIC_BASE_PATH='' \
PUBLIC_ORACLE_API_BASE_URL='https://<your-oracle-public-https-domain>' \
PUBLIC_WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
PUBLIC_SITE_URL='https://<your-root-domain>' \
pnpm -C website build

CI=1 pnpm -C cloudflare-worker exec wrangler pages deploy ../website/build --project-name classroom-quick-downloader-website --branch main --commit-dirty=true
```

Expected output:

- build succeeds with no fatal errors
- Pages deploy prints deployment URL and branch

Base-path notes:

- Use `PUBLIC_BASE_PATH=''` for root-hosted domains (recommended for Cloudflare Pages custom/root domains).
- Use `PUBLIC_BASE_PATH='/repo-name'` only when hosting under a subpath.
- Do not use `PUBLIC_BASE_PATH='/'`; SvelteKit rejects it.

## 5. Post-Deploy Smoke Matrix

Run after each deploy:

```bash
WORKER_BASE="https://cqd-analytics.adhamhaithameid.workers.dev"
SITE_ORIGIN="https://<your-root-domain>"
ORACLE_BASE="http://<oracle-host>:8080"

curl -fsS "${WORKER_BASE}/health"
curl -sS -o /tmp/worker_snapshot_body -w "%{http_code}" "${WORKER_BASE}/api/public/website/snapshot"; echo
curl -i "${WORKER_BASE}/admin/website/status" | head -n 1
curl -fsS -X POST "${WORKER_BASE}/api/public/website/events" \
  -H "Origin: ${SITE_ORIGIN}" \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"schemaVersion":"1","sessionId":"manual-smoke","pagePath":"/runbook","events":[{"eventId":"manual-smoke-1","eventType":"cta","action":"install_click","placement":"hero_install"}]}'

curl -fsS "${ORACLE_BASE}/health"
curl -fsS "${ORACLE_BASE}/api/public/website/snapshot"
curl -i "${ORACLE_BASE}/api/admin/website/state" | head -n 1
```

Expected results:

- health endpoints: HTTP `200`
- Oracle snapshot: `schemaVersion: "1"`
- Worker snapshot compatibility route: HTTP `200` with `schemaVersion: "1"` or `404` (compat route not exposed)
- admin endpoints unauthenticated: HTTP `401` or `403`
- website events POST: `{ "ok": true, ... }`

## 6. Failure Triage Tree

## 6.1 Deploy fails before release

1. Check workflow preflight step.
2. If missing secret/variable, set it in GitHub settings.
3. Re-run workflow.

## 6.2 Deploy succeeds but smoke fails

1. If `/health` fails:
   - inspect logs (`docker logs cqd-oracle-backend` or Worker logs)
   - roll back immediately (section 8)
2. If `auth gate` not `401/403`:
   - inspect auth middleware config
   - treat as security incident candidate
3. If ingest fails but health is up:
   - inspect CORS allowed origins
   - inspect shared secret and endpoint wiring
4. If snapshot fails:
   - verify `api/public/website/snapshot` route and DB health

## 6.3 Data lag after deployment

1. Check Worker queue depth and dead-letter count.
2. Trigger manual flush/replay.
3. Check Oracle `website_sync_batches` latest statuses.
4. If lag persists > 24h, open SEV-1 incident.

## 7. Manual Replay Procedures

## 7.1 Worker queue flush now

```bash
curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/flush-now \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'
```

Expected output:

- JSON with `ok: true`
- nonzero `sent` if there were pending batches

## 7.2 Replay dead-letter queue

```bash
curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/replay-dlq \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>' \
  -d '{"limit":50}'
```

Expected output:

- JSON with replay counters
- subsequent flush should reduce `deadLetterBatches`

## 8. Rollback Procedures

## 8.1 Worker rollback

```bash
git checkout <known-good-sha>
pnpm -C cloudflare-worker run deploy
```

## 8.2 Oracle rollback

Use rollback-capable deploy script and known-good commit:

```bash
ssh -i ~/.ssh/oracle_key ubuntu@<oracle-host> <<'SSH'
set -euo pipefail
cd ~/Classroom-Quick-Downloader
git fetch --all --prune
git checkout <known-good-sha>
bash oracle-backend/scripts/deploy_main_inplace.sh
SSH
```

`deploy_main_inplace.sh` keeps a rollback image tag for emergency container restore.

## 8.3 Website rollback

```bash
git checkout <known-good-sha>
PUBLIC_BASE_PATH='' \
PUBLIC_ORACLE_API_BASE_URL='https://<your-oracle-public-https-domain>' \
PUBLIC_WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
PUBLIC_SITE_URL='https://<your-root-domain>' \
pnpm -C website build
pnpm dlx wrangler pages deploy website/build --project-name classroom-quick-downloader-website --branch main
```

## 9. Security Incident Containment During Deploy

If deploy exposes unsafe behavior (open admin route, auth bypass, CSRF bypass, CORS leak):

1. Stop further deploys.
2. Roll back affected component.
3. Rotate impacted secrets:
   - Worker: `DASHBOARD_PASSWORD`, `DANGER_PASSWORD`, `DO_SHARED_SECRET`
   - Oracle: `DASHBOARD_PASSWORD`, `SUPER_ADMIN_PASSWORD`, `DANGER_PASSWORD`, `DO_SHARED_SECRET`
4. Invalidate sessions.
5. Capture evidence (logs, request IDs, timeline).
6. Execute incident flow in `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`.

## 10. Phase 12 + 13 Operator Scripts

These scripts execute the strict `refactor-plan.md` phase-12 and phase-13 gates directly:

```bash
# Full phase-12 strict matrix
bash tools/phase12_verify.sh

# Phase-13 smoke checks only
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
WEBSITE_URL='https://classroom-quick-downloader-website.pages.dev' \
bash tools/phase13_smoke.sh

# Full phase-13 sequence (no deploy unless --deploy is added)
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
WEBSITE_URL='https://classroom-quick-downloader-website.pages.dev' \
bash tools/phase13_rollout.sh

# 24h monitoring for lag/retry/DLQ thresholds
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
DURATION_HOURS=24 \
INTERVAL_SECONDS=300 \
bash tools/phase13_monitor.sh
```

Phase-12 matrix mapping is documented in:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/PHASE12_TEST_MATRIX.md`
