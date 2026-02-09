// oracle-backend/internal/db/db.go
package db

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// Init opens a SQLite database at the given path, enables WAL and a 5000ms busy timeout via the DSN, configures the connection pool for read concurrency, runs migrations, and returns the ready *sql.DB.
// If migrations fail the database is closed and the migration error is returned.
func Init(dbPath string) (*sql.DB, error) {
	// Use WAL + busy_timeout via DSN.
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", dbPath)
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// WAL mode allows concurrent readers with single writer.
	// Increase pool for better read concurrency.
	database.SetMaxOpenConns(5)
	database.SetMaxIdleConns(3)

	if err := Migrate(database); err != nil {
		_ = database.Close()
		return nil, err
	}

	return database, nil
}

// Migrate ensures required database pragmas, tables, and indices are present.
// It runs a series of idempotent SQL statements (PRAGMA and CREATE ... IF NOT EXISTS)
// and returns the first error encountered while executing them.
func Migrate(db *sql.DB) error {
	stmts := []string{
		`PRAGMA journal_mode = WAL;`,
		`PRAGMA synchronous = NORMAL;`,
		`PRAGMA busy_timeout = 5000;`,

		// Idempotency + batch metadata.
		`CREATE TABLE IF NOT EXISTS batches (
			batch_id        TEXT PRIMARY KEY,
			generated_at    INTEGER,
			ingested_at     INTEGER,
			time_zone       TEXT,
			events_count    INTEGER,
			downloads_count INTEGER,
			success_count   INTEGER,
			fail_count      INTEGER
		);`,

		// Per-hour aggregates (warehouse grain).
		`CREATE TABLE IF NOT EXISTS downloads_hourly (
			id                   INTEGER PRIMARY KEY AUTOINCREMENT,
			bucket_start         TEXT NOT NULL,
			bucket_end           TEXT NOT NULL,
			total_events         INTEGER NOT NULL DEFAULT 0,
			total_downloads      INTEGER NOT NULL DEFAULT 0,
			total_success        INTEGER NOT NULL DEFAULT 0,
			total_fail           INTEGER NOT NULL DEFAULT 0,
			by_status_json       TEXT,
			by_type_json         TEXT,
			by_browser_json      TEXT,
			by_os_json           TEXT,
			by_ext_ver_json      TEXT,
			by_lang_json         TEXT,
			by_country_json      TEXT,
			by_error_type_json   TEXT,
			batch_id             TEXT NOT NULL,
			FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_downloads_hourly_bucket_start
			ON downloads_hourly(bucket_start);`,

		// Lifetime totals (fast summary queries).
		`CREATE TABLE IF NOT EXISTS downloads_totals (
			key   TEXT PRIMARY KEY,
			value INTEGER NOT NULL DEFAULT 0
		);`,

		// DO state history (health + backlog + quota).
		`CREATE TABLE IF NOT EXISTS do_state_snapshots (
			snapshot_id           INTEGER PRIMARY KEY AUTOINCREMENT,
			captured_at           INTEGER NOT NULL,
			source                TEXT NOT NULL,
			raw_json              TEXT,
			total_events          INTEGER,
			total_downloads       INTEGER,
			total_success         INTEGER,
			total_fail            INTEGER,
			pending_events        INTEGER,
			last_event_at         INTEGER,
			last_flush_at         INTEGER,
			requests_today        INTEGER,
			quota_level           TEXT,
			mode_label            TEXT,
			remote_enabled        INTEGER,
			batch_size_suggestion INTEGER,
			max_batch_events      INTEGER
		);`,

		`CREATE INDEX IF NOT EXISTS idx_do_state_snapshots_captured_at
			ON do_state_snapshots(captured_at);`,

		// IP Tracking for Geo Map feature (required for dashboard's geographical map view)
		// NOTE: This is internal/trusted network traffic. Deploy behind VPN/Tunnel for security.
		// unique_ips format: {"ips": [...], "count": N, "is_truncated": boolean}
		// Legacy rows may contain JSON array of strings (backwards compatible)
		`CREATE TABLE IF NOT EXISTS batch_ips (
			batch_id   TEXT PRIMARY KEY,
			ip_count   INTEGER,
			unique_ips TEXT, -- JSON object: {"ips": [], "count": N, "is_truncated": bool}
			FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
		);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}