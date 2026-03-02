package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReliability_PublicWebsiteEventsHandler_DeduplicatesRetryBatch(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")
	h := PublicWebsiteEventsHandler(sqlDB)

	payload := `{
		"schemaVersion":"1",
		"sessionId":"retry-session",
		"pagePath":"/overview",
		"events":[
			{"eventId":"retry-event-000001","eventType":"cta","action":"install_click","placement":"hero_install"},
			{"eventId":"retry-event-000002","eventType":"map","action":"map_yes","placement":"map_prompt_yes"}
		]
	}`

	req1 := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(payload))
	req1.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	req1.Header.Set("X-Requested-With", "XMLHttpRequest")
	req1.Header.Set("Content-Type", "application/json")
	rr1 := httptest.NewRecorder()
	h.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("first ingest expected 200, got %d: %s", rr1.Code, rr1.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(payload))
	req2.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	req2.Header.Set("X-Requested-With", "XMLHttpRequest")
	req2.Header.Set("Content-Type", "application/json")
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("second ingest expected 200, got %d: %s", rr2.Code, rr2.Body.String())
	}

	var firstResp, secondResp publicWebsiteEventsIngestResponse
	if err := json.Unmarshal(rr1.Body.Bytes(), &firstResp); err != nil {
		t.Fatalf("decode first response failed: %v", err)
	}
	if err := json.Unmarshal(rr2.Body.Bytes(), &secondResp); err != nil {
		t.Fatalf("decode second response failed: %v", err)
	}

	if firstResp.AcceptedCount != 2 || firstResp.RejectedCount != 0 {
		t.Fatalf("unexpected first response: %+v", firstResp)
	}
	if secondResp.AcceptedCount != 0 || secondResp.RejectedCount != 2 {
		t.Fatalf("unexpected second response: %+v", secondResp)
	}

	var total int64
	if err := sqlDB.QueryRow(`SELECT SUM(count) FROM website_event_daily`).Scan(&total); err != nil {
		t.Fatalf("sum website_event_daily failed: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected deduped aggregate total=2, got %d", total)
	}
}

func TestReliability_PublicWebsiteEventsHandler_PartialAcceptDoesNotAbortBatch(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")
	h := PublicWebsiteEventsHandler(sqlDB)

	payload := `{
		"schemaVersion":"1",
		"sessionId":"partial-session",
		"pagePath":"/overview",
		"events":[
			{"eventId":"partial-evt-0001","eventType":"cta","action":"install_click","placement":"hero_install"},
			{"eventId":"bad-event-id","eventType":"cta","action":"unknown","placement":"hero_install"},
			{"eventId":"partial-evt-0002","eventType":"map","action":"map_no","placement":"map_prompt_no"},
			{"eventId":"partial-evt-0003","eventType":"map","action":"map_yes","placement":"<script>alert(1)</script>"}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewBufferString(payload))
	req.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var response publicWebsiteEventsIngestResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}

	if response.AcceptedCount != 3 || response.RejectedCount != 1 {
		t.Fatalf("expected partial accept (3/1), got %+v", response)
	}

	var unknownPlacementCount int64
	if err := sqlDB.QueryRow(
		`SELECT count FROM website_event_daily WHERE event_type = 'map' AND action = 'map_yes' AND placement = 'unknown'`,
	).Scan(&unknownPlacementCount); err != nil {
		t.Fatalf("query unknown placement aggregate failed: %v", err)
	}
	if unknownPlacementCount != 1 {
		t.Fatalf("expected unknown placement count=1, got %d", unknownPlacementCount)
	}
}
