package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/db"
)

func openControlPlaneDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/cp.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

// ---------------------------------------------------------------------------
// isRecordTypeAllowed
// ---------------------------------------------------------------------------

func TestIsRecordTypeAllowed_EmptyMap(t *testing.T) {
	if !isRecordTypeAllowed("anything", map[string]struct{}{}) {
		t.Fatal("expected true for empty allowed map")
	}
}

func TestIsRecordTypeAllowed_NilMap(t *testing.T) {
	if !isRecordTypeAllowed("anything", nil) {
		t.Fatal("expected true for nil map")
	}
}

func TestIsRecordTypeAllowed_Allowed(t *testing.T) {
	allowed := map[string]struct{}{"test": {}}
	if !isRecordTypeAllowed("test", allowed) {
		t.Fatal("expected true for allowed type")
	}
}

func TestIsRecordTypeAllowed_NotAllowed(t *testing.T) {
	allowed := map[string]struct{}{"test": {}}
	if isRecordTypeAllowed("other", allowed) {
		t.Fatal("expected false for disallowed type")
	}
}

// ---------------------------------------------------------------------------
// controlPlaneOutboxKey
// ---------------------------------------------------------------------------

func TestControlPlaneOutboxKey_Deterministic(t *testing.T) {
	k1 := controlPlaneOutboxKey("upsert", "type", "key", "req-1", []byte(`{"a":1}`))
	k2 := controlPlaneOutboxKey("upsert", "type", "key", "req-1", []byte(`{"a":1}`))
	if k1 != k2 {
		t.Fatal("expected deterministic key")
	}
	if len(k1) < 10 {
		t.Fatal("key too short")
	}
}

func TestControlPlaneOutboxKey_NoPayload(t *testing.T) {
	k := controlPlaneOutboxKey("delete", "type", "key", "req-1", nil)
	if k == "" {
		t.Fatal("expected non-empty key")
	}
}

// ---------------------------------------------------------------------------
// controlPlaneStoreFromDBs
// ---------------------------------------------------------------------------

func TestControlPlaneStoreFromDBs_BothNil(t *testing.T) {
	_, err := controlPlaneStoreFromDBs(nil, nil)
	if err == nil {
		t.Fatal("expected error when both DBs nil")
	}
}

func TestControlPlaneStoreFromDBs_SQLiteOnly(t *testing.T) {
	d := openControlPlaneDB(t)
	store, err := controlPlaneStoreFromDBs(d, nil)
	if err != nil {
		t.Fatal(err)
	}
	if store == nil {
		t.Fatal("expected non-nil store")
	}
}

// ---------------------------------------------------------------------------
// RecordsListHandlerV4
// ---------------------------------------------------------------------------

func TestRecordsListHandlerV4_Success(t *testing.T) {
	d := openControlPlaneDB(t)
	// Insert a record first
	_, _ = d.Exec(`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, "test_type", "key1", `{"value":"hello"}`, 1700000000000, 1700000000000)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records?type=test_type", nil)
	RecordsListHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	records := resp["records"].([]interface{})
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
}

func TestRecordsListHandlerV4_MethodNotAllowed(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records", nil)
	RecordsListHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsListHandlerV4_MissingType(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records", nil)
	RecordsListHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsListHandlerV4_DisallowedType(t *testing.T) {
	d := openControlPlaneDB(t)
	allowed := map[string]struct{}{"ok_type": {}}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records?type=not_allowed", nil)
	RecordsListHandlerV4(d, nil, allowed).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsListHandlerV4_EmptyDataJSON(t *testing.T) {
	d := openControlPlaneDB(t)
	_, _ = d.Exec(`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, "test_type", "key2", "", 1700000000000, 1700000000000)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records?type=test_type", nil)
	RecordsListHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RecordsUpsertHandlerV4
// ---------------------------------------------------------------------------

func TestRecordsUpsertHandlerV4_Success(t *testing.T) {
	d := openControlPlaneDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "test_type",
		"recordKey":  "key1",
		"data":       map[string]interface{}{"hello": "world"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsUpsertHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRecordsUpsertHandlerV4_MethodNotAllowed(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records/upsert", nil)
	RecordsUpsertHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandlerV4_MissingFields(t *testing.T) {
	d := openControlPlaneDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "",
		"recordKey":  "",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsUpsertHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandlerV4_DisallowedType(t *testing.T) {
	d := openControlPlaneDB(t)
	allowed := map[string]struct{}{"ok_type": {}}
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "bad_type",
		"recordKey":  "k1",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsUpsertHandlerV4(d, nil, allowed).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandlerV4_NilData(t *testing.T) {
	d := openControlPlaneDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "test_type",
		"recordKey":  "key1",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsUpsertHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestRecordsUpsertHandlerV4_InvalidBody(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/upsert", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	RecordsUpsertHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RecordsDeleteHandlerV4
// ---------------------------------------------------------------------------

func TestRecordsDeleteHandlerV4_Success(t *testing.T) {
	d := openControlPlaneDB(t)
	// Insert then delete
	_, _ = d.Exec(`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, "test_type", "key1", `{}`, 1700000000000, 1700000000000)

	body, _ := json.Marshal(map[string]interface{}{
		"recordType": "test_type",
		"recordKey":  "key1",
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsDeleteHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["affected"].(float64) != 1 {
		t.Fatalf("expected 1 affected, got %v", resp["affected"])
	}
}

func TestRecordsDeleteHandlerV4_MethodNotAllowed(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/records/delete", nil)
	RecordsDeleteHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandlerV4_MissingFields(t *testing.T) {
	d := openControlPlaneDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordType": "", "recordKey": ""})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsDeleteHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandlerV4_DisallowedType(t *testing.T) {
	d := openControlPlaneDB(t)
	allowed := map[string]struct{}{"ok_type": {}}
	body, _ := json.Marshal(map[string]interface{}{"recordType": "bad", "recordKey": "k1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsDeleteHandlerV4(d, nil, allowed).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandlerV4_InvalidBody(t *testing.T) {
	d := openControlPlaneDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	RecordsDeleteHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordsDeleteHandlerV4_NotFound(t *testing.T) {
	d := openControlPlaneDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordType": "test_type", "recordKey": "nonexistent"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/records/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	RecordsDeleteHandlerV4(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["affected"].(float64) != 0 {
		t.Fatalf("expected 0 affected for non-existent")
	}
}

// ---------------------------------------------------------------------------
// controlPlaneStore methods (via SQLite)
// ---------------------------------------------------------------------------

func TestControlPlaneStore_ListRecordsSQLite_Empty(t *testing.T) {
	d := openControlPlaneDB(t)
	store := newControlPlaneStore(d, nil)
	out, err := store.listRecords(ctx(), "nonexistent_type")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 0 {
		t.Fatalf("expected 0 records, got %d", len(out))
	}
}

func TestControlPlaneStore_UpsertAndListSQLite(t *testing.T) {
	d := openControlPlaneDB(t)
	store := newControlPlaneStore(d, nil)
	err := store.upsertRecord(ctx(), "test_type", "key1", map[string]any{"x": 1})
	if err != nil {
		t.Fatal(err)
	}
	out, err := store.listRecords(ctx(), "test_type")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0].RecordKey != "key1" {
		t.Fatalf("unexpected records: %+v", out)
	}
}

func TestControlPlaneStore_DeleteRecordSQLite(t *testing.T) {
	d := openControlPlaneDB(t)
	store := newControlPlaneStore(d, nil)
	_ = store.upsertRecord(ctx(), "test_type", "key1", map[string]any{})
	affected, err := store.deleteRecord(ctx(), "test_type", "key1")
	if err != nil {
		t.Fatal(err)
	}
	if affected != 1 {
		t.Fatalf("expected 1 affected, got %d", affected)
	}
}

func TestControlPlaneStore_DeleteRecordSQLite_NotFound(t *testing.T) {
	d := openControlPlaneDB(t)
	store := newControlPlaneStore(d, nil)
	affected, err := store.deleteRecord(ctx(), "test_type", "nonexistent")
	if err != nil {
		t.Fatal(err)
	}
	if affected != 0 {
		t.Fatalf("expected 0, got %d", affected)
	}
}

func ctx() context.Context {
	return context.Background()
}
