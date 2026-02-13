package db

import (
	"database/sql"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func InitPostgres(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, nil
	}
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	database.SetMaxOpenConns(10)
	database.SetMaxIdleConns(5)

	if err := database.Ping(); err != nil {
		_ = database.Close()
		return nil, err
	}

	if err := migratePostgres(database); err != nil {
		_ = database.Close()
		return nil, err
	}

	return database, nil
}

func migratePostgres(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS raw_ingest_events (
			id              BIGSERIAL PRIMARY KEY,
			event_type      TEXT NOT NULL,
			payload_json    JSONB NOT NULL,
			idempotency_key TEXT NOT NULL UNIQUE,
			created_at      BIGINT NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_raw_ingest_events_created_at
			ON raw_ingest_events(created_at DESC);`,

		`CREATE TABLE IF NOT EXISTS pg_ingest_batches (
			id              BIGSERIAL PRIMARY KEY,
			batch_id        TEXT NOT NULL UNIQUE,
			generated_at    BIGINT NOT NULL,
			ingested_at     BIGINT NOT NULL,
			time_zone       TEXT NOT NULL DEFAULT 'UTC',
			events_count    BIGINT NOT NULL DEFAULT 0,
			downloads_count BIGINT NOT NULL DEFAULT 0,
			success_count   BIGINT NOT NULL DEFAULT 0,
			fail_count      BIGINT NOT NULL DEFAULT 0,
			payload_json    JSONB NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pg_ingest_batches_ingested_at
			ON pg_ingest_batches(ingested_at DESC);`,

		`CREATE TABLE IF NOT EXISTS pg_outbox (
			id              BIGSERIAL PRIMARY KEY,
			event_type      TEXT NOT NULL,
			payload_json    JSONB NOT NULL,
			idempotency_key TEXT NOT NULL UNIQUE,
			status          TEXT NOT NULL DEFAULT 'pending',
			attempts        INTEGER NOT NULL DEFAULT 0,
			last_error      TEXT,
			created_at      BIGINT NOT NULL,
			next_run_at     BIGINT NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pg_outbox_status_next_run
			ON pg_outbox(status, next_run_at, id);`,

		// Postgres-owned control-plane entities mirrored from dashboard actions.
		`CREATE TABLE IF NOT EXISTS pg_admin_records (
			id           BIGSERIAL PRIMARY KEY,
			record_type  TEXT NOT NULL,
			record_key   TEXT NOT NULL,
			data_json    JSONB NOT NULL,
			created_at   BIGINT NOT NULL,
			updated_at   BIGINT NOT NULL,
			UNIQUE(record_type, record_key)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pg_admin_records_type_updated
			ON pg_admin_records(record_type, updated_at DESC, id DESC);`,

		`CREATE TABLE IF NOT EXISTS pg_dr_drills (
			id             BIGSERIAL PRIMARY KEY,
			drill_id       TEXT NOT NULL UNIQUE,
			target_region  TEXT NOT NULL,
			status         TEXT NOT NULL,
			result_json    JSONB NOT NULL,
			started_at     BIGINT NOT NULL,
			finished_at    BIGINT NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pg_dr_drills_started_at
			ON pg_dr_drills(started_at DESC);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
