package db

import (
	"path/filepath"
	"testing"
)

func TestInitReadOnly(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "readonly.db")
	sqlDB, err := Init(dbPath)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer sqlDB.Close()

	readOnlyDB, err := InitReadOnly(dbPath)
	if err != nil {
		t.Fatalf("InitReadOnly failed: %v", err)
	}
	defer readOnlyDB.Close()

	var count int
	if err := readOnlyDB.QueryRow(`SELECT COUNT(*) FROM feature_flags`).Scan(&count); err != nil {
		t.Fatalf("readonly query failed: %v", err)
	}
}

func TestInitPostgres_EmptyDSNReturnsNilDB(t *testing.T) {
	pg, err := InitPostgres("")
	if err != nil {
		t.Fatalf("InitPostgres with empty DSN should not fail, got: %v", err)
	}
	if pg != nil {
		t.Fatal("expected nil postgres DB when DSN is empty")
	}
}

func TestMigratePostgres_WithSQLiteHandle(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "migrate-postgres-on-sqlite.db")
	sqlDB, err := Init(dbPath)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer sqlDB.Close()

	if err := migratePostgres(sqlDB); err != nil {
		t.Fatalf("migratePostgres should be dialect-tolerant on sqlite test handle, got: %v", err)
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'pg_outbox'`).Scan(&count); err != nil {
		t.Fatalf("table probe failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected pg_outbox table to exist after migration, got %d", count)
	}
}
