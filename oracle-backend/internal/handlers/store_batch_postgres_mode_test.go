package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func TestShouldUsePostgresPrimaryIngest_FlagDriven(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	usePG, err := shouldUsePostgresPrimaryIngest(context.Background(), sqlDB, sqlDB)
	if err != nil {
		t.Fatalf("shouldUsePostgresPrimaryIngest returned err: %v", err)
	}
	if usePG {
		t.Fatalf("expected postgres primary ingest to be disabled by default")
	}

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1, updated_at = ? WHERE name = 'feature_postgres_primary_ingest'`, time.Now().UnixMilli()); err != nil {
		t.Fatalf("failed to enable feature flag: %v", err)
	}
	usePG, err = shouldUsePostgresPrimaryIngest(context.Background(), sqlDB, sqlDB)
	if err != nil {
		t.Fatalf("shouldUsePostgresPrimaryIngest returned err after enabling flag: %v", err)
	}
	if !usePG {
		t.Fatalf("expected postgres primary ingest to be enabled")
	}
}

func TestIngestBatchHandlerV4_PostgresFlagWithoutPostgresFallsBackSQLite(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1, updated_at = ? WHERE name = 'feature_postgres_primary_ingest'`, time.Now().UnixMilli()); err != nil {
		t.Fatalf("failed to enable feature flag: %v", err)
	}

	payload := `{"batchId":"batch-fallback-1","generatedAt":1739308800000,"timeZone":"UTC","summary":{"totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0}},"timeBuckets":[{"bucketStart":"2026-02-01T00:00:00Z","bucketEnd":"2026-02-01T01:00:00Z","totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0},"counters":{"byStatus":{"success":1},"byType":{"pdf":1},"byBrowser":{"chrome":1},"byOs":{"windows":1},"byExtVersion":{"1.0.0":1},"byLanguage":{"en":1},"byCountry":{"us":1},"byErrorType":{"none":1}}}],"doState":{"ok":true}}`
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandlerV4(sqlDB, nil, "secret").ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = 'batch-fallback-1'`).Scan(&count); err != nil {
		t.Fatalf("query sqlite batches failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected sqlite fallback ingest write, got count=%d", count)
	}
}

func TestIngestBatchHandlerV4_PostgresPrimaryWritesPostgresOnly(t *testing.T) {
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		t.Skip("POSTGRES_DSN not set")
	}
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	postgresDB, err := db.InitPostgres(dsn)
	if err != nil {
		t.Fatalf("postgres init failed: %v", err)
	}
	defer postgresDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1, updated_at = ? WHERE name = 'feature_postgres_primary_ingest'`, time.Now().UnixMilli()); err != nil {
		t.Fatalf("failed to enable feature flag: %v", err)
	}

	batchID := "batch-postgres-primary-mode"
	if _, err := postgresDB.Exec(`DELETE FROM pg_ingest_batches WHERE batch_id = $1`, batchID); err != nil {
		t.Fatalf("failed to cleanup pg_ingest_batches: %v", err)
	}
	if _, err := postgresDB.Exec(`DELETE FROM raw_ingest_events WHERE idempotency_key = $1`, "batch:"+batchID); err != nil {
		t.Fatalf("failed to cleanup raw_ingest_events: %v", err)
	}

	payload := `{"batchId":"` + batchID + `","generatedAt":1739308800000,"timeZone":"UTC","summary":{"totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0}},"timeBuckets":[{"bucketStart":"2026-02-01T00:00:00Z","bucketEnd":"2026-02-01T01:00:00Z","totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0},"counters":{"byStatus":{"success":1},"byType":{"pdf":1},"byBrowser":{"chrome":1},"byOs":{"windows":1},"byExtVersion":{"1.0.0":1},"byLanguage":{"en":1},"byCountry":{"us":1},"byErrorType":{"none":1}}}],"doState":{"ok":true}}`
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandlerV4(sqlDB, postgresDB, "secret").ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var sqliteCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batchID).Scan(&sqliteCount); err != nil {
		t.Fatalf("query sqlite batches failed: %v", err)
	}
	if sqliteCount != 0 {
		t.Fatalf("expected no sqlite writes when postgres primary ingest is enabled, got %d", sqliteCount)
	}

	var pgCount int64
	if err := postgresDB.QueryRow(`SELECT COUNT(*) FROM pg_ingest_batches WHERE batch_id = $1`, batchID).Scan(&pgCount); err != nil {
		t.Fatalf("query pg_ingest_batches failed: %v", err)
	}
	if pgCount != 1 {
		t.Fatalf("expected postgres ingest batch row, got %d", pgCount)
	}
}
