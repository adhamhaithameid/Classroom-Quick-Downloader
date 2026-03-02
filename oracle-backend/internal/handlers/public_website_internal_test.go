package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInternalWebsiteEventsBatchHandler_IngestsBatch(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	body := `{
		"schemaVersion":"1",
		"batchId":"ws-batch-0001",
		"generatedAtUtc":1771800000000,
		"attempt":1,
		"sessionId":"session-a",
		"pagePath":"/overview",
		"events":[
			{"eventId":"evt-100001","eventType":"cta","action":"install_click","placement":"hero_install"},
			{"eventId":"evt-100002","eventType":"map","action":"map_yes","placement":"map_prompt_yes"}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var response publicWebsiteEventsBatchIngestResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !response.OK {
		t.Fatal("expected ok=true")
	}
	if response.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %s", publicWebsiteSchemaVersion, response.SchemaVersion)
	}
	if response.BatchID != "ws-batch-0001" {
		t.Fatalf("expected batchId ws-batch-0001, got %s", response.BatchID)
	}

	var total int64
	if err := sqlDB.QueryRow(`SELECT SUM(count) FROM website_event_daily`).Scan(&total); err != nil {
		t.Fatalf("sum website_event_daily failed: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected aggregate count=2, got %d", total)
	}

	var rawCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_events_raw`).Scan(&rawCount); err != nil {
		t.Fatalf("count website_events_raw failed: %v", err)
	}
	if rawCount != 2 {
		t.Fatalf("expected website_events_raw count=2, got %d", rawCount)
	}

	var batchCount int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM website_sync_batches WHERE triggered_by = ? AND batch_id = ?`,
		"worker_website_events_batch",
		"ws-batch-0001",
	).Scan(&batchCount); err != nil {
		t.Fatalf("query website_sync_batches failed: %v", err)
	}
	if batchCount != 1 {
		t.Fatalf("expected one worker_website_events_batch row, got %d", batchCount)
	}
}

func TestInternalWebsiteEventsBatchHandler_FailsClosedWhenDatabaseMissing(t *testing.T) {
	handler := InternalWebsiteEventsBatchHandler(nil, "shared-secret")

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBufferString(`{"schemaVersion":"1","batchId":"x","generatedAtUtc":1771800000000,"attempt":1,"sessionId":"s","pagePath":"/","events":[{"eventId":"evt-300001","eventType":"cta","action":"install_click","placement":"hero_install"}]}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if payload.Error.Code != "database_unavailable" {
		t.Fatalf("expected database_unavailable, got %q", payload.Error.Code)
	}
}

func TestInternalWebsiteEventsBatchHandler_RejectsUnauthorized(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBufferString(`{"schemaVersion":"1","batchId":"x","attempt":1,"events":[]}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "wrong-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		Error         struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error envelope failed: %v", err)
	}
	if payload.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.OK {
		t.Fatal("expected ok=false for unauthorized response")
	}
	if payload.Error.Code != "unauthorized" {
		t.Fatalf("expected error code unauthorized, got %s", payload.Error.Code)
	}
}

func TestInternalWebsiteEventsBatchHandler_RejectsSchemaVersionWithStructuredError(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBufferString(`{
		"schemaVersion":"2",
		"batchId":"ws-batch-0002",
		"generatedAtUtc":1771800000000,
		"attempt":1,
		"sessionId":"session-a",
		"pagePath":"/overview",
		"events":[{"eventId":"evt-200001","eventType":"cta","action":"install_click","placement":"hero_install"}]
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		Error         struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error envelope failed: %v", err)
	}
	if payload.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.Error.Code != "schema_version_required" {
		t.Fatalf("expected error code schema_version_required, got %s", payload.Error.Code)
	}
}

func TestInternalWebsiteEventsBatchHandler_RejectsMissingGeneratedAtUtc(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBufferString(`{
		"schemaVersion":"1",
		"batchId":"ws-batch-0003",
		"generatedAtUtc":0,
		"attempt":1,
		"sessionId":"session-a",
		"pagePath":"/overview",
		"events":[{"eventId":"evt-200002","eventType":"cta","action":"install_click","placement":"hero_install"}]
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		Error         struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error envelope failed: %v", err)
	}
	if payload.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.OK {
		t.Fatal("expected ok=false for invalid generatedAtUtc response")
	}
	if payload.Error.Code != "generated_at_utc_required" {
		t.Fatalf("expected error code generated_at_utc_required, got %s", payload.Error.Code)
	}
}

func TestInternalWebsiteEventsBatchHandler_VerifiesChecksumAndRowCount(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	events := []publicWebsiteEventIngestEvent{
		{EventID: "evt-310001", EventType: "cta", Action: "install_click", Placement: "hero_install"},
		{EventID: "evt-310002", EventType: "map", Action: "map_yes", Placement: "map_prompt_yes"},
	}
	expectedCount := len(events)
	checksum := computeWebsiteEventsBatchChecksum(
		"ws-batch-checksum-1",
		1771800000000,
		"session-a",
		"/overview",
		events,
	)
	bodyBytes, err := json.Marshal(publicWebsiteEventsBatchIngestRequest{
		SchemaVersion:  publicWebsiteSchemaVersion,
		BatchID:        "ws-batch-checksum-1",
		BatchChecksum:  checksum,
		ExpectedEvents: &expectedCount,
		GeneratedAtUTC: 1771800000000,
		Attempt:        1,
		SessionID:      "session-a",
		PagePath:       "/overview",
		Events:         events,
	})
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var response publicWebsiteEventsBatchIngestResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if response.ChecksumState != "match" {
		t.Fatalf("expected checksumStatus=match, got %q", response.ChecksumState)
	}
	if response.RowCountState != "match" {
		t.Fatalf("expected rowCountStatus=match, got %q", response.RowCountState)
	}
	if response.Integrity != "ok" {
		t.Fatalf("expected integrityStatus=ok, got %q", response.Integrity)
	}

	var detailsRaw string
	if err := sqlDB.QueryRow(
		`SELECT details_json FROM website_sync_batches WHERE batch_id = ? ORDER BY id DESC LIMIT 1`,
		"ws-batch-checksum-1",
	).Scan(&detailsRaw); err != nil {
		t.Fatalf("query details_json failed: %v", err)
	}
	var details map[string]any
	if err := json.Unmarshal([]byte(detailsRaw), &details); err != nil {
		t.Fatalf("decode details_json failed: %v", err)
	}
	if got := stringFromAny(details["checksumStatus"]); got != "match" {
		t.Fatalf("expected details checksumStatus=match, got %q", got)
	}
	if got := stringFromAny(details["rowCountStatus"]); got != "match" {
		t.Fatalf("expected details rowCountStatus=match, got %q", got)
	}
}

func TestInternalWebsiteEventsBatchHandler_RaisesAlertOnChecksumMismatch(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	handler := InternalWebsiteEventsBatchHandler(sqlDB, "shared-secret")

	events := []publicWebsiteEventIngestEvent{
		{EventID: "evt-320001", EventType: "cta", Action: "install_click", Placement: "hero_install"},
	}
	expectedCount := len(events)
	bodyBytes, err := json.Marshal(publicWebsiteEventsBatchIngestRequest{
		SchemaVersion:  publicWebsiteSchemaVersion,
		BatchID:        "ws-batch-checksum-2",
		BatchChecksum:  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ExpectedEvents: &expectedCount,
		GeneratedAtUTC: 1771801000000,
		Attempt:        1,
		SessionID:      "session-b",
		PagePath:       "/overview",
		Events:         events,
	})
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/internal/website/events/batch", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "shared-secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var response publicWebsiteEventsBatchIngestResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if response.Integrity != "critical" {
		t.Fatalf("expected integrityStatus=critical, got %q", response.Integrity)
	}
	if response.ChecksumState != "mismatch" {
		t.Fatalf("expected checksumStatus=mismatch, got %q", response.ChecksumState)
	}

	var alertCount int64
	err = sqlDB.QueryRow(
		`SELECT COUNT(*) FROM system_alerts WHERE alert_type = ? AND status = 'open'`,
		"website_batch_integrity_mismatch",
	).Scan(&alertCount)
	if err != nil && err != sql.ErrNoRows {
		t.Fatalf("query system_alerts failed: %v", err)
	}
	if alertCount < 1 {
		t.Fatalf("expected website_batch_integrity_mismatch alert to be created")
	}
}
