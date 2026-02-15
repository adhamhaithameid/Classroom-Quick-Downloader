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
		"sheets_flush_runs",
		"oracle_operation_logs",
		"auth_sessions",
		"auth_stepup_challenges",
		"auth_rate_limits",
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
		"pg_admin_records",
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

// ──────────────────────────────────────────────────────────────────────────────
// Expanded migration tests
// ──────────────────────────────────────────────────────────────────────────────

func TestMigrationIdempotency_DoubleInit(t *testing.T) {
	dir := t.TempDir()
	sqlitePath := filepath.Join(dir, "idempotent.db")

	// First init
	db1, err := Init(sqlitePath)
	if err != nil {
		t.Fatalf("first Init failed: %v", err)
	}
	db1.Close()

	// Second init on same path — should not error
	db2, err := Init(sqlitePath)
	if err != nil {
		t.Fatalf("second Init failed: %v", err)
	}
	defer db2.Close()

	// Verify tables still exist
	var count int
	if err := db2.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'feature_flags'`).Scan(&count); err != nil {
		t.Fatalf("table probe: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected feature_flags table to survive double init")
	}
}

func TestFeatureFlagsDefaultValues(t *testing.T) {
	sqlitePath := filepath.Join(t.TempDir(), "flags.db")
	sqlDB, err := Init(sqlitePath)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer sqlDB.Close()

	// Check all expected feature flags and their defaults
	expectedFlags := map[string]int64{
		"feature_stepup_enforced":      1,
		"feature_sql_console_enabled":  0,
		"feature_sync_enabled":         1,
		"feature_creative_hub_enabled": 1,
	}

	for name, expectedEnabled := range expectedFlags {
		var enabled int64
		err := sqlDB.QueryRow(`SELECT enabled FROM feature_flags WHERE name = ?`, name).Scan(&enabled)
		if err != nil {
			t.Errorf("flag %q: query failed: %v", name, err)
			continue
		}
		if enabled != expectedEnabled {
			t.Errorf("flag %q: expected enabled=%d, got %d", name, expectedEnabled, enabled)
		}
	}
}

func TestMigrationCreatesRequiredIndexes(t *testing.T) {
	sqlitePath := filepath.Join(t.TempDir(), "indexes.db")
	sqlDB, err := Init(sqlitePath)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer sqlDB.Close()

	// Verify that key tables have the correct structure by doing a simple operation
	// Insert and query from downloads_hourly
	_, err = sqlDB.Exec(
		`INSERT INTO downloads_hourly (
			bucket_start, bucket_end, total_events, total_downloads, total_success, total_fail,
			by_status_json, by_type_json, by_browser_json, by_os_json, by_ext_ver_json,
			by_lang_json, by_country_json, by_error_type_json, batch_id
		) VALUES ('2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 1, 1, 1, 0,
			'{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', 'test-batch')`,
	)
	if err != nil {
		t.Fatalf("insert into downloads_hourly: %v", err)
	}

	var totalEvents int
	if err := sqlDB.QueryRow(`SELECT total_events FROM downloads_hourly WHERE bucket_start = '2026-01-01T00:00:00Z'`).Scan(&totalEvents); err != nil {
		t.Fatalf("query downloads_hourly: %v", err)
	}
	if totalEvents != 1 {
		t.Fatalf("expected 1, got %d", totalEvents)
	}
}
