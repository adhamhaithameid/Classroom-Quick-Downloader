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
		"oracle_operation_logs",
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

	var stepupEnabled int64
	if err := sqliteDB.QueryRow(`SELECT enabled FROM feature_flags WHERE name = 'feature_stepup_enforced'`).Scan(&stepupEnabled); err != nil {
		t.Fatalf("failed to load stepup flag: %v", err)
	}
	if stepupEnabled != 1 {
		t.Fatalf("expected feature_stepup_enforced to default to 1, got %d", stepupEnabled)
	}

	var sqlConsoleEnabled int64
	if err := sqliteDB.QueryRow(`SELECT enabled FROM feature_flags WHERE name = 'feature_sql_console_enabled'`).Scan(&sqlConsoleEnabled); err != nil {
		t.Fatalf("failed to load sql console flag: %v", err)
	}
	if sqlConsoleEnabled != 0 {
		t.Fatalf("expected feature_sql_console_enabled to default to 0, got %d", sqlConsoleEnabled)
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
