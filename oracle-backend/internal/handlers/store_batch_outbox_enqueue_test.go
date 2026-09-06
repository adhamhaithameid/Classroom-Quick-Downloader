package handlers

import (
	"context"
	"testing"
)

// ──────────────────────────────────────────────────────────────────────────────
// enqueueSQLiteOutbox
// ──────────────────────────────────────────────────────────────────────────────

func TestEnqueueSQLiteOutbox_Idempotent(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	payload := map[string]interface{}{"batchId": "b1"}

	// First insert
	tx1, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx1, "test_event", payload, "key-1"); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	tx1.Commit()

	// Second insert with same key
	tx2, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx2, "test_event", payload, "key-1"); err != nil {
		t.Fatalf("second insert: %v", err)
	}
	tx2.Commit()

	// Should still have exactly 1 row
	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE idempotency_key = 'key-1'`).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 row (idempotent), got %d", count)
	}
}

func TestEnqueueSQLiteOutbox_DifferentKeys(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	payload := map[string]interface{}{"batchId": "b1"}

	tx1, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx1, "test_event", payload, "key-a"); err != nil {
		t.Fatalf("insert key-a: %v", err)
	}
	tx1.Commit()

	tx2, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx2, "test_event", payload, "key-b"); err != nil {
		t.Fatalf("insert key-b: %v", err)
	}
	tx2.Commit()

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE idempotency_key IN ('key-a', 'key-b')`).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 rows for different keys, got %d", count)
	}
}
