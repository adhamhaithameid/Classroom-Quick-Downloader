# Oracle Hub v4 Notes

## Tracking
- Draft PR: https://github.com/adhamhaithameid/Classroom-Quick-Downloader/pull/235
- Execution branch (repo policy): `codex/oracle-hub-v4`

## Security
- Dashboard password auth uses `DASHBOARD_PASSWORD` (fallback default is set in app startup for first-run).
- Critical operations require step-up verification using `SUPER_ADMIN_PASSWORD`.
- Step-up can be toggled with `feature_stepup_enforced`.
- Append-only audit log:
  - table: `admin_audit_log`
  - hash chain fields: `prev_hash`, `payload_hash`, `row_hash`

## Reliability
- SQLite transactional outbox table: `ingest_outbox`
- Dead-letter table: `outbox_dead_letter`
- Relay metadata:
  - `relay_offsets`
  - `relay_leases`
- SQLite -> Postgres projection relay:
  - idempotent inserts into `raw_ingest_events`
  - retry + backoff + dead-letter routing

## Observability
- Structured request logs include:
  - `request_id`, `correlation_id`
  - `user_id`, `token_id`, `role`
  - `action_type`, `resource_type`, `resource_id`
  - `result`, `latency_ms`, `error_code`
- Prometheus-style endpoint: `GET /metrics`
- Alert table: `system_alerts`

## Feature Flags
- `feature_sql_console_enabled`
- `feature_clear_data_enabled`
- `feature_sync_enabled`
- `feature_creative_hub_enabled`
- `feature_management_hub_enabled`
- `feature_postgres_projection_enabled`
- `feature_stepup_enforced`

## Admin APIs
- Flags:
  - `GET /api/admin/flags`
  - `POST /api/admin/flags/update`
- Outbox:
  - `GET /api/admin/outbox/status`
  - `POST /api/admin/outbox/retry`
  - `POST /api/admin/outbox/replay-dead-letter`
- Audit:
  - `GET /api/admin/audit/verify-chain`
- Alerts:
  - `GET /api/admin/alerts`
- Migration state:
  - `GET /api/admin/migrations/status`
- SQL console:
  - `POST /api/admin/sql/query` (read-only)
  - `POST /api/admin/sql/exec` (mutating, supports `dryRun`)
- Danger:
  - `POST /api/admin/danger/clear-data` (supports `dryRun`)
  - `POST /api/admin/backup/run`
- Generic record CRUD:
  - `GET /api/admin/records/list?type=...`
  - `POST /api/admin/records/upsert`
  - `POST /api/admin/records/delete`

## Data Model Additions (SQLite)
- `cf_snapshots_raw`
- `cf_schema_registry`
- `ingest_outbox`
- `outbox_dead_letter`
- `relay_offsets`
- `relay_leases`
- `feature_flags`
- `admin_audit_log`
- `system_alerts`
- `backup_runs`
- `admin_records`

## Data Model Additions (Postgres)
- `raw_ingest_events`
- `pg_outbox`

## CI
- Added migration smoke job:
  - boots clean SQLite + Postgres
  - runs DB bootstrap tests
  - runs backend tests
