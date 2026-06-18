---
title: "Oracle: add database migration version tracking — no way to know current schema version"
---

## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-18

---

### 🔧 Improvement Type
Data Model / Operational

### 🔍 Current State
Currently, `oracle-backend/internal/db/postgres.go` and `oracle-backend/internal/db/db.go` both execute schema definitions inside functions like `migratePostgres(db *sql.DB)` and `migrate(db *sql.DB)` using `CREATE TABLE IF NOT EXISTS` blocks. There is absolutely no schema version or migration history table (e.g. `schema_migrations`) being tracked in the database.

### 💡 Proposed Improvement
Introduce a formal migration version tracking table.
- Create a `schema_migrations` table with columns `version (INTEGER)`, `applied_at (BIGINT)`.
- Modify the startup logic in `oracle-backend/internal/db/db.go` and `oracle-backend/internal/db/postgres.go` to check the current `version` in the database.
- Execute only the newer migrations based on the database version.
- Insert a record into `schema_migrations` after each successful schema application.
- This creates a reliable way to know what schema version is deployed in production versus what's in the code.

### 🎯 Why This Matters
For a single-maintainer service checked monthly, knowing the exact state of production is paramount. If the server goes down or fails to start after an update, the maintainer needs to know if the database schema matches the running binary. Without a `schema_migrations` table, it is impossible to definitively know the deployed schema version without manually querying table definitions. This makes debugging deployment failures or data corruption much harder.

### 📐 Acceptance Criteria
- [ ] A `schema_migrations` table is created in both SQLite and PostgreSQL on startup.
- [ ] The current schema application is recorded as a version in the table.
- [ ] Future schema changes can be applied conditionally based on the version.
- [ ] The application startup logs output the current database schema version.
- [ ] Existing UAT and unit tests continue to pass.

### 🔧 Technical Context
- Modifying `oracle-backend/internal/db/db.go` to add version tracking for SQLite.
- Modifying `oracle-backend/internal/db/postgres.go` to add version tracking for PostgreSQL.
- Both files would need a new `schema_migrations` table definition and logic to read/write from it during the `migrate()` and `migratePostgres()` functions.

### 📊 Estimated Complexity
Small (1-2 days) — This is a well-understood pattern. We can implement a very lightweight version tracking system without needing heavy external tools like `golang-migrate`, just by modifying the existing `Init` and `migrate` functions.

### ⚠️ Risks and Considerations
The main risk is the initial transition. The very first run of this new code on an existing production database needs to accurately recognize that the existing schema (version 0) is already fully applied, and set the version correctly without re-running destructive statements or failing due to conflicts. The use of `IF NOT EXISTS` mitigates most conflicts, but setting the correct initial version is important.

### 🔗 Related
- `oracle-backend/internal/db/db.go`
- `oracle-backend/internal/db/postgres.go`
