package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/db"
)

func openOracleLogsDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/oracle_logs.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func insertTestLog(t *testing.T, d *sql.DB, ts int64) {
	t.Helper()
	_, err := d.Exec(`INSERT INTO oracle_operation_logs
		(ts_utc, request_id, correlation_id, user_id, token_id, role,
		 action_type, resource_type, resource_id, method, path,
		 status_code, result, latency_ms, error_code)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		ts, "req-1", "cor-1", "user-1", "tok-1", "admin",
		"read", "batch", "b-1", "GET", "/api/test",
		200, "ok", 42, "")
	if err != nil {
		t.Fatal(err)
	}
}

// ---------------------------------------------------------------------------
// OracleOperationLogsListHandler
// ---------------------------------------------------------------------------

func TestOracleLogsListHandler_Success(t *testing.T) {
	d := openOracleLogsDB(t)
	insertTestLog(t, d, 1700000000000)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs?limit=10&offset=0", nil)
	OracleOperationLogsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
	logs := resp["logs"].([]interface{})
	if len(logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logs))
	}
}

func TestOracleLogsListHandler_MethodNotAllowed(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs", nil)
	OracleOperationLogsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestOracleLogsListHandler_InvalidLimit(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs?limit=abc", nil)
	OracleOperationLogsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestOracleLogsListHandler_InvalidOffset(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs?offset=-1", nil)
	OracleOperationLogsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestOracleLogsListHandler_DefaultParams(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs", nil)
	OracleOperationLogsListHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// OracleOperationLogsDeleteOlderHandler
// ---------------------------------------------------------------------------

func TestOracleLogsDeleteOlder_Success(t *testing.T) {
	d := openOracleLogsDB(t)
	insertTestLog(t, d, 1000000000000) // very old

	body, _ := json.Marshal(map[string]interface{}{"days": 1, "dryRun": false})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/delete-older", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["dryRun"] != false {
		t.Fatal("expected dryRun=false")
	}
}

func TestOracleLogsDeleteOlder_DryRun(t *testing.T) {
	d := openOracleLogsDB(t)
	insertTestLog(t, d, 1000000000000)

	body, _ := json.Marshal(map[string]interface{}{"days": 1, "dryRun": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/delete-older", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["dryRun"] != true {
		t.Fatal("expected dryRun=true")
	}
}

func TestOracleLogsDeleteOlder_MethodNotAllowed(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs/delete-older", nil)
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestOracleLogsDeleteOlder_InvalidBody(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/delete-older", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestOracleLogsDeleteOlder_InvalidDays(t *testing.T) {
	d := openOracleLogsDB(t)
	body, _ := json.Marshal(map[string]interface{}{"days": 0})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/delete-older", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestOracleLogsDeleteOlder_DaysOverMax(t *testing.T) {
	d := openOracleLogsDB(t)
	body, _ := json.Marshal(map[string]interface{}{"days": 40000})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/delete-older", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsDeleteOlderHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// OracleOperationLogsClearAllHandler
// ---------------------------------------------------------------------------

func TestOracleLogsClearAll_Success(t *testing.T) {
	d := openOracleLogsDB(t)
	insertTestLog(t, d, 1700000000000)

	body, _ := json.Marshal(map[string]interface{}{"confirm": "CLEAR_ALL_LOGS"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/clear-all", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsClearAllHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["deleted"].(float64) != 1 {
		t.Fatalf("expected 1 deleted, got %v", resp["deleted"])
	}
}

func TestOracleLogsClearAll_DryRun(t *testing.T) {
	d := openOracleLogsDB(t)
	insertTestLog(t, d, 1700000000000)

	body, _ := json.Marshal(map[string]interface{}{"confirm": "CLEAR_ALL_LOGS", "dryRun": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/clear-all", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsClearAllHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["dryRun"] != true {
		t.Fatal("expected dryRun=true")
	}
}

func TestOracleLogsClearAll_WrongConfirm(t *testing.T) {
	d := openOracleLogsDB(t)
	body, _ := json.Marshal(map[string]interface{}{"confirm": "nope"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/clear-all", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsClearAllHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestOracleLogsClearAll_MethodNotAllowed(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/oracle-logs/clear-all", nil)
	OracleOperationLogsClearAllHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestOracleLogsClearAll_InvalidBody(t *testing.T) {
	d := openOracleLogsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/oracle-logs/clear-all", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	OracleOperationLogsClearAllHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}
