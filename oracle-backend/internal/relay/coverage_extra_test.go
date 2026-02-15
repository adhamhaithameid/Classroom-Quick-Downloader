package relay

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestRelayStart_ReturnsImmediatelyWithNilDependencies(t *testing.T) {
	r := &SQLiteToPostgresRelay{}
	r.Start(context.Background())
}

func TestRelayStart_StopsOnCanceledContext(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	r := NewSQLiteToPostgresRelay(sqlDB, sqlDB, nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	start := time.Now()
	r.Start(ctx)
	if time.Since(start) > time.Second {
		t.Fatal("expected canceled Start to return immediately")
	}
}

func TestRelayWriteToPostgres_RejectsInvalidJSON(t *testing.T) {
	r := &SQLiteToPostgresRelay{}
	err := r.writeToPostgres(context.Background(), "ingest", "not-json", "idempotent-key")
	if err == nil || !strings.Contains(err.Error(), "invalid_payload_json") {
		t.Fatalf("expected invalid payload json error, got: %v", err)
	}
}

func TestRelayWriteToPostgres_ErrorsOnSQLiteHandle(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	r := &SQLiteToPostgresRelay{postgres: sqlDB}
	err := r.writeToPostgres(context.Background(), "ingest", `{"ok":true}`, "idempotent-key")
	if err == nil {
		t.Fatal("expected writeToPostgres to fail with sqlite handle")
	}
}
