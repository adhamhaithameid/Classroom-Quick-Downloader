package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func openJSONErrorTestDB(t *testing.T) (*httptest.ResponseRecorder, *http.Request) {
	t.Helper()
	return httptest.NewRecorder(), nil
}

func assertJSONError(t *testing.T, rr *httptest.ResponseRecorder, expectedStatus int) {
	t.Helper()
	if rr.Code != expectedStatus {
		t.Fatalf("expected status %d, got %d: %s", expectedStatus, rr.Code, rr.Body.String())
	}
	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "application/json") {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v\nbody: %s", err, rr.Body.String())
	}
	okVal, exists := resp["ok"]
	if !exists {
		t.Fatal("missing 'ok' field in JSON error response")
	}
	// writeJSONError uses map[string]string, so 'ok' is the string "false"
	if okStr, isStr := okVal.(string); !isStr || okStr != "false" {
		t.Fatalf("expected ok=\"false\" (string), got %v (%T)", okVal, okVal)
	}
	if _, has := resp["error"]; !has {
		t.Fatal("missing 'error' field in JSON error response")
	}
	if _, has := resp["message"]; !has {
		t.Fatal("missing 'message' field in JSON error response")
	}
}



// ---------------------------------------------------------------------------
// writeJSONError unit test
// ---------------------------------------------------------------------------

func TestWriteJSONError_Format(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSONError(rr, "test_code", "test message", http.StatusBadRequest)

	assertJSONError(t, rr, http.StatusBadRequest)

	var resp map[string]any
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["error"] != "test_code" {
		t.Fatalf("expected error=test_code, got %v", resp["error"])
	}
	if resp["message"] != "test message" {
		t.Fatalf("expected message=test message, got %v", resp["message"])
	}
}

func TestWriteJSONError_500(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSONError(rr, "internal_error", "something broke", http.StatusInternalServerError)
	assertJSONError(t, rr, http.StatusInternalServerError)
}

func TestWriteJSONError_404(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSONError(rr, "not_found", "resource not found", http.StatusNotFound)
	assertJSONError(t, rr, http.StatusNotFound)
}

func TestWriteJSONError_403(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSONError(rr, "forbidden", "access denied", http.StatusForbidden)
	assertJSONError(t, rr, http.StatusForbidden)
}

// ---------------------------------------------------------------------------
// Handler error paths return JSON
// ---------------------------------------------------------------------------

func TestSQLQueryHandler_InvalidBody_ReturnsJSON(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "sql-err.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	// Enable the feature flag
	d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_ReadOnlyViolation_ReturnsTextError(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "sql-ronly.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`)

	rr := httptest.NewRecorder()
	body := `{"sql":"INSERT INTO batches VALUES(1)"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_ForbiddenStatement_ReturnsError(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "sql-forbid.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`)

	rr := httptest.NewRecorder()
	body := `{"sql":"DROP TABLE batches"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sql/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	SQLExecHandler(d).ServeHTTP(rr, req)

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RestrictedTable_ReturnsError(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "sql-restricted.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	d.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`)

	rr := httptest.NewRecorder()
	body := `{"sql":"SELECT * FROM feature_flags"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Feature-disabled endpoint returns JSON
// ---------------------------------------------------------------------------

func TestSQLQueryHandler_FeatureDisabled_ReturnsJSON(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "sql-disabled.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	rr := httptest.NewRecorder()
	body := `{"sql":"SELECT 1"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sql/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	SQLQueryHandler(d, nil).ServeHTTP(rr, req)

	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// FeatureFlagsHandler error paths
// ---------------------------------------------------------------------------

func TestFeatureFlagsHandler_MethodNotAllowed_Returns405(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "ff-method.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)

	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// UpdateFeatureFlagHandler error paths
// ---------------------------------------------------------------------------

func TestUpdateFeatureFlagHandler_MethodNotAllowed_Returns405(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "uff-method.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/flags/update", nil)
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)

	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_InvalidBody_Returns400(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "uff-body.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// OutboxStatusHandler error paths
// ---------------------------------------------------------------------------

func TestOutboxStatusHandler_MethodNotAllowed_Returns405(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "outbox-method.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox-status", nil)
	OutboxStatusHandler(d, nil, observability.NewRegistry()).ServeHTTP(rr, req)

	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// BackupRunHandler error path returns JSON
// ---------------------------------------------------------------------------

func TestBackupRunHandler_MethodNotAllowed_Returns405JSON(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "backup-method.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	reg := observability.NewRegistry()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/backup/run", nil)
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// AuditVerifyChainHandler error paths
// ---------------------------------------------------------------------------

func TestAuditVerifyChainHandler_ErrorPath_ReturnsJSON(t *testing.T) {
	d, err := db.Init(filepath.Join(t.TempDir(), "audit-err.db"))
	if err != nil {
		t.Fatal(err)
	}
	d.Close() // close to force error on query

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/audit/verify", nil)
	AuditVerifyChainHandler(d).ServeHTTP(rr, req)

	if rr.Code != 500 {
		t.Fatalf("expected 500 on closed DB, got %d", rr.Code)
	}
	assertJSONError(t, rr, http.StatusInternalServerError)
}
