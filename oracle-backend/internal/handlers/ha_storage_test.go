package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
)

func newHAStorageTestDB(t *testing.T) *sql.DB {
	t.Helper()
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "ha-storage.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	return sqlDB
}

func TestIngestBackpressureMiddleware_Returns503AtEmergency(t *testing.T) {
	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 0.00001, Critical: 0.00002, Emergency: 0.00003})
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	h := IngestBackpressureMiddleware(next, nil, guard)
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
	if called {
		t.Fatalf("expected middleware to block downstream handler")
	}
}

func TestStorageStatusHandler_ReturnsStatusPayload(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	req := httptest.NewRequest(http.MethodGet, "/api/admin/storage/status", nil)
	rr := httptest.NewRecorder()
	StorageStatusHandler(sqlDB, guard).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if payload["ok"] != true {
		t.Fatalf("expected ok=true payload")
	}
	storageRaw, ok := payload["storage"].(map[string]any)
	if !ok {
		t.Fatalf("expected storage object")
	}
	if _, ok := storageRaw["severity"]; !ok {
		t.Fatalf("expected severity field")
	}
}

func TestReadyHandler_PostgresConfiguredWithoutHandleFails(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	migrationErr := ""
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rr := httptest.NewRecorder()
	ReadyHandler(sqlDB, nil, guard, true, &migrationErr).ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestReadyHandler_HealthySQLiteOnly(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	migrationErr := ""
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rr := httptest.NewRecorder()
	ReadyHandler(sqlDB, nil, guard, false, &migrationErr).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestHARuntimeStatusHandler_ReturnsFlagsAndBacklog(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	postgresErr := ""
	req := httptest.NewRequest(http.MethodGet, "/api/admin/ha/status", nil)
	rr := httptest.NewRecorder()
	HARuntimeStatusHandler(sqlDB, nil, guard, false, &postgresErr).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte("feature_postgres_primary_ingest")) {
		t.Fatalf("expected response to include postgres cutover flags")
	}
}

func TestDRDrillAndStatusHandlers_SQLite(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	drillReq := httptest.NewRequest(http.MethodPost, "/api/admin/dr/drill", bytes.NewBufferString(`{"dryRun":true}`))
	drillReq.Header.Set("Content-Type", "application/json")
	drillRR := httptest.NewRecorder()
	DRDrillHandler(sqlDB, nil).ServeHTTP(drillRR, drillReq)
	if drillRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from drill handler, got %d: %s", drillRR.Code, drillRR.Body.String())
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/api/admin/dr/status", nil)
	statusRR := httptest.NewRecorder()
	DRStatusHandler(sqlDB, nil).ServeHTTP(statusRR, statusReq)
	if statusRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from dr status handler, got %d: %s", statusRR.Code, statusRR.Body.String())
	}
	if !bytes.Contains(statusRR.Body.Bytes(), []byte("lastDrill")) {
		t.Fatalf("expected dr status to include lastDrill")
	}
}

func TestRetentionRunHandler_DryRunAndExecute(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`INSERT INTO pipeline_failure_logs (ts_utc, day_utc, source, stage, error_code, error_detail, sample_count, batch_id, delivery_id) VALUES (1, '1970-01-01', 'oracle', 'ingest', 'e', 'd', 1, '', '')`); err != nil {
		t.Fatalf("failed to seed pipeline failure log: %v", err)
	}

	dryReq := httptest.NewRequest(http.MethodPost, "/api/admin/retention/run", bytes.NewBufferString(`{"dryRun":true,"policies":["pipeline_failure_logs"]}`))
	dryReq.Header.Set("Content-Type", "application/json")
	dryRR := httptest.NewRecorder()
	RetentionRunHandler(sqlDB, nil).ServeHTTP(dryRR, dryReq)
	if dryRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from dry run, got %d: %s", dryRR.Code, dryRR.Body.String())
	}

	execReq := httptest.NewRequest(http.MethodPost, "/api/admin/retention/run", bytes.NewBufferString(`{"dryRun":false,"policies":["pipeline_failure_logs"]}`))
	execReq.Header.Set("Content-Type", "application/json")
	execRR := httptest.NewRecorder()
	RetentionRunHandler(sqlDB, nil).ServeHTTP(execRR, execReq)
	if execRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from execute run, got %d: %s", execRR.Code, execRR.Body.String())
	}

	var remaining int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs`).Scan(&remaining); err != nil {
		t.Fatalf("failed to query retained rows: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected retention executor to remove old rows, remaining=%d", remaining)
	}
}
