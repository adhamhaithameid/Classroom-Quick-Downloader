package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func TestRecordsHandlersV4_SQLiteFallbackCRUD(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	allowed := map[string]struct{}{
		"extension_version_note": {},
	}

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1","data":{"version":"1.0.0","note":"initial"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	RecordsUpsertHandlerV4(sqlDB, nil, allowed).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/records/list?type=extension_version_note", nil)
	listRR := httptest.NewRecorder()
	RecordsListHandlerV4(sqlDB, nil, allowed).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list failed: %d %s", listRR.Code, listRR.Body.String())
	}
	var listPayload map[string]any
	if err := json.Unmarshal(listRR.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("failed to parse list payload: %v", err)
	}
	records, ok := listPayload["records"].([]any)
	if !ok || len(records) != 1 {
		t.Fatalf("expected one record in payload, got: %#v", listPayload["records"])
	}

	deleteReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/delete",
		bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1"}`),
	)
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	RecordsDeleteHandlerV4(sqlDB, nil, allowed).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func TestRecordsHandlersV4_RejectsDisallowedType(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	allowed := map[string]struct{}{
		"deployment_target": {},
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1","data":{"version":"1.0.0"}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RecordsUpsertHandlerV4(sqlDB, nil, allowed).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for disallowed record type, got %d", rr.Code)
	}
}

func TestRecordsHandlersV4_RejectsMalformedJSON(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	allowed := map[string]struct{}{
		"deployment_target": {},
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/records/upsert", strings.NewReader(`{`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RecordsUpsertHandlerV4(sqlDB, nil, allowed).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d", rr.Code)
	}
}

func TestRecordsHandlersV4_PostgresWritesCreateOutbox(t *testing.T) {
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		t.Skip("POSTGRES_DSN not set")
	}
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	postgresDB, err := db.InitPostgres(dsn)
	if err != nil {
		t.Fatalf("postgres init failed: %v", err)
	}
	defer postgresDB.Close()

	recordKey := "cp-test-" + strings.ReplaceAll(strings.ToLower(t.Name()), "/", "-") + "-" + strings.ReplaceAll(time.Now().UTC().Format("150405"), ":", "")
	if _, err := postgresDB.Exec(`DELETE FROM pg_admin_records WHERE record_type = $1 AND record_key = $2`, "deployment_target", recordKey); err != nil {
		t.Fatalf("cleanup pg_admin_records failed: %v", err)
	}

	allowed := map[string]struct{}{
		"deployment_target": {},
	}

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"deployment_target","recordKey":"`+recordKey+`","data":{"users":"1000","version":"1.0.0"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	RecordsUpsertHandlerV4(sqlDB, postgresDB, allowed).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("postgres upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	var recordCount int64
	if err := postgresDB.QueryRow(
		`SELECT COUNT(*) FROM pg_admin_records WHERE record_type = $1 AND record_key = $2`,
		"deployment_target",
		recordKey,
	).Scan(&recordCount); err != nil {
		t.Fatalf("query pg_admin_records failed: %v", err)
	}
	if recordCount != 1 {
		t.Fatalf("expected pg_admin_records row to be created, got %d", recordCount)
	}

	var outboxCount int64
	if err := postgresDB.QueryRow(
		`SELECT COUNT(*) FROM pg_outbox WHERE event_type = 'control_plane_upsert' AND payload_json->>'recordKey' = $1`,
		recordKey,
	).Scan(&outboxCount); err != nil {
		t.Fatalf("query pg_outbox failed: %v", err)
	}
	if outboxCount == 0 {
		t.Fatalf("expected outbox event for control_plane_upsert")
	}
}
