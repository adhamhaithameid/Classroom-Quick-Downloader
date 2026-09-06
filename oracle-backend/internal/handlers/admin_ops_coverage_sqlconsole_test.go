package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
