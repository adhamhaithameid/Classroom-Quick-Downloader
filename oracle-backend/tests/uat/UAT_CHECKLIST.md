# Oracle Backend UAT Checklist

> Update (2026-02-28): Latest full-repository scan baseline is documented in /docs/MAJOR_SCAN_2026-02-28.md; deployment/rollout actions are tracked in /docs/DEPLOYMENT_RUNBOOK.md.

## Authentication and Session
- [ ] Login succeeds with correct dashboard password and sets `oracle_session` cookie.
- [ ] Login fails with incorrect password (`401`).
- [ ] Protected endpoints reject unauthenticated requests (`401`).
- [ ] Logout invalidates the current session.

## Ingest and Analytics
- [ ] `/ingest-batch` accepts valid payload + secret and returns `200`.
- [ ] Duplicate ingest with same `batchId` does not create duplicate rows.
- [ ] `/api/stats/summary` reflects ingested totals.
- [ ] `/api/stats/timeseries` returns expected buckets for populated windows.

## Admin Records and Creative Hub
- [ ] Generic admin records upsert/list/delete round-trip works.
- [ ] Creative email templates upsert/list/delete round-trip works.
- [ ] Newsletter subscriber upsert normalizes email and updates in place.

## Observability and Operations
- [ ] `/api/admin/oracle-logs` lists recent operation logs.
- [ ] `delete-older` dry-run reports impact without deleting data.
- [ ] `clear-all` requires explicit confirmation and deletes rows only when intended.
- [ ] `/metrics` returns Prometheus-format counters when authenticated.

## Security
- [ ] SQL injection payloads in query parameters do not mutate schema.
- [ ] SQL console restricted-table reads are blocked (including quoted/qualified identifiers).
- [ ] Unauthorized calls to critical endpoints are blocked.

## Reliability
- [ ] Outbox status endpoint returns stable payload under normal operation.
- [ ] Retry endpoint handles malformed JSON safely (`400`).
- [ ] Alert list endpoint surfaces DB iteration errors instead of partial silent success.
