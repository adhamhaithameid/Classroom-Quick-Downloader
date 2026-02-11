package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMigrationBootstrapCleanDatabases(t *testing.T) {
	sqlitePath := filepath.Join(t.TempDir(), "bootstrap.db")
	sqliteDB, err := Init(sqlitePath)
	if err != nil {
		t.Fatalf("sqlite init failed: %v", err)
	}
	defer sqliteDB.Close()

	requiredSQLiteTables := []string{
		"ingest_outbox",
		"feature_flags",
		"admin_audit_log",
		"system_alerts",
		"backup_runs",
	}
	for _, table := range requiredSQLiteTables {
		var count int
		if err := sqliteDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, table).Scan(&count); err != nil {
			t.Fatalf("sqlite table probe failed for %s: %v", table, err)
		}
		if count != 1 {
			t.Fatalf("expected sqlite table %s to exist", table)
		}
	}

	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		t.Skip("POSTGRES_DSN not set")
	}
	postgresDB, err := InitPostgres(dsn)
	if err != nil {
		t.Fatalf("postgres init failed: %v", err)
	}
	defer postgresDB.Close()

	requiredPostgresTables := []string{
		"raw_ingest_events",
		"pg_outbox",
	}
	for _, table := range requiredPostgresTables {
		var count int
		if err := postgresDB.QueryRow(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, table).Scan(&count); err != nil {
			t.Fatalf("postgres table probe failed for %s: %v", table, err)
		}
		if count != 1 {
			t.Fatalf("expected postgres table %s to exist", table)
		}
	}
}
