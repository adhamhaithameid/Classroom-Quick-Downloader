# RUNBOOK_INCIDENT_RESPONSE

Last updated: 2026-03-01
Owner: CQD platform maintainers

This runbook defines incident response for Website <-> Worker <-> Oracle production runtime.

Use this with:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_DEPLOYMENT.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DEPLOYMENT_RUNBOOK.md`

## 1. Severity Model

- SEV-0: confirmed data breach or active admin compromise
- SEV-1: ingest pipeline outage > 60 minutes, or replay backlog threatens SLO
- SEV-2: partial degradation, retries active, no data loss confirmed
- SEV-3: cosmetic or non-critical performance impact

## 2. Initial 15-Minute Checklist

1. Confirm alert signal and scope.
2. Assign incident commander and technical owner.
3. Freeze deployments.
4. Capture current health snapshot:

```bash
WORKER_BASE="https://cqd-analytics.adhamhaithameid.workers.dev"
ORACLE_BASE="http://<oracle-host>:8080"

curl -fsS "${WORKER_BASE}/health"
curl -fsS "${WORKER_BASE}/public/site-metrics"
curl -fsS "${WORKER_BASE}/api/public/website/snapshot"
curl -i "${WORKER_BASE}/admin/website/status" | head -n 1

curl -fsS "${ORACLE_BASE}/health"
curl -fsS "${ORACLE_BASE}/api/public/website/snapshot"
curl -i "${ORACLE_BASE}/api/admin/ha/status" | head -n 1
```

Expected outputs:

- worker/oracle health endpoints return HTTP `200`
- admin endpoints unauthenticated return `401/403`

5. Save logs and request/correlation IDs.

## 3. Triage Trees

## 3.1 Ingest outage (website writes failing)

1. Check Worker health and admin status.
2. If Worker down:
   - rollback Worker immediately.
3. If Worker up, inspect queue status (`pending`, `deadLetter`).
4. Trigger flush now, then replay DLQ if needed.
5. Check Oracle internal ingest response and shared secret alignment.
6. If Oracle unavailable, mark SEV-1 and focus on Oracle recovery while preserving Worker queue.

## 3.2 Snapshot stale or inconsistent

1. Verify Oracle `/api/public/website/snapshot` returns `schemaVersion: "1"`.
2. Check Oracle HA status for lag and backup drift.
3. Validate last accepted batch and last snapshot generated timestamps.
4. If lag exceeds threshold and queue is healthy, trigger manual snapshot refresh path through Oracle admin controls.
5. If mismatch persists, open integrity incident and compare checksums/row counts.

## 3.3 Auth/security anomaly

Examples:

- admin endpoint returns `200` unauthenticated
- CSRF protection bypass observed
- blocked IP bypass abuse suspected

Actions:

1. Immediately disable risky admin surface if possible.
2. Rotate passwords/secrets.
3. Invalidate sessions.
4. Roll back to known-good release.
5. Preserve forensic evidence before cleanup.

## 4. Manual Recovery Procedures

## 4.1 Worker replay and flush

```bash
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/status \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'

curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/replay-dlq \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>' \
  -d '{"limit":50}'

curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/flush-now \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'
```

Expected output:

- status endpoint returns queue metrics
- replay returns nonzero replayed count when DLQ is non-empty
- flush returns success and updates sent/ack timestamps

## 4.2 Oracle verification

```bash
ORACLE_BASE="http://<oracle-host>:8080"
curl -fsS "${ORACLE_BASE}/api/public/website/snapshot"
curl -fsS "${ORACLE_BASE}/health"
```

Expected output:

- valid JSON payload
- `schemaVersion` equals `1`

## 5. Rollback During Incident

## 5.1 Worker rollback

```bash
git checkout <known-good-sha>
pnpm -C cloudflare-worker run deploy
```

## 5.2 Oracle rollback

```bash
ssh -i ~/.ssh/oracle_key ubuntu@<oracle-host> <<'SSH'
set -euo pipefail
cd ~/Classroom-Quick-Downloader
git fetch --all --prune
git checkout <known-good-sha>
bash oracle-backend/scripts/deploy_main_inplace.sh
SSH
```

## 5.3 Website rollback

```bash
git checkout <known-good-sha>
PUBLIC_BASE_PATH='' \
PUBLIC_ORACLE_API_BASE_URL='https://<your-oracle-public-https-domain>' \
PUBLIC_WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
PUBLIC_SITE_URL='https://<your-root-domain>' \
pnpm -C website build
pnpm dlx wrangler pages deploy website/build --project-name classroom-quick-downloader-website --branch main
```

## 6. Security Incident Containment

When compromise or abuse is suspected:

1. Freeze deploys and admin access changes.
2. Rotate secrets immediately:

```bash
# Worker secrets
printf '%s' '<new-dashboard-password>' | pnpm -C cloudflare-worker exec wrangler secret put DASHBOARD_PASSWORD
printf '%s' '<new-danger-password>' | pnpm -C cloudflare-worker exec wrangler secret put DANGER_PASSWORD
printf '%s' '<new-do-shared-secret>' | pnpm -C cloudflare-worker exec wrangler secret put DO_SHARED_SECRET

# Redeploy worker
pnpm -C cloudflare-worker run deploy
```

3. Rotate Oracle `.env.production` passwords and shared secret; redeploy Oracle.
4. Invalidate active sessions.
5. Preserve logs and DB snapshots for forensic analysis.
6. Report timeline, blast radius, and mitigations.

## 7. Evidence Collection

Collect:

- GitHub Action run IDs
- Worker logs around failure window
- Oracle container logs (`docker logs cqd-oracle-backend`)
- queue depth before/after replay
- affected correlation IDs and batch IDs

## 8. Recovery Exit Criteria

Incident can be closed when all are true:

- health checks stable for 60+ minutes
- queue backlog trending to normal
- no new auth or integrity alerts
- snapshot lag within thresholds
- post-incident smoke checks pass

## 9. Post-Incident Actions

1. Publish incident summary.
2. Create corrective tasks for root cause.
3. Add/adjust tests to prevent recurrence.
4. Update runbooks if any procedure changed.
