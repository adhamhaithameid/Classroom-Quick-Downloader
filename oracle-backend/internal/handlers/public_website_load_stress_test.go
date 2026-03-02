package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

type websiteEventBatchPayload struct {
	SchemaVersion string                        `json:"schemaVersion"`
	SessionID string                        `json:"sessionId"`
	PagePath  string                        `json:"pagePath"`
	Events    []publicWebsiteEventBodyEntry `json:"events"`
}

type publicWebsiteEventBodyEntry struct {
	EventID   string `json:"eventId"`
	EventType string `json:"eventType"`
	Action    string `json:"action"`
	Placement string `json:"placement"`
}

func buildWebsiteEventBatch(prefix string, count int) websiteEventBatchPayload {
	events := make([]publicWebsiteEventBodyEntry, 0, count)
	for i := 0; i < count; i++ {
		action := "install_click"
		eventType := "cta"
		placement := "hero_install"
		switch i % 4 {
		case 1:
			action = "download_click"
			placement = "hero_download"
		case 2:
			action = "map_yes"
			eventType = "map"
			placement = "map_prompt_yes"
		case 3:
			action = "map_no"
			eventType = "map"
			placement = "map_prompt_no"
		}
		events = append(events, publicWebsiteEventBodyEntry{
			EventID:   fmt.Sprintf("%s-%06d", prefix, i),
			EventType: eventType,
			Action:    action,
			Placement: placement,
		})
	}
	return websiteEventBatchPayload{
		SchemaVersion: publicWebsiteSchemaVersion,
		SessionID: "load-session",
		PagePath:  "/overview",
		Events:    events,
	}
}

func postWebsiteEventsBatch(t *testing.T, h http.HandlerFunc, payload websiteEventBatchPayload) publicWebsiteEventsIngestResponse {
	t.Helper()
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewReader(bodyBytes))
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
		t.Fatalf("unmarshal response failed: %v", err)
	}
	return response
}

func TestLoad_PublicWebsiteEventsHandler_BulkAggregate(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")
	h := PublicWebsiteEventsHandler(sqlDB)

	totalAccepted := 0
	for i := 0; i < 40; i++ {
		payload := buildWebsiteEventBatch(fmt.Sprintf("bulk-%03d", i), 64)
		response := postWebsiteEventsBatch(t, h, payload)
		totalAccepted += response.AcceptedCount
		if response.RejectedCount != 0 {
			t.Fatalf("expected no rejected events in load test, got %d", response.RejectedCount)
		}
	}

	if totalAccepted != 2560 {
		t.Fatalf("expected accepted=2560, got %d", totalAccepted)
	}

	var aggregatedTotal int64
	if err := sqlDB.QueryRow(`SELECT SUM(count) FROM website_event_daily`).Scan(&aggregatedTotal); err != nil {
		t.Fatalf("sum website_event_daily failed: %v", err)
	}
	if aggregatedTotal != int64(totalAccepted) {
		t.Fatalf("expected aggregate sum=%d, got %d", totalAccepted, aggregatedTotal)
	}
}

func TestStress_PublicWebsiteEventsHandler_ConcurrentBatches(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")
	h := PublicWebsiteEventsHandler(sqlDB)

	const workers = 4
	const requestsPerWorker = 6
	const eventsPerRequest = 16

	var wg sync.WaitGroup
	errCh := make(chan error, workers*requestsPerWorker)
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < requestsPerWorker; i++ {
				payload := buildWebsiteEventBatch(fmt.Sprintf("stress-w%d-r%d", workerID, i), eventsPerRequest)
				bodyBytes, err := json.Marshal(payload)
				if err != nil {
					errCh <- err
					return
				}

				req := httptest.NewRequest(http.MethodPost, "/api/public/website/events", bytes.NewReader(bodyBytes))
				req.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
				req.Header.Set("X-Requested-With", "XMLHttpRequest")
				req.Header.Set("Content-Type", "application/json")
				rr := httptest.NewRecorder()
				h.ServeHTTP(rr, req)
				if rr.Code != http.StatusOK {
					errCh <- fmt.Errorf("worker=%d request=%d status=%d body=%s", workerID, i, rr.Code, rr.Body.String())
					return
				}
			}
		}(w)
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("stress failure: %v", err)
		}
	}

	var aggregatedTotal int64
	if err := sqlDB.QueryRow(`SELECT SUM(count) FROM website_event_daily`).Scan(&aggregatedTotal); err != nil {
		t.Fatalf("sum website_event_daily failed: %v", err)
	}

	expected := int64(workers * requestsPerWorker * eventsPerRequest)
	if aggregatedTotal != expected {
		t.Fatalf("expected stress aggregate sum=%d, got %d", expected, aggregatedTotal)
	}
}
