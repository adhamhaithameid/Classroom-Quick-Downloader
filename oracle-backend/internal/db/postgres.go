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
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
