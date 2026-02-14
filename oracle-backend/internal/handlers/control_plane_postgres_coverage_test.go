package handlers

import (
	"context"
	"testing"
)

func TestControlPlaneStore_ShouldAllowSQLiteReadFallbackFlag(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	store := newControlPlaneStore(sqlDB, nil)
	if !store.shouldAllowSQLiteReadFallback(context.Background()) {
		t.Fatal("expected sqlite read fallback to be enabled by default")
	}

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_sqlite_fallback_readonly'`); err != nil {
		t.Fatalf("failed to disable sqlite fallback flag: %v", err)
	}
	if store.shouldAllowSQLiteReadFallback(context.Background()) {
		t.Fatal("expected sqlite read fallback to be disabled")
	}
}

func TestControlPlaneStore_PostgresPathsReturnErrorsWithSQLiteAsPostgresHandle(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	store := newControlPlaneStore(sqlDB, sqlDB)

	if _, err := store.listRecordsPostgres(context.Background(), "deployment_target"); err == nil {
		t.Fatal("expected postgres list query to fail on sqlite handle")
	}
	if err := store.upsertRecordPostgres(context.Background(), "deployment_target", "k1", map[string]any{"name": "n"}); err == nil {
		t.Fatal("expected postgres upsert to fail on sqlite handle")
	}
	if _, err := store.deleteRecordPostgres(context.Background(), "deployment_target", "k1"); err == nil {
		t.Fatal("expected postgres delete to fail on sqlite handle")
	}
}
