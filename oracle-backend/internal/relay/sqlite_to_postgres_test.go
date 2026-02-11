package relay

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func newRelayTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "relay-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func insertOutboxRow(t *testing.T, sqlDB *sql.DB, attempts int64) int64 {
	t.Helper()
	now := time.Now().UnixMilli()
	res, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ('ingest_batch_committed', '{"batchId":"b1"}', ?, 'pending', ?, '', ?, ?)`,
		"key-"+time.Now().UTC().Format("150405.000000000"),
		attempts,
		now,
		now,
	)
	if err != nil {
		t.Fatalf("insert outbox failed: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id failed: %v", err)
	}
	return id
}

func TestRelayRunOnce_SuccessMarksSentAndUpdatesOffset(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	id := insertOutboxRow(t, sqlDB, 0)
	reg := observability.NewRegistry()
	r := NewSQLiteToPostgresRelay(sqlDB, nil, reg)
	r.writeFn = func(context.Context, string, string, string) error { return nil }

	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var status string
	var attempts int64
	if err := sqlDB.QueryRow(`SELECT status, attempts FROM ingest_outbox WHERE id = ?`, id).Scan(&status, &attempts); err != nil {
		t.Fatalf("query outbox failed: %v", err)
	}
	if status != "sent" || attempts != 1 {
		t.Fatalf("expected sent/1, got %s/%d", status, attempts)
	}

	var offset int64
	if err := sqlDB.QueryRow(`SELECT last_id FROM relay_offsets WHERE source = 'sqlite_to_postgres'`).Scan(&offset); err != nil {
		t.Fatalf("query offset failed: %v", err)
	}
	if offset != id {
		t.Fatalf("expected offset %d, got %d", id, offset)
	}

	metricsText := reg.RenderPrometheus()
	if !strings.Contains(metricsText, "oracle_sync_last_success_timestamp_seconds") {
		t.Fatalf("expected sync timestamp metric, got: %s", metricsText)
	}
}

func TestRelayRunOnce_FailureMovesToRetry(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	id := insertOutboxRow(t, sqlDB, 0)
	reg := observability.NewRegistry()
	r := NewSQLiteToPostgresRelay(sqlDB, nil, reg)
	r.writeFn = func(context.Context, string, string, string) error { return errors.New("postgres unavailable") }

	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var status string
	var attempts int64
	if err := sqlDB.QueryRow(`SELECT status, attempts FROM ingest_outbox WHERE id = ?`, id).Scan(&status, &attempts); err != nil {
		t.Fatalf("query outbox failed: %v", err)
	}
	if status != "retry" || attempts != 1 {
		t.Fatalf("expected retry/1, got %s/%d", status, attempts)
	}
}

func TestRelayRunOnce_DeadLettersAtMaxAttempts(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	id := insertOutboxRow(t, sqlDB, maxRelayAttempts-1)
	r := NewSQLiteToPostgresRelay(sqlDB, nil, observability.NewRegistry())
	r.writeFn = func(context.Context, string, string, string) error { return errors.New("persistent failure") }

	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var status string
	var attempts int64
	if err := sqlDB.QueryRow(`SELECT status, attempts FROM ingest_outbox WHERE id = ?`, id).Scan(&status, &attempts); err != nil {
		t.Fatalf("query outbox failed: %v", err)
	}
	if status != "dead" || attempts != maxRelayAttempts {
		t.Fatalf("expected dead/%d, got %s/%d", maxRelayAttempts, status, attempts)
	}

	var deadCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM outbox_dead_letter WHERE outbox_id = ?`, id).Scan(&deadCount); err != nil {
		t.Fatalf("query dead letter failed: %v", err)
	}
	if deadCount != 1 {
		t.Fatalf("expected dead letter row, got %d", deadCount)
	}
}

func TestRelayRunOnce_NoSyncAlertWhenNoSuccessOverThreshold(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	r := NewSQLiteToPostgresRelay(sqlDB, nil, observability.NewRegistry())
	r.startedAt = time.Now().Add(-noSyncAlertAfter - time.Minute)

	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'no_sync_success'`).Scan(&count); err != nil {
		t.Fatalf("query alert failed: %v", err)
	}
	if count == 0 {
		t.Fatalf("expected no_sync_success alert")
	}
}

func TestRelayRunOnce_SkipsWhenSyncFlagDisabled(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	id := insertOutboxRow(t, sqlDB, 0)
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_sync_enabled'`); err != nil {
		t.Fatalf("disable sync flag failed: %v", err)
	}

	r := NewSQLiteToPostgresRelay(sqlDB, nil, observability.NewRegistry())
	r.writeFn = func(context.Context, string, string, string) error { return nil }
	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var status string
	if err := sqlDB.QueryRow(`SELECT status FROM ingest_outbox WHERE id = ?`, id).Scan(&status); err != nil {
		t.Fatalf("query outbox failed: %v", err)
	}
	if status != "pending" {
		t.Fatalf("expected pending when sync disabled, got %s", status)
	}
}

func TestRelayRunOnce_ReclaimsStaleProcessingRows(t *testing.T) {
	sqlDB := newRelayTestDB(t)
	defer sqlDB.Close()

	nowMs := time.Now().UnixMilli()
	res, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ('ingest_batch_committed', '{"batchId":"b2"}', 'k-stale', 'processing', 1, '', ?, ?)`,
		nowMs,
		nowMs-1000,
	)
	if err != nil {
		t.Fatalf("insert stale processing row failed: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id failed: %v", err)
	}

	r := NewSQLiteToPostgresRelay(sqlDB, nil, observability.NewRegistry())
	r.writeFn = func(context.Context, string, string, string) error { return nil }
	if err := r.runOnce(context.Background()); err != nil {
		t.Fatalf("runOnce failed: %v", err)
	}

	var status string
	var attempts int64
	if err := sqlDB.QueryRow(`SELECT status, attempts FROM ingest_outbox WHERE id = ?`, id).Scan(&status, &attempts); err != nil {
		t.Fatalf("query row failed: %v", err)
	}
	if status != "sent" || attempts != 2 {
		t.Fatalf("expected stale processing row to be reclaimed and sent, got %s/%d", status, attempts)
	}
}
