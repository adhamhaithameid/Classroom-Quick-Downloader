## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-11

---

### 🔧 Improvement Type
Data Model / Operational

### 🔍 Current State
Currently, `oracle-backend/internal/db/postgres.go` defines a function `migratePostgres(db *sql.DB) error` that statically applies a series of `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements during application startup (`InitPostgres()`). There is no mechanism to track which migrations have been applied to the production database, no version tracking table, and no support for running backward migrations. Without version tracking, modifying existing schemas (e.g., adding a column) becomes extremely risky and error-prone, as there's no reliable way to verify the deployed schema version in production vs what's defined in the codebase. This makes operational maintenance and schema evolution difficult for a single maintainer.

### 💡 Proposed Improvement
Introduce a `schema_migrations` table to track applied migration versions and transition from a hardcoded slice of SQL strings to discrete, versioned migration files (or embedded versioned strings).

Specifically:
- Create a `schema_migrations` table containing columns `version (BIGINT PRIMARY KEY)`, `applied_at (BIGINT)`, and `description (TEXT)`.
- Update `InitPostgres()` and `migratePostgres()` in `oracle-backend/internal/db/postgres.go` to query `schema_migrations` to determine the current schema version.
- Apply only pending migrations, sequentially based on version number, and record the newly applied version into the `schema_migrations` table within a transaction.
- Create a Makefile target (`make db-migrate`) for applying migrations explicitly during deployments or local development, rather than strictly relying on auto-migration at startup.

### 🎯 Why This Matters
For a single-maintainer service checked infrequently, operational simplicity and survivability are paramount. Modifying a production database schema without version tracking is a major risk factor for data corruption and downtime. If an `ALTER TABLE` statement fails or needs to be retried, the maintainer has no context regarding the database's true state without logging into the instance and querying metadata manually. Implementing explicit migration tracking ensures that deployments apply database changes safely and predictably, avoiding the risk of a botched auto-migration at 3am. It provides a source of truth for the database state directly tied to the codebase.

### 📐 Acceptance Criteria
- [ ] A `schema_migrations` table is automatically created if it does not exist.
- [ ] Startup migration logic correctly identifies the current schema version from `schema_migrations`.
- [ ] The startup logic successfully executes only pending migrations within a transaction.
- [ ] Each successfully applied migration is recorded in the `schema_migrations` table.
- [ ] A `make db-migrate` command is added to the `Makefile` to trigger explicit migrations locally.

### 🔧 Technical Context
- Modifications are needed in `oracle-backend/internal/db/postgres.go`, specifically around `InitPostgres` and `migratePostgres`.
- The current hardcoded statements in `migratePostgres` should be refactored into a structured format (e.g., a slice of structs containing a version ID and the SQL statement) representing the initial migration (Version 1).
- `oracle-backend/Makefile` will need a new `db-migrate` target.

### 📊 Estimated Complexity
Medium (3–5 days). Transitioning the existing setup to a tracked system involves refactoring the current hardcoded setup and carefully implementing the new logic to recognize the existing schema as "Version 1" to avoid attempting to recreate tables that already exist.

### ⚠️ Risks and Considerations
- **Transitioning Existing Databases:** The most critical risk is ensuring that existing production databases are correctly recognized as having "Version 1" applied without attempting to rerun the initial `CREATE TABLE` commands. The logic must either safely execute `CREATE TABLE IF NOT EXISTS` for the base version or manually insert the base version record into `schema_migrations` if the base tables are detected.

### 🔗 Related
- N/A
