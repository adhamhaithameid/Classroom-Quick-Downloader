---
title: "Oracle: add /health/deep endpoint that validates Postgres DB connectivity and query execution"
---

## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-25

---

### 🔧 Improvement Type
API Enhancement / Observability

### 🔍 Current State
The backend provides health endpoints like `/health` (which just returns static JSON) and `/health/db` (which executes a lightweight `SELECT 1` on the SQLite database). However, it lacks a comprehensive, deep health check that validates connectivity and query execution for the PostgreSQL database (`postgresDB`), which handles critical paths like the ingest outbox and raw event storage.
- `oracle-backend/internal/handlers/health.go` defines `DBHealthHandler` but it only accepts and tests a `*sql.DB` (specifically the SQLite DB in `main.go`).
- The `ReadyHandler` in `health.go` checks if migrations are done and optionally pings Postgres if configured, but a dedicated deep health check endpoint for ongoing load-balancer or uptime monitoring that thoroughly verifies both SQLite and Postgres read/write capability is missing.

### 💡 Proposed Improvement
Add a new `/health/deep` endpoint that performs a comprehensive check of all critical backend dependencies:
- Verifies SQLite connectivity and query execution.
- Verifies PostgreSQL connectivity and query execution (if configured).
- Checks storage watermarks/disk space availability (using the existing `StorageGuard`).
- Returns a structured JSON response indicating the individual health status of each component and an overall `ok` boolean.

### 🎯 Why This Matters
For a single-maintainer service, relying on a simple HTTP `200 OK` or a localized SQLite ping gives a false sense of security. If the PostgreSQL database goes down or becomes unreachable, the main `/health` check will still pass, but critical background jobs (like the `SQLiteToPostgresRelay`) and ingest endpoints will silently fail or back up. A deep health check allows an external monitor (like Uptime Kuma) to catch DB outages or disk space exhaustion before users report missing analytics data, enabling faster response times and preventing data loss.

### 📐 Acceptance Criteria
- [ ] A new `DeepHealthHandler` is added to `oracle-backend/internal/handlers/health.go`.
- [ ] The handler pings both SQLite and PostgreSQL databases (if Postgres is configured).
- [ ] The handler incorporates a check on the `StorageGuard` to ensure disk space is within acceptable limits.
- [ ] The response is a JSON object detailing the status of `sqlite`, `postgres`, and `storage`, along with an overall status.
- [ ] The handler returns HTTP 200 if all configured dependencies are healthy, and HTTP 503 Service Unavailable if any critical component is failing.
- [ ] The endpoint `/health/deep` is registered in `oracle-backend/cmd/app/main.go`.

### 🔧 Technical Context
- Modifies `oracle-backend/internal/handlers/health.go` to add `DeepHealthHandler`.
- Modifies `oracle-backend/cmd/app/main.go` to inject dependencies (SQLite `db`, Postgres `db`, and `storageGuard`) and route `/health/deep` to the new handler.

### 📊 Estimated Complexity
Small (1–2 days) — The underlying ping and status mechanisms already exist; it mostly requires assembling them into a unified, structured endpoint and configuring the route.

### ⚠️ Risks and Considerations
- **Load balancing:** Deep health checks should not be executed too frequently (e.g., every second by a load balancer) to avoid unnecessary database load. Monitoring tools should be configured to poll this endpoint at a reasonable interval (e.g., every 30-60 seconds).
- **Postgres optionality:** The handler must gracefully handle environments where PostgreSQL is not configured (e.g., local development), skipping the Postgres check and returning healthy for that component.

### 🔗 Related
None.
