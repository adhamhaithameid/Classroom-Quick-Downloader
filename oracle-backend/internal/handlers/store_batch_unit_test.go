package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// sanitizeFailureField / sanitizeFailureDetail
// ──────────────────────────────────────────────────────────────────────────────

func TestSanitizeFailureField_EmptyFallback(t *testing.T) {
	if got := sanitizeFailureField("", "fallback"); got != "fallback" {
		t.Fatalf("expected fallback, got %q", got)
	}
}

func TestSanitizeFailureField_Normal(t *testing.T) {
	if got := sanitizeFailureField("ingest", "fallback"); got != "ingest" {
		t.Fatalf("expected ingest, got %q", got)
	}
}

func TestSanitizeFailureField_Truncation(t *testing.T) {
	long := strings.Repeat("x", 100)
	got := sanitizeFailureField(long, "fallback")
	if len(got) != maxFailureFieldLen {
		t.Fatalf("expected length %d, got %d", maxFailureFieldLen, len(got))
	}
}

func TestSanitizeFailureDetail_EmptyReturnsNA(t *testing.T) {
	if got := sanitizeFailureDetail(""); got != "n/a" {
		t.Fatalf("expected n/a, got %q", got)
	}
}

func TestSanitizeFailureDetail_Normal(t *testing.T) {
	if got := sanitizeFailureDetail("some error"); got != "some error" {
		t.Fatalf("expected 'some error', got %q", got)
	}
}

func TestSanitizeFailureDetail_Truncation(t *testing.T) {
	long := strings.Repeat("x", 500)
	got := sanitizeFailureDetail(long)
	if len(got) != maxFailureDetailLen {
		t.Fatalf("expected length %d, got %d", maxFailureDetailLen, len(got))
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// dayUTC
// ──────────────────────────────────────────────────────────────────────────────

func TestDayUTC_FormatsCorrectly(t *testing.T) {
	// 2026-02-11 00:00:00 UTC in milliseconds
	tsMs := time.Date(2026, 2, 11, 15, 30, 0, 0, time.UTC).UnixMilli()
	got := dayUTC(tsMs)
	if got != "2026-02-11" {
		t.Fatalf("expected 2026-02-11, got %q", got)
	}
}

func TestDayUTC_HandlesEpochZero(t *testing.T) {
	got := dayUTC(0)
	if got != "1970-01-01" {
		t.Fatalf("expected 1970-01-01, got %q", got)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// walkJSONPaths
// ──────────────────────────────────────────────────────────────────────────────

func TestWalkJSONPaths_FlatObject(t *testing.T) {
	input := map[string]interface{}{
		"name":  "test",
		"count": float64(42),
		"flag":  true,
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["name"] != "string" {
		t.Fatalf("expected name→string, got %q", out["name"])
	}
	if out["count"] != "number" {
		t.Fatalf("expected count→number, got %q", out["count"])
	}
	if out["flag"] != "bool" {
		t.Fatalf("expected flag→bool, got %q", out["flag"])
	}
}

func TestWalkJSONPaths_NestedObject(t *testing.T) {
	input := map[string]interface{}{
		"outer": map[string]interface{}{
			"inner": "value",
		},
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["outer.inner"] != "string" {
		t.Fatalf("expected outer.inner→string, got %q", out["outer.inner"])
	}
}

func TestWalkJSONPaths_Array(t *testing.T) {
	input := map[string]interface{}{
		"items": []interface{}{"a", "b"},
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["items[]"] != "array" {
		t.Fatalf("expected items[]→array, got %q", out["items[]"])
	}
}

func TestWalkJSONPaths_NullValue(t *testing.T) {
	input := map[string]interface{}{
		"missing": nil,
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["missing"] != "null" {
		t.Fatalf("expected missing→null, got %q", out["missing"])
	}
}

func TestWalkJSONPaths_EmptyMap(t *testing.T) {
	out := make(map[string]string)
	walkJSONPaths("", map[string]interface{}{}, out)

	if len(out) != 0 {
		t.Fatalf("expected no paths for empty map, got %d", len(out))
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// isValidIP
// ──────────────────────────────────────────────────────────────────────────────

func TestIsValidIP_Accepts(t *testing.T) {
	cases := []string{"127.0.0.1", "192.168.1.1", "::1", "2001:db8::1", "8.8.8.8"}
	for _, ip := range cases {
		if !isValidIP(ip) {
			t.Errorf("expected %q to be valid", ip)
		}
	}
}

func TestIsValidIP_Rejects(t *testing.T) {
	cases := []string{"", "unknown", "not-an-ip", "999.999.999.999", "abc"}
	for _, ip := range cases {
		if isValidIP(ip) {
			t.Errorf("expected %q to be invalid", ip)
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// insertBatchIPs
// ──────────────────────────────────────────────────────────────────────────────

func TestInsertBatchIPs_SkipsEmptyBatch(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	batch := &model.OracleBatch{BatchID: "b-empty", UniqueIps: []string{}}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback()

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("expected nil for empty IPs, got %v", err)
	}
}

func TestInsertBatchIPs_SkipsInvalidIPs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	batch := &model.OracleBatch{BatchID: "b-invalid", UniqueIps: []string{"", "unknown", "garbage"}}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback()

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("expected nil for all-invalid IPs, got %v", err)
	}
}

func TestInsertBatchIPs_CanonicalizesIPv6(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	// Ensure batch row exists for FK
	if _, err := sqlDB.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at, time_zone, events_count, downloads_count, success_count, fail_count) VALUES ('b-ipv6', 0, 0, 'UTC', 0, 0, 0, 0)`); err != nil {
		t.Fatalf("insert batch: %v", err)
	}

	batch := &model.OracleBatch{
		BatchID:   "b-ipv6",
		UniqueIps: []string{"::1", "0:0:0:0:0:0:0:1", "127.0.0.1"},
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("insertBatchIPs: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var rawIPs string
	if err := sqlDB.QueryRow(`SELECT unique_ips FROM batch_ips WHERE batch_id = 'b-ipv6'`).Scan(&rawIPs); err != nil {
		t.Fatalf("query batch_ips: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawIPs), &parsed); err != nil {
		t.Fatalf("parse unique_ips JSON: %v", err)
	}

	// ::1 and 0:0:0:0:0:0:0:1 should canonicalize to same IP = 2 unique IPs total
	count, ok := parsed["count"].(float64)
	if !ok {
		t.Fatalf("expected count in JSON, got %#v", parsed)
	}
	if int(count) != 2 {
		t.Fatalf("expected 2 unique IPs (::1 canonicalized + 127.0.0.1), got %d", int(count))
	}
}

func TestInsertBatchIPs_TruncatesAt500(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at, time_zone, events_count, downloads_count, success_count, fail_count) VALUES ('b-trunc', 0, 0, 'UTC', 0, 0, 0, 0)`); err != nil {
		t.Fatalf("insert batch: %v", err)
	}

	// Generate 600 unique IPs
	ips := make([]string, 600)
	for i := 0; i < 600; i++ {
		ips[i] = "10." + strings.Repeat("0", 0) + string(rune('0'+(i/256)%10)) + "." + string(rune('0'+(i/10)%10)) + string(rune('0'+i%10)) + ".1"
	}
	// Use a simpler approach: generate 10.X.Y.Z IPs
	ips = make([]string, 600)
	for i := 0; i < 600; i++ {
		a := (i / 256) % 256
		b := i % 256
		ips[i] = "10.0." + itoa(a) + "." + itoa(b)
	}

	batch := &model.OracleBatch{BatchID: "b-trunc", UniqueIps: ips}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("insertBatchIPs: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var rawIPs string
	if err := sqlDB.QueryRow(`SELECT unique_ips FROM batch_ips WHERE batch_id = 'b-trunc'`).Scan(&rawIPs); err != nil {
		t.Fatalf("query batch_ips: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawIPs), &parsed); err != nil {
		t.Fatalf("parse unique_ips JSON: %v", err)
	}

	isTruncated, _ := parsed["is_truncated"].(bool)
	if !isTruncated {
		t.Fatalf("expected is_truncated=true for >500 IPs")
	}

	storedIPs, ok := parsed["ips"].([]interface{})
	if !ok {
		t.Fatalf("expected ips array in JSON")
	}
	if len(storedIPs) > 500 {
		t.Fatalf("expected at most 500 stored IPs, got %d", len(storedIPs))
	}
}

// itoa is a simple int-to-string helper for test IP generation
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}
	return digits
}

// ──────────────────────────────────────────────────────────────────────────────
// sanitizeRawSnapshotPayload / isSensitiveRawSnapshotKey / redactRawSnapshotValue
// ──────────────────────────────────────────────────────────────────────────────

func TestSanitizeRawSnapshotPayload_RedactsIPValues(t *testing.T) {
	input := `{"name":"test","address":"192.168.1.1"}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}
	// "192.168.1.1" is a valid IP string, should be redacted
	if parsed["address"] != "[REDACTED_IP]" {
		t.Fatalf("expected address to be redacted, got %v", parsed["address"])
	}
	if parsed["name"] != "test" {
		t.Fatalf("expected name to remain 'test', got %v", parsed["name"])
	}
}

func TestSanitizeRawSnapshotPayload_RedactsSensitiveKeys(t *testing.T) {
	input := `{"ip":"8.8.8.8","clientIp":"1.1.1.1","data":"kept"}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}

	if parsed["ip"] != "[REDACTED]" {
		t.Fatalf("expected ip key to be redacted, got %v", parsed["ip"])
	}
	if parsed["data"] != "kept" {
		t.Fatalf("expected data to remain, got %v", parsed["data"])
	}
}

func TestSanitizeRawSnapshotPayload_PreservesNonIPStrings(t *testing.T) {
	input := `{"name":"alice","status":"ok","count":42}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}
	if parsed["name"] != "alice" {
		t.Fatalf("expected name=alice, got %v", parsed["name"])
	}
	if parsed["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", parsed["status"])
	}
}

func TestSanitizeRawSnapshotPayload_InvalidJSON(t *testing.T) {
	input := []byte(`{invalid`)
	got := sanitizeRawSnapshotPayload(input)
	if string(got) != string(input) {
		t.Fatalf("expected original bytes for invalid JSON, got %q", string(got))
	}
}

func TestIsSensitiveRawSnapshotKey_NormalizedKeys(t *testing.T) {
	sensitiveKeys := []string{"ip", "IP", "client-ip", "CLIENT_IP", "uniqueIps", "raw_ips", "ipAddress"}
	for _, key := range sensitiveKeys {
		if !isSensitiveRawSnapshotKey(key) {
			t.Errorf("expected %q to be sensitive", key)
		}
	}

	safeKeys := []string{"name", "status", "count", "batchId", "type"}
	for _, key := range safeKeys {
		if isSensitiveRawSnapshotKey(key) {
			t.Errorf("expected %q to NOT be sensitive", key)
		}
	}
}

func TestRedactedRawSnapshotValue_Array(t *testing.T) {
	input := []interface{}{"a", "b", "c"}
	got := redactedRawSnapshotValue(input)

	m, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("expected map, got %T", got)
	}
	if m["redacted"] != true {
		t.Fatalf("expected redacted=true")
	}
	if m["count"] != 3 {
		t.Fatalf("expected count=3, got %v", m["count"])
	}
}

func TestRedactedRawSnapshotValue_Map(t *testing.T) {
	input := map[string]interface{}{"a": 1, "b": 2}
	got := redactedRawSnapshotValue(input)

	m, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("expected map, got %T", got)
	}
	if m["redacted"] != true {
		t.Fatalf("expected redacted=true")
	}
	if m["keys"] != 2 {
		t.Fatalf("expected keys=2, got %v", m["keys"])
	}
}

func TestRedactedRawSnapshotValue_Scalar(t *testing.T) {
	got := redactedRawSnapshotValue("some string")
	if got != "[REDACTED]" {
		t.Fatalf("expected [REDACTED], got %v", got)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// enqueueSQLiteOutbox
// ──────────────────────────────────────────────────────────────────────────────

func TestEnqueueSQLiteOutbox_Idempotent(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	payload := map[string]interface{}{"batchId": "b1"}

	// First insert
	tx1, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx1, "test_event", payload, "key-1"); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	tx1.Commit()

	// Second insert with same key
	tx2, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx2, "test_event", payload, "key-1"); err != nil {
		t.Fatalf("second insert: %v", err)
	}
	tx2.Commit()

	// Should still have exactly 1 row
	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE idempotency_key = 'key-1'`).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 row (idempotent), got %d", count)
	}
}

func TestEnqueueSQLiteOutbox_DifferentKeys(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	payload := map[string]interface{}{"batchId": "b1"}

	tx1, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx1, "test_event", payload, "key-a"); err != nil {
		t.Fatalf("insert key-a: %v", err)
	}
	tx1.Commit()

	tx2, _ := sqlDB.Begin()
	if err := enqueueSQLiteOutbox(context.Background(), tx2, "test_event", payload, "key-b"); err != nil {
		t.Fatalf("insert key-b: %v", err)
	}
	tx2.Commit()

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE idempotency_key IN ('key-a', 'key-b')`).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 rows for different keys, got %d", count)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// IngestBatchHandler edge cases
// ──────────────────────────────────────────────────────────────────────────────

func TestIngestBatchHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodGet, "/ingest-batch", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_MissingSecret(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for missing DO_SHARED_SECRET, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_InvalidJSON(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{invalid`))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_MissingBatchID(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{"timeZone":"UTC"}`))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing batchId, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_Idempotent(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	batch := model.OracleBatch{
		BatchID:     "idempotent-test-" + time.Now().Format("150405"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		DOState:     model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)

	// First ingest
	req1 := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req1.Header.Set("X-DO-SECRET", "secret")
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("first ingest: expected 200, got %d", rr1.Code)
	}

	// Second ingest of same batch — should succeed (idempotent)
	req2 := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req2.Header.Set("X-DO-SECRET", "secret")
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("second ingest: expected 200 (idempotent), got %d", rr2.Code)
	}

	// Should still have exactly 1 batch row
	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 batch row (idempotent), got %d", count)
	}
}

func TestIngestBatchHandler_EmptyTimeBucketsStillCreatesBatch(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	batch := model.OracleBatch{
		BatchID:     "empty-buckets-" + time.Now().Format("150405"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		TimeBuckets: []model.TimeBucket{},
		DOState:     model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected batch row to exist for empty time buckets, got %d", count)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// insertDOStateSnapshot — covering Quota/EnvSnapshot branches (was 57.7%)
// ──────────────────────────────────────────────────────────────────────────────

func TestInsertDOStateSnapshot_WithQuota(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	lastEvent := int64(1700000000000)
	lastFlush := int64(1700000001000)
	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    100,
			TotalDownloads: 80,
			TotalSuccess:   70,
			TotalFail:      10,
			PendingEvents:  5,
			LastEventAt:    &lastEvent,
			LastFlushAt:    &lastFlush,
			Quota: &model.DOStateQuota{
				RequestsToday:       42,
				QuotaLevel:          "normal",
				ModeLabel:           "standard",
				RemoteEnabled:       true,
				BatchSizeSuggestion: 100,
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot with quota failed: %v", err)
	}
	tx.Commit()

	var count int
	sqlDB.QueryRow("SELECT COUNT(*) FROM do_state_snapshots").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 snapshot, got %d", count)
	}
}

func TestInsertDOStateSnapshot_WithEnvSnapshot(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    50,
			TotalDownloads: 40,
			TotalSuccess:   35,
			TotalFail:      5,
			PendingEvents:  2,
			EnvSnapshot: &model.DOStateEnvSnapshot{
				MaxBatchEvents: "500",
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot with env snapshot failed: %v", err)
	}
	tx.Commit()
}

func TestInsertDOStateSnapshot_MinimalNoBranches(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: 0, // Will default to time.Now().UnixMilli()
		DOState: model.DOState{
			OK: true,
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot minimal failed: %v", err)
	}
	tx.Commit()
}

func TestInsertDOStateSnapshot_QuotaRemoteDisabled(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK: true,
			Quota: &model.DOStateQuota{
				RequestsToday:       10,
				QuotaLevel:          "low",
				ModeLabel:           "conservative",
				RemoteEnabled:       false,
				BatchSizeSuggestion: 50,
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot quota remote disabled failed: %v", err)
	}
	tx.Commit()
}

// ──────────────────────────────────────────────────────────────────────────────
// IngestBatchHandler — full batch with timebuckets and DO state
// ──────────────────────────────────────────────────────────────────────────────

func TestIngestBatchHandler_FullBatchWithTimeBuckets(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	lastEvent := int64(1700000000000)
	batch := model.OracleBatch{
		BatchID:     "full-batch-" + time.Now().Format("150405.000"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
				BucketEnd:   time.Now().UTC().Format(time.RFC3339),
				Totals: model.BucketTotals{
					TotalEvents:    10,
					TotalDownloads: 8,
					TotalSuccess:   7,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"completed": 7, "error": 1},
					ByType:      map[string]int64{"document": 5, "image": 3},
					ByBrowser:   map[string]int64{"chrome": 8},
					ByOs:        map[string]int64{"windows": 8},
					ByExtVer:    map[string]int64{"1.0.0": 8},
					ByLanguage:  map[string]int64{"en": 8},
					ByCountry:   map[string]int64{"US": 8},
					ByErrorType: map[string]int64{"network": 1},
				},
			},
		},
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    100,
			TotalDownloads: 80,
			TotalSuccess:   70,
			TotalFail:      10,
			PendingEvents:  0,
			LastEventAt:    &lastEvent,
			Quota: &model.DOStateQuota{
				RequestsToday:       5,
				QuotaLevel:          "normal",
				ModeLabel:           "standard",
				RemoteEnabled:       true,
				BatchSizeSuggestion: 100,
			},
			EnvSnapshot: &model.DOStateEnvSnapshot{
				MaxBatchEvents: "1000",
			},
		},
	}
	bodyBytes, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify batch was stored
	var count int
	sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count)
	if count != 1 {
		t.Fatalf("expected batch to be stored, got count=%d", count)
	}

	// Verify hourly data was inserted
	var hourlyCount int
	sqlDB.QueryRow(`SELECT COUNT(*) FROM downloads_hourly WHERE batch_id = ?`, batch.BatchID).Scan(&hourlyCount)
	if hourlyCount < 1 {
		t.Fatalf("expected at least 1 hourly row, got %d", hourlyCount)
	}

	// Verify DO state snapshot was captured
	var doCount int
	sqlDB.QueryRow("SELECT COUNT(*) FROM do_state_snapshots").Scan(&doCount)
	if doCount < 1 {
		t.Fatalf("expected at least 1 DO state snapshot, got %d", doCount)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// cleanupOldFailureLogs
// ──────────────────────────────────────────────────────────────────────────────

func TestCleanupOldFailureLogs_NoOldLogs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	err := cleanupOldFailureLogs(context.Background(), tx, 30)
	if err != nil {
		t.Fatalf("cleanupOldFailureLogs failed: %v", err)
	}
	tx.Commit()
}

func TestCleanupOldFailureLogs_WithOldLogs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	// Insert old failure log (30+ days ago)
	oldTimestamp := time.Now().Add(-31 * 24 * time.Hour).UnixMilli()
	_, _ = sqlDB.Exec(`INSERT INTO pipeline_failure_logs (source, stage, error_code, error_detail, sample_count, occurred_at, batch_id, delivery_id)
		VALUES ('test', 'ingest', 'timeout', 'old log', 1, ?, 'old-batch', 'old-del')`, oldTimestamp)
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	err := cleanupOldFailureLogs(context.Background(), tx, 30)
	if err != nil {
		t.Fatalf("cleanupOldFailureLogs failed: %v", err)
	}
	tx.Commit()
}

// ──────────────────────────────────────────────────────────────────────────────
// registerSchemaPaths
// ──────────────────────────────────────────────────────────────────────────────

func TestRegisterSchemaPaths_Basic(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	tx, _ := sqlDB.Begin()
	defer tx.Rollback()
	payload := map[string]interface{}{
		"level1": map[string]interface{}{
			"level2": "value",
		},
		"array": []interface{}{1, 2, 3},
	}
	err := registerSchemaPaths(context.Background(), tx, payload)
	if err != nil {
		t.Fatalf("registerSchemaPaths failed: %v", err)
	}
	tx.Commit()
}

func TestRegisterSchemaPaths_IdempotentWhenPathAlreadyExists(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx1, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx1 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx1, map[string]interface{}{
		"existing": "value",
	}); err != nil {
		_ = tx1.Rollback()
		t.Fatalf("first registerSchemaPaths failed: %v", err)
	}
	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1 failed: %v", err)
	}

	var firstSeen, lastSeen int64
	var sampleType string
	if err := sqlDB.QueryRow(
		`SELECT first_seen_at, last_seen_at, sample_type
		 FROM cf_schema_registry
		 WHERE json_path = 'existing'`,
	).Scan(&firstSeen, &lastSeen, &sampleType); err != nil {
		t.Fatalf("failed to load initial schema row: %v", err)
	}
	if sampleType != "string" {
		t.Fatalf("expected initial sample type string, got %q", sampleType)
	}

	time.Sleep(3 * time.Millisecond)

	tx2, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx2 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx2, map[string]interface{}{
		"existing": float64(12),
	}); err != nil {
		_ = tx2.Rollback()
		t.Fatalf("second registerSchemaPaths failed: %v", err)
	}
	if err := tx2.Commit(); err != nil {
		t.Fatalf("commit tx2 failed: %v", err)
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'existing'`).Scan(&count); err != nil {
		t.Fatalf("failed to count schema rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected a single schema row, got %d", count)
	}

	var updatedLastSeen int64
	var updatedSampleType string
	if err := sqlDB.QueryRow(
		`SELECT last_seen_at, sample_type FROM cf_schema_registry WHERE json_path = 'existing'`,
	).Scan(&updatedLastSeen, &updatedSampleType); err != nil {
		t.Fatalf("failed to load updated schema row: %v", err)
	}
	if updatedSampleType != "number" {
		t.Fatalf("expected updated sample type number, got %q", updatedSampleType)
	}
	if updatedLastSeen < lastSeen {
		t.Fatalf("expected last_seen_at to be updated, before=%d after=%d", lastSeen, updatedLastSeen)
	}
}

func TestRegisterSchemaPaths_ConcurrentSamePath_NoUniqueConstraintError(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	const workers = 8
	start := make(chan struct{})
	errCh := make(chan error, workers)
	payload := map[string]interface{}{
		"concurrent": map[string]interface{}{
			"path": true,
		},
	}

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			tx, err := sqlDB.BeginTx(context.Background(), nil)
			if err != nil {
				errCh <- err
				return
			}
			if err := registerSchemaPaths(context.Background(), tx, payload); err != nil {
				_ = tx.Rollback()
				errCh <- err
				return
			}
			errCh <- tx.Commit()
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("unexpected concurrent registerSchemaPaths error: %v", err)
		}
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'concurrent.path'`).Scan(&count); err != nil {
		t.Fatalf("failed to count schema rows after concurrency run: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly one schema row for concurrent path, got %d", count)
	}
}

func TestRegisterSchemaPaths_NewCountTracksInsertedRowsOnly(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx1, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx1 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx1, map[string]interface{}{
		"existing": "value",
	}); err != nil {
		_ = tx1.Rollback()
		t.Fatalf("seed registerSchemaPaths failed: %v", err)
	}
	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1 failed: %v", err)
	}

	if _, err := sqlDB.Exec(`DELETE FROM system_alerts`); err != nil {
		t.Fatalf("failed to clear system_alerts: %v", err)
	}

	tx2, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx2 failed: %v", err)
	}
	if err := registerSchemaPaths(context.Background(), tx2, map[string]interface{}{
		"existing": "updated",
		"newField": map[string]interface{}{
			"enabled": true,
		},
	}); err != nil {
		_ = tx2.Rollback()
		t.Fatalf("second registerSchemaPaths failed: %v", err)
	}
	if err := tx2.Commit(); err != nil {
		t.Fatalf("commit tx2 failed: %v", err)
	}

	var payloadRaw string
	if err := sqlDB.QueryRow(
		`SELECT payload_json FROM system_alerts
		 WHERE alert_type = 'schema_drift_detected'
		 ORDER BY id DESC
		 LIMIT 1`,
	).Scan(&payloadRaw); err != nil {
		t.Fatalf("failed to load schema drift alert payload: %v", err)
	}

	var alertPayload map[string]interface{}
	if err := json.Unmarshal([]byte(payloadRaw), &alertPayload); err != nil {
		t.Fatalf("failed to parse schema drift alert payload: %v", err)
	}
	newPaths, ok := alertPayload["newPaths"].(float64)
	if !ok {
		t.Fatalf("expected numeric newPaths field, got %#v", alertPayload["newPaths"])
	}
	if int64(newPaths) != 1 {
		t.Fatalf("expected newPaths=1, got %v", newPaths)
	}
}
