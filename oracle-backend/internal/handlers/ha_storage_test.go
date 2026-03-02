package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

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

func TestReadyHandler_StorageBackpressureWarnsButStaysReady(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	guard := NewStorageGuard(
		filepath.Join(t.TempDir(), "analytics.db"),
		StorageWatermarks{Warn: 0.00001, Critical: 0.00002, Emergency: 0.00003},
	)
	migrationErr := ""
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	rr := httptest.NewRecorder()
	ReadyHandler(sqlDB, nil, guard, false, &migrationErr).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 during ingest backpressure, got %d body=%s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK                 bool     `json:"ok"`
		Reasons            []string `json:"reasons"`
		Warnings           []string `json:"warnings"`
		IngestBackpressure bool     `json:"ingestBackpressure"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode ready payload: %v", err)
	}
	if !payload.OK {
		t.Fatalf("expected ready payload OK=true under storage backpressure, got false")
	}
	if !payload.IngestBackpressure {
		t.Fatalf("expected ingestBackpressure=true in payload")
	}
	foundWarning := false
	for _, warning := range payload.Warnings {
		if warning == "storage_emergency_backpressure" {
			foundWarning = true
			break
		}
	}
	if !foundWarning {
		t.Fatalf("expected storage_emergency_backpressure warning in payload")
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

func TestHARuntimeStatusHandler_IncludesWebsiteChainHealth(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	now := time.Now().UTC().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO website_sync_batches (direction, batch_id, triggered_by, status, details_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		websiteSyncDirectionWebsiteToOracle,
		"website-batch-123",
		"worker_flush",
		"ok",
		`{"acceptedCount":12,"correlationId":"corr-abc"}`,
		now-2*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed website_sync_batches failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO website_public_snapshots (snapshot_id, schema_version, generated_at, payload_json, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		"ws-public-website-snapshot-test",
		"1",
		now-3*int64(time.Minute/time.Millisecond),
		`{"ok":true}`,
		now-3*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed website_public_snapshots failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO backup_runs (backup_path, status, error_message, started_at, finished_at)
		 VALUES (?, ?, ?, ?, ?)`,
		"/tmp/cqd-backup.db",
		"success",
		"",
		now-10*int64(time.Minute/time.Millisecond),
		now-8*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed backup_runs failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO sheets_flush_runs (flushed_at_utc, archived_day, status, sheet_id, api_url, row_json, summary_json, meta_json, error_message, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		now-6*int64(time.Minute/time.Millisecond),
		"2026-03-01",
		"ok",
		"sheet-id",
		"https://example.invalid",
		`{"downloads":1}`,
		`{"rows":1}`,
		`{"verify":"ok"}`,
		"",
		now-6*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed sheets_flush_runs failed: %v", err)
	}

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	postgresErr := ""
	req := httptest.NewRequest(http.MethodGet, "/api/admin/ha/status", nil)
	rr := httptest.NewRecorder()
	HARuntimeStatusHandler(sqlDB, nil, guard, false, &postgresErr).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload failed: %v", err)
	}
	websiteChain, ok := payload["websiteChain"].(map[string]any)
	if !ok {
		t.Fatalf("expected websiteChain object in response")
	}
	if _, ok := websiteChain["lastBatchAccepted"].(map[string]any); !ok {
		t.Fatalf("expected websiteChain.lastBatchAccepted object")
	}
	if _, ok := websiteChain["lastSnapshotGenerated"].(map[string]any); !ok {
		t.Fatalf("expected websiteChain.lastSnapshotGenerated object")
	}
	batchIntegrity, ok := websiteChain["batchIntegrity"].(map[string]any)
	if !ok {
		t.Fatalf("expected websiteChain.batchIntegrity object")
	}
	if _, ok := batchIntegrity["checksumStatus"]; !ok {
		t.Fatalf("expected batchIntegrity.checksumStatus field")
	}
	if _, ok := batchIntegrity["rowCountStatus"]; !ok {
		t.Fatalf("expected batchIntegrity.rowCountStatus field")
	}
	if _, ok := websiteChain["lagMinutes"]; !ok {
		t.Fatalf("expected websiteChain.lagMinutes field")
	}
	backupDrift, ok := websiteChain["backupDrift"].(map[string]any)
	if !ok {
		t.Fatalf("expected websiteChain.backupDrift object")
	}
	if backupDrift["status"] == nil {
		t.Fatalf("expected backup drift status")
	}
	sheetsVerification, ok := websiteChain["sheetsFlushVerification"].(map[string]any)
	if !ok {
		t.Fatalf("expected websiteChain.sheetsFlushVerification object")
	}
	if sheetsVerification["verified"] != true {
		t.Fatalf("expected sheets verification to be true")
	}
	if _, ok := sheetsVerification["checksumStatus"]; !ok {
		t.Fatalf("expected sheets verification checksumStatus field")
	}
	if _, ok := sheetsVerification["rowCountStatus"]; !ok {
		t.Fatalf("expected sheets verification rowCountStatus field")
	}
}

func TestHARuntimeStatusHandler_RaisesWebsiteBackupDriftAlertOnMissedWindow(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	t.Setenv("ORACLE_BACKUP_EXPECTED_INTERVAL_MINUTES", "10")
	t.Setenv("ORACLE_SHEETS_FLUSH_EXPECTED_INTERVAL_MINUTES", "10")

	now := time.Now().UTC().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO backup_runs (backup_path, status, error_message, started_at, finished_at)
		 VALUES (?, ?, ?, ?, ?)`,
		"/tmp/cqd-backup.db",
		"success",
		"",
		now-45*int64(time.Minute/time.Millisecond),
		now-35*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed backup_runs failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO sheets_flush_runs (flushed_at_utc, archived_day, status, sheet_id, api_url, row_json, summary_json, meta_json, error_message, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		now-5*int64(time.Minute/time.Millisecond),
		"2026-03-01",
		"ok",
		"sheet-id",
		"https://example.invalid",
		`{"downloads":1}`,
		`{"rows":1}`,
		`{"verification":{"verified":true,"checksumStatus":"match","rowCountStatus":"match","expectedRows":1,"actualRows":1}}`,
		"",
		now-5*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed sheets_flush_runs failed: %v", err)
	}

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	postgresErr := ""
	req := httptest.NewRequest(http.MethodGet, "/api/admin/ha/status", nil)
	rr := httptest.NewRecorder()
	HARuntimeStatusHandler(sqlDB, nil, guard, false, &postgresErr).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var severity string
	var payloadJSON string
	if err := sqlDB.QueryRow(
		`SELECT severity, payload_json
		 FROM system_alerts
		 WHERE alert_type = ? AND status = 'open'
		 ORDER BY updated_at DESC, id DESC
		 LIMIT 1`,
		"website_backup_drift",
	).Scan(&severity, &payloadJSON); err != nil {
		t.Fatalf("expected website_backup_drift alert, query failed: %v", err)
	}
	if severity != "critical" {
		t.Fatalf("expected critical severity, got %q", severity)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		t.Fatalf("decode alert payload failed: %v", err)
	}
	reasons, _ := payload["reasons"].([]any)
	found := false
	for _, item := range reasons {
		if item == "backup_drift_critical" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected reasons to include backup_drift_critical, payload=%v", payload)
	}
}

func TestHARuntimeStatusHandler_RaisesWebsiteBackupDriftAlertOnBatchIntegrityMismatch(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	now := time.Now().UTC().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO website_sync_batches (direction, batch_id, triggered_by, status, details_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		websiteSyncDirectionWebsiteToOracle,
		"website-batch-integrity-mismatch",
		"worker_website_events_batch",
		"ok",
		`{
			"acceptedCount":4,
			"rejectedCount":0,
			"receivedCount":4,
			"accountedCount":4,
			"batchChecksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"expectedBatchChecksum":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			"checksumStatus":"mismatch",
			"rowCountStatus":"match",
			"integrity":"critical",
			"integrityNotes":["batch checksum mismatch"],
			"correlationId":"corr-mismatch"
		}`,
		now-2*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed website_sync_batches failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO backup_runs (backup_path, status, error_message, started_at, finished_at)
		 VALUES (?, ?, ?, ?, ?)`,
		"/tmp/cqd-backup.db",
		"success",
		"",
		now-10*int64(time.Minute/time.Millisecond),
		now-8*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed backup_runs failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO sheets_flush_runs (flushed_at_utc, archived_day, status, sheet_id, api_url, row_json, summary_json, meta_json, error_message, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		now-6*int64(time.Minute/time.Millisecond),
		"2026-03-01",
		"ok",
		"sheet-id",
		"https://example.invalid",
		`{"downloads":1}`,
		`{"rows":1}`,
		`{"verification":{"verified":true,"checksumStatus":"match","rowCountStatus":"match","expectedRows":1,"actualRows":1}}`,
		"",
		now-6*int64(time.Minute/time.Millisecond),
	); err != nil {
		t.Fatalf("seed sheets_flush_runs failed: %v", err)
	}

	guard := NewStorageGuard(filepath.Join(t.TempDir(), "analytics.db"), StorageWatermarks{Warn: 99, Critical: 99.5, Emergency: 99.9})
	postgresErr := ""
	req := httptest.NewRequest(http.MethodGet, "/api/admin/ha/status", nil)
	rr := httptest.NewRecorder()
	HARuntimeStatusHandler(sqlDB, nil, guard, false, &postgresErr).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var severity string
	var payloadJSON string
	if err := sqlDB.QueryRow(
		`SELECT severity, payload_json
		 FROM system_alerts
		 WHERE alert_type = ? AND status = 'open'
		 ORDER BY updated_at DESC, id DESC
		 LIMIT 1`,
		"website_backup_drift",
	).Scan(&severity, &payloadJSON); err != nil {
		t.Fatalf("expected website_backup_drift alert, query failed: %v", err)
	}
	if severity != "critical" {
		t.Fatalf("expected critical severity, got %q", severity)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		t.Fatalf("decode alert payload failed: %v", err)
	}
	reasons, _ := payload["reasons"].([]any)
	found := false
	for _, item := range reasons {
		if item == "worker_to_oracle_batch_integrity_mismatch" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected reasons to include worker_to_oracle_batch_integrity_mismatch, payload=%v", payload)
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

func TestRetentionRunHandler_RawSnapshotsPolicyDryRunAndExecute(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	oldReceivedAt := time.Now().UTC().AddDate(0, 0, -45).UnixMilli()
	recentReceivedAt := time.Now().UTC().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO cf_snapshots_raw (source, endpoint, payload_json, schema_fingerprint, status, received_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"oracle-backend",
		"/ingest-batch",
		`{"k":"old"}`,
		"fp-old",
		"ok",
		oldReceivedAt,
	); err != nil {
		t.Fatalf("failed to seed old raw snapshot: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO cf_snapshots_raw (source, endpoint, payload_json, schema_fingerprint, status, received_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"oracle-backend",
		"/ingest-batch",
		`{"k":"recent"}`,
		"fp-recent",
		"ok",
		recentReceivedAt,
	); err != nil {
		t.Fatalf("failed to seed recent raw snapshot: %v", err)
	}

	dryReq := httptest.NewRequest(http.MethodPost, "/api/admin/retention/run", bytes.NewBufferString(`{"dryRun":true,"policies":["cf_snapshots_raw"]}`))
	dryReq.Header.Set("Content-Type", "application/json")
	dryRR := httptest.NewRecorder()
	RetentionRunHandler(sqlDB, nil).ServeHTTP(dryRR, dryReq)
	if dryRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from dry run, got %d: %s", dryRR.Code, dryRR.Body.String())
	}
	if !bytes.Contains(dryRR.Body.Bytes(), []byte(`"name":"cf_snapshots_raw"`)) {
		t.Fatalf("expected dry run response to include cf_snapshots_raw action, got %s", dryRR.Body.String())
	}

	var afterDryRun int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_snapshots_raw`).Scan(&afterDryRun); err != nil {
		t.Fatalf("failed to count snapshots after dry run: %v", err)
	}
	if afterDryRun != 2 {
		t.Fatalf("expected dry run to keep both rows, got %d", afterDryRun)
	}

	execReq := httptest.NewRequest(http.MethodPost, "/api/admin/retention/run", bytes.NewBufferString(`{"dryRun":false,"policies":["cf_snapshots_raw"]}`))
	execReq.Header.Set("Content-Type", "application/json")
	execRR := httptest.NewRecorder()
	RetentionRunHandler(sqlDB, nil).ServeHTTP(execRR, execReq)
	if execRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from execute run, got %d: %s", execRR.Code, execRR.Body.String())
	}

	var remaining int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_snapshots_raw`).Scan(&remaining); err != nil {
		t.Fatalf("failed to query retained raw snapshots: %v", err)
	}
	if remaining != 1 {
		t.Fatalf("expected only recent snapshot to remain, remaining=%d", remaining)
	}
}

func TestRetentionRunHandler_AuthPoliciesUseSecondCutoffs(t *testing.T) {
	sqlDB := newHAStorageTestDB(t)
	defer sqlDB.Close()

	nowSec := time.Now().Unix()

	if _, err := sqlDB.Exec(
		`INSERT INTO auth_sessions (token, session_kind, parent_token, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"expired-session",
		"viewer",
		"",
		nowSec-(2*24*60*60),
		nowSec-(2*24*60*60),
		nowSec-(2*24*60*60),
	); err != nil {
		t.Fatalf("failed to seed expired auth session: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO auth_sessions (token, session_kind, parent_token, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"active-session",
		"viewer",
		"",
		nowSec+(24*60*60),
		nowSec,
		nowSec,
	); err != nil {
		t.Fatalf("failed to seed active auth session: %v", err)
	}

	if _, err := sqlDB.Exec(
		`INSERT INTO auth_stepup_challenges (challenge_id, client_ip, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		"expired-challenge",
		"203.0.113.1",
		nowSec-60,
		nowSec-60,
		nowSec-60,
	); err != nil {
		t.Fatalf("failed to seed expired stepup challenge: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO auth_stepup_challenges (challenge_id, client_ip, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		"active-challenge",
		"203.0.113.2",
		nowSec+(10*60),
		nowSec,
		nowSec,
	); err != nil {
		t.Fatalf("failed to seed active stepup challenge: %v", err)
	}

	if _, err := sqlDB.Exec(
		`INSERT INTO auth_rate_limits (scope, client_ip, attempts, first_attempt_at, blocked_until, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"login",
		"stale-ip",
		3,
		nowSec-(15*24*60*60),
		int64(0),
		nowSec-(15*24*60*60),
	); err != nil {
		t.Fatalf("failed to seed stale auth rate limit: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO auth_rate_limits (scope, client_ip, attempts, first_attempt_at, blocked_until, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		"login",
		"recent-ip",
		1,
		nowSec-(60*60),
		int64(0),
		nowSec-(60*60),
	); err != nil {
		t.Fatalf("failed to seed recent auth rate limit: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/retention/run",
		bytes.NewBufferString(`{"dryRun":false,"policies":["auth_sessions_expired","auth_stepup_challenges_expired","auth_rate_limits_stale"]}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RetentionRunHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 from retention run, got %d: %s", rr.Code, rr.Body.String())
	}

	var sessions int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM auth_sessions`).Scan(&sessions); err != nil {
		t.Fatalf("failed to count auth sessions: %v", err)
	}
	if sessions != 1 {
		t.Fatalf("expected only one auth session to remain, got %d", sessions)
	}

	var challenges int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM auth_stepup_challenges`).Scan(&challenges); err != nil {
		t.Fatalf("failed to count stepup challenges: %v", err)
	}
	if challenges != 1 {
		t.Fatalf("expected only one stepup challenge to remain, got %d", challenges)
	}

	var rateLimits int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM auth_rate_limits`).Scan(&rateLimits); err != nil {
		t.Fatalf("failed to count auth rate limits: %v", err)
	}
	if rateLimits != 1 {
		t.Fatalf("expected only one auth rate limit row to remain, got %d", rateLimits)
	}
}

func TestMultiplyClampUint64(t *testing.T) {
	tests := []struct {
		name string
		a    uint64
		b    uint64
		want uint64
	}{
		{name: "normal product", a: 12, b: 1024, want: 12288},
		{name: "zero a clamps to zero", a: 0, b: 10, want: 0},
		{name: "zero b clamps to zero", a: 10, b: 0, want: 0},
		{name: "overflow clamps to max int64", a: math.MaxInt64, b: 2, want: uint64(math.MaxInt64)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := multiplyClampUint64(tc.a, tc.b)
			if got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestParseNonNegativeUint64(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want uint64
	}{
		{name: "uint64 input", in: uint64(42), want: 42},
		{name: "int input", in: 42, want: 42},
		{name: "int64 input", in: int64(42), want: 42},
		{name: "negative clamps to zero", in: int64(-1), want: 0},
		{name: "invalid string clamps to zero", in: "abc", want: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := parseNonNegativeUint64(tc.in)
			if got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}
