---
title: "Oracle: add database migration version tracking to db schemas"
---

## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-25

---

### 🔧 Improvement Type
Data Model / Operational

### 🔍 Current State
Currently, both the SQLite and PostgreSQL databases do not track schema migration versions.
- In `oracle-backend/internal/db/db.go`, `Migrate()` executes a hardcoded list of `CREATE TABLE IF NOT EXISTS` statements.
- In `oracle-backend/internal/db/postgres.go`, `migratePostgres()` executes a hardcoded list of `CREATE TABLE IF NOT EXISTS` statements.
There is no `schema_migrations` table to track which migrations have been applied. The application blindly relies on `IF NOT EXISTS` constructs to avoid errors, which makes schema alterations (like adding a column, modifying indexes, or dropping tables) incredibly risky and difficult to manage across different environments, especially in a single-maintainer setup where memory of recent changes fades quickly.

### 💡 Proposed Improvement
Introduce a formal schema migration tracking table and mechanism:
- Add a `schema_migrations` table with a `version` (integer or timestamp) and `applied_at` column to both SQLite and Postgres initialization scripts.
- Refactor the migration logic in `db.go` and `postgres.go` to iterate over an ordered list or embedded directory of migration files (or structs), checking the `schema_migrations` table before applying each one.
- Update the application startup sequence to log the current database version.

### 🎯 Why This Matters
In a single-maintainer context where the service is checked on roughly monthly, knowing exactly what schema is running in production is critical. Without version tracking, the maintainer cannot reliably answer "Did this schema change get deployed?" without manually querying the database for the existence of specific columns. Furthermore, relying on `IF NOT EXISTS` completely falls apart when a column needs to be renamed or an index needs to be dropped. Migration version tracking provides a clear, reliable history of database state and prevents deployment mysteries.

### 📐 Acceptance Criteria
- [ ] A `schema_migrations` table is automatically created on startup if it doesn't exist.
- [ ] Each applied migration inserts its version into `schema_migrations`.
- [ ] Startup logs output the current database schema version.
- [ ] Subsequent restarts do not attempt to reapply already-applied migrations.
- [ ] All existing `CREATE TABLE` and `CREATE INDEX` statements are moved into the new versioned migration framework (as version 1).

### 🔧 Technical Context
- Modifies `oracle-backend/internal/db/db.go` to implement migration tracking for SQLite.
- Modifies `oracle-backend/internal/db/postgres.go` to implement migration tracking for PostgreSQL.
- Potentially creates a new package `oracle-backend/internal/db/migrations` or uses existing Go packages like `golang-migrate/migrate` or `pressly/goose` to handle the logic.

### 📊 Estimated Complexity
Medium (3–5 days) — Requires carefully converting the existing implicit schema into an explicit "Version 1" migration and ensuring that existing databases gracefully adopt the new migration table without attempting to recreate existing tables.

### ⚠️ Risks and Considerations
- **Adoption on existing databases:** The system must gracefully handle the case where tables already exist but the `schema_migrations` table does not. It should probably create the migration table and mark "Version 1" as already applied if a known base table (e.g., `batches` or `pg_ingest_batches`) exists.

### 🔗 Related
None.
