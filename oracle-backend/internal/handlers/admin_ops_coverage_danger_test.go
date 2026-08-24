package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// DangerClearDataHandler
// ---------------------------------------------------------------------------

func TestDangerClearDataHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/clear-data", nil)
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestDangerClearDataHandler_FeatureDisabled(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"scope": "all", "dryRun": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/clear-data", bytes.NewReader(body))
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

func TestDangerClearDataHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableClearData(t, d)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/clear-data", bytes.NewReader([]byte("bad")))
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDangerClearDataHandler_InvalidScope(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableClearData(t, d)
	body, _ := json.Marshal(map[string]interface{}{"scope": "nonexistent"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/clear-data", bytes.NewReader(body))
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// clearScopeTables
// ---------------------------------------------------------------------------

func TestClearScopeTables_AllScope(t *testing.T) {
	tables, ok := clearScopeTables("all_non_core")
	if !ok || len(tables) == 0 {
		t.Fatal("expected tables for 'all_non_core' scope")
	}
}

func TestClearScopeTables_SingleScope(t *testing.T) {
	tables, ok := clearScopeTables("pipeline_failure_logs")
	if !ok || len(tables) != 1 {
		t.Fatalf("expected 1 table/true, got %d/%v", len(tables), ok)
	}
}

func TestClearScopeTables_IngestOutbox(t *testing.T) {
	tables, ok := clearScopeTables("ingest_outbox")
	if !ok || len(tables) != 1 || tables[0] != "ingest_outbox" {
		t.Fatalf("unexpected: tables=%v ok=%v", tables, ok)
	}
}

func TestClearScopeTables_OutboxDeadLetter(t *testing.T) {
	tables, ok := clearScopeTables("outbox_dead_letter")
	if !ok || len(tables) != 1 || tables[0] != "outbox_dead_letter" {
		t.Fatalf("unexpected: tables=%v ok=%v", tables, ok)
	}
}

func TestClearScopeTables_SystemAlerts(t *testing.T) {
	tables, ok := clearScopeTables("system_alerts")
	if !ok || len(tables) != 1 || tables[0] != "system_alerts" {
		t.Fatalf("unexpected: tables=%v ok=%v", tables, ok)
	}
}

func TestClearScopeTables_CfSnapshotsRaw(t *testing.T) {
	tables, ok := clearScopeTables("cf_snapshots_raw")
	if !ok || len(tables) != 1 || tables[0] != "cf_snapshots_raw" {
		t.Fatalf("unexpected: tables=%v ok=%v", tables, ok)
	}
}

func TestClearScopeTables_OracleOperationLogs(t *testing.T) {
	tables, ok := clearScopeTables("oracle_operation_logs")
	if !ok || len(tables) != 1 || tables[0] != "oracle_operation_logs" {
		t.Fatalf("unexpected: tables=%v ok=%v", tables, ok)
	}
}

func TestClearScopeTables_InvalidScope(t *testing.T) {
	tables, ok := clearScopeTables("nonexistent")
	if ok || tables != nil {
		t.Fatalf("expected nil/false for invalid scope, got %v/%v", tables, ok)
	}
}

// ---------------------------------------------------------------------------
// DangerClearDataHandler extra coverage
// ---------------------------------------------------------------------------

func TestDangerClearDataHandler_DryRun(t *testing.T) {
	d := openAdminCoverageDB(t)
	_, _ = d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_clear_data_enabled'`)
	body, _ := json.Marshal(map[string]interface{}{"scope": "pipeline_failure_logs", "dryRun": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/danger/clear-data", bytes.NewReader(body))
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestDangerClearDataHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	_, _ = d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_clear_data_enabled'`)
	body, _ := json.Marshal(map[string]interface{}{"scope": "pipeline_failure_logs", "dryRun": false})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/danger/clear-data", bytes.NewReader(body))
	DangerClearDataHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
