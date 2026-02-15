# Oracle Hub v4

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

Last updated: 2026-02-13

## 1. Scope and Objectives

Oracle Hub v4 upgrades Oracle from an analytics-only sink into a full operational control plane and analysis hub for the CQD ecosystem.

Primary goals:

- Make Oracle the central admin dashboard for analytics, deployments, notifications, and operational controls.
- Keep ingestion reliable under failure with outbox-driven replay and idempotency.
- Move critical administration to role-aware and step-up-protected workflows.
- Expand observability with structured logs, metrics, and alerting.
- Keep UI style simple/dark while adding high-value admin sections.

Related issues:

- `#103` major oracle dashboard changes.
- `#228` security foundation + step-up auth.
- `#229` hybrid DB enablement.
- `#230` cloudflare sync + schema drift tracking.
- `#231` client-side analytics/UI overhaul.
- `#232` management hub.
- `#233` creative hub.
- `#234` danger zone + admin operations.

## 2. What v4 Delivers

### 2.1 Main Admin Experience

- Unified Oracle dashboard with sectioned navigation for:
  - Overview/Insights/Activity analytics.
  - Ops Hub (service links and operational cards).
  - Creative/Newsletter management.
  - Logs.
  - Danger zone actions.
- Dashboard-level UX additions:
  - Top Today and Top All Time cards.
  - Donut charts for Success vs Failure and Downloads vs Cancelled.
  - Time-filterable activity views and chart windows.
  - UTC clock integrated in the navigation shell.

### 2.2 Management + Ops Hub

- Central operational link hub (Cloudflare, Uptime Kuma, GitHub, Google Sheets, Figma).
- Browser deployment sync endpoints and deployment-target records.
- GitHub open-count endpoint for admin notification cards.

### 2.3 Creative + Newsletter Hub

- Admin CRUD for:
  - creative design cards,
  - HTML email templates,
  - newsletter subscribers,
  - newsletter campaigns (backend supports it even if UI simplifies flows).
- Feature-flag support to disable this module quickly if needed.

### 2.4 Logs + Danger Zone

- Oracle operation logs tab with:
  - list view,
  - retention deletion (delete older than N days),
  - clear-all endpoint.
- Danger zone converted to explicit action buttons/workflows (no need for raw SQL typing in normal use).
- SQL console remains available behind strict feature flag + step-up for exceptional maintenance only.

## 3. Data and Reliability Architecture

### 3.1 Ingestion Path (SQLite-owned)

- `/ingest-batch` writes analytics batch data to SQLite.
- Same transaction appends outbox event (`ingest_outbox`) with deterministic idempotency key.
- Relay processes outbox and projects to Postgres asynchronously.
- Dead-letter queue (`outbox_dead_letter`) captures poison events.

### 3.2 Control Plane Path (Postgres-capable)

- Admin/control-plane records can run in Postgres-primary mode behind server flags.
- Outbox model is preserved for downstream async work and replay.
- No unsafe synchronous SQLite+Postgres dual-write in one request path.

### 3.3 Raw-to-Projected Model

- Raw Cloudflare payload snapshots are persisted (sanitized as configured).
- Schema path registry tracks discovered JSON paths (`cf_schema_registry`).
- Known fields are projected for fast analytics queries.
- Schema drift raises alerts without blocking ingest.

### 3.4 Audit Integrity

- `admin_audit_log` is append-only by policy.
- Each row includes hash-chain fields:
  - `prev_hash`,
  - `payload_hash`,
  - `row_hash`.
- Verification endpoint:
  - `GET /api/admin/audit/verify-chain`

## 4. Security Model (Current v4 Baseline)

### 4.1 Authentication and Step-Up

- Startup is fail-closed for secrets:
  - `DASHBOARD_PASSWORD` required unless explicitly bypassed for local dev.
  - `SUPER_ADMIN_PASSWORD` required.
- Viewer auth uses session cookies.
- Critical operations require step-up when `feature_stepup_enforced=true`.

### 4.2 Cookie and Proxy Security

- Cookie policy supports auto/forced secure mode:
  - `SESSION_COOKIE_SECURE=auto|true|false`
- In `auto`, secure cookies are issued for:
  - direct TLS, or
  - trusted proxy with `https` forwarded proto.
- Forwarded headers are trusted only when source remote IP is within `TRUSTED_PROXY_CIDRS`.

### 4.3 Header and Request Hardening

- CSRF defenses for mutating `/api/*`:
  - requires `X-Requested-With: XMLHttpRequest`,
  - validates origin host when `Origin` is present.
- Request body limits:
  - admin APIs capped (`1 MiB` class),
  - auth APIs capped (`256 KiB` class),
  - ingest has dedicated max body bound.
- Security headers middleware sets:
  - `Content-Security-Policy` with nonce-based script control,
  - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  - `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- Sensitive API paths send no-store cache headers.

### 4.4 Auth Bypass Surface Reduction

- `X-Archiver-Secret` bypass is restricted to explicit archiver-safe GET routes only.
- Auth/session checks still gate all normal admin and mutating flows.
- `/metrics` is authenticated.

### 4.5 SQL Console Guardrails

- Disabled by default via `feature_sql_console_enabled`.
- Step-up protected.
- Query endpoint:
  - read-only enforcement,
  - restricted-table deny rules including quoted/qualified/comma-join forms,
  - forbidden term checks.
- Exec endpoint:
  - limited to allowlisted tables,
  - dry-run support.
- SQL console operations are audit-logged.
- SQL execution paths use bounded timeouts.

### 4.6 Ingest Abuse Controls

- Unauthorized ingest attempts return `401`.
- Unauthorized failure logging is throttled per window to reduce log/DB flood pressure.

## 5. Observability and Alerts

### 5.1 Structured Logging

Operation logs include actor + request context fields such as:

- `request_id`, `correlation_id`,
- `user_id`, `token_id`, `role`,
- `action_type`, `resource_type`, `resource_id`,
- `result`, `latency_ms`, `error_code`.

### 5.2 Metrics

- `GET /metrics` (authenticated) exports Prometheus-style counters/gauges.
- Coverage includes auth failures, step-up/rate-limit events, sync timings, outbox signals, drift counts, backup failures, and related runtime signals.

### 5.3 Alerting

`system_alerts` is used for operational alerts such as:

- no-sync-success windows,
- schema drift detections,
- backup failures,
- outbox backlog pressure,
- step-up abuse spikes.

Admin alert endpoint:

- `GET /api/admin/alerts`

## 6. Feature Flags and Kill Controls

Server-side flags include:

- `feature_sql_console_enabled`
- `feature_clear_data_enabled`
- `feature_sync_enabled`
- `feature_creative_hub_enabled`
- `feature_management_hub_enabled`
- `feature_postgres_projection_enabled`
- `feature_stepup_enforced`
- postgres cutover flags where configured (`feature_postgres_primary_ingest`, `feature_postgres_primary_control_plane`, etc.)

Admin API:

- `GET /api/admin/flags`
- `POST /api/admin/flags/update`

## 7. Core v4 API Surface

### 7.1 Reliability and Operations

- `GET /api/admin/outbox/status`
- `POST /api/admin/outbox/retry`
- `POST /api/admin/outbox/replay-dead-letter`
- `GET /api/admin/migrations/status`
- `GET /api/admin/ha/status`
- `GET /api/admin/storage/status`
- `GET /api/admin/dr/status`
- `POST /api/admin/dr/drill`
- `POST /api/admin/retention/run`

### 7.2 Security and Audit

- `GET /api/admin/audit/verify-chain`
- `POST /api/auth/stepup/start`
- `POST /api/auth/stepup/verify`
- `GET /api/auth/stepup/check`

### 7.3 Logs and Admin Data

- `GET /api/admin/oracle-logs`
- `POST /api/admin/oracle-logs/delete-older`
- `POST /api/admin/oracle-logs/clear-all`
- `GET /api/admin/records/list`
- `POST /api/admin/records/upsert`
- `POST /api/admin/records/delete`

### 7.4 Creative and Newsletter

- `GET /api/admin/creative/designs`
- `POST /api/admin/creative/designs/upsert`
- `POST /api/admin/creative/designs/delete`
- `GET /api/admin/creative/emails`
- `POST /api/admin/creative/emails/upsert`
- `POST /api/admin/creative/emails/delete`
- `GET /api/admin/newsletter/subscribers`
- `POST /api/admin/newsletter/subscribers/upsert`
- `POST /api/admin/newsletter/subscribers/delete`
- `GET /api/admin/newsletter/campaigns`
- `POST /api/admin/newsletter/campaigns/upsert`
- `POST /api/admin/newsletter/campaigns/delete`

## 8. Testing and Validation

Recommended checks:

- Full backend + worker scan:
  - `cd oracle-backend && ./scripts/full-scan.sh`
- Backend tests:
  - `cd oracle-backend && go test ./... -count=1`
- Handler-only tests:
  - `cd oracle-backend && go test ./internal/handlers -count=1`
- App-layer tests:
  - `cd oracle-backend && go test ./cmd/app -count=1`

## 9. Notes for Operators

- Keep `TRUSTED_PROXY_CIDRS` strict and minimal when running behind reverse proxies.
- Keep dangerous feature flags disabled by default in production.
- Treat SQL console as emergency-only, not routine operation.
- Periodically verify audit chain and backup/restore readiness.
