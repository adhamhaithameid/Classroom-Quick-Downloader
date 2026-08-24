package handlers

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// cleanupOldFailureLogs
// ──────────────────────────────────────────────────────────────────────────────

func TestCleanupOldFailureLogs_NoOldLogs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	err := cleanupOldFailureLogs(context.Background(), tx, 30)
	if err != nil {
		t.Fatalf("cleanupOldFailureLogs failed: %v", err)
	}
	tx.Commit()
}

func TestCleanupOldFailureLogs_WithOldLogs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	// Insert old failure log (30+ days ago)
	oldTimestamp := time.Now().Add(-31 * 24 * time.Hour).UnixMilli()
	_, _ = sqlDB.Exec(`INSERT INTO pipeline_failure_logs (source, stage, error_code, error_detail, sample_count, occurred_at, batch_id, delivery_id)
		VALUES ('test', 'ingest', 'timeout', 'old log', 1, ?, 'old-batch', 'old-del')`, oldTimestamp)
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	err := cleanupOldFailureLogs(context.Background(), tx, 30)
	if err != nil {
		t.Fatalf("cleanupOldFailureLogs failed: %v", err)
	}
	tx.Commit()
}

// ──────────────────────────────────────────────────────────────────────────────
// registerSchemaPaths
// ──────────────────────────────────────────────────────────────────────────────

func TestRegisterSchemaPaths_Basic(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	payload := map[string]interface{}{
		"level1": map[string]interface{}{
			"level2": "value",
		},
		"array": []interface{}{1, 2, 3},
	}
	err := registerSchemaPaths(context.Background(), tx, payload)
	if err != nil {
		t.Fatalf("registerSchemaPaths failed: %v", err)
	}
	tx.Commit()
}

func TestRegisterSchemaPaths_IdempotentWhenPathAlreadyExists(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx1, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx1 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx1, map[string]interface{}{
		"existing": "value",
	}); err != nil {
		_ = tx1.Rollback()
		t.Fatalf("first registerSchemaPaths failed: %v", err)
	}
	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1 failed: %v", err)
	}

	var firstSeen, lastSeen int64
	var sampleType string
	if err := sqlDB.QueryRow(
		`SELECT first_seen_at, last_seen_at, sample_type
		 FROM cf_schema_registry
		 WHERE json_path = 'existing'`,
	).Scan(&firstSeen, &lastSeen, &sampleType); err != nil {
		t.Fatalf("failed to load initial schema row: %v", err)
	}
	if sampleType != "string" {
		t.Fatalf("expected initial sample type string, got %q", sampleType)
	}

	time.Sleep(3 * time.Millisecond)

	tx2, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx2 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx2, map[string]interface{}{
		"existing": float64(12),
	}); err != nil {
		_ = tx2.Rollback()
		t.Fatalf("second registerSchemaPaths failed: %v", err)
	}
	if err := tx2.Commit(); err != nil {
		t.Fatalf("commit tx2 failed: %v", err)
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'existing'`).Scan(&count); err != nil {
		t.Fatalf("failed to count schema rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected a single schema row, got %d", count)
	}

	var updatedLastSeen int64
	var updatedSampleType string
	if err := sqlDB.QueryRow(
		`SELECT last_seen_at, sample_type FROM cf_schema_registry WHERE json_path = 'existing'`,
	).Scan(&updatedLastSeen, &updatedSampleType); err != nil {
		t.Fatalf("failed to load updated schema row: %v", err)
	}
	if updatedSampleType != "number" {
		t.Fatalf("expected updated sample type number, got %q", updatedSampleType)
	}
	if updatedLastSeen < lastSeen {
		t.Fatalf("expected last_seen_at to be updated, before=%d after=%d", lastSeen, updatedLastSeen)
	}
}

func TestRegisterSchemaPaths_ConcurrentSamePath_NoUniqueConstraintError(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	const workers = 8
	start := make(chan struct{})
	errCh := make(chan error, workers)
	payload := map[string]interface{}{
		"concurrent": map[string]interface{}{
			"path": true,
		},
	}

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			tx, err := sqlDB.BeginTx(context.Background(), nil)
			if err != nil {
				errCh <- err
				return
			}
			if err := registerSchemaPaths(context.Background(), tx, payload); err != nil {
				_ = tx.Rollback()
				errCh <- err
				return
			}
			errCh <- tx.Commit()
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("unexpected concurrent registerSchemaPaths error: %v", err)
		}
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'concurrent.path'`).Scan(&count); err != nil {
		t.Fatalf("failed to count schema rows after concurrency run: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly one schema row for concurrent path, got %d", count)
	}
}

func TestRegisterSchemaPaths_NewCountTracksInsertedRowsOnly(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx1, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx1 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx1, map[string]interface{}{
		"existing": "value",
	}); err != nil {
		_ = tx1.Rollback()
		t.Fatalf("seed registerSchemaPaths failed: %v", err)
	}
	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1 failed: %v", err)
	}

	if _, err := sqlDB.Exec(`DELETE FROM system_alerts`); err != nil {
		t.Fatalf("failed to clear system_alerts: %v", err)
	}

	tx2, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx2 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx2, map[string]interface{}{
		"existing": "updated",
		"newField": map[string]interface{}{
			"enabled": true,
		},
	}); err != nil {
		_ = tx2.Rollback()
		t.Fatalf("second registerSchemaPaths failed: %v", err)
	}
	if err := tx2.Commit(); err != nil {
		t.Fatalf("commit tx2 failed: %v", err)
	}

	var payloadRaw string
	if err := sqlDB.QueryRow(
		`SELECT payload_json FROM system_alerts
		 WHERE alert_type = 'schema_drift_detected'
		 ORDER BY id DESC
		 LIMIT 1`,
	).Scan(&payloadRaw); err != nil {
		t.Fatalf("failed to load schema drift alert payload: %v", err)
	}

	var alertPayload map[string]interface{}
	if err := json.Unmarshal([]byte(payloadRaw), &alertPayload); err != nil {
		t.Fatalf("failed to parse schema drift alert payload: %v", err)
	}
	newPaths, ok := alertPayload["newPaths"].(float64)
	if !ok {
		t.Fatalf("expected numeric newPaths field, got %#v", alertPayload["newPaths"])
	}
	if int64(newPaths) != 1 {
		t.Fatalf("expected newPaths=1, got %v", newPaths)
	}
}
