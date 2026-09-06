package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
