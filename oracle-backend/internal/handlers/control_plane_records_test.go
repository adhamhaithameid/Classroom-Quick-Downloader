package handlers

import (
	"bytes"
	"context"
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
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1, updated_at = ? WHERE name = 'feature_postgres_primary_control_plane'`, time.Now().UnixMilli()); err != nil {
		t.Fatalf("enable postgres control plane flag failed: %v", err)
	}

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

	deleteReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/delete",
		bytes.NewBufferString(`{"recordType":"deployment_target","recordKey":"`+recordKey+`"}`),
	)
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	RecordsDeleteHandlerV4(sqlDB, postgresDB, allowed).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("postgres delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}

	if err := postgresDB.QueryRow(
		`SELECT COUNT(*) FROM pg_admin_records WHERE record_type = $1 AND record_key = $2`,
		"deployment_target",
		recordKey,
	).Scan(&recordCount); err != nil {
		t.Fatalf("query pg_admin_records after delete failed: %v", err)
	}
	if recordCount != 0 {
		t.Fatalf("expected pg_admin_records row to be deleted, got %d", recordCount)
	}

	var deleteOutboxCount int64
	if err := postgresDB.QueryRow(
		`SELECT COUNT(*) FROM pg_outbox WHERE event_type = 'control_plane_delete' AND payload_json->>'recordKey' = $1`,
		recordKey,
	).Scan(&deleteOutboxCount); err != nil {
		t.Fatalf("query delete outbox failed: %v", err)
	}
	if deleteOutboxCount == 0 {
		t.Fatalf("expected outbox event for control_plane_delete")
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/records/list?type=deployment_target", nil)
	listRR := httptest.NewRecorder()
	RecordsListHandlerV4(sqlDB, postgresDB, allowed).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("postgres list failed: %d %s", listRR.Code, listRR.Body.String())
	}
}

func TestRecordsHandlersV4_PostgresConfiguredButFlagDisabledWritesSQLite(t *testing.T) {
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

	recordKey := "sqlite-fallback-" + strings.ReplaceAll(strings.ToLower(t.Name()), "/", "-")
	allowed := map[string]struct{}{
		"deployment_target": {},
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"deployment_target","recordKey":"`+recordKey+`","data":{"users":"1500"}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RecordsUpsertHandlerV4(sqlDB, postgresDB, allowed).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("upsert failed: %d %s", rr.Code, rr.Body.String())
	}

	var sqliteCount int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM admin_records WHERE record_type = ? AND record_key = ?`,
		"deployment_target",
		recordKey,
	).Scan(&sqliteCount); err != nil {
		t.Fatalf("query sqlite admin_records failed: %v", err)
	}
	if sqliteCount != 1 {
		t.Fatalf("expected sqlite fallback write, got sqliteCount=%d", sqliteCount)
	}
}

func TestControlPlaneOutboxKey_IsDeterministicAndSensitiveToInputs(t *testing.T) {
	key1 := controlPlaneOutboxKey("upsert", "deployment_target", "chrome", "req-1", []byte(`{"v":1}`))
	key2 := controlPlaneOutboxKey("upsert", "deployment_target", "chrome", "req-1", []byte(`{"v":1}`))
	key3 := controlPlaneOutboxKey("upsert", "deployment_target", "chrome", "req-2", []byte(`{"v":1}`))
	key4 := controlPlaneOutboxKey("delete", "deployment_target", "chrome", "req-1", nil)

	if key1 != key2 {
		t.Fatalf("expected deterministic key; key1=%q key2=%q", key1, key2)
	}
	if key1 == key3 {
		t.Fatalf("expected key to differ by request id")
	}
	if key1 == key4 {
		t.Fatalf("expected key to differ by action/payload")
	}
}

func TestControlPlaneStoreFromDBs(t *testing.T) {
	if _, err := controlPlaneStoreFromDBs(nil, nil); err == nil {
		t.Fatalf("expected error when both DBs are nil")
	}

	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	store, err := controlPlaneStoreFromDBs(sqlDB, nil)
	if err != nil {
		t.Fatalf("expected sqlite store, got error: %v", err)
	}
	if store == nil {
		t.Fatalf("expected non-nil control plane store")
	}

	if err := store.upsertRecord(context.Background(), "deployment_target", "chrome", map[string]any{"users": "100"}); err != nil {
		t.Fatalf("expected sqlite upsert through store to succeed: %v", err)
	}
}
