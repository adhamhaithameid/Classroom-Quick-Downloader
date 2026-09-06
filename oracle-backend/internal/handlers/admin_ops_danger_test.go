package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDangerClearDataDryRunAndExec(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_clear_data_enabled'`); err != nil {
		t.Fatalf("failed to enable clear data flag: %v", err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO pipeline_failure_logs (ts_utc, day_utc, source, stage, error_code, error_detail, sample_count)
		VALUES (1, '2026-02-11', 'test', 'ingest', 'e', 'd', 1)`); err != nil {
		t.Fatalf("seed pipeline failure failed: %v", err)
	}

	dryReq := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"pipeline_failure_logs","dryRun":true}`))
	dryReq.Header.Set("Content-Type", "application/json")
	dryRR := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(dryRR, dryReq)
	if dryRR.Code != http.StatusOK {
		t.Fatalf("expected dry run success, got %d: %s", dryRR.Code, dryRR.Body.String())
	}

	execReq := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"pipeline_failure_logs","dryRun":false}`))
	execReq.Header.Set("Content-Type", "application/json")
	execRR := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(execRR, execReq)
	if execRR.Code != http.StatusOK {
		t.Fatalf("expected clear data success, got %d: %s", execRR.Code, execRR.Body.String())
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs`).Scan(&count); err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rows to be deleted, got %d", count)
	}
}

func TestDangerClearData_FeatureDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"all_non_core","dryRun":true}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when clear-data flag disabled, got %d: %s", rr.Code, rr.Body.String())
	}
}
