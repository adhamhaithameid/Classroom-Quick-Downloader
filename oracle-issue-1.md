## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-03-05

---

### 🔧 Improvement Type
Data Model / Operational

### 🔍 Current State
Currently, database migrations are handled using `CREATE TABLE IF NOT EXISTS` statements executed sequentially at application startup in `oracle-backend/internal/db/db.go` (and similarly for PostgreSQL in `postgres.go`). There is no mechanism to track the current database schema version or to safely apply alter/drop statements for evolutionary changes. The current state relies entirely on idempotent `IF NOT EXISTS` queries, which cannot easily handle column renames, data backfills, or table drops without manual intervention.

### 💡 Proposed Improvement
Introduce a formal database migration version tracking system.
- Create a `schema_migrations` table that stores the currently applied schema version(s).
- Refactor the `Migrate(db *sql.DB)` function to run forward migrations incrementally based on the stored version.
- Introduce a mechanism (such as Go `embed` or simple structured Go strings) to separate individual migration steps (up/down).
- Add a new Makefile target `make db-migrate` to run migrations cleanly outside of normal application startup if required, although auto-migration on startup can be retained for simplicity.

### 🎯 Why This Matters
For a single-maintainer backend with infrequent check-ins, the inability to safely alter schema structure means technical debt accumulates rapidly. If an index needs dropping or a column type needs changing to fix a production issue, it requires manual `sqlite3` execution on the server. If this manual step is forgotten or the server goes down and is reprovisioned, the `IF NOT EXISTS` logic alone will not restore the altered state. Version tracking ensures that the production database schema is strictly synchronized with the deployed codebase, enabling automated and reliable recovery without human memory.

### 📐 Acceptance Criteria
- [ ] A `schema_migrations` table is automatically created if it doesn't exist during startup.
- [ ] The system accurately records each applied migration version in the database.
- [ ] The `Migrate` function applies only unapplied migrations sequentially.
- [ ] A test verifies that running migrations against an already up-to-date database performs no unwanted operations.
- [ ] The new behaviour is compatible with both SQLite (`db.go`) and PostgreSQL (`postgres.go`) configurations.

### 🔧 Technical Context
- **Files to modify:** `oracle-backend/internal/db/db.go`, `oracle-backend/internal/db/postgres.go`
- **Packages:** `database/sql`
- **Implementation Details:** Implement a lightweight custom migrator or adopt a small, robust library like `golang-migrate/migrate`. Given the minimal dependency philosophy, a simple internal migration runner that loops over a slice of `{Version, UpQuery, DownQuery}` structs and tracks execution in `schema_migrations` would be sufficient.

### 📊 Estimated Complexity
Small (1–2 days). The logic for a simple, linear migration runner is straightforward and localized entirely within the `internal/db` package.

### ⚠️ Risks and Considerations
The main risk is the initial bootstrapping of the migration table on existing production databases. The first migration script (Version 1) must be a baseline that safely identifies if the legacy `IF NOT EXISTS` tables are already present and inserts a "v1" record without destructive consequences.

### 🔗 Related
None.
