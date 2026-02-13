package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFunctionalSmoke_CoreEndpointsReturn200(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	routes := []string{
		"/health",
		"/health/api",
		"/health/db",
		"/api/stats/summary",
		"/api/admin/flags",
		"/api/admin/alerts",
		"/api/admin/oracle-logs",
		"/api/admin/creative/designs",
		"/api/admin/creative/emails",
		"/api/admin/newsletter/subscribers",
	}

	for _, route := range routes {
		t.Run(route, func(t *testing.T) {
			// Act
			req := httptest.NewRequest(http.MethodGet, route, nil)
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			// Assert
			if rr.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestFunctionalRegression_IngestIsIdempotentByBatchID(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	payload := `{
		"batchId":"smoke-idempotent-1",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{"totals":{"totalEvents":3,"totalDownloads":3,"totalSuccess":2,"totalFail":1}},
		"timeBuckets":[],
		"doState":{"ok":true}
	}`

	// Act: ingest same payload twice
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-DO-SECRET", "test-secret")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("ingest #%d expected 200, got %d: %s", i+1, rr.Code, rr.Body.String())
		}
	}

	// Assert: DB still has one batch row
	var batchRows int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = 'smoke-idempotent-1'`).Scan(&batchRows); err != nil {
		t.Fatalf("failed to count batches: %v", err)
	}
	if batchRows != 1 {
		t.Fatalf("expected 1 batch row for duplicate ingest, got %d", batchRows)
	}
}

func TestFunctionalRegression_NewsletterUpsertNormalizesEmailAndUpdatesInPlace(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	firstUpsert := map[string]any{
		"data": map[string]any{
			"email": "USER@Example.COM",
			"name":  "First Name",
		},
	}
	secondUpsert := map[string]any{
		"data": map[string]any{
			"email": "user@example.com",
			"name":  "Updated Name",
		},
	}

	// Act: first upsert
	body, _ := json.Marshal(firstUpsert)
	firstReq := httptest.NewRequest(http.MethodPost, "/api/admin/newsletter/subscribers/upsert", bytes.NewReader(body))
	firstReq.Header.Set("Content-Type", "application/json")
	firstRR := httptest.NewRecorder()
	mux.ServeHTTP(firstRR, firstReq)
	if firstRR.Code != http.StatusOK {
		t.Fatalf("first upsert expected 200, got %d: %s", firstRR.Code, firstRR.Body.String())
	}

	// Act: second upsert for the same normalized email
	body, _ = json.Marshal(secondUpsert)
	secondReq := httptest.NewRequest(http.MethodPost, "/api/admin/newsletter/subscribers/upsert", bytes.NewReader(body))
	secondReq.Header.Set("Content-Type", "application/json")
	secondRR := httptest.NewRecorder()
	mux.ServeHTTP(secondRR, secondReq)
	if secondRR.Code != http.StatusOK {
		t.Fatalf("second upsert expected 200, got %d: %s", secondRR.Code, secondRR.Body.String())
	}

	// Assert: list returns one normalized record with updated data
	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/newsletter/subscribers", nil)
	listRR := httptest.NewRecorder()
	mux.ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list expected 200, got %d: %s", listRR.Code, listRR.Body.String())
	}

	var listPayload struct {
		OK      bool `json:"ok"`
		Records []struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		} `json:"records"`
	}
	if err := json.Unmarshal(listRR.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("failed to parse list payload: %v", err)
	}
	if !listPayload.OK || len(listPayload.Records) != 1 {
		t.Fatalf("expected one subscriber record, got payload: %s", listRR.Body.String())
	}
	rec := listPayload.Records[0]
	if rec.RecordKey != "user@example.com" {
		t.Fatalf("expected normalized recordKey=user@example.com, got %q", rec.RecordKey)
	}
	if gotEmail, _ := rec.Data["email"].(string); gotEmail != "user@example.com" {
		t.Fatalf("expected normalized email in data, got %q", gotEmail)
	}
	if gotName, _ := rec.Data["name"].(string); gotName != "Updated Name" {
		t.Fatalf("expected latest name to win update, got %q", gotName)
	}
}
