package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

func TestAcceptance_GivenNoData_WhenSummary_ThenZeros(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["totalDownloads"].(float64) != 0 {
		t.Fatalf("expected 0 downloads for empty system")
	}
}

func TestAcceptance_GivenBatch_WhenIngested_ThenSummaryReflects(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	batch := model.OracleBatch{
		BatchID: "accept-1-" + time.Now().Format("150405"), GeneratedAt: time.Now().UnixMilli(),
		TimeZone: "UTC",
		Summary: model.BatchSummary{
			Totals:   model.BucketTotals{TotalEvents: 10, TotalDownloads: 10, TotalSuccess: 8, TotalFail: 2},
			Browsers: map[string]int64{"chrome": 10}, Os: map[string]int64{"windows": 10},
			Countries: map[string]int64{"us": 10}, Languages: map[string]int64{"en": 10},
			Versions: map[string]int64{"1.0.0": 10}, Types: map[string]int64{"pdf": 10},
			TopBrowser: "chrome", TopOs: "windows", TopCountry: "us", TopType: "pdf",
		},
		TimeBuckets: []model.TimeBucket{}, DOState: model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "test-secret")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d", rr.Code)
	}

	sReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	sRR := httptest.NewRecorder()
	mux.ServeHTTP(sRR, sReq)
	if sRR.Code != http.StatusOK {
		t.Fatalf("summary: expected 200, got %d: %s", sRR.Code, sRR.Body.String())
	}
	var s map[string]interface{}
	json.Unmarshal(sRR.Body.Bytes(), &s)
	td, _ := s["totalDownloads"].(float64)
	if td < 1 {
		// Also check nested totals
		if totals, ok := s["totals"].(map[string]interface{}); ok {
			if nested, _ := totals["totalDownloads"].(float64); nested >= 1 {
				return // Data is present in nested totals
			}
		}
		t.Fatalf("expected totalDownloads>=1 after ingest, got totalDownloads=%v, full response: %s", td, sRR.Body.String())
	}
}

func TestAcceptance_GivenNoSecret_WhenIngest_ThenRejected(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch",
		strings.NewReader(`{"batchId":"unauth","timeZone":"UTC"}`))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestAcceptance_GivenDuplicate_WhenIngestedTwice_ThenIdempotent(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	batch := model.OracleBatch{
		BatchID: "idempotent-accept", GeneratedAt: time.Now().UnixMilli(), TimeZone: "UTC",
		Summary:     model.BatchSummary{Totals: model.BucketTotals{TotalEvents: 5, TotalDownloads: 5, TotalSuccess: 5}},
		TimeBuckets: []model.TimeBucket{}, DOState: model.DOState{OK: true},
	}
	body, _ := json.Marshal(batch)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(body)))
		req.Header.Set("X-DO-SECRET", "test-secret")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("ingest %d: expected 200, got %d", i+1, rr.Code)
		}
	}
	var count int
	sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = 'idempotent-accept'`).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 row, got %d", count)
	}
}

func TestAcceptance_GivenFeatureFlags_ThenDefaultsPresent(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/flags", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	flags, _ := resp["flags"].([]interface{})
	if len(flags) < 3 {
		t.Fatalf("expected >=3 flags, got %d", len(flags))
	}
}

func TestAcceptance_GivenHealthCheck_ThenOK(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	for _, path := range []string{"/health", "/health/api", "/health/db"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d", path, rr.Code)
		}
	}
}

func TestAcceptance_GivenCSVExport_ThenCorrectContentType(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?format=csv&range=all&granularity=day", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/csv" {
		t.Fatalf("expected text/csv, got %q", ct)
	}
}
