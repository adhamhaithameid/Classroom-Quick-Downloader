# Architecture Runtime Contract

Status: Active
Scope: Website telemetry and public-read data pipeline
Last Updated: 2026-02-27

## 1. Purpose

This document is the runtime source of truth for production behavior across:

- Website (`/website`)
- Cloudflare Worker + Durable Object (`/cloudflare-worker`)
- Oracle backend + dashboard (`/oracle-backend`)

It defines contracts, ownership, SLO/SLA targets, freshness windows, retry policy, failure behavior, and operator responsibilities.

## 2. Canonical Architecture

### 2.1 Write path

- Website writes telemetry only to Worker.
- Worker validates and queues telemetry.
- Worker flushes telemetry batches to Oracle on schedule.
- Oracle persists telemetry as source of truth.

Path:

`Website -> Cloudflare Worker (ingestion) -> Oracle (storage and aggregation)`

### 2.2 Read path

- Website reads public data only from Oracle public APIs.
- Worker does not act as canonical read source for website-facing analytics.

Path:

`Website <- Oracle public snapshot/data APIs`

### 2.3 Source-of-truth rule

- Oracle is the canonical source for persisted telemetry, aggregates, and website snapshot data.
- Worker is an ingestion gateway and transient queue only.

## 3. Ownership

- Worker ingestion + queue reliability:
  - code: `/cloudflare-worker`
  - owner domain: edge ingestion and buffering
- Oracle persistence + aggregation + snapshot publication:
  - code: `/oracle-backend`
  - owner domain: data truth, auditability, admin operations
- Website fetch/cache/render behavior:
  - code: `/website`
  - owner domain: user UI, graceful degradation, client caching

## 4. Data Contracts

## 4.1 Website telemetry ingress contract

Route:

- `POST /api/public/website/events` (Worker)

Contract rules:

- bounded body size
- bounded events per request
- strict schema validation
- strict enum validation for event kind/action
- idempotent event IDs required
- unknown fields rejected
- structured error response returned

## 4.2 Worker to Oracle batch contract

Route:

- internal authenticated batch route (Oracle)

Contract rules:

- authenticated by shared secret
- includes schema version, batch ID, and generated timestamp
- supports partial-accept accounting
- returns structured ACK/NACK with error code

## 4.3 Oracle public read contract

Routes:

- canonical website snapshot endpoint
- public compatibility endpoints

Contract rules:

- deterministic payload shape
- sanitized fields only
- no raw IPs or sensitive identifiers
- schema version emitted in payloads

## 5. Scheduling and Freshness

## 5.1 Worker -> Oracle telemetry flush

- daily flush target: `23:00 UTC`
- if flush fails, retry with backoff and jitter
- failed exhausted batches move to dead-letter queue state

## 5.2 Oracle snapshot cadence

- public website snapshot refresh target: every `3 hours`
- snapshot freshness objective: `<= 3h + 15m`

## 5.3 Website cache policy

- stale-while-revalidate behavior
- shared in-memory cache + local storage fallback
- manual refresh options for external-data sections

## 6. SLOs and SLA Targets

These are operational targets for pipeline reliability.

- Worker ingest availability: `99.9%` monthly target
- Oracle public snapshot availability: `99.9%` monthly target
- Worker->Oracle batch successful commit within 24h: `99.9%` target
- Snapshot lag alert threshold: `> 195 minutes`

## 7. Retry and Failure Semantics

## 7.1 Worker retry policy

- jittered exponential backoff
- bounded max retries
- retries include correlation IDs
- once exhausted, move to dead-letter queue state

## 7.2 Oracle ingest policy

- transactional writes
- idempotent insert semantics
- explicit accepted/rejected accounting
- fail-closed on auth/config/contract violations

## 7.3 Public endpoint behavior

- fail safely with structured error payload
- do not leak internal state or secrets in responses

## 8. Security Runtime Requirements

- Dashboard auth uses password + session model.
- In production, Oracle session cookies require `SESSION_COOKIE_SECURE=true` (strict secure-cookie mode).
- Danger actions require step-up password verification.
- Worker dashboard IP allowlist is supported and can be enforced.
- Non-allowlisted devices may be granted temporary login via step-up bypass when the dashboard toggle is enabled.
- CSRF/origin checks required for mutating dashboard/API paths.
- Rate limiting and lockout applied to auth and danger verification.
- Audit logs required for admin and danger actions.

## 9. Data Retention Policy

- Telemetry and analytics truth data in Oracle are retained forever.
- Worker stores transient queue and runtime state only; it is not archival storage.
- Operational retention jobs may still prune non-telemetry operational tables.
- No silent deletion of Oracle telemetry truth data is allowed.

## 10. Health Chain and Observability

Required chain visibility:

- Worker:
  - last batch prepared
  - last batch sent
  - last ACK
  - retry count
  - queue depth
  - dead-letter count
- Oracle:
  - last batch accepted
  - last snapshot generation time
  - lag in minutes
  - backup and sheets flush verification status

All chain events should carry request/batch correlation identifiers where possible.

## 11. Error Model

Errors must be structured and machine-readable:

- stable `code`
- human-readable `message`
- `retryable` boolean where relevant

Examples:

- `invalid_payload`
- `invalid_schema_version`
- `method_not_allowed`
- `unauthorized`
- `upstream_unavailable`
- `batch_ack_mismatch`

## 12. Deployment Contract

- Worker, Oracle, and Website auto-deploy on `main`.
- Pre-deploy checks must validate required env/secrets and contract compatibility.
- Post-deploy smoke checks must validate health, ingest path, and read path.
- Rollback procedures must exist for each component.

## 13. Operations and Runbook Alignment

The following runbooks must remain aligned with this runtime contract:

- `/docs/RUNBOOK_INCIDENT_RESPONSE.md`
- `/docs/RUNBOOK_DEPLOYMENT.md`
- `/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`
- `/docs/DEPLOYMENT_RUNBOOK.md`

If behavior changes, update this file and corresponding runbooks in the same change set.
