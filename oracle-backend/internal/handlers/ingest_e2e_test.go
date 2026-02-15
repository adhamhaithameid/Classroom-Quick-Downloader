package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// Full ingest → query lifecycle (E2E within the handler layer)
// ──────────────────────────────────────────────────────────────────────────────

func newE2ETestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "e2e-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func TestE2E_IngestThenSummary(t *testing.T) {
	sqlDB := newE2ETestDB(t)
	defer sqlDB.Close()

	// Arrange — ingest a batch with real data
	now := time.Now().UnixMilli()
	bucketStart := time.Now().UTC().Truncate(time.Hour).Format(time.RFC3339)
	bucketEnd := time.Now().UTC().Truncate(time.Hour).Add(time.Hour).Format(time.RFC3339)

	batch := model.OracleBatch{
		BatchID:     "e2e-summary-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    50,
				TotalDownloads: 40,
				TotalSuccess:   35,
				TotalFail:      5,
			},
			Browsers:     map[string]int64{"chrome": 30, "firefox": 10},
			Os:           map[string]int64{"windows": 25, "macos": 15},
			Countries:    map[string]int64{"us": 20, "gb": 15, "de": 5},
			Languages:    map[string]int64{"en": 35, "de": 5},
			Versions:     map[string]int64{"1.0.0": 30, "1.1.0": 10},
			Types:        map[string]int64{"pdf": 25, "docx": 10, "zip": 5},
			ErrorReasons: map[string]int64{"timeout": 3, "not_found": 2},
			TopBrowser:   "chrome",
			TopOs:        "windows",
			TopCountry:   "us",
			TopType:      "pdf",
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: bucketStart,
				BucketEnd:   bucketEnd,
				Totals: model.BucketTotals{
					TotalEvents:    50,
					TotalDownloads: 40,
					TotalSuccess:   35,
					TotalFail:      5,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": 35, "fail": 5},
					ByType:      map[string]int64{"pdf": 25, "docx": 10, "zip": 5},
					ByBrowser:   map[string]int64{"chrome": 30, "firefox": 10},
					ByOs:        map[string]int64{"windows": 25, "macos": 15},
					ByExtVer:    map[string]int64{"1.0.0": 30, "1.1.0": 10},
					ByLanguage:  map[string]int64{"en": 35, "de": 5},
					ByCountry:   map[string]int64{"us": 20, "gb": 15, "de": 5},
					ByErrorType: map[string]int64{"timeout": 3, "not_found": 2},
				},
			},
		},
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    50,
			TotalDownloads: 40,
			TotalSuccess:   35,
			TotalFail:      5,
		},
		UniqueIps: []string{"1.1.1.1", "8.8.8.8", "::1"},
		Delivery: &model.DeliverySnapshot{
			DeliveryID:     "dlv-e2e-1",
			AcceptedCount:  50,
			StoredCount:    50,
			ForwardedCount: 50,
			CommittedCount: 50,
			CreatedAt:      now,
		},
	}

	// Act — ingest
	ingestHandler := IngestBatchHandler(sqlDB, "test-secret")
	bodyBytes, _ := json.Marshal(batch)
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	ingestReq.Header.Set("X-DO-SECRET", "test-secret")
	ingestRR := httptest.NewRecorder()
	ingestHandler.ServeHTTP(ingestRR, ingestReq)

	if ingestRR.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	// Assert — summary should reflect totals
	summaryReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	summaryRR := httptest.NewRecorder()
	SummaryHandler(sqlDB).ServeHTTP(summaryRR, summaryReq)

	if summaryRR.Code != http.StatusOK {
		t.Fatalf("summary: expected 200, got %d: %s", summaryRR.Code, summaryRR.Body.String())
	}

	var summary map[string]interface{}
	if err := json.Unmarshal(summaryRR.Body.Bytes(), &summary); err != nil {
		t.Fatalf("unmarshal summary: %v", err)
	}
	if summary["ok"] != true {
		t.Fatalf("expected ok=true")
	}
	if summary["totalDownloads"].(float64) != 40 {
		t.Fatalf("expected totalDownloads=40, got %v", summary["totalDownloads"])
	}
}

func TestE2E_IngestThenTimeSeries(t *testing.T) {
	sqlDB := newE2ETestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	bucketStart := time.Now().UTC().Truncate(time.Hour).Format(time.RFC3339)
	bucketEnd := time.Now().UTC().Truncate(time.Hour).Add(time.Hour).Format(time.RFC3339)

	batch := model.OracleBatch{
		BatchID:     "e2e-ts-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    10,
				TotalDownloads: 10,
				TotalSuccess:   8,
				TotalFail:      2,
			},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: bucketStart,
				BucketEnd:   bucketEnd,
				Totals: model.BucketTotals{
					TotalEvents:    10,
					TotalDownloads: 10,
					TotalSuccess:   8,
					TotalFail:      2,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": 8, "fail": 2},
					ByType:      map[string]int64{"pdf": 10},
					ByBrowser:   map[string]int64{"chrome": 10},
					ByOs:        map[string]int64{"windows": 10},
					ByExtVer:    map[string]int64{"1.0.0": 10},
					ByLanguage:  map[string]int64{"en": 10},
					ByCountry:   map[string]int64{"us": 10},
					ByErrorType: map[string]int64{},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}

	ingestHandler := IngestBatchHandler(sqlDB, "secret")
	bodyBytes, _ := json.Marshal(batch)
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	ingestReq.Header.Set("X-DO-SECRET", "secret")
	ingestRR := httptest.NewRecorder()
	ingestHandler.ServeHTTP(ingestRR, ingestReq)

	if ingestRR.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	// Query time series
	today := time.Now().UTC().Format("2006-01-02")
	tsReq := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?from="+today+"&to="+today, nil)
	tsRR := httptest.NewRecorder()
	TimeSeriesHandler(sqlDB).ServeHTTP(tsRR, tsReq)

	if tsRR.Code != http.StatusOK {
		t.Fatalf("timeseries: expected 200, got %d: %s", tsRR.Code, tsRR.Body.String())
	}

	var ts map[string]interface{}
	if err := json.Unmarshal(tsRR.Body.Bytes(), &ts); err != nil {
		t.Fatalf("unmarshal timeseries: %v", err)
	}
	if ts["ok"] != true {
		t.Fatalf("expected ok=true")
	}
	buckets, ok := ts["buckets"].([]interface{})
	if !ok || len(buckets) == 0 {
		t.Fatalf("expected non-empty buckets from timeseries")
	}
}

func TestE2E_IngestThenExportJSON(t *testing.T) {
	sqlDB := newE2ETestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	bucketStart := time.Now().UTC().Truncate(time.Hour).Format(time.RFC3339)
	bucketEnd := time.Now().UTC().Truncate(time.Hour).Add(time.Hour).Format(time.RFC3339)

	batch := model.OracleBatch{
		BatchID:     "e2e-export-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    5,
				TotalDownloads: 5,
				TotalSuccess:   4,
				TotalFail:      1,
			},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: bucketStart,
				BucketEnd:   bucketEnd,
				Totals: model.BucketTotals{
					TotalEvents:    5,
					TotalDownloads: 5,
					TotalSuccess:   4,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": 4, "fail": 1},
					ByType:      map[string]int64{"pdf": 5},
					ByBrowser:   map[string]int64{"chrome": 5},
					ByOs:        map[string]int64{"windows": 5},
					ByExtVer:    map[string]int64{"1.0.0": 5},
					ByLanguage:  map[string]int64{"en": 5},
					ByCountry:   map[string]int64{"us": 5},
					ByErrorType: map[string]int64{},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}

	ingestHandler := IngestBatchHandler(sqlDB, "secret")
	bodyBytes, _ := json.Marshal(batch)
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	ingestReq.Header.Set("X-DO-SECRET", "secret")
	ingestRR := httptest.NewRecorder()
	ingestHandler.ServeHTTP(ingestRR, ingestReq)

	if ingestRR.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	// Export JSON
	exportReq := httptest.NewRequest(http.MethodGet, "/api/stats/export?format=json&range=all&granularity=hour", nil)
	exportRR := httptest.NewRecorder()
	ExportHandler(sqlDB).ServeHTTP(exportRR, exportReq)

	if exportRR.Code != http.StatusOK {
		t.Fatalf("export: expected 200, got %d: %s", exportRR.Code, exportRR.Body.String())
	}
	if ct := exportRR.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %q", ct)
	}
}

func TestE2E_IngestThenPipelineMetrics(t *testing.T) {
	sqlDB := newE2ETestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	batch := model.OracleBatch{
		BatchID:     "e2e-pipeline-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    20,
				TotalDownloads: 20,
				TotalSuccess:   18,
				TotalFail:      2,
			},
		},
		TimeBuckets: []model.TimeBucket{},
		DOState:     model.DOState{OK: true},
		Delivery: &model.DeliverySnapshot{
			DeliveryID:     "dlv-e2e-pipeline",
			AcceptedCount:  20,
			StoredCount:    20,
			ForwardedCount: 20,
			CommittedCount: 20,
			CreatedAt:      now,
		},
		FailureLogs: []model.FailureLogEntry{
			{
				Key:         "2026-02-11|ingest|validation_error",
				Source:      "cloudflare-do",
				Stage:       "ingest",
				ErrorCode:   "validation_error",
				ErrorDetail: "missing required field",
				SampleCount: 1,
				TSUTC:       now,
			},
		},
	}

	ingestHandler := IngestBatchHandler(sqlDB, "secret")
	bodyBytes, _ := json.Marshal(batch)
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	ingestReq.Header.Set("X-DO-SECRET", "secret")
	ingestRR := httptest.NewRecorder()
	ingestHandler.ServeHTTP(ingestRR, ingestReq)

	if ingestRR.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	// Pipeline metrics should show the delivery
	metricsReq := httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics?days=30&limit=20", nil)
	metricsRR := httptest.NewRecorder()
	PipelineMetricsHandler(sqlDB).ServeHTTP(metricsRR, metricsReq)

	if metricsRR.Code != http.StatusOK {
		t.Fatalf("pipeline metrics: expected 200, got %d: %s", metricsRR.Code, metricsRR.Body.String())
	}

	var metrics pipelineMetricsResponse
	if err := json.Unmarshal(metricsRR.Body.Bytes(), &metrics); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(metrics.Recent) == 0 {
		t.Fatalf("expected recent deliveries")
	}
	if metrics.Totals["accepted"] != 20 {
		t.Fatalf("expected accepted=20, got %v", metrics.Totals["accepted"])
	}

	// Pipeline failures should show the failure log
	failReq := httptest.NewRequest(http.MethodGet, "/api/pipeline/failures?days=30&limit=20", nil)
	failRR := httptest.NewRecorder()
	PipelineFailuresHandler(sqlDB).ServeHTTP(failRR, failReq)

	if failRR.Code != http.StatusOK {
		t.Fatalf("pipeline failures: expected 200, got %d: %s", failRR.Code, failRR.Body.String())
	}

	var failures pipelineFailuresResponse
	if err := json.Unmarshal(failRR.Body.Bytes(), &failures); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(failures.Recent) == 0 {
		t.Fatalf("expected recent failures from ingested failure logs")
	}
}

func TestE2E_IngestThenBreakdown(t *testing.T) {
	sqlDB := newE2ETestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	bucketStart := time.Now().UTC().Truncate(time.Hour).Format(time.RFC3339)
	bucketEnd := time.Now().UTC().Truncate(time.Hour).Add(time.Hour).Format(time.RFC3339)

	batch := model.OracleBatch{
		BatchID:     "e2e-breakdown-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    15,
				TotalDownloads: 15,
				TotalSuccess:   12,
				TotalFail:      3,
			},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: bucketStart,
				BucketEnd:   bucketEnd,
				Totals: model.BucketTotals{
					TotalEvents:    15,
					TotalDownloads: 15,
					TotalSuccess:   12,
					TotalFail:      3,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": 12, "fail": 3},
					ByType:      map[string]int64{"pdf": 10, "docx": 5},
					ByBrowser:   map[string]int64{"chrome": 10, "firefox": 5},
					ByOs:        map[string]int64{"windows": 10, "macos": 5},
					ByExtVer:    map[string]int64{"1.0.0": 15},
					ByLanguage:  map[string]int64{"en": 15},
					ByCountry:   map[string]int64{"us": 10, "gb": 5},
					ByErrorType: map[string]int64{"timeout": 3},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}

	ingestHandler := IngestBatchHandler(sqlDB, "secret")
	bodyBytes, _ := json.Marshal(batch)
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	ingestReq.Header.Set("X-DO-SECRET", "secret")
	ingestRR := httptest.NewRecorder()
	ingestHandler.ServeHTTP(ingestRR, ingestReq)

	if ingestRR.Code != http.StatusOK {
		t.Fatalf("ingest: expected 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	today := time.Now().UTC().Format("2006-01-02")
	bReq := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension=browser&from="+today+"&to="+today, nil)
	bRR := httptest.NewRecorder()
	BreakdownHandler(sqlDB).ServeHTTP(bRR, bReq)

	if bRR.Code != http.StatusOK {
		t.Fatalf("breakdown: expected 200, got %d: %s", bRR.Code, bRR.Body.String())
	}

	var bResp map[string]interface{}
	if err := json.Unmarshal(bRR.Body.Bytes(), &bResp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if bResp["ok"] != true {
		t.Fatalf("expected ok=true")
	}
	if bResp["dimension"].(string) != "browser" {
		t.Fatalf("expected dimension=browser, got %v", bResp["dimension"])
	}
	values, ok := bResp["values"].([]interface{})
	if !ok || len(values) == 0 {
		t.Fatalf("expected non-empty breakdown values")
	}
}
