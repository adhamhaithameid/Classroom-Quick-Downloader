package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRecordsCRUDHandlers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_stepup_enforced'`); err != nil {
		t.Fatalf("failed to set stepup flag: %v", err)
	}

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1","data":{"version":"1.0.0","note":"initial"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	RecordsUpsertHandler(sqlDB).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/records/list?type=extension_version_note", nil)
	listRR := httptest.NewRecorder()
	RecordsListHandler(sqlDB).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list failed: %d %s", listRR.Code, listRR.Body.String())
	}
	var listResp map[string]any
	if err := json.Unmarshal(listRR.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("failed to parse list response: %v", err)
	}
	records, ok := listResp["records"].([]any)
	if !ok || len(records) == 0 {
		t.Fatalf("expected records in list response: %v", listResp)
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/records/delete", bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	RecordsDeleteHandler(sqlDB).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}
