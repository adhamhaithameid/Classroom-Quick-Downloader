package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSQLExecDryRunDoesNotMutate(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO system_alerts (alert_type, severity, message, status, payload_json, created_at, updated_at)
		VALUES ('a', 'warning', 'm', 'open', '{}', 1, 1)`); err != nil {
		t.Fatalf("seed alert failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sql/exec", bytes.NewBufferString(`{"sql":"DELETE FROM system_alerts","dryRun":true}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected dry run success, got %d: %s", rr.Code, rr.Body.String())
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM system_alerts`).Scan(&count); err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected dry run not to delete rows, count=%d", count)
	}
}

func TestSQLQueryHandler_FeatureDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sql/query", bytes.NewBufferString(`{"sql":"SELECT 1"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when sql console flag disabled, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsWithMutatingCTE(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"WITH x AS (DELETE FROM system_alerts RETURNING 1) SELECT * FROM x"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for WITH statement on query endpoint, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM admin_audit_log"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsQuotedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM \"feature_flags\""}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for quoted restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsQualifiedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM main.feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for qualified restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommaJoinRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM batches, feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comma-join restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommaJoinQualifiedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM batches, \"main\".\"feature_flags\""}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comma-join qualified restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommentObfuscatedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM/*x*/feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comment-obfuscated restricted query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsBacktickRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM `+"`feature_flags`"+`"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for backtick restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsBracketRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM [feature_flags]"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bracket restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_RejectsForbiddenKeywords(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/exec",
		bytes.NewBufferString(`{"sql":"UPDATE system_alerts SET message = replace(message,'a','b')","dryRun":true}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for forbidden keyword, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_RejectsRestrictedMutationTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/exec",
		bytes.NewBufferString(`{"sql":"DELETE FROM feature_flags","dryRun":true}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for restricted mutation table, got %d: %s", rr.Code, rr.Body.String())
	}
}
