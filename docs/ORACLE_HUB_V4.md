# Oracle Hub v4 Notes

## Tracking
- Draft PR: [#235](https://github.com/adhamhaithameid/Classroom-Quick-Downloader/pull/235)
- Current execution branch: `codex/oracle-hub-v4`

## Security Baseline
- Startup is fail-closed for credentials:
  - `DASHBOARD_PASSWORD` is required unless `ALLOW_EMPTY_DASHBOARD_PASSWORD=true` (dev-only escape hatch).
  - `SUPER_ADMIN_PASSWORD` is required for step-up-protected operations.
- No built-in default dashboard/admin passwords are used.
- Critical actions require step-up auth when `feature_stepup_enforced=true`.
- Audit log is append-only with hash chain integrity:
  - `prev_hash`
  - `payload_hash`
  - `row_hash`

## Reliability Model
- No unsafe synchronous dual-write between SQLite and Postgres in request paths.
- SQLite ingestion path uses transactional outbox:
  - `ingest_outbox`
  - `outbox_dead_letter`
  - `relay_offsets`
  - `relay_leases`
- Postgres control-plane path writes to `pg_admin_records` and appends to `pg_outbox`.
- Replay/backfill tooling is exposed via admin APIs.

## Observability
- Structured operation logging includes:
  - `request_id`, `correlation_id`
  - `user_id`, `token_id`, `role`
  - `action_type`, `resource_type`, `resource_id`
  - `result`, `latency_ms`, `error_code`
- Prometheus-style metrics endpoint:
  - `GET /metrics`
- Oracle operation logs UI/API:
  - `GET /api/admin/oracle-logs`
  - `POST /api/admin/oracle-logs/delete-older`
  - `POST /api/admin/oracle-logs/clear-all`
- Alert sink:
  - `system_alerts`
  - `GET /api/admin/alerts`

## Feature Flags
- `feature_sql_console_enabled`
- `feature_clear_data_enabled`
- `feature_sync_enabled`
- `feature_creative_hub_enabled`
- `feature_management_hub_enabled`
- `feature_postgres_projection_enabled`
- `feature_stepup_enforced`

## Admin API Surface (v4)
- Flags:
  - `GET /api/admin/flags`
  - `POST /api/admin/flags/update`
- Outbox:
  - `GET /api/admin/outbox/status`
  - `POST /api/admin/outbox/retry`
  - `POST /api/admin/outbox/replay-dead-letter`
- Audit:
  - `GET /api/admin/audit/verify-chain`
- Migrations:
  - `GET /api/admin/migrations/status`
- Deployments:
  - `GET /api/admin/deployments/targets`
  - `POST /api/admin/deployments/sync`
- Creative/Newsletter:
  - `GET/POST` endpoints under `/api/admin/creative/*` and `/api/admin/newsletter/*`
- Danger + SQL:
  - `POST /api/admin/danger/clear-data`
  - `POST /api/admin/sql/query`
  - `POST /api/admin/sql/exec`
  - `POST /api/admin/backup/run`

## UI Notes
- Sidebar and topbar shortcuts are visible when holding `Command`/`Ctrl` for 1 second.
- Main dashboard includes donut cards for:
  - Success vs failure
  - Downloads vs cancelled
- Logs tab is dedicated to Oracle backend operation logs and retention controls.

## Verification Commands
- Oracle backend full scan:
  - `cd oracle-backend && ./scripts/full-scan.sh`
- Cloudflare worker validation:
  - `pnpm -C cloudflare-worker run validate`
- Extension tests:
  - `pnpm -C extension test`
