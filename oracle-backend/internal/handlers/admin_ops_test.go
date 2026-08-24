package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func newAdminTestDB(t *testing.T) *sql.DB {
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
	dbPath := filepath.Join(t.TempDir(), "oracle-admin-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func ptr[T any](v T) *T { return &v }

func TestOracleOperationLogsHandlers_ListDeleteAndClear(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	if err := InsertOracleOperationLog(context.Background(), sqlDB, OracleOperationLogEntry{
		TSUTC:         now - int64((10*24*time.Hour)/time.Millisecond),
		RequestID:     "req-old",
		CorrelationID: "corr-old",
		UserID:        "viewer",
		TokenID:       "tok-old",
		Role:          "viewer",
		ActionType:    "admin",
		ResourceType:  "record",
		ResourceID:    "old",
		Method:        "POST",
		Path:          "/api/admin/records/upsert",
		StatusCode:    200,
		Result:        "ok",
		LatencyMS:     12,
	}); err != nil {
		t.Fatalf("insert old oracle operation log failed: %v", err)
	}
	if err := InsertOracleOperationLog(context.Background(), sqlDB, OracleOperationLogEntry{
		TSUTC:         now,
		RequestID:     "req-new",
		CorrelationID: "corr-new",
		UserID:        "super-admin",
		TokenID:       "tok-new",
		Role:          "super_admin",
		ActionType:    "admin",
		ResourceType:  "record",
		ResourceID:    "new",
		Method:        "POST",
		Path:          "/api/admin/records/delete",
		StatusCode:    200,
		Result:        "ok",
		LatencyMS:     9,
	}); err != nil {
		t.Fatalf("insert new oracle operation log failed: %v", err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/oracle-logs?limit=10", nil)
	listRR := httptest.NewRecorder()
	OracleOperationLogsListHandler(sqlDB).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list failed: %d %s", listRR.Code, listRR.Body.String())
	}

	dryDeleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/delete-older", bytes.NewBufferString(`{"days":5,"dryRun":true}`))
	dryDeleteReq.Header.Set("Content-Type", "application/json")
	dryDeleteRR := httptest.NewRecorder()
	OracleOperationLogsDeleteOlderHandler(sqlDB).ServeHTTP(dryDeleteRR, dryDeleteReq)
	if dryDeleteRR.Code != http.StatusOK {
		t.Fatalf("delete older dry-run failed: %d %s", dryDeleteRR.Code, dryDeleteRR.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/delete-older", bytes.NewBufferString(`{"days":5,"dryRun":false}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	OracleOperationLogsDeleteOlderHandler(sqlDB).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete older failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}

	var remaining int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&remaining); err != nil {
		t.Fatalf("count after delete older failed: %v", err)
	}
	if remaining != 1 {
		t.Fatalf("expected one row after delete older, got %d", remaining)
	}

	clearInvalidReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/clear-all", bytes.NewBufferString(`{"confirm":"NOPE","dryRun":false}`))
	clearInvalidReq.Header.Set("Content-Type", "application/json")
	clearInvalidRR := httptest.NewRecorder()
	OracleOperationLogsClearAllHandler(sqlDB).ServeHTTP(clearInvalidRR, clearInvalidReq)
	if clearInvalidRR.Code != http.StatusBadRequest {
		t.Fatalf("expected clear-all confirm validation failure, got %d", clearInvalidRR.Code)
	}

	clearReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/clear-all", bytes.NewBufferString(`{"confirm":"CLEAR_ALL_LOGS","dryRun":false}`))
	clearReq.Header.Set("Content-Type", "application/json")
	clearRR := httptest.NewRecorder()
	OracleOperationLogsClearAllHandler(sqlDB).ServeHTTP(clearRR, clearReq)
	if clearRR.Code != http.StatusOK {
		t.Fatalf("clear-all failed: %d %s", clearRR.Code, clearRR.Body.String())
	}

	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&remaining); err != nil {
		t.Fatalf("count after clear-all failed: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected zero rows after clear-all, got %d", remaining)
	}
}

func TestCanonicalJSON_SortsNestedMapsDeterministically(t *testing.T) {
	in := map[string]any{
		"z": map[string]any{
			"b": 1,
			"a": 2,
		},
		"a": 1,
	}
	raw, err := canonicalJSON(in)
	if err != nil {
		t.Fatalf("canonicalJSON failed: %v", err)
	}
	want := `{"a":1,"z":{"a":2,"b":1}}`
	if raw != want {
		t.Fatalf("unexpected canonical JSON: got %s want %s", raw, want)
	}
}
