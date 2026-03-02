# DATA_FLOW_WORKER_ORACLE_WEBSITE

Last updated: 2026-03-01
Owner: CQD platform maintainers

This is the canonical operator/developer data-flow document for:

- Website telemetry writes
- Worker ingestion queue and replay
- Oracle persistence, aggregation, and snapshot reads

## 1. Architecture Contract

Locked runtime contract:

- `Website -> Worker` for writes
- `Worker -> Oracle` for batch ingest
- `Website <- Oracle` for canonical read data (`/api/public/website/snapshot`)
- Worker is queue/gateway, Oracle is source of truth

## 2. Trust Boundaries

- Public browser boundary: website and extension clients
- Edge boundary: Worker + Durable Object ingress and queue state
- Origin boundary: Oracle internal batch ingest and persistent storage
- Admin boundary: dashboard routes requiring auth + step-up for danger actions

## 3. Write Path (Website to Oracle)

## 3.1 Website -> Worker

Endpoint:

- `POST /api/public/website/events`

Required payload fields:

- `schemaVersion: "1"`
- `sessionId`
- `pagePath`
- `events[]`

Validation guarantees at ingress:

- strict schema
- unknown field rejection
- enum checks for `eventType` and `action`
- size and batch caps
- structured error responses

## 3.2 Worker queue and retries

Worker stores:

- pending queue
- retry metadata
- dead-letter queue
- batch IDs and correlation IDs

Flush schedule:

- daily target at `23:00 UTC`

Failure behavior:

- jittered backoff retries
- exhausted retries moved to DLQ
- manual replay supported

## 3.3 Worker -> Oracle internal batch

Endpoint:

- `POST /api/internal/website/events/batch`

Auth:

- `X-DO-SECRET`

Batch integrity:

- includes checksum and expected event count
- Oracle computes and validates checksum and row-count status

## 3.4 Oracle ingest transaction

Oracle ingest behavior:

- idempotent insert into `website_event_idempotency`
- append-only insert into `website_events_raw`
- aggregate upsert into `website_event_daily`
- batch metadata write to `website_sync_batches`

Retention policy:

- telemetry/event truth data retained forever

## 4. Read Path (Oracle to Website)

Canonical endpoint:

- `GET /api/public/website/snapshot`

Contains:

- totals
- installs
- versions
- status
- map countries
- changelog summary
- privacy pointers
- `schemaVersion`
- `snapshotId`

Website behavior:

- shared snapshot service
- in-memory cache + localStorage fallback
- stale-while-revalidate
- degraded state rendering

## 5. Health and Observability Chain

Worker reports:

- last created/sent/ack batch
- pending queue size
- retry count
- dead-letter count

Oracle reports:

- last batch accepted
- snapshot generation timestamp
- lag minutes
- backup drift
- sheets flush verification
- batch checksum/row-count integrity

## 6. Backup and Integrity Verification

Oracle records:

- per-batch checksum status (`match/mismatch`)
- per-batch row-count status (`match/mismatch`)
- sheets flush verification metadata (checksum and row counts)

Alert behavior:

- raises backup/integrity drift alert when:
  - expected flush window is missed
  - checksum mismatch appears
  - row-count mismatch appears

## 7. Manual Operations

## 7.1 Check queue and chain state

```bash
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/status \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'

curl -fsS http://<oracle-host>:8080/api/admin/ha/status
```

Expected output:

- queue counts and last-batch fields populated
- website chain health object present

## 7.2 Flush and replay

```bash
curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/flush-now \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'

curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/replay-dlq \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>' \
  -d '{"limit":50}'
```

## 7.3 Read smoke

```bash
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/api/public/website/snapshot
curl -fsS http://<oracle-host>:8080/api/public/website/snapshot
```

Expected output:

- both respond with valid JSON
- both include `"schemaVersion":"1"`

## 8. Triage by Failure Class

## 8.1 CORS rejection on website events

- verify `Origin` in request
- verify Worker `CORS_ALLOWED_ORIGINS`
- verify event payload includes `schemaVersion: "1"`

## 8.2 Queue growth or DLQ growth

- inspect `pendingBatches` and `deadLetterBatches`
- trigger replay then flush
- validate Oracle internal endpoint auth and availability

## 8.3 Snapshot lag

- inspect Oracle HA status lag metrics
- inspect latest `website_sync_batches`
- verify snapshot refresh loop and DB health

## 8.4 Integrity mismatch alerts

- inspect latest batch details for checksum/row statuses
- compare expected and computed values
- replay affected batch if source data still queued
- if repeatable, treat as SEV-1 data integrity incident

## 9. Rollback References

- Worker rollback: redeploy known-good SHA
- Oracle rollback: `oracle-backend/scripts/deploy_main_inplace.sh` on known-good SHA
- Website rollback: rebuild/deploy known-good SHA to Pages

See detailed steps:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_DEPLOYMENT.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`
