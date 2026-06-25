## 2026-06-25 — Database migrations tracking and deep health check endpoints
**Issues Filed:**
- Oracle: add database migration version tracking to db schemas
- Oracle: add /health/deep endpoint that validates Postgres DB connectivity and query execution
**Rationale:** In a single-maintainer system, survivability relies on explicit visibility. Migrations currently use implicit `IF NOT EXISTS` creation, making schema management and tracking brittle over time. A deep health check provides early alerts to data store failures before user-visible symptoms occur, rather than relying on a false-positive API ping.
**Areas for Next Run:**
- Idempotency key tracking in `store_batch.go` to prevent duplication (though there are some naive UNIQUE constraints).
- Pagination on `pipeline.go` handlers to prevent unbounded result sets.
