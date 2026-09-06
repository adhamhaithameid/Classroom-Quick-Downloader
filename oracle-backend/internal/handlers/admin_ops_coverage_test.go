package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func openAdminCoverageDB(t *testing.T) *sql.DB {
	t.Helper()
	prevSecret := getAuditCheckpointSecret()
	SetAuditCheckpointSecret("audit-checkpoint-test-secret")
	t.Cleanup(func() {
		if len(prevSecret) == 0 {
			SetAuditCheckpointSecret("")
			return
		}
		SetAuditCheckpointSecret(string(prevSecret))
	})
	d, err := db.Init(t.TempDir() + "/admin_cov.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func enableSQLConsole(t *testing.T, d *sql.DB) {
	t.Helper()
	_, err := d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`)
	if err != nil {
		t.Fatal(err)
	}
}

func enableClearData(t *testing.T, d *sql.DB) {
	t.Helper()
	_, err := d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_clear_data_enabled'`)
	if err != nil {
		t.Fatal(err)
	}
}

// ---------------------------------------------------------------------------
// canonicalJSON edge cases
// ---------------------------------------------------------------------------

func TestCanonicalJSON_NestedMaps(t *testing.T) {
	m := map[string]any{
		"b": map[string]any{"c": 1, "a": 2},
		"a": "x",
	}
	s, err := canonicalJSON(m)
	if err != nil {
		t.Fatal(err)
	}
	if s == "" {
		t.Fatal("expected non-empty canonical JSON")
	}
}

func TestCanonicalizeValue_Types(t *testing.T) {
	// nil
	if canonicalizeValue(nil) != nil {
		t.Fatal("expected nil for nil")
	}
	// string
	if canonicalizeValue("hello") != "hello" {
		t.Fatal("wrong string")
	}
	// float64
	if canonicalizeValue(float64(42.5)) != float64(42.5) {
		t.Fatal("wrong float")
	}
	// bool
	if canonicalizeValue(true) != true {
		t.Fatal("wrong bool")
	}
	// slice
	result := canonicalizeValue([]interface{}{3, 1, 2})
	if result == nil {
		t.Fatal("expected non-nil for slice")
	}
}

// ---------------------------------------------------------------------------
// BackupRunHandler
// ---------------------------------------------------------------------------

func TestBackupRunHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	reg := observability.NewRegistry()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/backup/run", nil)
	BackupRunHandler(d, reg).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// MigrationsStatusHandler
// ---------------------------------------------------------------------------

func TestMigrationsStatusHandler_NoPostgres(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/migrations", nil)
	MigrationsStatusHandler(false, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestMigrationsStatusHandler_PostgresWithError(t *testing.T) {
	errMsg := "connection refused"
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/migrations", nil)
	MigrationsStatusHandler(true, &errMsg).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	pg := resp["postgres"].(map[string]interface{})
	if pg["status"].(string) != "error" {
		t.Fatalf("expected status=error, got %v", pg["status"])
	}
}

func TestMigrationsStatusHandler_MethodNotAllowed(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/migrations", nil)
	MigrationsStatusHandler(false, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// BackupRunHandler coverage
// ---------------------------------------------------------------------------

func TestBackupRunHandler_SuccessWithTempDir(t *testing.T) {
	d := openAdminCoverageDB(t)
	reg := observability.NewRegistry()
	tmpDir := t.TempDir()
	t.Setenv("BACKUP_DIR", tmpDir)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", nil)
	BackupRunHandler(d, reg).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestBackupRunHandler_InvalidFileName(t *testing.T) {
	d := openAdminCoverageDB(t)
	reg := observability.NewRegistry()
	body, _ := json.Marshal(map[string]interface{}{"fileName": "../../../etc/passwd"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", bytes.NewReader(body))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// AuditVerifyChainHandler
// ---------------------------------------------------------------------------

func TestAuditVerifyChainHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/audit/verify-chain", nil)
	AuditVerifyChainHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestAuditVerifyChainHandler_EmptyChain(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/audit/verify-chain", nil)
	AuditVerifyChainHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["valid"] != false {
		t.Fatal("expected valid=false for empty chain without anchor")
	}
	if resp["anchorStatus"] != "missing" {
		t.Fatalf("expected anchorStatus=missing, got %v", resp["anchorStatus"])
	}
}

func TestAuditVerifyChainHandler_WithAuditData(t *testing.T) {
	d := openAdminCoverageDB(t)
	// AppendAuditLog creates chain-linked entries
	_ = AppendAuditLog(context.Background(), d, "test_action", "test", "resource1", "ok", map[string]any{"k": "v"})
	_ = AppendAuditLog(context.Background(), d, "test_action", "test", "resource2", "ok", map[string]any{"k": "v2"})

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/audit/verify-chain", nil)
	AuditVerifyChainHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["valid"] != true {
		t.Fatalf("expected valid chain, got %v", resp)
	}
	if resp["totalRows"].(float64) < 2 {
		t.Fatalf("expected at least 2 rows, got %v", resp["totalRows"])
	}
}

// ---------------------------------------------------------------------------
// recordOracleFailure
// ---------------------------------------------------------------------------

func TestRecordOracleFailure_Basic(t *testing.T) {
	d := openAdminCoverageDB(t)
	recordOracleFailure(d, "ingest", "timeout", "connection timeout", 5, "batch-rf-1", "del-rf-1")
	var count int64
	d.QueryRow("SELECT COUNT(*) FROM pipeline_failure_logs WHERE batch_id = 'batch-rf-1'").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 failure log, got %d", count)
	}
}

// ---------------------------------------------------------------------------
// canonicalJSON edge cases
// ---------------------------------------------------------------------------

func TestCanonicalJSON_NestedObjects(t *testing.T) {
	input := map[string]any{
		"b": map[string]any{"z": 1, "a": 2},
		"a": "value",
	}
	out, err := canonicalJSON(input)
	if err != nil {
		t.Fatal(err)
	}
	if out == "" {
		t.Fatal("expected non-empty canonical JSON")
	}
}

func TestCanonicalJSON_WithArray(t *testing.T) {
	input := map[string]any{
		"list": []any{3, 1, 2},
	}
	out, err := canonicalJSON(input)
	if err != nil {
		t.Fatal(err)
	}
	if out == "" {
		t.Fatal("expected non-empty canonical JSON")
	}
}
