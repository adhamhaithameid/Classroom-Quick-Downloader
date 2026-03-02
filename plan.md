# Execution Gate

Before making **any** repository changes, read this file first and confirm the current implementation phase. This file is the mandatory plan source of truth for the runtime hardening work.

# Runtime Contract + Fail-Safe Telemetry Plan (Website ↔ Worker ↔ Oracle)

## Summary

This plan locks the architecture as:

- `Website -> Cloudflare Worker` for writes only.
- `Website <- Oracle` for reads only.
- Worker is ingestion gateway and temporary queue only.
- Oracle is the source of truth and long-term store.
- Website/extension telemetry sent to Oracle is retained forever.
- Cloudflare dashboard IP allowlist is kept, with optional step-up bypass for non-allowlisted devices.
- Dashboard auth remains password + step-up; optional Cloudflare Access can be added.
- Auto-deploy on `main` covers Worker/DO, Oracle backend+dashboard, and Website.

Decisions locked:
- Retention: **Telemetry Forever** (ingest data + analytics snapshots forever, operational retention still allowed).
- Website-event daily flush from Worker to Oracle: **23:00 UTC**.
- Auto-deploy scope: **Cloudflare Worker+DO, Oracle backend/dashboard, Website**.

---

## 1) Architecture Lock + SLA Contract

Create `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/ARCHITECTURE_RUNTIME_CONTRACT.md` with exact contracts and ownership.

Include:
1. Component ownership:
   - Worker ingestion: `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker`.
   - Oracle source-of-truth and snapshots: `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend`.
   - Website read/cache/render: `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website`.
2. Data flow contract:
   - Website event writes only to Worker.
   - Worker batches and flushes to Oracle at 23:00 UTC daily with retry.
   - Oracle serves one canonical public snapshot endpoint.
3. Freshness windows:
   - Public snapshot refresh cadence: every 3 hours.
   - Snapshot max acceptable lag: 3h + 15m.
   - Website telemetry batch max ingestion lag target: 24h + retry window.
4. SLOs:
   - Worker ingest availability target.
   - Oracle public snapshot availability target.
   - End-to-end batch success target and max replay lag.
5. Retry behavior:
   - Worker retry with jittered exponential backoff.
   - Dead-letter after max retries.
   - Replay controls in dashboard.
6. Error-code catalog and fail-closed rules.
7. Explicit “no silent delete of telemetry data” policy for Oracle ingest tables.

---

## 2) API Contract Freeze + Versioning

Add explicit schema versioning across ingest and read contracts.

### 2.1 Worker ingest request contract (from Website)
Endpoint stays:
- `POST /api/public/website/events` on Worker.

Required request field:
- `schemaVersion: "1"`.

Rules:
1. Reject unknown fields.
2. Enforce enums for `eventType` and `action`.
3. Enforce max batch size and max body size.
4. Return structured errors only.

Structured error response shape:
- `{ ok: false, schemaVersion: "1", error: { code, message, retryable } }`.

### 2.2 Worker -> Oracle internal batch contract
Add internal endpoint:
- `POST /api/internal/website/events/batch` on Oracle.
- Auth by shared secret header (`X-DO-SECRET`).
- No browser CORS usage.

Request includes:
- `schemaVersion`, `batchId`, `generatedAtUtc`, `events[]`, `attempt`.

### 2.3 Oracle public read contracts
Add `schemaVersion: "1"` to:
- `GET /api/public/website/snapshot` (new canonical endpoint).
- Existing public endpoints (overview/map/status/changelog/uninstall) for compatibility.

---

## 3) Worker Ingestion Pipeline Hardening

Update:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/index.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/downloads_do.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/types.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/src/dashboard/main.ts`

Changes:
1. Stop proxying website events directly to Oracle for `POST /api/public/website/events`.
2. Ingest website events into DO queue with idempotent event IDs.
3. Keep only gateway state in Worker:
   - pending queue,
   - retry state,
   - dead-letter queue,
   - last flush metadata.
4. Remove long-term analytics role from Worker for website read path.
5. Flush website-event queue once daily at 23:00 UTC.
6. Retry with jittered backoff; after max retries send to DLQ.
7. Add admin replay/flush-now controls for website telemetry queue.
8. Keep correlation IDs through queue, flush, and errors.
9. Keep Cloudflare dashboard IP allowlist enforcement in login flow, and add configurable step-up bypass for blocked IPs.

---

## 4) Oracle Write Path Hardening + Forever Storage

Update:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/public_website.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/website_ops.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/db/db.go`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go`
- Add new handler file for internal worker batch ingest.

Changes:
1. Add append-only raw table for website events (`website_events_raw`).
2. Use transactional ingest:
   - insert raw event (idempotent by `event_id`),
   - upsert daily aggregates,
   - record batch metadata.
3. Remove website event idempotency auto-delete in `public_website.go`.
4. Keep all website/extension ingest payload history forever in Oracle.
5. Keep operational retention only for non-telemetry operational tables.
6. Keep write endpoints fail-closed on auth/config errors.
7. Enforce strict decoder + bounded body size for all ingest routes.

---

## 5) Canonical Oracle Snapshot Layer

Add one source endpoint for website reads:
- `GET /api/public/website/snapshot`.

Snapshot includes:
- totals, installs, versions, status, map countries, user changelog summary, privacy summary pointers, generatedAt, schemaVersion, snapshotId.

Rules:
1. Snapshot generated from Oracle tables only.
2. Snapshot refresh job every 3 hours.
3. Existing `overview/map/status/changelog` endpoints become wrappers over same snapshot store to avoid divergence.
4. Website consumes snapshot endpoint as primary read path.

---

## 6) End-to-End Health Chain

Expose chain observability with shared correlation IDs.

Add/extend:
1. Worker health payload includes:
   - last website batch created,
   - last website batch sent,
   - last website batch ack,
   - pending queue size,
   - retry count,
   - dead-letter count.
2. Oracle admin health payload includes:
   - last batch accepted,
   - last snapshot generated,
   - lag in minutes,
   - backup drift indicators,
   - sheets flush verification status.
3. Dashboard pages display chain states and lag with explicit thresholds.

---

## 7) Dashboard Security Hardening

### 7.1 Worker dashboard
1. Keep IP allowlist gate on login.
2. Keep password auth + step-up password, with optional bypass for non-allowlisted IPs (dashboard toggle).
3. Keep login attempt rate limiting + lockout/backoff.
4. Add CSRF/origin checks for mutating admin routes.
5. Keep audit logs for danger actions.
6. Optional Cloudflare Access mode:
   - if Access headers configured, require valid Access identity for dashboard routes.

### 7.2 Oracle dashboard
1. Keep existing auth + CSRF + step-up.
2. Enforce strict session cookie policy in production.
3. Keep lockout/backoff for auth attempts.
4. Ensure all danger actions are audited with actor, action, timestamp, correlation ID.

---

## 8) Website Data Behavior Hardening

Update:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/api/publicSite.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/types/public.ts`
- Add a shared snapshot service/store module.

Changes:
1. Use one snapshot fetch service across all pages.
2. Keep stale-while-revalidate with shared in-memory + local storage fallback.
3. Keep manual refresh buttons for external-data sections.
4. Provide explicit degraded states when Oracle is unavailable.
5. Ensure all pages read the same snapshot instance to avoid duplicate calls and inconsistent numbers.

---

## 9) Backup + Integrity Verification

Oracle changes:
1. Add checksum/hash per Worker->Oracle telemetry batch.
2. Record archive verification metadata after sheets flush.
3. Add “backup drift” alert condition:
   - if expected flush window missed,
   - or if checksum/row-count mismatch occurs.
4. Expose verification status on Oracle dashboard.

---

## 10) CI/CD Guardrails + Auto Deploy on Main

Update workflows:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/deploy-cloudflare-worker.yml`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/oracle-dashboard-deploy.yml`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/.github/workflows/website-deploy.yml`

Changes:
1. Keep auto deploy on every `main` push for Worker, Oracle, Website.
2. Remove website path-only deploy filter so website deploy is not skipped on main changes.
3. Add pre-deploy checks:
   - env completeness,
   - required secrets present,
   - schema compatibility checks.
4. Add post-deploy smoke checks:
   - health,
   - auth,
   - ingest path,
   - snapshot path.
5. Add rollback commands/script references in runbook for each system.

---

## 11) Runbooks + Operator Docs

Create/update:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_DEPLOYMENT.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DEPLOYMENT_RUNBOOK.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/TESTING.md`

Must include:
1. Exact commands.
2. Expected outputs.
3. Triage trees per failure class.
4. Manual replay procedures.
5. Rollback procedures.
6. Security incident containment steps.

---

## 12) Test Plan (Strict + Comprehensive)

### 12.1 Unit
1. Schema validators reject unknown fields and invalid enums.
2. Idempotency behavior for duplicate event IDs.
3. Aggregation determinism by UTC day.

### 12.2 Functional
1. Website click events accepted by Worker.
2. Daily 23:00 flush emits correct batch.
3. Oracle persists raw + aggregate in one transaction.

### 12.3 Integration
1. Website -> Worker -> Oracle batch flow with correlation ID continuity.
2. Oracle snapshot generation reflects new aggregate rows.
3. Dashboard replay of DLQ batch succeeds.

### 12.4 Regression
1. Existing extension ingest and dashboard behavior unchanged.
2. Existing public website endpoints still respond (compatibility wrappers).

### 12.5 Load
1. Worker ingest sustained throughput under expected peak.
2. Oracle batch ingest throughput for daily flush size.

### 12.6 Stress
1. Burst ingest to queue limits.
2. Oracle temporary downtime + large replay on recovery.

### 12.7 Security
1. Auth required on admin routes.
2. Step-up required on danger routes.
3. CSRF/origin checks enforced.
4. Rate-limit and lockout behavior validated.
5. No raw IP leakage in public outputs.

### 12.8 UI
1. Worker dashboard replay/flush controls usable.
2. Oracle health chain panels show accurate state.
3. Website degraded states and refresh behavior correct.

### 12.9 Fuzz
1. Fuzz ingest payload parser for Worker and Oracle.
2. Fuzz malformed JSON and boundary-size payloads.

### 12.10 Reliability
1. Retry with jitter/backoff functions correctly.
2. DLQ creation and replay path verified.
3. No event loss across Worker restarts (within DO persistence guarantees).

### 12.11 Smoke
1. `health` endpoints.
2. one ingest call.
3. one snapshot call.
4. one authenticated dashboard call.

---

## 13) Rollout Sequence

1. Add runtime contract docs and schema definitions first.
2. Implement Oracle internal batch ingest + raw storage + tests.
3. Implement Worker website-event queue + daily 23:00 flush + DLQ + tests.
4. Implement Oracle snapshot canonical endpoint + compatibility wrappers.
5. Update website to consume canonical snapshot endpoint.
6. Update dashboards (health chain + replay controls).
7. Apply security hardening changes.
8. Update CI/deploy guardrails and runbooks.
9. Deploy Oracle, then Worker, then Website.
10. Run smoke checks and 24h monitoring for lag/retry/DLQ.

---

## Important Public API / Interface / Type Changes

1. New/updated request field:
   - `schemaVersion` in website telemetry ingest payload.
2. New Oracle internal endpoint:
   - `POST /api/internal/website/events/batch` (secret-authenticated).
3. New Oracle canonical public endpoint:
   - `GET /api/public/website/snapshot`.
4. Updated response envelopes:
   - add `schemaVersion` and structured `error` object.
5. Worker dashboard API additions:
   - website queue status, dead-letter metrics, replay actions.
6. Website types update:
   - canonical snapshot response type and error envelope type.

---

## Assumptions and Defaults Chosen

1. “Store forever” applies to telemetry/event and analytics snapshot data in Oracle.
2. Operational housekeeping retention remains for non-telemetry operational tables.
3. Daily website-event flush from Worker to Oracle runs at 23:00 UTC.
4. Cloudflare IP allowlist remains available; step-up bypass for non-allowlisted devices is configurable.
5. Cloudflare Access remains optional hardening layer, not mandatory default.
6. Auto deploy on `main` applies to Worker/DO, Oracle backend/dashboard, and Website.
7. Browser-store extension publishing is out of this auto-deploy scope.
