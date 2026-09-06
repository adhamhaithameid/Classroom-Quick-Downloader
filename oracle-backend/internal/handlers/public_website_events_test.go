package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicWebsiteEventsHandler_IngestsAndAggregates(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	body := `{
		"schemaVersion":"1",
		"sessionId":"session-abc",
		"pagePath":"/overview",
		"events":[
			{"eventId":"evt-000001","eventType":"cta","action":"install_click","placement":"hero_install"},
			{"eventId":"evt-000002","eventType":"map","action":"map_yes","placement":"map_prompt_yes"},
			{"eventId":"evt-000001","eventType":"cta","action":"install_click","placement":"hero_install"},
			{"eventId":"evt-000003","eventType":"cta","action":"unknown_action","placement":"hero_install"}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(body))
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteEventsHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var response struct {
		OK            bool `json:"ok"`
		AcceptedCount int  `json:"acceptedCount"`
		RejectedCount int  `json:"rejectedCount"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !response.OK {
		t.Fatal("expected ok=true")
	}
	if response.AcceptedCount != 2 {
		t.Fatalf("expected acceptedCount=2, got %d", response.AcceptedCount)
	}
	if response.RejectedCount != 2 {
		t.Fatalf("expected rejectedCount=2, got %d", response.RejectedCount)
	}

	var installCount int64
	if err := sqlDB.QueryRow(
		`SELECT count FROM website_event_daily WHERE event_type = 'cta' AND action = 'install_click' AND placement = 'hero_install'`,
	).Scan(&installCount); err != nil {
		t.Fatalf("query install_click aggregate failed: %v", err)
	}
	if installCount != 1 {
		t.Fatalf("expected install_click count=1, got %d", installCount)
	}

	var mapYesCount int64
	if err := sqlDB.QueryRow(
		`SELECT count FROM website_event_daily WHERE event_type = 'map' AND action = 'map_yes' AND placement = 'map_prompt_yes'`,
	).Scan(&mapYesCount); err != nil {
		t.Fatalf("query map_yes aggregate failed: %v", err)
	}
	if mapYesCount != 1 {
		t.Fatalf("expected map_yes count=1, got %d", mapYesCount)
	}

	var rawEventsCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_events_raw`).Scan(&rawEventsCount); err != nil {
		t.Fatalf("query website_events_raw failed: %v", err)
	}
	if rawEventsCount != 2 {
		t.Fatalf("expected website_events_raw count=2, got %d", rawEventsCount)
	}

	var websiteToOracleCount int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM website_sync_batches WHERE direction = ? AND triggered_by = ?`,
		websiteSyncDirectionWebsiteToOracle,
		"website_events_ingest",
	).Scan(&websiteToOracleCount); err != nil {
		t.Fatalf("query website_sync_batches failed: %v", err)
	}
	if websiteToOracleCount != 1 {
		t.Fatalf("expected one website_events_ingest batch, got %d", websiteToOracleCount)
	}
}

func TestPublicWebsiteEventsHandler_RejectsInvalidPayload(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(`{"schemaVersion":"1","sessionId":"x","pagePath":"/","events":[]}`))
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteEventsHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty events, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		Error         struct {
			Code      string `json:"code"`
			Retryable bool   `json:"retryable"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error envelope failed: %v", err)
	}
	if payload.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %q", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.OK {
		t.Fatal("expected ok=false in error envelope")
	}
	if payload.Error.Code != "events_required" {
		t.Fatalf("expected error code events_required, got %q", payload.Error.Code)
	}
	if payload.Error.Retryable {
		t.Fatal("expected retryable=false for validation error")
	}
}

func TestPublicWebsiteEventsHandler_FailsClosedWhenDatabaseMissing(t *testing.T) {
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(`{"schemaVersion":"1","sessionId":"x","pagePath":"/","events":[{"eventId":"evt-900001","eventType":"cta","action":"install_click","placement":"hero_install"}]}`))
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteEventsHandler(nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when database is unavailable, got %d: %s", rr.Code, rr.Body.String())
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
	if payload.OK {
		t.Fatal("expected ok=false when database is unavailable")
	}
	if payload.Error.Code != "database_unavailable" {
		t.Fatalf("expected database_unavailable error code, got %q", payload.Error.Code)
	}
}

func TestPublicWebsiteEventsHandler_RejectsMissingSchemaVersion(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(`{"sessionId":"x","pagePath":"/","events":[{"eventId":"evt-1","eventType":"cta","action":"install_click","placement":"hero_install"}]}`))
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteEventsHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing schemaVersion, got %d: %s", rr.Code, rr.Body.String())
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
		t.Fatalf("expected schemaVersion=%s, got %q", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.Error.Code != "schema_version_required" {
		t.Fatalf("expected error code schema_version_required, got %q", payload.Error.Code)
	}
}

func TestPublicWebsiteEventsHandler_RejectsDisallowedOriginWithStructuredError(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(`{"schemaVersion":"1","sessionId":"x","pagePath":"/","events":[{"eventId":"evt-100001","eventType":"cta","action":"install_click","placement":"hero_install"}]}`))
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteEventsHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for disallowed origin, got %d: %s", rr.Code, rr.Body.String())
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
		t.Fatalf("expected schemaVersion=%s, got %q", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.Error.Code != "origin_not_allowed" {
		t.Fatalf("expected error code origin_not_allowed, got %q", payload.Error.Code)
	}
}
