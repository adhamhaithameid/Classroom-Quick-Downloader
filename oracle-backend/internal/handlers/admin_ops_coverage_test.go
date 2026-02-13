package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func openAdminCoverageDB(t *testing.T) *sql.DB {
	t.Helper()
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
// FeatureFlagsHandler
// ---------------------------------------------------------------------------

func TestFeatureFlagsHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestFeatureFlagsHandler_ReturnsSeedFlags(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	flags := resp["flags"].([]interface{})
	if len(flags) < 5 {
		t.Fatalf("expected at least 5 seeded flags, got %d", len(flags))
	}
}

// ---------------------------------------------------------------------------
// UpdateFeatureFlagHandler
// ---------------------------------------------------------------------------

func TestUpdateFeatureFlagHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/flags/update", nil)
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_EmptyName(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader([]byte("bad")))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_NotFoundFlag(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "nonexistent_flag", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 404 {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "feature_sync_enabled", "enabled": false})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// IsFeatureEnabled
// ---------------------------------------------------------------------------

func TestIsFeatureEnabled_Exists(t *testing.T) {
	d := openAdminCoverageDB(t)
	enabled, err := IsFeatureEnabled(context.Background(), d, "feature_sync_enabled")
	if err != nil {
		t.Fatal(err)
	}
	if !enabled {
		t.Fatal("expected feature_sync_enabled to be on by default")
	}
}

func TestIsFeatureEnabled_NoRows(t *testing.T) {
	d := openAdminCoverageDB(t)
	enabled, err := IsFeatureEnabled(context.Background(), d, "nonexistent_flag")
	if err != nil {
		t.Fatal(err)
	}
	if enabled {
		t.Fatal("expected false for nonexistent flag")
	}
}

// ---------------------------------------------------------------------------
// OutboxStatusHandler
// ---------------------------------------------------------------------------

func TestOutboxStatusHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox-status", nil)
	OutboxStatusHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestOutboxStatusHandler_SQLiteSourceWithMetrics(t *testing.T) {
	d := openAdminCoverageDB(t)
	reg := observability.NewRegistry()

	// source=sqlite (avoid source=all which queries nil postgres)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox-status?source=sqlite", nil)
	OutboxStatusHandler(d, nil, reg).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestOutboxStatusHandler_InvalidSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox-status?source=invalid", nil)
	OutboxStatusHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SQLQueryHandler
// ---------------------------------------------------------------------------

func TestSQLQueryHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	// Use a non-restricted table (feature_flags is restricted for read-only queries)
	body, _ := json.Marshal(map[string]interface{}{
		"sql":   "SELECT batch_id FROM batches LIMIT 5",
		"limit": 10,
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestSQLQueryHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/sql/query", nil)
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader([]byte("bad")))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_MutatingSQL(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "DELETE FROM feature_flags"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_DefaultLimit(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT batch_id FROM batches", "limit": 0})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_ExcessiveLimit(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT batch_id FROM batches", "limit": 5000})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_WithReadOnlyDB(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	// Use d itself as readOnly (just testing the branch)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT batch_id FROM batches", "limit": 5})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestSQLQueryHandler_InvalidSQL(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT invalid_syntax FROM"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SQLExecHandler
// ---------------------------------------------------------------------------

func TestSQLExecHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/sql/exec", nil)
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestSQLExecHandler_FeatureDisabled(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"sql": "DELETE FROM batches"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader(body))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403 (feature disabled), got %d", rr.Code)
	}
}

func TestSQLExecHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader([]byte("bad")))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestSQLExecHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	// Use an allowed table (feature_flags is NOT in sqlExecAllowedTables)
	body, _ := json.Marshal(map[string]interface{}{
		"sql":    "DELETE FROM pipeline_failure_logs WHERE 1=0",
		"dryRun": false,
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader(body))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

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
// AlertsHandler
// ---------------------------------------------------------------------------

func TestAlertsHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestAlertsHandler_EmptyDB(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RetryOutboxHandler
// ---------------------------------------------------------------------------

func TestRetryOutboxHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox/retry", nil)
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader([]byte("bad")))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_EmptyIDs(t *testing.T) {
	// Empty IDs means "retry all" — returns 200
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "sqlite", "ids": []int64{}})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// ReplayDeadLetterHandler
// ---------------------------------------------------------------------------

func TestReplayDeadLetterHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestReplayDeadLetterHandler_EmptyDB(t *testing.T) {
	// ReplayDeadLetterHandler doesn't parse the body — it reads from the DB directly
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// RecordsListHandler / RecordsUpsertHandler / RecordsDeleteHandler
// ---------------------------------------------------------------------------

func TestRecordsListHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records", nil)
	RecordsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsListHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records?type=creative_design", nil)
	RecordsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRecordsUpsertHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records/upsert", nil)
	RecordsUpsertHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader([]byte("bad")))
	RecordsUpsertHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandler_EmptyType(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordType": "", "recordKey": "k1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	RecordsUpsertHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records/delete", nil)
	RecordsDeleteHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader([]byte("bad")))
	RecordsDeleteHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// normalizeSingleStatement
// ---------------------------------------------------------------------------

func TestNormalizeSingleStatement_Valid(t *testing.T) {
	stmt, err := normalizeSingleStatement("SELECT * FROM feature_flags;")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(stmt, "SELECT") {
		t.Fatalf("expected normalized to start with SELECT, got %q", stmt)
	}
}

func TestNormalizeSingleStatement_Empty(t *testing.T) {
	_, err := normalizeSingleStatement("")
	if err == nil {
		t.Fatal("expected error for empty statement")
	}
}

func TestNormalizeSingleStatement_Multiple(t *testing.T) {
	_, err := normalizeSingleStatement("SELECT 1; SELECT 2;")
	if err == nil {
		t.Fatal("expected error for multiple statements")
	}
}

// ---------------------------------------------------------------------------
// mutatingTargetTable
// ---------------------------------------------------------------------------

func TestMutatingTargetTable_Update(t *testing.T) {
	table, ok := mutatingTargetTable("UPDATE feature_flags SET enabled = 1")
	if !ok || table != "feature_flags" {
		t.Fatalf("expected feature_flags/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Insert(t *testing.T) {
	table, ok := mutatingTargetTable("INSERT INTO batches VALUES ()")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Delete(t *testing.T) {
	table, ok := mutatingTargetTable("DELETE FROM batches WHERE 1=1")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Select(t *testing.T) {
	table, ok := mutatingTargetTable("SELECT * FROM feature_flags")
	if ok || table != "" {
		t.Fatalf("expected empty/false for SELECT, got %q/%v", table, ok)
	}
}

// ---------------------------------------------------------------------------
// isAllowedReadOnlyQuery
// ---------------------------------------------------------------------------

func TestIsAllowedReadOnlyQuery_Valid(t *testing.T) {
	// feature_flags IS restricted, use batches instead
	if !isAllowedReadOnlyQuery("SELECT * FROM batches") {
		t.Fatal("expected allowed for batches")
	}
}

func TestIsAllowedReadOnlyQuery_RestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM admin_audit_log") {
		t.Fatal("expected rejected for admin_audit_log")
	}
}

func TestIsAllowedReadOnlyQuery_FeatureFlagsRestricted(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM feature_flags") {
		t.Fatal("expected rejected for feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QuotedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "feature_flags"`) {
		t.Fatal("expected rejected for quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QualifiedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM main.feature_flags`) {
		t.Fatal("expected rejected for qualified feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QualifiedQuotedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "main"."feature_flags"`) {
		t.Fatal("expected rejected for quoted qualified feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_BacktickRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM `feature_flags`") {
		t.Fatal("expected rejected for backtick-quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_BracketRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM [feature_flags]") {
		t.Fatal("expected rejected for bracket-quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_MalformedSourceFailsClosed(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "main"."feature_flags`) {
		t.Fatal("expected malformed quoted source to be rejected")
	}
}

func TestIsAllowedReadOnlyQuery_CommentObfuscatedRestrictedTable(t *testing.T) {
	stmt := normalizeSQLForPolicy(`SELECT * FROM/* bypass */feature_flags`)
	if isAllowedReadOnlyQuery(stmt) {
		t.Fatal("expected rejected for comment-obfuscated restricted table")
	}
}

func TestNormalizeSQLForPolicy_RemovesDashComments(t *testing.T) {
	got := normalizeSQLForPolicy("SELECT * FROM batches -- trailing comment")
	if strings.Contains(got, "--") {
		t.Fatalf("expected dash comments to be removed, got %q", got)
	}
}

func TestNormalizeSQLForPolicy_RemovesBlockComments(t *testing.T) {
	got := normalizeSQLForPolicy("SELECT /* hidden */ * FROM batches")
	if strings.Contains(got, "hidden") {
		t.Fatalf("expected block comments to be removed, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// truncateSQLForAudit
// ---------------------------------------------------------------------------

func TestTruncateSQLForAudit_Short(t *testing.T) {
	s := truncateSQLForAudit("SELECT 1")
	if s != "SELECT 1" {
		t.Fatalf("expected unchanged short string, got %q", s)
	}
}

func TestTruncateSQLForAudit_Long(t *testing.T) {
	long := strings.Repeat("x", 2000)
	s := truncateSQLForAudit(long)
	if len(s) > 1024 {
		t.Fatalf("expected truncated to <=1024, got %d", len(s))
	}
}

// ---------------------------------------------------------------------------
// truncateAlertError
// ---------------------------------------------------------------------------

func TestTruncateAlertError_Short(t *testing.T) {
	s := truncateAlertError("short")
	if s != "short" {
		t.Fatalf("expected unchanged string, got %q", s)
	}
}

func TestTruncateAlertError_Long(t *testing.T) {
	long := strings.Repeat("x", 1000)
	s := truncateAlertError(long)
	if len(s) == len(long) {
		t.Fatal("expected truncated string for long error")
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
// upsertOpenAlert (admin_ops version)
// ---------------------------------------------------------------------------

func TestUpsertOpenAlert_NewAlert(t *testing.T) {
	d := openAdminCoverageDB(t)
	err := upsertOpenAlert(context.Background(), d, "test_alert", "warn", "test message", map[string]any{"key": "val"})
	if err != nil {
		t.Fatal(err)
	}
	var count int64
	d.QueryRow("SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'test_alert'").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 alert, got %d", count)
	}
}

func TestUpsertOpenAlert_UpdateExistingAlert(t *testing.T) {
	d := openAdminCoverageDB(t)
	upsertOpenAlert(context.Background(), d, "test_alert2", "warn", "msg1", map[string]any{})
	upsertOpenAlert(context.Background(), d, "test_alert2", "critical", "msg2", map[string]any{})
	var count int64
	d.QueryRow("SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'test_alert2'").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 alert after update, got %d", count)
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
	if resp["valid"] != true {
		t.Fatal("expected valid=true for empty chain")
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
// SQLQueryHandler edge cases
// ---------------------------------------------------------------------------

func TestSQLQueryHandler_ForbiddenTerms(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT * FROM batches; DROP TABLE batches", "limit": 10})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_MutatingSQLNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "DELETE FROM batches", "limit": 10})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_InvalidSQLCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELEKT * FRUM batches", "limit": 10})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	// Invalid SQL should fail at query execution or parse
	if rr.Code == 200 {
		t.Fatal("expected non-200 for invalid SQL")
	}
}

func TestSQLQueryHandler_WithDataRows(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	// Seed data so the query actually returns rows
	_, _ = d.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at, events_count, downloads_count, success_count, fail_count)
		VALUES ('sql-q-batch', 1700000000000, 1700000001000, 5, 3, 2, 1)`)
	body, _ := json.Marshal(map[string]interface{}{"sql": "SELECT batch_id, events_count FROM batches", "limit": 10})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", bytes.NewReader(body))
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["count"].(float64) < 1 {
		t.Fatal("expected at least 1 row")
	}
}

// ---------------------------------------------------------------------------
// SQLExecHandler edge cases
// ---------------------------------------------------------------------------

func TestSQLExecHandler_DryRun(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{
		"sql":    "DELETE FROM pipeline_failure_logs WHERE 1=0",
		"dryRun": true,
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader(body))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_DisallowedTable(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{
		"sql":    "UPDATE feature_flags SET description = 'x' WHERE name = 'feature_sync_enabled'",
		"dryRun": false,
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader(body))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400 for restricted table, got %d", rr.Code)
	}
}

func TestSQLExecHandler_ForbiddenTerms(t *testing.T) {
	d := openAdminCoverageDB(t)
	enableSQLConsole(t, d)
	body, _ := json.Marshal(map[string]interface{}{
		"sql": "DROP TABLE pipeline_failure_logs",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", bytes.NewReader(body))
	SQLExecHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400 for DROP, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RetryOutboxHandler edge cases
// ---------------------------------------------------------------------------

func TestRetryOutboxHandler_WithSpecificIDs(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "sqlite", "ids": []int64{1, 2, 3}})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRetryOutboxHandler_InvalidSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "mysql"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_DefaultSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	// Empty body — defaults to sqlite source
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", nil)
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// ReplayDeadLetterHandler edge cases
// ---------------------------------------------------------------------------

func TestReplayDeadLetterHandler_WithDeadLetterData(t *testing.T) {
	d := openAdminCoverageDB(t)
	// Insert outbox entry and dead letter entry
	_, _ = d.Exec(`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		VALUES ('test_event', '{}', 'idem-replay-1', 'dead', 5, 'too many retries', 1700000000000, 1700000000000)`)
	var outboxID int64
	_ = d.QueryRow("SELECT id FROM ingest_outbox WHERE idempotency_key = 'idem-replay-1'").Scan(&outboxID)
	_, _ = d.Exec(`INSERT INTO outbox_dead_letter (outbox_id, event_type, payload_json, idempotency_key, attempts, created_at)
		VALUES (?, 'test_event', '{}', 'idem-replay-1', 5, 1700000000000)`, outboxID)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// RecordsListHandler edge cases
// ---------------------------------------------------------------------------

func TestRecordsListHandler_SuccessCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	_, _ = d.Exec(`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, "config", "key1", `{"v": 1}`, 1700000000000, 1700000000000)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records?type=config", nil)
	RecordsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRecordsListHandler_MissingTypeCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records", nil)
	RecordsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsListHandler_MethodNotAllowedCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records", nil)
	RecordsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RecordsUpsertHandler/RecordsDeleteHandler
// ---------------------------------------------------------------------------

func TestRecordsUpsertHandler_SuccessCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "config",
		"recordKey":  "key1",
		"data":       map[string]interface{}{"hello": "world"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	RecordsUpsertHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRecordsDeleteHandler_SuccessCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	_, _ = d.Exec(`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, "config", "key-del", `{}`, 1700000000000, 1700000000000)
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "config",
		"recordKey":  "key-del",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader(body))
	RecordsDeleteHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// AlertsHandler edge cases
// ---------------------------------------------------------------------------

func TestAlertsHandler_WithData(t *testing.T) {
	d := openAdminCoverageDB(t)
	upsertOpenAlert(context.Background(), d, "test_alert_data", "info", "alert msg", map[string]any{"k": "v"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	alerts := resp["alerts"].([]interface{})
	if len(alerts) < 1 {
		t.Fatal("expected at least 1 alert")
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

// ---------------------------------------------------------------------------
// FeatureFlagsHandler edge cases
// ---------------------------------------------------------------------------

func TestFeatureFlagsHandler_WithFlags(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
	flags := resp["flags"].([]interface{})
	if len(flags) == 0 {
		t.Fatal("expected seeded flags")
	}
}

func TestUpdateFeatureFlagHandler_SuccessCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "feature_sync_enabled", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/feature-flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
